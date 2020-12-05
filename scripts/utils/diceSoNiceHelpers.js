import { toggleAllDisabledButtonState } from './domUtils.js';

export const DICE_SO_NICE = 'dice-so-nice';
export const DICE_SO_NICE_IMMEDIATELY_DISPLAY_CHAT_MESSAGES = 'immediatelyDisplayChatMessages';

export const isDiceSoNiceEnabled = () => game.dice3d;

export const immediatelyDisplayChatMessages = () => game.settings.get(
  DICE_SO_NICE, DICE_SO_NICE_IMMEDIATELY_DISPLAY_CHAT_MESSAGES,
);

export const diceSoNiceShowForRoll = async ({ roll, messageId }) => {
  if (isDiceSoNiceEnabled()) {
    const shouldImmediatelyDisplayChatMessage = immediatelyDisplayChatMessages();
    if (shouldImmediatelyDisplayChatMessage) {
      game.dice3d.showForRoll(roll);
    } else {
      toggleAllDisabledButtonState({ messageId, isDisable: true });
      await game.dice3d.showForRoll(roll);
      toggleAllDisabledButtonState({ messageId, isDisable: false });
    }
  }
};
