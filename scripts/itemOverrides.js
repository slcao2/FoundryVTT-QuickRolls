import { debug, error } from './utils/logger.js';
import {
  calculateCrit, replaceButton,
} from './utils/chat.js';
import {
  moduleName, SETTING_AUTO_ROLL_DAMAGE, AUTO_ROLL_DAMAGE_DM_ONLY, AUTO_ROLL_DAMAGE_ALL,
} from './settings.js';
import { ownedOnlyByGM } from './utils/helpers.js';
import { DEFAULT_RADIX } from './utils/utilities.js';

/**
 * Place an attack roll using an item (weapon, feat, spell, or equipment)
 * Rely upon the d20Roll logic for the core implementation
 *
 * @param {object} options        Roll options which are configured and provided to the d20Roll function
 * @return {Promise<Roll|null>}   A Promise which resolves to the created Roll instance
 */
async function rollAttack({ event, message, vantage = false } = {}) {
  const itemData = this.data.data;
  const actorData = this.actor.data.data;
  const flags = this.actor.data.flags.dnd5e || {};
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

  // Expanded critical hit thresholds
  let critical = 20;
  if ((this.data.type === 'weapon') && flags.weaponCriticalThreshold) {
    critical = parseInt(flags.weaponCriticalThreshold, DEFAULT_RADIX);
  } else if ((this.data.type === 'spell') && flags.spellCriticalThreshold) {
    critical = parseInt(flags.spellCriticalThreshold, DEFAULT_RADIX);
  }

  // Elven Accuracy
  let elvenAccuracy = false;
  if (['weapon', 'spell'].includes(this.data.type)) {
    if (flags.elvenAccuracy && ['dex', 'int', 'wis', 'cha'].includes(this.abilityMod)) {
      elvenAccuracy = true;
    }
  }

  // Apply Halfling Lucky
  let halflingLucky = false;
  if (flags.halflingLucky) halflingLucky = true;

  // Apply Reliable Talent
  let reliableTalent = false;
  if (flags.reliableTalent) reliableTalent = true;

  // Prepare Message Data
  parts.push('@bonus');

  // Handle fast-forward events
  let adv = 0;
  if (vantage) {
    adv = event.ctrlKey || event.metaKey ? -1 : 1;
    message.isAdvantage = adv > 0;
  }

  // Define the inner roll function
  const _roll = (_parts, _adv, form) => {
    // Determine the d20 roll and modifiers
    let nd = 1;
    let mods = halflingLucky ? 'r=1' : '';

    // Handle advantage
    if (_adv === 1 && elvenAccuracy) {
      nd = 2;
      mods += 'kh';
    }

    // Prepend the d20 roll
    let formula = `${nd}d20${mods}`;
    if (reliableTalent) formula = `{${nd}d20${mods},10}kh`;
    _parts.unshift(formula);

    // Optionally include a situational bonus
    if (form) {
      rollData.bonus = form.bonus.value;
    }
    if (!rollData.bonus) _parts.pop();

    // Optionally include an ability score selection (used for tool checks)
    const ability = form ? form.ability : null;
    if (ability && ability.value) {
      rollData.ability = ability.value;
      const abl = rollData.abilities[rollData.ability];
      if (abl) {
        rollData.mod = abl.mod;
      }
    }

    // Execute the roll
    const roll = new Roll(_parts.join(' + '), rollData);
    try {
      roll.roll();
    } catch (err) {
      error(err);
      ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
      return null;
    }

    // Flag d20 options for any 20-sided dice in the roll
    const fumble = 1;
    const targetValue = null;
    roll.dice.forEach((d) => {
      if (d.faces === 20) {
        d.options.critical = critical;
        d.options.fumble = fumble;
        if (targetValue) d.options.target = targetValue;
      }
    });

    return roll;
  };

  // Create the Roll instance
  const attackRoll = _roll.bind(this)(parts, adv);

  if (attackRoll === false) return null;

  // Handle resource consumption if the attack roll was made
  if (!vantage) {
    const allowed = await this._handleResourceConsumption({ isCard: false, isAttack: true });
    if (allowed === false) return null;
    message.attackRollTotal = attackRoll.total;
    attackRoll.dice.forEach((d) => {
      d.results.forEach((r) => {
        if (r.active && d.options.critical === r.result) {
          message.isAttackCritical = true;
        } else if (r.active && d.options.fumble === r.result) {
          message.isAttackFumble = true;
        }
      });
    });
  } else {
    message.vantageRollTotal = attackRoll.total;
    attackRoll.dice.forEach((d) => {
      d.results.forEach((r) => {
        if (r.active && d.options.critical === r.result) {
          message.isVantageCritical = true;
        } else if (r.active && d.options.fumble === r.result) {
          message.isVantageFumble = true;
        }
      });
    });
  }

  // Replace button with roll
  let headerKey = 'DND5E.Attack';
  let headerRegex = /<h4 class="qr-card-button-header qr-attack-header qr-hidden">[^<]*<\/h4>/;
  let buttonRegex = /<button data-action="attack">[^<]*<\/button>/;
  let action = 'attack';

  if (vantage) {
    headerKey = adv === -1 ? 'QR.Disadvantage' : 'QR.Advantage';
    headerRegex = /<h4 class="qr-card-button-header qr-vantage-header qr-hidden">[^<]*<\/h4>/;
    buttonRegex = /<button data-action="vantage">[^<]*<\/button>/;
    action = 'vantage';
  }

  await this.replaceButton({
    headerKey, buttonRegex, headerRegex, message, roll: attackRoll, action,
  });

  return attackRoll;
}

