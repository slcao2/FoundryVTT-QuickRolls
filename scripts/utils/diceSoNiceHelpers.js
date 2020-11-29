export const DICE_SO_NICE = 'dice-so-nice';
export const DICE_SO_NICE_IMMEDIATELY_DISPLAY_CHAT_MESSAGES = 'immediatelyDisplayChatMessages';

export const isDiceSoNiceEnabled = () => game.dice3d;

export const immediatelyDisplayChatMessages = () => game.settings.get(
  DICE_SO_NICE, DICE_SO_NICE_IMMEDIATELY_DISPLAY_CHAT_MESSAGES,
);
