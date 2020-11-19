import { debug } from "./utils/logger.js";
import { getAttackRollFormula } from "./utils/roll.js";
import { generateChatRollData } from "./chat.js";

/**
 * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
 * @param {boolean} [configureDialog]     Display a configuration dialog for the item roll, if applicable?
 * @param {string} [rollMode]             The roll display mode with which to display (or not) the card
 * @param {boolean} [createMessage]       Whether to automatically create a chat message (if true) or simply return
 *                                        the prepared chat message data (if false).
 * @return {Promise}
 */
export async function rollItem({configureDialog=true, rollMode=null, createMessage=true}={}) {
  debug("this", this);

  const attackRollFormula = getAttackRollFormula(this.getRollData());
  const attackRoll = new Roll(attackRollFormula);
  const advDisRoll = new Roll(attackRollFormula);
  attackRoll.evaluate();
  advDisRoll.evaluate();

  // Basic template rendering data
  const token = this.actor.token;
  const templateData = {
    actor: this.actor,
    tokenId: token ? `${token.scene._id}.${token.id}` : null,
    item: this.data,
    data: this.getChatData(),
    labels: this.labels,
    hasAttack: this.hasAttack,
    isHealing: this.isHealing,
    hasDamage: this.hasDamage,
    isVersatile: this.isVersatile,
    isSpell: this.data.type === "spell",
    hasSave: this.hasSave,
    hasAreaTarget: this.hasAreaTarget,
    attackRoll: generateChatRollData(attackRoll),
    advDisRoll: generateChatRollData(advDisRoll),
  };

  // For feature items, optionally show an ability usage dialog
  if (this.data.type === "feat") {
    let configured = await this._rollFeat(configureDialog);
    if ( configured === false ) return;
  } else if ( this.data.type === "consumable" ) {
    let configured = await this._rollConsumable(configureDialog);
    if ( configured === false ) return;
  }

  // For items which consume a resource, handle that here
  const allowed = await this._handleResourceConsumption({isCard: true, isAttack: false});
  if ( allowed === false ) return;

  // Render the chat card template
  const templateType = ["tool"].includes(this.data.type) ? this.data.type : "item";
  const template = `modules/quick-rolls/templates/${templateType}-card.html`;
  const html = await renderTemplate(template, templateData);

  // Basic chat message data
  const chatData = {
    user: game.user._id,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    content: html,
    flavor: this.data.data.chatFlavor || this.name,
    speaker: {
      actor: this.actor._id,
      token: this.actor.token,
      alias: this.actor.name
    },
    flags: {"core.canPopout": true}
  };

  // If the consumable was destroyed in the process - embed the item data in the surviving message
  if ( (this.data.type === "consumable") && !this.actor.items.has(this.id) ) {
    chatData.flags["dnd5e.itemData"] = this.data;
  }

  // Toggle default roll mode
  rollMode = rollMode || game.settings.get("core", "rollMode");
  if ( ["gmroll", "blindroll"].includes(rollMode) ) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
  if ( rollMode === "blindroll" ) chatData["blind"] = true;

  // Roll 3D dice on screen if Dice So Nice is enabled
  if (game.dice3d) {
    game.dice3d.showForRoll(attackRoll);
    game.dice3d.showForRoll(advDisRoll);
  }

  // Create the chat message
  if ( createMessage ) return ChatMessage.create(chatData);
  else return chatData;
};

/**
 * Place a damage roll using an item (weapon, feat, spell, or equipment)
 * Rely upon the damageRoll logic for the core implementation.
 * @param {MouseEvent} [event]    An event which triggered this roll, if any
 * @param {number} [spellLevel]   If the item is a spell, override the level for damage scaling
 * @param {boolean} [versatile]   If the item is a weapon, roll damage using the versatile formula
 * @param {object} [options]      Additional options passed to the damageRoll function
 * @return {Promise<Roll>}        A Promise which resolves to the created Roll instance
 */
