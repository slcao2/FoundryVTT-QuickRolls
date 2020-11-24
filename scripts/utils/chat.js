import { moduleName, SETTING_CRIT_CALCULATION, CRIT_CALCULATION_DEFAULT, CRIT_CALCULATION_MAXCRITDICE } from "../settings.js";

export function calculateCrit({ parts, rollData, roll, criticalMultiplier, criticalBonusDice }) {
  const critType = game.settings.get(moduleName, SETTING_CRIT_CALCULATION);
  switch (critType) {
    case CRIT_CALCULATION_DEFAULT:
      roll.alter(criticalMultiplier, 0);      // Multiply all dice
      if ( roll.terms[0] instanceof Die ) {   // Add bonus dice for only the main dice term
        roll.terms[0].alter(1, criticalBonusDice);
        roll._formula = roll.formula;
      }
      break;
    case CRIT_CALCULATION_MAXCRITDICE:
      parts.push("@crit");
      rollData["crit"] = 0;
      const dRegex = /[0-9]*d[0-9]+/;
      parts.forEach(part => {
        part.split("+").map(p => p.trim()).forEach(p => {
          if (dRegex.test(p)) {
            rollData["crit"] += p.split("d").reduce((acc, curr) => acc * curr, 1)
          }
        });
      });
      roll = new Roll(parts.join("+"), rollData);
      break;
  }
  return roll;
}

export async function replaceButton({ headerKey, buttonRegex, headerRegex, message, roll, action }) {
  // Show roll on screen if Dice So Nice enabled
  if (game.dice3d) {
    game.dice3d.showForRoll(roll);
  }
  
  const content = duplicate(message.data.content);
  const rollHtml = await roll.render();
  const modifiedRollHtml = modifyRollHtml({ rollHtml, roll, action, message });
  const updateHeader = `<h4 class="qr-card-button-header qr-${action}-header">${game.i18n.localize(headerKey)}</h4>`
  const updateButton = `${modifiedRollHtml}`;

  const updatedContent = content
    .replace(headerRegex, updateHeader)
    .replace(buttonRegex, updateButton);
  const modifiedContent = modifyChatHtml({ chatHtml: updatedContent, message, action });

  await message.update({ content: modifiedContent })
}

export function modifyChatHtml({ chatHtml, message, action }) {
  const html = $(chatHtml);

  switch (action) {
    case "attack":
      message.isCritical = message.isAttackCritical;
      message.isFumble = message.isAttackFumble;
    case "vantage":
      if ((message.isAdvantage && message.attackRollTotal >= message.vantageRollTotal) || (!message.isAdvantage && message.attackRollTotal <= message.vantageRollTotal)) {
        html.find(".qr-vantage").addClass("qr-discarded");
        message.isCritical = message.isAttackCritical;
        message.isFumble = message.isAttackFumble;
      } else if ((message.isAdvantage && message.attackRollTotal < message.vantageRollTotal) || (!message.isAdvantage && message.attackRollTotal > message.vantageRollTotal)) {
        html.find(".qr-attack").addClass("qr-discarded");
        message.isCritical = message.isVantageCritical;
        message.isFumble = message.isVantageFumble;
      }
      break;
  }

  return html.prop("outerHTML");
}

export function modifyRollHtml({ rollHtml, roll, action, message }) {
  const html = $(rollHtml);
  switch (action) {
    case "attack":
      if (message.isAttackCritical) {
        html.find(".dice-total").addClass("critical");
      } else if (message.isAttackFumble) {
        html.find(".dice-total").addClass("fumble");
      }
      break;
    case "vantage":
      if (message.isVantageCritical) {
        html.find(".dice-total").addClass("critical");
      } else if (message.isVantageFumble) {
        html.find(".dice-total").addClass("fumble");
      }
      break;
  }
  html.first().addClass(`qr-${action}`);
  return html.prop("outerHTML");
}
