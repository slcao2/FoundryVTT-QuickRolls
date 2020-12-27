import { updateButtonAndHeader } from './utils/chat.js';
import { toggleAllDisabledButtonState } from './utils/domUtils.js';
import {
  ABILITY, ATTACK, DAMAGE, hasVantageFromEvent, isScrolledToBottom, SAVE, scrollToBottom, SKILL, VANTAGE,
} from './utils/helpers.js';
import { debug } from './utils/logger.js';
import { rollArbitrary, rollD20 } from './utils/roll.js';
import { TEMPLATE_PATH_PREFIX } from './utils/templatePathPrefix.js';

// Import DND5E System files
import { DND5E } from '../../../systems/dnd5e/module/config.js';
import { isTidy5eSheetActive } from './utils/tidy5eHelpers.js';
import { getSkillCustomizationForSkill, isSkillCustomizationEnabled } from './utils/skillCustomizationHelpers.js';

/**
 * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
 * @private
 */
function _onItemRoll(event) {
  event.preventDefault();
  const { itemId } = event.currentTarget.closest('.item').dataset;
  const item = this.actor.getOwnedItem(itemId);
  return item.roll({ event });
}

/**
 * Get the Actor which is the author of a chat card
 * @param {HTMLElement} card    The chat card being used
 * @return {Actor|null}         The Actor entity or null
 * @private
 */
function _getChatCardActor(card) {
  // Case 1 - a synthetic actor from a Token
  const tokenKey = card.dataset.tokenId;
  if (tokenKey) {
    const [sceneId, tokenId] = tokenKey.split('.');
    const scene = game.scenes.get(sceneId);
    if (!scene) return null;
    const tokenData = scene.getEmbeddedEntity('Token', tokenId);
    if (!tokenData) return null;
    const token = new Token(tokenData);
    return token.actor;
  }

  // Case 2 - use Actor ID directory
  const { actorId } = card.dataset;
  return game.actors.get(actorId) || null;
}

/**
 * Handle rolling a Skill check
 * @param {Event} event   The originating click event
 * @private
 */
function _onRollSkillCheck(event) {
  event.preventDefault();
  const { skill } = event.currentTarget.parentElement.dataset;
  this.actor.rollSkill(skill, { event });
}

/**
 * Roll a generic ability test or saving throw.
 * Prompt the user for input on which variety of roll they want to do.
 * @param {String}abilityId     The ability id (e.g. "str")
 * @param {Object} options      Options which configure how ability tests or saving throws are rolled
 */
function rollAbility(abilityId, options = {}) {
  const label = CONFIG.DND5E.abilities[abilityId];
  new Dialog({
    title: game.i18n.format('DND5E.AbilityPromptTitle', { ability: label }),
    content: `<p>${game.i18n.format('DND5E.AbilityPromptText', { ability: label })}</p>`,
    buttons: {
      test: {
        label: game.i18n.localize('DND5E.ActionAbil'),
        callback: () => this.rollAbilityTest(abilityId, options),
      },
      save: {
        label: game.i18n.localize('DND5E.ActionSave'),
        callback: () => this.rollAbilitySave(abilityId, options),
      },
    },
  }).render(true);
}

/**
 * Handle rolling an Ability check, either a test or a saving throw
 * @param {Event} event   The originating click event
 * @private
 */
function _onRollAbilityTest(event) {
  event.preventDefault();
  const { ability } = event.currentTarget.parentElement.dataset;
  this.actor.rollAbility(ability, { event });
}

async function _onChatCardAction(event) {
  event.preventDefault();

  // Extract card data
  const button = event.currentTarget;
  const card = button.closest('.chat-card');
  const { messageId } = card.closest('.message').dataset;
  const { checkId, checkType } = card.dataset;

  const isChatLogScrolledToBottom = isScrolledToBottom();
  toggleAllDisabledButtonState({ messageId, isDisable: true });

  const message = game.messages.get(messageId);
  const { action } = button.dataset;

  // Recover the actor for the chat card
  const actor = this._getChatCardActor(card);
  if (!actor) return;

  const options = {};
  // Handle Skill Customization module
  if (checkType === SKILL && isSkillCustomizationEnabled() && getSkillCustomizationForSkill(actor, checkId)) {
    options.parts = [];
    options.parts.push('@extra');
    options.data = {};
    options.data.extra = getSkillCustomizationForSkill(actor, checkId);
  }

  // Handle different actions
  switch (action) {
    case ATTACK:
    case `${ATTACK}-reroll`:
      await actor.rollCheck({
        checkId, action: ATTACK, type: checkType, event, message, options,
      });
      break;
    case VANTAGE:
    case `${VANTAGE}-reroll`:
      await actor.rollCheck({
        checkId, action: VANTAGE, type: checkType, event, message, vantage: true, options,
      });
      break;
    default:
  }

  // Re-enable the button
  toggleAllDisabledButtonState({ messageId, isDisable: false });
  if (isChatLogScrolledToBottom) {
    scrollToBottom();
  }
}

