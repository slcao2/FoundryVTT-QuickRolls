export const TEMPLATE_PATH_PREFIX = 'modules/quick-rolls/templates';

const PERMISSION_OWNER = 3;

function getGMUsers() {
  const gmUsers = [];
  game.users.forEach((value, key) => {
    if (value.isGM) {
      gmUsers.push(key);
    }
  });
  return gmUsers;
}

export function ownedOnlyByGM(actor) {
  const { permission } = actor.data;
  const gmUsers = getGMUsers();
  let isOnlyGmOwned = true;
  Object.keys(permission).forEach((perm) => {
    if (permission[perm] === PERMISSION_OWNER && !gmUsers.includes(perm)) {
      isOnlyGmOwned = false;
    }
  });
  return isOnlyGmOwned;
}
