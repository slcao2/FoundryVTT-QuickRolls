const SKILL_CUSTOMIZATION = 'skill-customization-5e';
const SKILL_CUSTOMIZATION_SKILL_BONUS_KEY = 'skill-bonus';

export const isSkillCustomizationEnabled = () => !!game.modules.get(SKILL_CUSTOMIZATION)?.active;

export const getSkillCustomizationForSkill = (actor, skillId) => {
  const skillBonus = actor.getFlag(SKILL_CUSTOMIZATION, `${skillId}.${SKILL_CUSTOMIZATION_SKILL_BONUS_KEY}`);
  return skillBonus || 0;
};
