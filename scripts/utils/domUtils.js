/**
 * All DOM manipulation should be done on jquery nodes until the very end
 */

export const replaceClassNode = ({ node, targetClass, replacementNode }) => {
  node.find(`.${targetClass}`).replaceWith(replacementNode);
};

// eslint-disable-next-line max-len
export const getDomChatCardNode = ({ messageId }) => $(document).find(`li.chat-message.message[data-message-id=${messageId}]`);

export const toggleAllDisabledButtonState = ({
  messageId, isDisable,
}) => {
  const messageCard = $(document).find(`li.chat-message.message[data-message-id=${messageId}]`);
  messageCard.find('button[data-action]').prop('disabled', isDisable);
};

export const nodeToHtml = (node) => node.prop('outerHTML');

// eslint-disable-next-line max-len
export const isNodeCritical = (node) => node.find('.dice-roll').not('.qr-discarded').find('.dice-total').filter('.critical').length > 0;

export const getRollTotal = (node) => node.find('.dice-total').prop('innerText');
