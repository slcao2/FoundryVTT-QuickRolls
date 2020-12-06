import { debug, error } from './utils/logger.js';
import {
  updateButtonAndHeader,
} from './utils/chat.js';
import {
  moduleName, SETTING_AUTO_ROLL_DAMAGE,
  AUTO_ROLL_DAMAGE_DM_ONLY, AUTO_ROLL_DAMAGE_ALL,
} from './settings.js';
import {
  ownedOnlyByGM, hasVantageFromEvent, ATTACK, VANTAGE, DAMAGE, VERSATILE, FORMULA,
} from './utils/helpers.js';
import { TEMPLATE_PATH_PREFIX } from './utils/templatePathPrefix.js';
import { DEFAULT_RADIX } from './utils/utilities.js';
import AbilityTemplate from './ability-template.js';
import { calculateCrit, rollArbitrary, rollD20 } from './utils/roll.js';
import { isNodeCritical, toggleAllDisabledButtonState } from './utils/domUtils.js';

/**
 * Place an attack roll using an item (weapon, feat, spell, or equipment)
 * Rely upon the d20Roll logic for the core implementation
 *
 * @param {MouseEvent} [event]        An event which triggered this roll, if any
 * @param {ChatMessage} [message]     The chat message event associate with the roll
 * @param {boolean} [vantage]         Whether the attack is being made with advantager or disadvantage
 * @return {Promise<Roll|null>}       A Promise which resolves to the created Roll instance
 */
async function rollAttack({
  event, message, vantage = false, isReroll = false, action,
} = {}) {
  const itemData = this.data.data;
  const actorData = this.actor.data.data;
  const actorFlags = this.actor.data.flags.dnd5e || {};
  const rollFlags = {};
  const htmlFlags = {};
  if (!this.hasAttack) {
    throw new Error('You may not place an Attack Roll with this Item.');
  }
  const rollData = this.getRollData();

  // Define Roll bonuses
  const parts = ['@mod'];
  if ((this.data.type !== 'weapon') || itemData.proficient) {
    parts.push('@prof');
  }

  // Attack Bonus
  if (itemData.attackBonus) parts.push(itemData.attackBonus);
  const actorBonus = actorData?.bonuses?.[itemData.actionType] || {};
  if (actorBonus.attack) parts.push(actorBonus.attack);

  // Ammunition Bonus
  delete this._ammo;
  const { consume } = itemData;
  if (consume?.type === 'ammo') {
    const ammo = this.actor.items.get(consume.target);
    if (ammo?.data) {
      const q = ammo.data.data.quantity;
      const consumeAmount = consume.amount ?? 0;
      if (q && (q - consumeAmount >= 0)) {
        this._ammo = ammo;
        const ammoBonus = ammo.data.data.attackBonus;
        if (ammoBonus) {
          parts.push('@ammo');
          rollData.ammo = ammoBonus;
        }
      }
    }
  }

  rollFlags.fumble = 1;

  // Expanded critical hit thresholds
  rollFlags.critical = 20;
  if ((this.data.type === 'weapon') && actorFlags.weaponCriticalThreshold) {
    rollFlags.critical = parseInt(actorFlags.weaponCriticalThreshold, DEFAULT_RADIX);
  } else if ((this.data.type === 'spell') && actorFlags.spellCriticalThreshold) {
    rollFlags.critical = parseInt(actorFlags.spellCriticalThreshold, DEFAULT_RADIX);
  }

  // Check Elven Accuracy
  if (['weapon', 'spell'].includes(this.data.type)) {
    if (actorFlags.elvenAccuracy && ['dex', 'int', 'wis', 'cha'].includes(this.abilityMod)) {
      rollFlags.elvenAccuracy = true;
    }
  }

  // Check Halfling Lucky
  if (actorFlags.halflingLucky) rollFlags.halflingLucky = true;

  // Prepare Message Data
  if (rollData.bonus) {
    parts.push('@bonus');
  }

  // Handle fast-forward events
  let advantage = 0;
  if (vantage) {
    advantage = event.ctrlKey || event.metaKey ? -1 : 1;
    htmlFlags.vantageTypeHeader = advantage > 0 ? 'qr-advantage-header' : 'qr-disadvantage-header';
  }

  // Create the Roll instance
  const attackRoll = rollD20({
    parts, rollData, advantage, flags: rollFlags,
  });

  if (attackRoll === false) return null;

  // Handle resource consumption if the attack roll was made
  if (!vantage && !isReroll) {
    const allowed = await this._handleResourceConsumption({ isCard: false, isAttack: true });
    if (allowed === false) return null;
  }

  const headerKey = (advantage > 0 && 'QR.Advantage') || (advantage < 0 && 'QR.Disadvantage') || 'DND5E.Attack';
  await updateButtonAndHeader({
    contentNode: $(message.data.content), roll: attackRoll, action, headerKey, message, flags: htmlFlags,
  });

  return attackRoll;
}