export async function rollDamage({event, spellLevel=null, versatile=false, options={}}={}) {
  
  if ( !this.hasDamage ) throw new Error("You may not make a Damage Roll with this Item.");
  const itemData = this.data.data;
  const actorData = this.actor.data.data;
  const messageData = {"flags.dnd5e.roll": {type: "damage", itemId: this.id }};

  const button = event.currentTarget;
  const card = button.closest(".chat-card");
  const messageId = card.closest(".message").dataset.messageId;
  const message =  game.messages.get(messageId);

  // Get roll data
  const parts = itemData.damage.parts.map(d => d[0]);
  const rollData = this.getRollData();
  if ( spellLevel ) rollData.item.level = spellLevel;

  // Adjust damage from versatile usage
  if ( versatile && itemData.damage.versatile ) {
    parts[0] = itemData.damage.versatile;
    messageData["flags.dnd5e.roll"].versatile = true;
  }

  // Scale damage from up-casting spells
  if ( (this.data.type === "spell") ) {
    if ( (itemData.scaling.mode === "cantrip") ) {
      const level = this.actor.data.type === "character" ? actorData.details.level : actorData.details.spellLevel;
      this._scaleCantripDamage(parts, itemData.scaling.formula, level, rollData);
    }
    else if ( spellLevel && (itemData.scaling.mode === "level") && itemData.scaling.formula ) {
      const scaling = itemData.scaling.formula;
      this._scaleSpellDamage(parts, itemData.level, spellLevel, scaling, rollData);
    }
  }

  // Add damage bonus formula
  const actorBonus = getProperty(actorData, `bonuses.${itemData.actionType}`) || {};
  if ( actorBonus.damage && (parseInt(actorBonus.damage) !== 0) ) {
    parts.push(actorBonus.damage);
  }

  // Add ammunition damage
  if ( this._ammo ) {
    parts.push("@ammo");
    rollData["ammo"] = this._ammo.data.data.damage.parts.map(p => p[0]).join("+");
    delete this._ammo;
  }

  // Prepare Message Data
  // parts = parts.concat(["@bonus"]);
  parts.push("@bonus");

  // Define inner roll function
  const _roll = function(parts, crit, form) {
    const criticalMultiplier = 2;
    // Scale melee critical hit damage
    const criticalBonusDice = itemData.actionType === "mwak" ? this.actor.getFlag("dnd5e", "meleeCriticalDamageDice") ?? 0 : 0;

    // Optionally include a situational bonus
    if ( form ) {
      rollData['bonus'] = form.bonus.value;
      messageOptions.rollMode = form.rollMode.value;
    }
    if (!rollData["bonus"]) parts.pop();

    // Create the damage roll
    let roll = new Roll(parts.join("+"), rollData);

    // Modify the damage formula for critical hits
    if ( crit === true ) {
      roll.alter(criticalMultiplier, 0);      // Multiply all dice
      if ( roll.terms[0] instanceof Die ) {   // Add bonus dice for only the main dice term
        roll.terms[0].alter(1, criticalBonusDice);
        roll._formula = roll.formula;
      }
      if ( "flags.dnd5e.roll" in messageData ) messageData["flags.dnd5e.roll"].critical = true;
    }

    // Execute the roll
    try {
      return roll.roll();
    } catch(err) {
      console.error(err);
      ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
      return null;
    }
  };

  const critical = false;
  // Create the Roll instance
  const damageRoll = _roll.bind(this)(parts, critical || event.altKey);

  if (game.dice3d) {
    game.dice3d.showForRoll(damageRoll);
  }

  const content = duplicate(message.data.content);
  const damageRegex = /<button data-action="damage">[^<]*<\/button>/;
  const versatileRegex = /<button data-action="versatile">[^<]*<\/button>/;

  const damageRollHtml = await damageRoll.render();
  const headerString = versatile ? "Versatile" : "Damage";
  const updateString = `<h4 class="quick-rolls-card-button-header">${headerString}</h4>${damageRollHtml}`;
  const replaceRegex = versatile ? versatileRegex : damageRegex;

  const replacedContent = content.replace(replaceRegex, updateString);
  message.update({ content: replacedContent });

  return damageRoll;
}

export const overrideRoller = () => {
  CONFIG.Item.entityClass.prototype.roll = rollItem;
  CONFIG.Item.entityClass.prototype.rollDamage = rollDamage;
};
