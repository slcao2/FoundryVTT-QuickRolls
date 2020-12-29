import { debug } from './logger.js';

export const ATTACK = 'attack';
export const VANTAGE = 'vantage';
export const DAMAGE = 'damage';
export const VERSATILE = 'versatile';
export const FORMULA = 'formula';

export const ROLL = 'roll';
export const ABILITY = 'ability';
export const SAVE = 'save';
export const SKILL = 'skill';

const PERMISSION_OWNER = 3;

const getGMUsers = () => {
  const gmUsers = [];
  game.users.forEach((value, key) => {
    if (value.isGM) {
      gmUsers.push(key);
    }
  });
  return gmUsers;
};

export const getWhisperData = () => {
  let rollMode = null;
  let whisper;
  let blind = null;

  rollMode = game.settings.get('core', 'rollMode');
  if (['gmroll', 'blindroll'].includes(rollMode)) whisper = ChatMessage.getWhisperRecipients('GM');
  if (rollMode === 'blindroll' && !getGMUsers().includes(game.user._id)) blind = true;
  else if (rollMode === 'selfroll') whisper = [game.user._id];

  return { rollMode, whisper, blind };
};

export const ownedOnlyByGM = (actor) => {
  const { permission } = actor.data;
  const gmUsers = getGMUsers();
  let isOnlyGmOwned = true;
  Object.keys(permission).forEach((perm) => {
    if (permission[perm] === PERMISSION_OWNER && !gmUsers.includes(perm)) {
      isOnlyGmOwned = false;
    }
  });
  return isOnlyGmOwned;
};

export const getTargetActors = () => {
  const { character } = game.user;
  const { controlled } = canvas.tokens;

  if (controlled.length === 0) return [character] || null;
  if (controlled.length > 0) {
    const actors = controlled.map((c) => c.actor);
    return actors;
  }
  throw new Error('You must designate a specific Token as the roll target');
};

export const isScrolledToBottom = () => {
  const chatLog = document.getElementById('chat-log');
  return chatLog.scrollHeight - chatLog.scrollTop === chatLog.clientHeight;
};

export const scrollToBottom = () => {
  const chatLog = document.getElementById('chat-log');
  chatLog.scrollTop = chatLog.scrollHeight;
};

export const hasVantageFromEvent = (event) => event && (event.altKey || event.ctrlKey || event.metaKey);
