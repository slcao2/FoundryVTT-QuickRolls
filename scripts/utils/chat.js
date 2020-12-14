import { diceSoNiceShowForRoll } from './diceSoNiceHelpers.js';
import { getRollTotal, nodeToHtml, replaceClassNode } from './domUtils.js';
import {
  ATTACK, DAMAGE, VANTAGE, VERSATILE,
} from './helpers.js';
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

export const buildDamageRollHtmlNode = async ({ rolls, types }) => {
  const NONE = 'none';
  const typeIconMap = {
    none: 'ban',
    acid: 'vial',
    bludgeoning: 'hammer',
    cold: 'snowflake',
    fire: 'fire',
    force: 'hand-paper',
    lightning: 'bolt',
    necrotic: 'skull',
    piercing: 'long-arrow-alt-right',
    poison: 'skull-crossbones',
    psychic: 'brain',
    radiant: 'sun',
    slashing: 'slash',
    thunder: 'volume-up',
    healing: 'plus',
    temphp: 'shield-alt',
  };
  const min = 1;
  const templateData = {
    diceFormula: rolls.map((roll) => roll.formula).join(' + '),
    rolls: rolls.map((roll, index) => ({
      formula: roll.formula,
      type: types[index] || NONE,
      typeIcon: typeIconMap[types[index] || NONE],
      total: roll.total,
      roll: roll.dice.map((die) => die.results.map((r) => (
        {
          diceSize: die.faces,
          result: r.result,
          isMin: r.result === min,
          isMax: r.result === die.faces,
          isDiscarded: !r.active,
        }
      ))).flat(),
    })),
  };
  const node = await renderTemplate(`${TEMPLATE_PATH_PREFIX}/dice-roll.html`, templateData);
  return $(node);
};

export const updateButtonAndHeader = async ({
  contentNode, roll, rollHtmlNode = null, action, headerKey, message, flags = {},
}) => {
  if (Array.isArray(roll)) {
    await Promise.all(roll.map((r) => diceSoNiceShowForRoll({ roll: r, messageId: message.id })));
  } else {
    await diceSoNiceShowForRoll({ roll, messageId: message.id });
  }

  if (!rollHtmlNode) {
    const rollHtml = await roll.render();
    rollHtmlNode = $(rollHtml);
  }

  updateRollClass({ action, rollNode: rollHtmlNode, flags: { isCritical: roll?.isCritical, isFumble: roll?.isFumble } });
  replaceClassNode({ node: contentNode, targetClass: `qr-${action}`, replacementNode: rollHtmlNode });

  const headerTemplateData = {
    action,
    headerText: game.i18n.localize(headerKey),
    vantageTypeHeader: flags.vantageTypeHeader,
  };
  const headerHtml = await renderTemplate(`${TEMPLATE_PATH_PREFIX}/button-header.html`, headerTemplateData);
  const headerHtmlNode = $(headerHtml);
  replaceClassNode({ node: contentNode, targetClass: `qr-${action}-header`, replacementNode: headerHtmlNode });

  updateChatClass({ node: contentNode, message, action });

  await message.update({ content: nodeToHtml(contentNode) });
};
