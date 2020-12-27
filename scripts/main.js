import { registerSettings } from './settings.js';
import { overrideItem } from './itemOverrides.js';
import { overrideActorEntity, overrideActorSheet } from './actorOverrides.js';
import { TEMPLATE_PATH_PREFIX } from './utils/templatePathPrefix.js';
import { registerPartials } from './utils/partials.js';
import { debug } from './utils/logger.js';

// Import DND5E System files
import Actor5e from '../../../systems/dnd5e/module/actor/entity.js';
import Item5e from '../../../systems/dnd5e/module/item/entity.js';

CONFIG.debug.hooks = true;

const preloadTemplates = () => {
  const templatePaths = [
    `${TEMPLATE_PATH_PREFIX}/item-card.html`,
    `${TEMPLATE_PATH_PREFIX}/tool-card.html`,
    `${TEMPLATE_PATH_PREFIX}/button-header.html`,
    `${TEMPLATE_PATH_PREFIX}/dice-roll.html`,
    `${TEMPLATE_PATH_PREFIX}/roll-card.html`,
  ];
  return loadTemplates(templatePaths);
};

Hooks.on('init', () => {
  registerSettings();
  preloadTemplates();
  registerPartials();
});

Hooks.on('setup', () => {
  overrideItem();
  overrideActorEntity();
});

Hooks.on('ready', () => {
  overrideActorSheet();
});

Hooks.on('renderChatLog', (app, html, data) => {
  Actor5e.chatListeners(html);
  Item5e.additionalChatListeners(html);
});

Hooks.on('renderChatPopout', (app, html, data) => {
  Actor5e.chatListeners(html);
  Item5e.additionalChatListeners(html);
});
