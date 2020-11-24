import AbilityUseDialog from "./ability-use-dialog.js";
import { debug } from "./utils/logger.js";

/**
 * Cast a Spell, consuming a spell slot of a certain level
 * @param {Item5e} item   The spell being cast by the actor
 * @param {Event} event   The originating user interaction which triggered the cast
 */
async function useSpell(item, {configureDialog=true, event}={}) {
  if ( item.data.type !== "spell" ) throw new Error("Wrong Item type");
  const itemData = item.data.data;

  // Configure spellcasting data
  let lvl = itemData.level;
  const usesSlots = (lvl > 0) && CONFIG.DND5E.spellUpcastModes.includes(itemData.preparation.mode);
  const limitedUses = !!itemData.uses.per;
  let consumeSlot = `spell${lvl}`;
  let consumeUse = false;
  let placeTemplate = false;
  const originalLevel = item.data.data.level;

  // Configure spell slot consumption and measured template placement from the form
  if ( configureDialog && (usesSlots || item.hasAreaTarget || limitedUses) ) {
    const usage = await AbilityUseDialog.create(item);
    if ( usage === null ) return;

    // Determine consumption preferences
    consumeSlot = Boolean(usage.get("consumeSlot"));
    consumeUse = Boolean(usage.get("consumeUse"));
    placeTemplate = Boolean(usage.get("placeTemplate"));

    // Determine the cast spell level
    const isPact = usage.get('level') === 'pact';
    const lvl = isPact ? this.data.data.spells.pact.level : parseInt(usage.get("level"));
    if ( lvl !== item.data.data.level ) {
      const upcastData = mergeObject(item.data, {"data.level": lvl}, {inplace: false});
      item = item.constructor.createOwned(upcastData, this);
    }

    // Denote the spell slot being consumed
    if ( consumeSlot ) consumeSlot = isPact ? "pact" : `spell${lvl}`;
  }

  // Update Actor data
  if ( usesSlots && consumeSlot && (lvl > 0) ) {
    const slots = parseInt(this.data.data.spells[consumeSlot]?.value);
    if ( slots === 0 || Number.isNaN(slots) ) {
      return ui.notifications.error(game.i18n.localize("DND5E.SpellCastNoSlots"));
    }
    await this.update({
      [`data.spells.${consumeSlot}.value`]: Math.max(slots - 1, 0)
    });
  }

  // Update Item data
  if ( limitedUses && consumeUse ) {
    const uses = parseInt(itemData.uses.value || 0);
    if ( uses <= 0 ) ui.notifications.warn(game.i18n.format("DND5E.ItemNoUses", {name: item.name}));
    await item.update({"data.uses.value": Math.max(parseInt(item.data.data.uses.value || 0) - 1, 0)})
  }

  // Initiate ability template placement workflow if selected
  if ( placeTemplate && item.hasAreaTarget ) {
    const template = AbilityTemplate.fromItem(item);
    if ( template ) template.drawPreview();
    if ( this.sheet.rendered ) this.sheet.minimize();
  }

  // Invoke the Item roll
  return item.roll({ event, originalSpellLevel: originalLevel });
}

/**
 * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
 * @private
 */
function _onItemRoll(event) {
  event.preventDefault();
  const itemId = event.currentTarget.closest(".item").dataset.itemId;
  const item = this.actor.getOwnedItem(itemId);

  // Roll spells through the actor
  if ( item.data.type === "spell" ) {
    return this.actor.useSpell(item, {configureDialog: !event.shiftKey, event});
  }

  // Otherwise roll the Item directly
  else return item.roll({ event });
}

export const overrideActorSetup = () => {
  CONFIG.Actor.entityClass.prototype.useSpell = useSpell;
};

export const overrideActor = () => {
  Object.values(CONFIG.Actor.sheetClasses).forEach(type => 
      Object.values(type).forEach(sheet => {
        sheet.cls.prototype._onItemRoll = _onItemRoll;
    }));
};
