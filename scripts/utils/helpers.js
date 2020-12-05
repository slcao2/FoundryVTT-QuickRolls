export const ATTACK = 'attack';
export const VANTAGE = 'vantage';
export const DAMAGE = 'damage';
export const VERSATILE = 'versatile';
export const FORMULA = 'formula';

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

export const hasVantageFromEvent = (event) => event.altKey || event.ctrlKey || event.metaKey;
