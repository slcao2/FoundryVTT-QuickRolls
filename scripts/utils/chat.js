import { diceSoNiceShowForRoll } from './diceSoNiceHelpers.js';
import { getRollTotal, nodeToHtml, replaceClassNode } from './domUtils.js';
import { ATTACK, VANTAGE } from './helpers.js';
import { debug } from './logger.js';
import { TEMPLATE_PATH_PREFIX } from './templatePathPrefix.js';
import { DEFAULT_RADIX } from './utilities.js';

export function replaceRollString({
  action, message, newRollHtml,
}) {
  const content = $(duplicate(message.data.content));
  const oldRoll = content.find(`.qr-${action}`);
  oldRoll.replaceWith($(newRollHtml));
  return content.prop('outerHTML');
}

const updateRollClass = ({
  action, rollNode, flags = {},
}) => {
  rollNode.first().addClass(`qr-${action}`);
  switch (action) {
    case ATTACK:
    case VANTAGE:
      if (flags.isCritical) {
        rollNode.find('.dice-total').addClass('critical');
      } else if (flags.isFumble) {
        rollNode.find('.dice-total').addClass('fumble');
      }
      break;
    default:
  }
};

const updateChatClass = ({ node, message, action }) => {
  switch (action) {
    case ATTACK:
    case VANTAGE: {
      const attackNode = node.find('.qr-attack');
      const vantageNode = node.find('.qr-vantage').filter('.dice-roll');

      const hasVantage = vantageNode.length > 0;
      const isAdvantage = node.find('.qr-advantage-header').length > 0;
      const isDisadvantage = node.find('.qr-disadvantage-header').length > 0;

      const attackTotal = parseInt(getRollTotal(attackNode), DEFAULT_RADIX);
      const vantageTotal = parseInt(getRollTotal(vantageNode), DEFAULT_RADIX);
      debug('attackTotal', attackTotal);
      debug('vantageTotal', vantageTotal);

      if (hasVantage) {
        attackNode.removeClass('qr-discarded');
        vantageNode.removeClass('qr-discarded');
        if (isAdvantage) {
          if (attackTotal >= vantageTotal) {
            vantageNode.addClass('qr-discarded');
          } else {
            attackNode.addClass('qr-discarded');
          }
        } else if (isDisadvantage) {
          if (attackTotal <= vantageTotal) {
            vantageNode.addClass('qr-discarded');
          } else {
            attackNode.addClass('qr-discarded');
          }
        }
      }
      break;
    }
    default:
  }
};

export const updateButtonAndHeader = async ({
  contentNode, roll, action, headerKey, message, flags = {},
}) => {
  await diceSoNiceShowForRoll({ roll, messageId: message.id });

  const rollHtml = await roll.render();
  const rollHtmlNode = $(rollHtml);
  updateRollClass({ action, rollNode: rollHtmlNode, flags: { isCritical: roll.isCritical, isFumble: roll.isFumble } });
  replaceClassNode({ node: contentNode, targetClass: `qr-${action}`, replacementNode: rollHtmlNode });

  const headerTemplateData = {
    action,
    headerText: game.i18n.localize(headerKey),
    vantageTypeHeader: flags.vantageTypeHeader,
  };
  debug('vantageTypeHeader', flags.vantageTypeHeader);
  const headerHtml = await renderTemplate(`${TEMPLATE_PATH_PREFIX}/button-header.html`, headerTemplateData);
  const headerHtmlNode = $(headerHtml);
  replaceClassNode({ node: contentNode, targetClass: `qr-${action}-header`, replacementNode: headerHtmlNode });

  updateChatClass({ node: contentNode, message, action });

  await message.update({ content: nodeToHtml(contentNode) });
};
