import { registerSettings } from './settings.js';
import { debug } from './utils/logger.js';
import { overrideItem } from './itemOverrides.js';
import { overrideActorSetup, overrideActor } from './actorOverrides.js';

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

Hooks.on("init", () => {
  registerSettings();
  preloadTemplates();
});

Hooks.on("setup", () => {
  overrideItem();
  overrideActorSetup();
});

Hooks.on("ready", () => {
  overrideActor();
});
