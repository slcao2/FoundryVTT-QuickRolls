import {
  moduleName, SETTING_CRIT_CALCULATION,
  CRIT_CALCULATION_DEFAULT, CRIT_CALCULATION_MAXCRITDICE,
} from '../settings.js';
import { immediatelyDisplayChatMessages, isDiceSoNiceEnabled } from './diceSoNiceHelpers.js';
import { debug } from './logger.js';

export function resetMessage({ message, vantage }) {
  message.isCritical = undefined;
  message.isFumble = undefined;
  if (vantage) {
    message.isAdvantage = undefined;
    message.isVantageCritical = undefined;
    message.isVantageFumble = undefined;
    message.vantageRollTotal = undefined;
  } else {
    message.isAttackCritical = undefined;
    message.isAttackFumble = undefined;
    message.attackRollTotal = undefined;
  }
}

export function modifyChatHtml({ chatHtml, message, action }) {
  const html = $(chatHtml);

  switch (action) {
    case 'attack':
      if (message.isAdvantage === undefined) {
        message.isCritical = message.isAttackCritical;
        message.isFumble = message.isAttackFumble;
      } else if ((message.isAdvantage && message.attackRollTotal >= message.vantageRollTotal)
      || (!message.isAdvantage && message.attackRollTotal <= message.vantageRollTotal)) {
        html.find('.qr-vantage').addClass('qr-discarded');
        html.find('.qr-attack').removeClass('qr-discarded');
        message.isCritical = message.isAttackCritical;
        message.isFumble = message.isAttackFumble;
      } else if ((message.isAdvantage && message.attackRollTotal < message.vantageRollTotal)
      || (!message.isAdvantage && message.attackRollTotal > message.vantageRollTotal)) {
        html.find('.qr-attack').addClass('qr-discarded');
        html.find('.qr-vantage').removeClass('qr-discarded');
        message.isCritical = message.isVantageCritical;
        message.isFumble = message.isVantageFumble;
      }
      break;
    case 'vantage':
      if ((message.isAdvantage && message.attackRollTotal >= message.vantageRollTotal)
      || (!message.isAdvantage && message.attackRollTotal <= message.vantageRollTotal)) {
        html.find('.qr-vantage').addClass('qr-discarded');
        html.find('.qr-attack').removeClass('qr-discarded');
        message.isCritical = message.isAttackCritical;
        message.isFumble = message.isAttackFumble;
      } else if ((message.isAdvantage && message.attackRollTotal < message.vantageRollTotal)
      || (!message.isAdvantage && message.attackRollTotal > message.vantageRollTotal)) {
        html.find('.qr-attack').addClass('qr-discarded');
        html.find('.qr-vantage').removeClass('qr-discarded');
        message.isCritical = message.isVantageCritical;
        message.isFumble = message.isVantageFumble;
      }
      break;
    default:
  }

  return html.prop('outerHTML');
}

export function modifyRollHtml({
  rollHtml, action, message,
}) {
  const html = $(rollHtml);
  switch (action) {
    case 'attack':
      if (message.isAttackCritical) {
        html.find('.dice-total').addClass('critical');
      } else if (message.isAttackFumble) {
        html.find('.dice-total').addClass('fumble');
      }
      break;
    case 'vantage':
      if (message.isVantageCritical) {
        html.find('.dice-total').addClass('critical');
      } else if (message.isVantageFumble) {
        html.find('.dice-total').addClass('fumble');
      }
      break;
    default:
  }
  html.first().addClass(`qr-${action}`);
  return html.prop('outerHTML');
}

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

export async function toggleAllDisabledButtonState({
  messageId, isDisable,
}) {
  const messageCard = $(document).find(`li.chat-message.message[data-message-id=${messageId}]`);
  messageCard.find('button[data-action]').prop('disabled', isDisable);
}

export function replaceRollString({
  action, message, newRollHtml,
}) {
  const content = $(duplicate(message.data.content));
  const oldRoll = content.find(`.qr-${action}`);
  oldRoll.replaceWith($(newRollHtml));
  return content.prop('outerHTML');
}

export async function replaceButton({
  headerKey, buttonRegex, headerRegex, message, roll, action,
}) {
  // Show roll on screen if Dice So Nice enabled
  if (isDiceSoNiceEnabled()) {
    const shouldImmediatelyDisplayChatMessage = immediatelyDisplayChatMessages();
    if (shouldImmediatelyDisplayChatMessage) {
      game.dice3d.showForRoll(roll);
    } else {
      toggleAllDisabledButtonState({ messageId: message.id, isDisable: true });
      await game.dice3d.showForRoll(roll);
      toggleAllDisabledButtonState({ messageId: message.id, isDisable: false });
    }
  }

  const content = duplicate(message.data.content);
  const rollHtml = await roll.render();
  const modifiedRollHtml = modifyRollHtml({
    rollHtml, roll, action, message,
  });
  const updateHeader = `<h4 class="qr-card-button-header qr-${action}-header">`
    + `${game.i18n.localize(headerKey)}`
    + `<button data-action="${action}-reroll" class="qr-icon-button">`
    + '<i class="fas fa-redo qr-tooltip"></i>'
    + '</button>'
    + '</h4>';

  let updatedContent = content;

  if (buttonRegex) {
    updatedContent = updatedContent.replace(buttonRegex, modifiedRollHtml);
  } else {
    updatedContent = replaceRollString({ action, message, newRollHtml: modifiedRollHtml });
  }

  if (headerRegex) {
    updatedContent = updatedContent.replace(headerRegex, updateHeader);
  }
  const modifiedContent = modifyChatHtml({ chatHtml: updatedContent, message, action });

  await message.update({ content: modifiedContent });
}