/**
 * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
 * @param {boolean} [configureDialog]     Display a configuration dialog for the item roll, if applicable?
 * @param {string} [rollMode]             The roll display mode with which to display (or not) the card
 * @param {boolean} [createMessage]       Whether to automatically create a chat message (if true) or simply return
 *                                        the prepared chat message data (if false).
 * @param {MouseEvent} [event]            An event which triggered this roll, if any
 * @param {number} [originalSpellLevel]   The original spell level if the roll is a spell roll that is upcast
 * @return {Promise}
 */
async function rollItem({
  configureDialog = true, rollMode = null, createMessage = true, event, originalSpellLevel = null,
} = {}) {
  // Basic template rendering data
  const { token } = this.actor;

  const templateData = {
    actor: this.actor,
    tokenId: token ? `${token.scene._id}.${token.id}` : null,
    item: this.data,
    data: this.getChatData(),
    labels: this.labels,
    hasAttack: this.hasAttack,
    isHealing: this.isHealing,
    hasDamage: this.hasDamage,
    isVersatile: this.isVersatile,
    isSpell: this.data.type === 'spell',
    hasSave: this.hasSave,
    hasAreaTarget: this.hasAreaTarget,
  };

  // For feature items, optionally show an ability usage dialog
  if (this.data.type === 'feat') {
    const configured = await this._rollFeat(configureDialog);
    if (configured === false) return;
  } else if (this.data.type === 'consumable') {
    const configured = await this._rollConsumable(configureDialog);
    if (configured === false) return;
  }

  // For items which consume a resource, handle that here
  const allowed = await this._handleResourceConsumption({ isCard: true, isAttack: false });
  if (allowed === false) return;

  // Render the chat card template
  const templateType = ['tool'].includes(this.data.type) ? this.data.type : 'item';
  const template = `${TEMPLATE_PATH_PREFIX}/${templateType}-card.html`;
  const html = await renderTemplate(template, templateData);

  // Basic chat message data
  const chatData = {
    user: game.user._id,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    content: html,
    flavor: this.data.data.chatFlavor || this.name,
    speaker: {
      actor: this.actor._id,
      token: this.actor.token,
      alias: this.actor.name,
    },
    flags: { 'core.canPopout': true },
  };

  // If the consumable was destroyed in the process - embed the item data in the surviving message
  if ((this.data.type === 'consumable') && !this.actor.items.has(this.id)) {
    chatData.flags['dnd5e.itemData'] = this.data;
  }

  // Toggle default roll mode
  rollMode = rollMode || game.settings.get('core', 'rollMode');
  if (['gmroll', 'blindroll'].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients('GM');
  if (rollMode === 'blindroll') chatData.blind = true;

  // Create the chat message
  if (createMessage) {
    const message = await ChatMessage.create(chatData);

    if (this.hasAttack) {
      toggleAllDisabledButtonState({ messageId: message.id, isDisable: true });
      await this.rollAttack.bind(this)({ event, message, action: ATTACK });
      if (hasVantageFromEvent(event)) {
        await this.rollAttack.bind(this)({
          event, message, vantage: true, action: VANTAGE,
        });
      }
    }

    if (this.hasDamage) {
      toggleAllDisabledButtonState({ messageId: message.id, isDisable: true });

      const autoRollDamage = game.settings.get(moduleName, SETTING_AUTO_ROLL_DAMAGE);
      const spellLevel = $(message.data.content).data('spell-level') || null;

      // Don't roll as a crit if it's rolling from the item
      event.altKey = false;

      const executeDamageRoll = async () => {
        this.data.data.level = originalSpellLevel;
        await this.rollDamage.bind(this)({
          event, spellLevel, message, action: DAMAGE,
        });
      };

      if (!this.hasAttack) {
        await executeDamageRoll();
      } else {
        switch (autoRollDamage) {
          case AUTO_ROLL_DAMAGE_DM_ONLY:
            if (ownedOnlyByGM(this.actor)) {
              await executeDamageRoll();
            }
            break;
          case AUTO_ROLL_DAMAGE_ALL:
            await executeDamageRoll();
            break;
          default:
        }
      }
    }

    toggleAllDisabledButtonState({ messageId: message.id, isDisable: false });

    return message;
  }
  return chatData;
}

/**
 * Place a damage roll using an item (weapon, feat, spell, or equipment)
 * Rely upon the damageRoll logic for the core implementation.
 * @param {MouseEvent} [event]      An event which triggered this roll, if any
 * @param {number} [spellLevel]     If the item is a spell, override the level for damage scaling
 * @param {boolean} [versatile]     If the item is a weapon, roll damage using the versatile formula
 * @param {ChatMessage} [message]   The chat message event associate with the roll
 * @return {Promise<Roll>}          A Promise which resolves to the created Roll instance
 */
async function rollDamage({
  event, spellLevel = null, versatile = false, message, isReroll = false, action,
} = {}) {
  if (!this.hasDamage) throw new Error('You may not make a Damage Roll with this Item.');
  const itemData = this.data.data;
  const actorData = this.actor.data.data;
  const rollFlags = {};

  // Get roll data
  const parts = itemData.damage.parts.map((d) => d[0]);
  const rollData = this.getRollData();
  if (spellLevel) rollData.item.level = spellLevel;

  // Adjust damage from versatile usage
  if (versatile && itemData.damage.versatile) {
    parts[0] = itemData.damage.versatile;
  }

  // Scale damage from up-casting spells
  if ((this.data.type === 'spell')) {
    if ((itemData.scaling.mode === 'cantrip')) {
      const level = this.actor.data.type === 'character' ? actorData.details.level : actorData.details.spellLevel;
      this._scaleCantripDamage(parts, itemData.scaling.formula, level, rollData);
    } else if (spellLevel && (itemData.scaling.mode === 'level') && itemData.scaling.formula) {
      const scaling = itemData.scaling.formula;
      this._scaleSpellDamage(parts, itemData.level, spellLevel, scaling, rollData);
    }
  }

  // Add damage bonus formula
  const actorBonus = getProperty(actorData, `bonuses.${itemData.actionType}`) || {};
  if (actorBonus.damage && (parseInt(actorBonus.damage, DEFAULT_RADIX) !== 0)) {
    parts.push(actorBonus.damage);
  }

  // Add ammunition damage
  if (this._ammo) {
    parts.push('@ammo');
    rollData.ammo = this._ammo.data.data.damage.parts.map((p) => p[0]).join('+');
    delete this._ammo;
  }

  // Prepare Message Data
  if (rollData.bonus) {
    parts.push('@bonus');
  }

  // eslint-disable-next-line max-len
  rollFlags.criticalBonusDice = itemData.actionType === 'mwak' || this.actor.getFlag('dnd5e', 'meleeCriticalDamageDice');
  const isCritical = (isNodeCritical($(message.data.content)) || event.altKey) && !event.ctrlKey;
  // Create the Roll instance
  const damageRoll = rollArbitrary({
    parts, rollData, isCritical, flags: rollFlags,
  });

  const headerKey = (this.isHealing && 'DND5E.Healing') || (versatile && 'DND5E.Versatile') || 'DND5E.Damage';
  await updateButtonAndHeader({
    contentNode: $(message.data.content), roll: damageRoll, action, headerKey, message,
  });

  return damageRoll;
}

/**
 * Place an attack roll using an item (weapon, feat, spell, or equipment)
 * Rely upon the d20Roll logic for the core implementation
 *
 * @param {MouseEvent} [event]    An event which triggered this roll, if any
 * @param {number} [spellLevel]   Level of spell
 * @param {ChatMessage} [message]     The chat message event associate with the roll
 * @return {Promise<Roll>}        A Promise which resolves to the created Roll instance
 */
async function rollFormula({
  event, spellLevel, message, isReroll = false, action,
}) {
  if (!this.data.data.formula) {
    throw new Error('This Item does not have a formula to roll!');
  }

  // Define Roll Data
  const rollData = this.getRollData();
  if (spellLevel) rollData.item.level = spellLevel;

  // Invoke the roll and submit it to chat
  let roll = new Roll(rollData.item.formula, rollData);
  if ((isNodeCritical($(message.data.content)) || event.altKey) && !event.ctrlKey) {
    roll = calculateCrit({
      parts: [rollData.item.formula], rollData, roll, criticalMultiplier: 2, criticalBonusDice: 0,
    });
  }

  try {
    roll = roll.roll();
  } catch (err) {
    error(err);
    ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
    roll = null;
  }

  const headerKey = 'DND5E.OtherFormula';
  await updateButtonAndHeader({
    contentNode: $(message.data.content), roll, action, headerKey, message,
  });

  return roll;
}

/**
 * Handle execution of a chat card action via a click event on one of the card buttons
 * @param {Event} event       The originating click event
 * @returns {Promise}         A promise which resolves once the handler workflow is complete
 * @private
 */
async function _onChatCardAction(event) {
  event.preventDefault();

  // Extract card data
  const button = event.currentTarget;
  const card = button.closest('.chat-card');
  const { messageId } = card.closest('.message').dataset;

  toggleAllDisabledButtonState({ messageId, isDisable: true });

  const message = game.messages.get(messageId);
  const { action } = button.dataset;

  // Validate permission to proceed with the roll
  const isTargetted = action === 'save';
  if (!(isTargetted || game.user.isGM || message.isAuthor)) return;

  // Recover the actor for the chat card
  const actor = this._getChatCardActor(card);
  if (!actor) return;

  // Get the Item from stored flag data or by the item ID on the Actor
  const storedData = message.getFlag('dnd5e', 'itemData');
  const item = storedData ? this.createOwned(storedData, actor) : actor.getOwnedItem(card.dataset.itemId);
  if (!item) {
    return ui.notifications.error(
      game.i18n.format('DND5E.ActionWarningNoItem', { item: card.dataset.itemId, name: actor.name }),
    );
  }
  const spellLevel = parseInt(card.dataset.spellLevel, DEFAULT_RADIX) || null;

  // Handle different actions
  switch (action) {
    case ATTACK:
      await item.rollAttack({ event, message, action }); break;
    case 'attack-reroll':
      await item.rollAttack({
        event, message, isReroll: true, action: ATTACK,
      }); break;
    case VANTAGE:
      await item.rollAttack({
        event, message, vantage: true, action,
      }); break;
    case 'vantage-reroll':
      await item.rollAttack({
        event, message, vantage: true, isReroll: true, action: VANTAGE,
      }); break;
    case DAMAGE:
      await item.rollDamage({
        event, spellLevel, message, action,
      }); break;
    case 'damage-reroll':
      await item.rollDamage({
        event, spellLevel, message, isReroll: true, action: DAMAGE,
      }); break;
    case VERSATILE:
      await item.rollDamage({
        event, spellLevel, versatile: true, message, action,
      }); break;
    case 'versatile-reroll':
      await item.rollDamage({
        event, spellLevel, message, versatile: true, isReroll: true, action: VERSATILE,
      }); break;
    case FORMULA:
      await item.rollFormula({
        event, spellLevel, message, action,
      }); break;
    case 'formula-reroll':
      await item.rollFormula({
        event, spellLevel, message, isReroll: true, action: FORMULA,
      }); break;
    case 'save': {
      const targets = this._getChatCardTargets(card);
      targets.forEach(async (token) => {
        const speaker = ChatMessage.getSpeaker({ scene: canvas.scene, token });
        await token.actor.rollAbilitySave(button.dataset.ability, { event, speaker });
      });
      break;
    }
    case 'toolCheck':
      await item.rollToolCheck({ event }); break;
    case 'placeTemplate': {
      const template = AbilityTemplate.fromItem(item);
      if (template) template.drawPreview();
      break;
    }
    default:
  }

  // Re-enable the button
  toggleAllDisabledButtonState({ messageId, isDisable: false });
}

export const overrideItem = () => {
  CONFIG.Item.entityClass._onChatCardAction = _onChatCardAction;
  CONFIG.Item.entityClass.prototype.roll = rollItem;
  CONFIG.Item.entityClass.prototype.rollAttack = rollAttack;
  CONFIG.Item.entityClass.prototype.rollDamage = rollDamage;
  CONFIG.Item.entityClass.prototype.rollFormula = rollFormula;
};
