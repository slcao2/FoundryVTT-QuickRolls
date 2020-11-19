import { debug, warn } from './utils/logger.js';
import { getAttackRollFormula } from './utils/roll.js';

export const TEMPLATE_PATH_PREFIX = "modules/quick-rolls/templates";

export const DATA_ACTION_ATTACK = "attack";
export const DATA_ACTION_DAMAGE = "damage";
export const DATA_ACTION_VERSATILE = "versatile";
export const DATA_ACTION_OTHER = "formula";
export const DATA_ACTION_SAVE = "save";

const ROLL_MODE_PUBLIC_ROLL = "roll";
const ROLL_MODE_PRIVATE_GM_ROLL = "gmroll";
const ROLL_MODE_BLIND_GM_ROLL = "blindroll";
const ROLL_MODE_SELF_ROLL = "selfroll";

const removeActionButton = (action, html) => html.find(`button[data-action='${action}']`).remove();

const replaceActionButton = (action, html, template) => html.find(`button[data-action='${action}']`).replaceWith(template);

export function getWhisperData() {
  const whisperData = {};
  const rollMode = game.settings.get("core", "rollMode");
  switch (rollMode) {
    case ROLL_MODE_BLIND_GM_ROLL:
      whisperData.whisper = ChatMessage.getWhisperRecipients("GM");
      whisperData.blind = true;
      break;
    case ROLL_MODE_PRIVATE_GM_ROLL:
      whisperData.whisper = ChatMessage.getWhisperRecipients("GM");
      break;
    case ROLL_MODE_SELF_ROLL:
      whisperData.whisper = [game.user.id];
    default:
      warn("Unsupported rollMode", rollMode)
  }
  return whisperData;
}

const generateChatData = (content, chatMessage, roll) => {
  const { data } = chatMessage;
  const { blind, speaker, user, whisper } = data;
  const { actor, alias, token } = speaker;

  debug(content);

  return {
    user,
    content,
    speaker: {
      actor,
      token,
      alias,
    },
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    roll,
    blind,
    whisper,
  };
  // {
  //   user: game.user._id,
  //   content: content,
  //   speaker: {
  //     actor: actor._id,
  //     token: actor.token,
  //     alias: actor.token?.name || actor.name
  //   },
  //   type: CONST.CHAT_MESSAGE_TYPES.ROLL,
  //   roll: blankRoll,
  //   rollMode: wd.rollMode,
  //   blind: wd.blind,
  //   sound: (playRollSounds && !has3DDiceSound) ? CONFIG.sounds.dice : null,
  // }
};

export const generateChatRollData = (roll) => {
  const excludedTokens = ["+", "-", "*", "/"];

  const filteredRollTerms = roll.terms.filter(term => !excludedTokens.includes(term) && !!term.formula);
  debug("filteredRollTerms", filteredRollTerms);
  const rollParts = filteredRollTerms.map(term => ({
      formula: term.formula,
      total: term.total,
      rolls: term.results.map(result => ({
        roll: result.result,
      })),
      dice: term.faces,
  }));
  return {
    rollFormula: roll.formula,
    rollParts,
    rollTotal: roll.total,
  };
};

export const handleItemClick = async (chatMessage, html, data) => {
  const actorId = $(data.message.content).data("actor-id");
  const itemId = $(data.message.content).data("item-id");
  if (!actorId && !itemId) {
    return;
  }

  // removeActionButton(DATA_ACTION_ATTACK, html);

  const actor = game.actors.get(actorId);
  const item = actor.getOwnedItem(itemId); 
  debug("item", item);
  const rollData = item.getRollData();
  debug("item roll data", item.getRollData())

  const attackRollFormula = getAttackRollFormula(rollData);
  const rollOne = new Roll(attackRollFormula);
  const rollTwo = new Roll(attackRollFormula);
  rollOne.evaluate();
  rollTwo.evaluate();

  debug(rollOne);
  debug(rollTwo);

  const test = new Roll("3d20+2d4+1");
  test.evaluate();

  debug("test", test);
  debug("generateChatRollData", generateChatRollData(test));
  const attackRoll = await renderTemplate(`${TEMPLATE_PATH_PREFIX}/dice-roll.html`, generateChatRollData(test));
  debug("attackRoll", attackRoll);
  replaceActionButton(DATA_ACTION_ATTACK, html, attackRoll);
  // const chat = await ChatMessage.create(generateChatData(attackRoll, chatMessage, test));
  // debug(chat);
};