function chatListeners(html) {
  html.on('click', '.qr-card-check-buttons button', this._onChatCardAction.bind(this));
}

function getTitle(id, type) {
  switch (type) {
    case SKILL:
      return game.i18n.format('DND5E.SkillPromptTitle', { skill: CONFIG.DND5E.skills[id] });
    case ABILITY:
      return game.i18n.format('DND5E.AbilityPromptTitle', { ability: CONFIG.DND5E.abilities[id] });
    case SAVE:
      return game.i18n.format('DND5E.SavePromptTitle', { ability: CONFIG.DND5E.abilities[id] });
    default:
      return '';
  }
}

/**
 * Display the chat card for an Item as a Chat Message
 * @param {object} options          Options which configure the display of the item chat card
 * @param {string} rollMode         The message visibility mode to apply to the created card
 * @param {boolean} createMessage   Whether to automatically create a ChatMessage entity (if true), or only return
 *                                  the prepared message data (if false)
 */
async function displayCard({
  event = { altKey: false, ctrlKey: false, metaKey: false }, rollMode, createMessage = true, id, type, options = {},
} = {}) {
  // Basic template rendering data
  const { data, token } = this;
  const hasDataToken = !!(data && data.token);
  const templateData = {
    actor: this,
    tokenId: token ? `${token.scene._id}.${token.id}` : null,
    img: hasDataToken ? data.token.img : this.img,
    name: hasDataToken ? data.token.name : this.name,
    titleText: getTitle(id, type),
    checkId: id,
    checkType: type,
    isDualRoll: true,
  };

  // Render the chat card template
  const template = `${TEMPLATE_PATH_PREFIX}/roll-card.html`;
  const html = await renderTemplate(template, templateData);

  // Create the ChatMessage data object
  const chatData = {
    user: game.user._id,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    content: html,
    speaker: ChatMessage.getSpeaker({ actor: this, token }),
    flags: { 'core.canPopout': true },
  };

  // Apply the roll mode to adjust message visibility
  ChatMessage.applyRollMode(chatData, rollMode || game.settings.get('core', 'rollMode'));

  // Create the chat message
  if (createMessage) {
    const message = await ChatMessage.create(chatData, { rollMode });

    toggleAllDisabledButtonState({ messageId: message.id, isDisable: true });
    await this.rollCheck.bind(this)({
      checkId: id, action: ATTACK, type, event, message, options,
    });
    if (hasVantageFromEvent(event)) {
      await this.rollCheck.bind(this)({
        checkId: id, action: VANTAGE, type, event, message, vantage: true, options,
      });
    }
    toggleAllDisabledButtonState({ messageId: message.id, isDisable: false });
    scrollToBottom();

    return message;
  }
  return chatData;
}

/**
 * Builds the parts array and modifies the data and rollFlags as needed
 * @param {string} checkId
 * @param {object} data           Data to be modified
 * @param {object} rollFlags      Roll flags to be modified based on data
 */
function buildSkillCheckParts({
  checkId, data, rollFlags,
}) {
  const skill = this.data.data.skills[checkId];
  const bonuses = getProperty(this.data.data, 'bonuses.abilities') || {};

  // Compose roll parts and data
  const parts = ['@mod'];
  data.mod = skill.mod + skill.prof;

  // Ability test bonus
  if (bonuses.check) {
    data.checkBonus = bonuses.check;
    parts.push('@checkBonus');
  }

  // Skill check bonus
  if (bonuses.skill) {
    data.skillBonus = bonuses.skill;
    parts.push('@skillBonus');
  }

  // Check Reliable Talent, applies to any skill check we have full or better proficiency in
  rollFlags.reliableTalent = skill.value >= 1 && this.getFlag('dnd5e', 'reliableTalent');

  // Check Halfling Lucky
  rollFlags.halflingLucky = this.getFlag('dnd5e', 'halflingLucky');

  return parts;
}

/**
 * Builds the parts array and modifies the data and rollFlags as needed
 * @param {string} checkId
 * @param {object} data           Data to be modified
 * @param {object} rollFlags      Roll flags to be modified based on data
 */