/**
 * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
 * @param {boolean} [configureDialog]     Display a configuration dialog for the item roll, if applicable?
 * @param {string} [rollMode]             The roll display mode with which to display (or not) the card
 * @param {boolean} [createMessage]       Whether to automatically create a chat message (if true) or simply return
 *                                        the prepared chat message data (if false).
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
  const template = `modules/quick-rolls/templates/${templateType}-card.html`;
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
      await this.rollAttack.bind(this)({ event, message });
      if (event.altKey || event.ctrlKey || event.metaKey) {
        await this.rollAttack.bind(this)({ event, message, vantage: true });
      }
    }

    if (this.hasDamage) {
      const autoRollDamage = game.settings.get(moduleName, SETTING_AUTO_ROLL_DAMAGE);
      const spellLevel = $(message.data.content).data('spell-level') || null;

      switch (autoRollDamage) {
        case AUTO_ROLL_DAMAGE_DM_ONLY:
          if (ownedOnlyByGM(this.actor)) {
            this.data.data.level = originalSpellLevel;
            await this.rollDamage({ event, spellLevel, message });
          }
          break;
        case AUTO_ROLL_DAMAGE_ALL:
          this.data.data.level = originalSpellLevel;
          await this.rollDamage({ event, spellLevel, message });
          break;
        default:
      }
    }
    return message;
  }
  return chatData;
}

/**
 * Place a damage roll using an item (weapon, feat, spell, or equipment)
 * Rely upon the damageRoll logic for the core implementation.
 * @param {MouseEvent} [event]    An event which triggered this roll, if any
 * @param {number} [spellLevel]   If the item is a spell, override the level for damage scaling
 * @param {boolean} [versatile]   If the item is a weapon, roll damage using the versatile formula
 * @param {object} [options]      Additional options passed to the damageRoll function
 * @return {Promise<Roll>}        A Promise which resolves to the created Roll instance
 */
