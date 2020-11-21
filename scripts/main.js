import { registerSettings } from './settings.js';
import { debug } from './utils/logger.js';
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
