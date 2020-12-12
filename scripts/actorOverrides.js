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

export const overrideActor = () => {
  Object.values(CONFIG.Actor.sheetClasses).forEach((type) => Object.values(type).forEach((sheet) => {
    sheet.cls.prototype._onItemRoll = _onItemRoll;
  }));
};