function buildAbilityCheckParts({
  checkId, data, rollFlags,
}) {
  const abl = this.data.data.abilities[checkId];

  // Construct parts
  const parts = ['@mod'];
  data.mod = abl.mod;

  // Add feat-related proficiency bonuses
  const feats = this.data.flags.dnd5e || {};
  if (feats.remarkableAthlete && DND5E.characterFlags.remarkableAthlete.abilities.includes(checkId)) {
    parts.push('@proficiency');
    data.proficiency = Math.ceil(0.5 * this.data.data.attributes.prof);
  } else if (feats.jackOfAllTrades) {
    parts.push('@proficiency');
    data.proficiency = Math.floor(0.5 * this.data.data.attributes.prof);
  }

  // Add global actor bonus
  const bonuses = getProperty(this.data.data, 'bonuses.abilities') || {};
  if (bonuses.check) {
    parts.push('@checkBonus');
    data.checkBonus = bonuses.check;
  }

  return parts;
}

/**
 * Builds the parts array and modifies the data and rollFlags as needed
 * @param {string} checkId
 * @param {object} data           Data to be modified
 * @param {object} rollFlags      Roll flags to be modified based on data
 */
function buildAbilitySaveParts({
  checkId, data, rollFlags,
}) {
  const abl = this.data.data.abilities[checkId];

  // Construct parts
  const parts = ['@mod'];
  data.mod = abl.mod;

  // Include proficiency bonus
  if (abl.prof > 0) {
    parts.push('@prof');
    data.prof = abl.prof;
  }

  // Include a global actor ability save bonus
  const bonuses = getProperty(this.data.data, 'bonuses.abilities') || {};
  if (bonuses.save) {
    parts.push('@saveBonus');
    data.saveBonus = bonuses.save;
  }

  return parts;
}

async function rollCheck({
  checkId, action, type,
  event = { altKey: false, ctrlKey: false, metaKey: false },
  message, vantage = false, options = {},
}) {
  const rollFlags = {};
  const htmlFlags = {};
  const data = {};
  let parts = [];

  switch (type) {
    case ABILITY:
      parts = buildAbilityCheckParts.bind(this)({
        checkId, data, rollFlags, options,
      });
      break;
    case SAVE:
      parts = buildAbilitySaveParts.bind(this)({
        checkId, data, rollFlags, options,
      });
      break;
    case SKILL:
      parts = buildSkillCheckParts.bind(this)({
        checkId, data, rollFlags, options,
      });
      break;
    default:
  }

  // Add provided extra roll parts
  if (options.parts?.length > 0) {
    parts.push(...options.parts);
  }

  // Add provided data associated with extra roll parts
  if (options.data) {
    mergeObject(data, options.data);
  }

  let advantage = 0;
  if (vantage) {
    advantage = event.ctrlKey || event.metaKey ? -1 : 1;
    htmlFlags.vantageTypeHeader = advantage > 0 ? 'qr-advantage-header' : 'qr-disadvantage-header';
  }

  rollFlags.fumble = 1;
  rollFlags.critical = 20;
  const checkRoll = rollD20({
    parts, rollData: data, advantage, flags: rollFlags,
  });
  if (checkRoll === false) return null;

  const headerKey = (advantage > 0 && 'QR.Advantage') || (advantage < 0 && 'QR.Disadvantage') || 'QR.Roll';
  htmlFlags.isPC = this.isPC;
  await updateButtonAndHeader({
    contentNode: $(message.data.content), roll: checkRoll, action, headerKey, message, flags: htmlFlags,
  });

  return checkRoll;
}

/**
 * Roll a hit die of the appropriate type, gaining hit points equal to the die roll plus your CON modifier
 * @param {string} [denomination]   The hit denomination of hit die to roll. Example "d8".
 *                                  If no denomination is provided, the first available HD will be used
 * @param {boolean} [dialog]        Show a dialog prompt for configuring the hit die roll?
 * @return {Promise<Roll|null>}     The created Roll instance, or null if no hit die was rolled
 */
