import { debug, error } from './utils/logger.js';
import {
  buildDamageRollHtmlNode,
  updateButtonAndHeader,
} from './utils/chat.js';
import {
  moduleName, SETTING_AUTO_ROLL_DAMAGE,
  AUTO_ROLL_DAMAGE_DM_ONLY, AUTO_ROLL_DAMAGE_ALL,
} from './settings.js';
import {
  ownedOnlyByGM, hasVantageFromEvent, ATTACK, VANTAGE, DAMAGE, VERSATILE, FORMULA, getTargetActors,
} from './utils/helpers.js';
import { TEMPLATE_PATH_PREFIX } from './utils/templatePathPrefix.js';
import { DEFAULT_RADIX } from './utils/utilities.js';
import { calculateCrit, rollArbitrary, rollD20 } from './utils/roll.js';
import { isNodeCritical, toggleAllDisabledButtonState } from './utils/domUtils.js';

// Import DND5E System files
import AbilityTemplate from '../../../systems/dnd5e/module/pixi/ability-template.js';
import AbilityUseDialog from '../../../systems/dnd5e/module/apps/ability-use-dialog.js';

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
  if (!['weapon', 'consumable'].includes(this.data.type) || itemData.proficient) {
    parts.push('@prof');
  }

  // Attack Bonus
  if (itemData.attackBonus) parts.push(itemData.attackBonus);
  const actorBonus = actorData?.bonuses?.[itemData.actionType] || {};
  if (actorBonus.attack) parts.push(actorBonus.attack);

  // Ammunition Bonus
  delete this._ammo;
  let ammo = null;
  let ammoUpdate = null;

  const { consume } = itemData;
  if (consume?.type === 'ammo') {
    ammo = this.actor.items.get(consume.target);
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

    // Get pending ammunition update
    const usage = this._getUsageUpdates({ consumeResource: true });
    if (usage === false) return null;
    ammoUpdate = usage.resourceUpdates || {};
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

  // Commit ammunition consumption on attack rolls resource consumption if the attack roll was made
  if (ammo && !isObjectEmpty(ammoUpdate) && !vantage && !isReroll) await ammo.update(ammoUpdate);

  const headerKey = (advantage > 0 && 'QR.Advantage') || (advantage < 0 && 'QR.Disadvantage') || 'DND5E.Attack';
  await updateButtonAndHeader({
    contentNode: $(message.data.content), roll: attackRoll, action, headerKey, message, flags: htmlFlags,
  });

  return attackRoll;
}

/**
 * Display the chat card for an Item as a Chat Message
 * @param {object} options          Options which configure the display of the item chat card
 * @param {string} rollMode         The message visibility mode to apply to the created card
 * @param {boolean} createMessage   Whether to automatically create a ChatMessage entity (if true), or only return
 *                                  the prepared message data (if false)
 */