async function rollDamage({
  event, spellLevel = null, versatile = false, message,
} = {}) {
  if (!this.hasDamage) throw new Error('You may not make a Damage Roll with this Item.');
  const itemData = this.data.data;
  const actorData = this.actor.data.data;

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
  parts.push('@bonus');

  // Define inner roll function
  const _roll = (_parts, crit, form) => {
    const criticalMultiplier = 2;
    // Scale melee critical hit damage
    const criticalBonusDice = itemData.actionType === 'mwak'
      ? this.actor.getFlag('dnd5e', 'meleeCriticalDamageDice') ?? 0 : 0;

    // Optionally include a situational bonus
    if (form) {
      rollData.bonus = form.bonus.value;
    }
    if (!rollData.bonus) parts.pop();

    // Create the damage roll
    let roll = new Roll(parts.join('+'), rollData);

    // Modify the damage formula for critical hits
    if (crit) {
      roll = calculateCrit({
        parts, rollData, roll, criticalMultiplier, criticalBonusDice,
      });
    }

    // Execute the roll
    try {
      return roll.roll();
    } catch (err) {
      error(err);
      ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
      return null;
    }
  };

  const critical = message.isCritical || event.altKey;
  // Create the Roll instance
  const damageRoll = _roll.bind(this)(parts, critical || event.altKey);

  // Replace button with roll
  let headerKey = 'DND5E.Damage';
  if (versatile) {
    headerKey = 'DND5E.Versatile';
  } else if (this.isHealing) {
    headerKey = 'DND5E.Healing';
  }
  const headerRegex = versatile
    ? /<h4 class="qr-card-button-header qr-versatile-header qr-hidden">[^<]*<\/h4>/
    : /<h4 class="qr-card-button-header qr-damage-header qr-hidden">[^<]*<\/h4>/;
  const buttonRegex = versatile
    ? /<button data-action="versatile">[^<]*<\/button>/ : /<button data-action="damage">[^<]*<\/button>/;
  const action = versatile ? 'versatile' : 'damage';

  this.replaceButton({
    headerKey, headerRegex, buttonRegex, message, roll: damageRoll, action,
  });

  return damageRoll;
}

/**
 * Place an attack roll using an item (weapon, feat, spell, or equipment)
 * Rely upon the d20Roll logic for the core implementation
 *
 * @return {Promise<Roll>}   A Promise which resolves to the created Roll instance
 */
async function rollFormula({ event, spellLevel, message }) {
  if (!this.data.data.formula) {
    throw new Error('This Item does not have a formula to roll!');
  }

  // Define Roll Data
  const rollData = this.getRollData();
  if (spellLevel) rollData.item.level = spellLevel;

  // Invoke the roll and submit it to chat
  let roll = new Roll(rollData.item.formula, rollData).roll();
  if (message.isCritical || event.altKey) {
    roll = calculateCrit({
      parts: [rollData.item.formula], rollData, roll, criticalMultiplier: 2, criticalBonusDice: 0,
    });
  }

  // Replace button with roll
  const headerKey = 'DND5E.OtherFormula';
  const headerRegex = /<h4 class="qr-card-button-header qr-formula-header qr-hidden">[^<]*<\/h4>/;
  const buttonRegex = /<button data-action="formula">[^<]*<\/button>/;
  const action = 'formula';

  this.replaceButton({
    headerKey, headerRegex, buttonRegex, message, roll, action,
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
  button.disabled = true;
  const card = button.closest('.chat-card');
  const { messageId } = card.closest('.message').dataset;
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
    case 'attack':
      await item.rollAttack({ event, message }); break;
    case 'vantage':
      await item.rollAttack({ event, message, vantage: true }); break;
    case 'damage':
      await item.rollDamage({ event, spellLevel, message }); break;
    case 'versatile':
      await item.rollDamage({
        event, spellLevel, versatile: true, message,
      }); break;
    case 'formula':
      await item.rollFormula({ event, spellLevel, message }); break;
    case 'save': {
      const targets = this._getChatCardTargets(card);
      debug(targets);
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
  button.disabled = false;
}

export const overrideItem = () => {
  CONFIG.Item.entityClass._onChatCardAction = _onChatCardAction;
  CONFIG.Item.entityClass.prototype.replaceButton = replaceButton;
  CONFIG.Item.entityClass.prototype.roll = rollItem;
  CONFIG.Item.entityClass.prototype.rollAttack = rollAttack;
  CONFIG.Item.entityClass.prototype.rollDamage = rollDamage;
  CONFIG.Item.entityClass.prototype.rollFormula = rollFormula;
};
