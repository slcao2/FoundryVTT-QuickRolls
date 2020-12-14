import { registerSettings } from './settings.js';
import { overrideItem } from './itemOverrides.js';
import { overrideActor } from './actorOverrides.js';
import { TEMPLATE_PATH_PREFIX } from './utils/templatePathPrefix.js';

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
});

Hooks.on('ready', () => {
  overrideActor();
});