async function rollHitDie(denomination, { dialog = true } = {}) {
  // If no denomination was provided, choose the first available
  let cls = null;
  if (!denomination) {
    cls = this.itemTypes.class.find((c) => c.data.data.hitDiceUsed < c.data.data.levels);
    if (!cls) return null;
    denomination = cls.data.data.hitDice;
  }

  // Otherwise locate a class (if any) which has an available hit die of the requested denomination
  else {
    cls = this.items.find((i) => {
      const d = i.data.data;
      return (d.hitDice === denomination) && ((d.hitDiceUsed || 0) < (d.levels || 1));
    });
  }

  // If no class is available, display an error notification
  if (!cls) {
    ui.notifications.error(game.i18n.format('DND5E.HitDiceWarn', { name: this.name, formula: denomination }));
    return null;
  }

  // Prepare roll data
  const parts = [`1${denomination}`, '@abilities.con.mod'];
  const rollData = duplicate(this.data.data);

  // Call the roll helper utility
  const roll = rollArbitrary({ parts, rollData, isCritical: false });
  if (!roll) return null;

  const { data, token } = this;
  const hasDataToken = !!(data && data.token);
  const templateData = {
    actor: this,
    tokenId: token ? `${token.scene._id}.${token.id}` : null,
    img: hasDataToken ? data.token.img : this.img,
    name: hasDataToken ? data.token.name : this.name,
    titleText: 'Roll Hit Dice',
    isSingleRoll: true,
  };

  // Render the chat card template
  const template = `${TEMPLATE_PATH_PREFIX}/roll-card.html`;
  const html = await renderTemplate(template, templateData);

  // Create the ChatMessage data object
  const chatData = {
    user: game.user._id,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    content: html,
    speaker: ChatMessage.getSpeaker({ actor: this, token }),
    flags: { 'core.canPopout': true },
  };

  // Apply the roll mode to adjust message visibility
  const rollMode = game.settings.get('core', 'rollMode');
  ChatMessage.applyRollMode(chatData, rollMode);

  // Create the chat message
  const message = await ChatMessage.create(chatData, { rollMode });

  toggleAllDisabledButtonState({ messageId: message.id, isDisable: true });
  const headerKey = game.i18n.format('QR.Roll');
  await updateButtonAndHeader({
    contentNode: $(message.data.content), roll, action: DAMAGE, headerKey, message,
  });
  toggleAllDisabledButtonState({ messageId: message.id, isDisable: false });
  scrollToBottom();

  // Adjust actor data
  await cls.update({ 'data.hitDiceUsed': cls.data.data.hitDiceUsed + 1 });
  const { hp } = this.data.data.attributes;
  const dhp = Math.min(hp.max + (hp.tempmax ?? 0) - hp.value, roll.total);
  await this.update({ 'data.attributes.hp.value': hp.value + dhp });

  return roll;
}

function rollAbilityTest(ability, options = {}) {
  displayCard.bind(this)({
    event: options.event, createMessage: true, id: ability, type: ABILITY, options,
  });
}

function rollAbilitySave(ability, options = {}) {
  displayCard.bind(this)({
    event: options.event, createMessage: true, id: ability, type: SAVE, options,
  });
}

function rollSkill(skill, options = {}) {
  displayCard.bind(this)({
    event: options.event, createMessage: true, id: skill, type: SKILL, options,
  });
}

function activateListeners(html) {
  this.originalActivateListeners(html);

  // Only activate listeners for non-tidy5e sheets
  if (!isTidy5eSheetActive(html)) {
    // Modificator Ability Check
    html.find('.ability-mod').click(async (event) => {
      event.preventDefault();
      const { ability } = event.currentTarget.parentElement.parentElement.dataset;
      this.actor.rollAbilityTest(ability, { event });
    });

    // Modificator Ability Saving Throw
    html.find('.ability-save').click(async (event) => {
      event.preventDefault();
      const { ability } = event.currentTarget.parentElement.parentElement.dataset;
      this.actor.rollAbilitySave(ability, { event });
    });
  }
}

export const overrideActorEntity = () => {
  CONFIG.Actor.entityClass._getChatCardActor = _getChatCardActor;
  CONFIG.Actor.entityClass._onChatCardAction = _onChatCardAction;
  CONFIG.Actor.entityClass.chatListeners = chatListeners;

  CONFIG.Actor.entityClass.prototype.rollAbility = rollAbility;
  CONFIG.Actor.entityClass.prototype.rollAbilitySave = rollAbilitySave;
  CONFIG.Actor.entityClass.prototype.rollAbilityTest = rollAbilityTest;
  CONFIG.Actor.entityClass.prototype.rollCheck = rollCheck;
  CONFIG.Actor.entityClass.prototype.rollHitDie = rollHitDie;
  CONFIG.Actor.entityClass.prototype.rollSkill = rollSkill;
};

export const overrideActorSheet = () => {
  Object.values(CONFIG.Actor.sheetClasses).forEach((type) => Object.values(type).forEach((sheet) => {
    if (sheet.id.includes('dnd5e.ActorSheet5e')) {
      sheet.cls.prototype.originalActivateListeners = sheet.cls.prototype.activateListeners;
      sheet.cls.prototype.activateListeners = activateListeners;
    }
    sheet.cls.prototype._onItemRoll = _onItemRoll;
    sheet.cls.prototype._onRollSkillCheck = _onRollSkillCheck;
    sheet.cls.prototype._onRollAbilityTest = _onRollAbilityTest;
  }));
};
