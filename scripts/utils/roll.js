import { error } from './logger.js';
import {
  moduleName, SETTING_CRIT_CALCULATION,
  CRIT_CALCULATION_DEFAULT, CRIT_CALCULATION_MAXCRITDICE,
} from '../settings.js';

export const rollD20 = ({
  parts = [], rollData, advantage = 0, flags = {},
}) => {
  let numberOfDice = 1;
  let modifiers = '';

  // Apply Halfling Lucky
  if (flags.halflingLucky) {
    modifiers += 'r=1';
  }

  // Apply Elven Accuracy
  if (advantage > 0 && flags.elvenAccuracy) {
    numberOfDice = 2;
    modifiers += 'kh';
  }

  const formula = `${numberOfDice}d20${modifiers}`;

  parts.unshift(formula);

  const roll = new Roll(parts.join(' + '), rollData);

  try {
    roll.roll();
  } catch (err) {
    error(err);
    ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
    return null;
  }

  roll.dice.forEach((d) => {
    if (d.faces === 20) {
      d.options.critical = flags.critical;
      d.options.fumble = flags.fumble;
    }
    d.results.forEach((r) => {
      if (r.active && d.options.critical === r.result) {
        roll.isCritical = true;
      } else if (r.active && d.options.fumble === r.result) {
        roll.isFumble = true;
      }
    });
  });

  return roll;
};

export function calculateCrit({
  parts, rollData, roll, criticalMultiplier, criticalBonusDice,
}) {
  const critType = game.settings.get(moduleName, SETTING_CRIT_CALCULATION);
  switch (critType) {
    case CRIT_CALCULATION_DEFAULT:
      roll.alter(criticalMultiplier, 0); // Multiply all dice
      if (roll.terms[0] instanceof Die) { // Add bonus dice for only the main dice term
        roll.terms[0].alter(1, criticalBonusDice);
        roll._formula = roll.formula;
      }
      break;
    case CRIT_CALCULATION_MAXCRITDICE: {
      parts.push('@crit');
      rollData.crit = 0;
      const dRegex = /[0-9]*d[0-9]+/;
      parts.forEach((part) => {
        part.split('+').map((p) => p.trim()).forEach((p) => {
          if (dRegex.test(p)) {
            rollData.crit += p.split('d').reduce((acc, curr) => acc * curr, 1);
          }
        });
      });
      roll = new Roll(parts.join('+'), rollData);
      break;
    }
    default:
  }
  return roll;
}

export const rollArbitrary = ({
  parts = [], rollData, isCritical = false, flags = {},
}) => {
  const criticalMultiplier = 2;
  // Scale melee critical hit damage
  const criticalBonusDice = flags.criticalBonusDice || 0;

  let roll = new Roll(parts.join(' + '), rollData);
  if (isCritical) {
    roll = calculateCrit({
      parts, rollData, roll, criticalMultiplier, criticalBonusDice,
    });
  }

  try {
    return roll.roll();
  } catch (err) {
    error(err);
    ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
    return null;
  }
};
