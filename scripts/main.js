import { registerSettings } from './settings.js';
import { debug, info } from './utils/logger.js';
import { handleItemClick } from './chat.js';
import { overrideRoller } from './overrides.js';

export const TEMPLATE_PATH_PREFIX = "modules/quick-rolls/templates";

/*
TODO
Hijack the roll button on an item and replace it with an attack roll (roll 2 dice)
Modify the chat card replacing the attack button with the roll result
Modify the damage button on the chat card to roll damage without the prompt
*/

CONFIG.debug.hooks = true;
debug("CONFIG", CONFIG);

const preloadTemplates = () => {
  const templatePaths = [
    `${TEMPLATE_PATH_PREFIX}/item-card.html`,
    `${TEMPLATE_PATH_PREFIX}/tool-card.html`,
  ];
	return loadTemplates(templatePaths);
};

const registerPartials = async () => {
  Handlebars.registerPartial("diceRoll", await $.get(`${TEMPLATE_PATH_PREFIX}/dice-roll.html`, (data) => {
    debug("load html", data);
  }));
};

Hooks.on("init", () => {
  registerSettings();
  preloadTemplates();
  registerPartials();
});

Hooks.on("setup", () => {
  overrideRoller();
});

Hooks.on("ready", () => {
  debug("ready");
});

// Hooks.on("preCreateChatMessage", (data, flags, user) => {
//   debug("preCreateChatMessage", data, flags, user);
// });

// Hooks.on("createChatMessage", (chatMessage, flags, user) => {
//   debug("createChatMessage", chatMessage, flags, user);
// });

// Hooks.on("renderChatMessage", (chatMessage, html, data) => {
//   debug("renderChatMessage", chatMessage, html, data);
  
//   // const actorId = $(chatMessage.data.content).data("actor-id");
//   // const itemId = $(chatMessage.data.content).data("item-id");
//   // if (!actorId && !itemId) {
//   //   return;
//   // }

//   // const actor = game.actors.get(actorId);
//   // const item = actor.getOwnedItem(itemId); 
//   // debug("item", item);
//   // const rollData = item.getRollData();
//   // debug("item roll data", item.getRollData())

//   // const attackRollFormula = getAttackRollFormula(rollData);
//   // debug(attackRollFormula);

//   // const rollOne = new Roll(attackRollFormula);
//   // const rollTwo = new Roll(attackRollFormula);

//   // rollOne.evaluate();
//   // rollTwo.evaluate();

//   // debug(rollOne);
//   // debug(rollTwo);

//   handleItemClick(chatMessage, html, data);
// });