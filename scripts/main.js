import { registerSettings } from './settings.js';
import { overrideItem } from './itemOverrides.js';
import { overrideActorEntity, overrideActorSheet } from './actorOverrides.js';
import { TEMPLATE_PATH_PREFIX } from './utils/templatePathPrefix.js';

// Import DND5E System files
import Actor5e from '../../../systems/dnd5e/module/actor/entity.js';
import { debug } from './utils/logger.js';

const preloadTemplates = () => {
  const templatePaths = [
    `${TEMPLATE_PATH_PREFIX}/item-card.html`,
    `${TEMPLATE_PATH_PREFIX}/tool-card.html`,
    `${TEMPLATE_PATH_PREFIX}/button-header.html`,
  ];
  return loadTemplates(templatePaths);
};

Hooks.on('init', () => {
  registerSettings();
  preloadTemplates();
});

Hooks.on('setup', () => {
  overrideItem();
  overrideActorEntity();
});

Hooks.on('ready', () => {
  overrideActorSheet();
});

Hooks.on('renderChatLog', (app, html, data) => Actor5e.chatListeners(html));
Hooks.on('renderChatPopout', (app, html, data) => Actor5e.chatListeners(html));
