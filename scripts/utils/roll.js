import { error } from './logger.js';
import { get } from './utilities.js';

export const ROLL_STATE_ADVANTAGE = "ADVANTAGE";
export const ROLL_STATE_DISADVANTAGE = "DISADVANTAGE";

export const ACTION_TYPE_MELEE_WEAPON_ATTACK = "mwak";
export const ACTION_TYPE_RANGED_WEAPON_ATTACK = "rwak";
export const ACTION_TYPE_MELEE_SPELL_ATTACK = "msak";
export const ACTION_TYPE_RANGED_SPELL_ATTACK = "rsak";
export const ACTION_TYPE_HEAL = "heal"

export const DAMAGE_PARTS_MAIN = "main";
export const DAMAGE_PARTS_VERSATILE = "versatile";
export const DAMAGE_PARTS_OTHER = "other";

const isAttackRoll = (actionType) => {
  return actionType === ACTION_TYPE_MELEE_WEAPON_ATTACK ||
    actionType === ACTION_TYPE_RANGED_WEAPON_ATTACK || 
    actionType === ACTION_TYPE_MELEE_SPELL_ATTACK ||
    actionType === ACTION_TYPE_RANGED_SPELL_ATTACK;
};

const isDamageRollOfParts = (rollData, damageParts) => {
  switch (damageParts) {
    case DAMAGE_PARTS_MAIN:
      return get(rollData, "item.damage.parts", []).length > 0;
    case DAMAGE_PARTS_VERSATILE:
      return get(rollData, "item.damage.versatile");
    case DAMAGE_PARTS_OTHER:
      return get(rollData, "item.formula");
    default: 
      return false;
  }
};

export const getAttackRollFormula = (rollData, rollState) => {
  const { bonuses, item, prof, mod } = rollData;
  if (!isAttackRoll(item.actionType)) {
    error("Not a valid attack action type", rollData);
    return "0";
  }

  const rollFormula = [];

  let baseDice;
  switch (rollState) {
    case ROLL_STATE_ADVANTAGE:
      baseDice = "2d20kh";
      break;
    case ROLL_STATE_DISADVANTAGE:
      baseDice = "2d20kl";
      break;
    default:
      baseDice = "1d20";
  }
  rollFormula.push(baseDice);

  const globalMod = bonuses[item.actionType].attack;
  rollFormula.push(globalMod);

  rollFormula.push(prof);
  rollFormula.push(mod);
  rollFormula.push(item.attackBonus)

  return rollFormula.filter(part => !!part).join("+");
};

export const getDamageRollFormula = (rollData, damageParts, isCritical) => {
  const { bonuses, item } = rollData;
  if (!isDamageRollOfParts(rollData, damageParts)) {
    error("No valid damage roll data", rollData);
    return "0";
  }

  const rollFormula = [];

  const globalMod = bonuses[item.actionType].damage;
  rollFormula.push(globalMod);

  return rollFormula.filter(part => !!part).join("+");
};