async function displayCard({
  event = { altKey: false, ctrlKey: false, metaKey: false }, rollMode, createMessage = true,
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

  // Render the chat card template
  const templateType = ['tool'].includes(this.data.type) ? this.data.type : 'item';
  const template = `${TEMPLATE_PATH_PREFIX}/${templateType}-card.html`;
  const html = await renderTemplate(template, templateData);

  // Create the ChatMessage data object
  const chatData = {
    user: game.user._id,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    content: html,
    flavor: this.data.data.chatFlavor || this.name,
    speaker: ChatMessage.getSpeaker({ actor: this.actor, token }),
    flags: { 'core.canPopout': true },
  };

  // If the Item was destroyed in the process of displaying its card - embed the item data in the chat message
  if ((this.data.type === 'consumable') && !this.actor.items.has(this.id)) {
    chatData.flags['dnd5e.itemData'] = this.data;
  }

  // Apply the roll mode to adjust message visibility
  ChatMessage.applyRollMode(chatData, rollMode || game.settings.get('core', 'rollMode'));

  // Create the chat message
  if (createMessage) {
    const message = await ChatMessage.create(chatData, { rollMode });

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
      if (event) {
        event.altKey = false;
      }

      const executeDamageRoll = async () => {
        // this.data.data.level = originalSpellLevel;
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
 * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
 * @param {boolean} [configureDialog]     Display a configuration dialog for the item roll, if applicable?
 * @param {string} [rollMode]             The roll display mode with which to display (or not) the card
 * @param {boolean} [createMessage]       Whether to automatically create a chat message (if true) or simply return
 *                                        the prepared chat message data (if false).
 * @return {Promise<ChatMessage|object|void>}
 */
async function roll({
  event, configureDialog = true, rollMode, createMessage = true,
} = {}) {
  let item = this;
  const { actor } = this;

  // Reference aspects of the item data necessary for usage
  const id = this.data.data; // Item data
  const hasArea = this.hasAreaTarget; // Is the ability usage an AoE?
  const resource = id.consume || {}; // Resource consumption
  const recharge = id.recharge || {}; // Recharge mechanic
  const uses = id?.uses ?? {}; // Limited uses
  const isSpell = this.type === 'spell'; // Does the item require a spell slot?
  const requireSpellSlot = isSpell && (id.level > 0) && CONFIG.DND5E.spellUpcastModes.includes(id.preparation.mode);

  // Define follow-up actions resulting from the item usage
  let createMeasuredTemplate = hasArea; // Trigger a template creation
  let consumeRecharge = !!recharge.value; // Consume recharge
  let consumeResource = !!resource.target && (resource.type !== 'ammo'); // Consume a linked (non-ammo) resource
  let consumeSpellSlot = requireSpellSlot; // Consume a spell slot
  let consumeUsage = !!uses.per; // Consume limited uses
  const consumeQuantity = uses.autoDestroy; // Consume quantity of the item in lieu of uses

  // Display a configuration dialog to customize the usage
  const needsConfiguration = createMeasuredTemplate || consumeRecharge
    || consumeResource || consumeSpellSlot || consumeUsage;
  if (configureDialog && needsConfiguration) {
    const configuration = await AbilityUseDialog.create(this);
    if (!configuration) return;

    // Determine consumption preferences
    createMeasuredTemplate = Boolean(configuration.placeTemplate);
    consumeUsage = Boolean(configuration.consumeUse);
    consumeRecharge = Boolean(configuration.consumeRecharge);
    consumeResource = Boolean(configuration.consumeResource);
    consumeSpellSlot = Boolean(configuration.consumeSlot);

    // Handle spell upcasting
    if (requireSpellSlot) {
      const slotLevel = configuration.level;
      const spellLevel = slotLevel === 'pact' ? actor.data.data.spells.pact.level : parseInt(slotLevel, DEFAULT_RADIX);
      if (spellLevel !== id.level) {
        const upcastData = mergeObject(this.data, { 'data.level': spellLevel }, { inplace: false });
        item = this.constructor.createOwned(upcastData, actor); // Replace the item with an upcast version
      }
      if (consumeSpellSlot) consumeSpellSlot = slotLevel === 'pact' ? 'pact' : `spell${spellLevel}`;
    }
  }

  // Determine whether the item can be used by testing for resource consumption
  const usage = item._getUsageUpdates({
    consumeRecharge, consumeResource, consumeSpellSlot, consumeUsage, consumeQuantity,
  });
  if (!usage) return;
  const { actorUpdates, itemUpdates, resourceUpdates } = usage;

  // Commit pending data updates
  if (!isObjectEmpty(itemUpdates)) await item.update(itemUpdates);
  if (consumeQuantity && (item.data.data.quantity === 0)) await item.delete();
  if (!isObjectEmpty(actorUpdates)) await actor.update(actorUpdates);
  if (!isObjectEmpty(resourceUpdates)) {
    const resourceVal = actor.items.get(id.consume?.target);
    if (resourceVal) await resourceVal.update(resourceUpdates);
  }

  // Initiate measured template creation
  if (createMeasuredTemplate) {
    const template = AbilityTemplate.fromItem(item);
    if (template) template.drawPreview();
  }

  // Create or return the Chat Message data
  return item.displayCard({ event, rollMode, createMessage });
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
  const types = itemData.damage.parts.map((d) => d[1]);
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
    parts[0] = `${parts[0]} + ${actorBonus.damage}`;
  }

  if (this._ammo) {
    this._ammo.data.data.damage.parts.forEach((p) => {
      const searchIndex = types.indexOf(p[1]);
      if (searchIndex !== -1) {
        parts[searchIndex] = `${parts[searchIndex]} + ${p[0]}`;
      } else {
        parts.push(p[0]);
        types.push(p[1]);
      }
    });
    delete this._ammo;
  }

  // Prepare Message Data
  if (rollData.bonus) {
    parts[0] = `${parts[0]} + ${rollData.bonus}`;
  }

  // eslint-disable-next-line max-len
  rollFlags.criticalBonusDice = itemData.actionType === 'mwak' || this.actor.getFlag('dnd5e', 'meleeCriticalDamageDice');
  const isCritical = (isNodeCritical($(message.data.content)) || event.altKey) && !event.ctrlKey;
  // Create the Roll instance
  const damageRolls = parts.map((p) => rollArbitrary({
    parts: [p], rollData, isCritical, flags: rollFlags,
  }));

  const rollNode = await buildDamageRollHtmlNode({ rolls: damageRolls, types });

  const headerKey = (this.isHealing && 'DND5E.Healing') || (versatile && 'DND5E.Versatile') || 'DND5E.Damage';
  await updateButtonAndHeader({
    contentNode: $(message.data.content),
    action,
    headerKey,
    message,
    rollHtmlNode: rollNode,
    roll: damageRolls,
    flags: { isCritical },
  });

  return damageRolls;
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

  const isCritical = (isNodeCritical($(message.data.content)) || event.altKey) && !event.ctrlKey;
  // Invoke the roll and submit it to chat
  const formulaRoll = rollArbitrary({
    parts: [rollData.item.formula],
    rollData,
    isCritical,
  });

  const rollNode = await buildDamageRollHtmlNode({ rolls: [formulaRoll] });

  const headerKey = 'DND5E.OtherFormula';
  await updateButtonAndHeader({
    contentNode: $(message.data.content),
    roll: formulaRoll,
    rollHtmlNode: rollNode,
    action,
    headerKey,
    message,
    flags: { isCritical },
  });

  return formulaRoll;
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

function _onDamageApplyAction(event) {
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget;
  const card = button.closest('.dice-roll');
  const partDamage = parseInt($(button).closest('.dice').find('.part-total').text(), DEFAULT_RADIX);
  const totalDamage = parseInt($(card).find('.dice-total').text(), DEFAULT_RADIX);
  const { damageMultiplier } = button.dataset;
  const targetActors = getTargetActors() || [];

  targetActors.forEach((actor) => {
    actor.applyDamage(Number.isNaN(partDamage) ? totalDamage : partDamage, damageMultiplier);
  });
}

function additionalChatListeners(html) {
  html.on('click', '.qr-damage-apply-buttons .qr-damage-apply-button', this._onDamageApplyAction.bind(this));
}

export const overrideItem = () => {
  CONFIG.Item.entityClass._onChatCardAction = _onChatCardAction;
  CONFIG.Item.entityClass._onDamageApplyAction = _onDamageApplyAction;
  CONFIG.Item.entityClass.additionalChatListeners = additionalChatListeners;

  CONFIG.Item.entityClass.prototype.roll = roll;
  CONFIG.Item.entityClass.prototype.rollAttack = rollAttack;
  CONFIG.Item.entityClass.prototype.rollDamage = rollDamage;
  CONFIG.Item.entityClass.prototype.rollFormula = rollFormula;
  CONFIG.Item.entityClass.prototype.displayCard = displayCard;
};
