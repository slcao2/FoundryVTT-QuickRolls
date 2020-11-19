import { debug } from "./utils/logger.js";

const moduleName = "quick-rolls";
const curryRegister = module => (key, data) => game.settings.register(module, key, data);
const register = curryRegister(moduleName);

// Module Settings
const SETTING_CRIT_CALCULATION = "critCalculation";
const SETTING_AUTO_ROLL_DAMAGE = "autoRollDamage";

// Setting Scope
const SCOPE_WORLD = "world";
const SCOPE_CLIENT = "client";

const CRIT_CALCULATION_DEFAULT = "default";
const CRIT_CALCULATION_MAXCRITDICE = "maxCritDice";

const AUTO_ROLL_DAMAGE_NONE = "none";
const AUTO_ROLL_DAMAGE_DM_ONLY = "dmOnly";
const AUTO_ROLL_DAMAGE_ALL = "all";

export const registerSettings = () => {
  register(SETTING_CRIT_CALCULATION, {
    name: "Crit Calculation",
    hint: "How do you want crits to be calculated?",
    scope: SCOPE_WORLD,
    config: true,
    type: String,
    choices: {
      [CRIT_CALCULATION_DEFAULT]: "Default (Roll double the number of dice)",
      [CRIT_CALCULATION_MAXCRITDICE]: "Max Crit Dice (Roll the normal damage dice and add the max for the crit dice)",
    },
    default: CRIT_CALCULATION_DEFAULT,
    onChange: value => {
      debug(SETTING_CRIT_CALCULATION, value);
    },
  });

  register(SETTING_AUTO_ROLL_DAMAGE, {
    name: "Auto Roll Damage",
    hint: "Who should damage be auto rolled for?",
    scope: SCOPE_WORLD,
    config: true,
    type: String,
    choice: {
      [AUTO_ROLL_DAMAGE_NONE]: "None",
      [AUTO_ROLL_DAMAGE_DM_ONLY]: "DM Only",
      [AUTO_ROLL_DAMAGE_ALL]: "All",
    },
    default: AUTO_ROLL_DAMAGE_DM_ONLY,
    onChange: value => {
      debug(SETTING_AUTO_ROLL_DAMAGE, value);
    },
  });
};