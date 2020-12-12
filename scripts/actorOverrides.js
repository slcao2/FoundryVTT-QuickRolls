// /**
//  * Cast a Spell, consuming a spell slot of a certain level
//  * @param {Item5e} item   The spell being cast by the actor
//  * @param {Event} event   The originating user interaction which triggered the cast
//  */
// async function useSpell(item, { configureDialog = true, event } = {}) {
//   const originalLevel = item.data.data.level;
//   console.warn('The Actor5e#useSpell method has been deprecated in favor of Item5e#roll');
//   if (item.data.type !== 'spell') throw new Error('Wrong Item type');
//   return item.roll({ event, originalSpellLevel: originalLevel });
// }

/**
 * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
 * @private
 */
function _onItemRoll(event) {
  event.preventDefault();
  const { itemId } = event.currentTarget.closest('.item').dataset;
  const item = this.actor.getOwnedItem(itemId);
  return item.roll({ event });
}

// export const overrideActorSetup = () => {
//   CONFIG.Actor.entityClass.prototype.useSpell = useSpell;
// };

export const overrideActor = () => {
  Object.values(CONFIG.Actor.sheetClasses).forEach((type) => Object.values(type).forEach((sheet) => {
    sheet.cls.prototype._onItemRoll = _onItemRoll;
  }));
};
