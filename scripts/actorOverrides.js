import { debug } from "./utils/logger.js";

/**
 * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
 * @private
 */
function _onItemRoll(event) {
  debug("custom _onItemRoll");
  event.preventDefault();
  const itemId = event.currentTarget.closest(".item").dataset.itemId;
  const item = this.actor.getOwnedItem(itemId);

  // Roll spells through the actor
  if ( item.data.type === "spell" ) {
    return this.actor.useSpell(item, {configureDialog: !event.shiftKey});
  }

  // Otherwise roll the Item directly
  else return item.roll({ event });
}

export const overrideActor = () => {
  Object.values(CONFIG.Actor.sheetClasses).forEach(type => 
      Object.values(type).forEach(sheet => {
        sheet.cls.prototype._onItemRoll = _onItemRoll;
    }));
};
