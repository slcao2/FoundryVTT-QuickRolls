import { toggleAllDisabledButtonState } from '../utils/domUtils.js';
import { getWhisperData } from '../utils/helpers.js';
import { debug } from '../utils/logger.js';
import { sleep } from '../utils/utilities.js';

export const DICE_SO_NICE = 'dice-so-nice';
export const DICE_SO_NICE_IMMEDIATELY_DISPLAY_CHAT_MESSAGES = 'immediatelyDisplayChatMessages';
export const DICE_SO_NICE_HIDE_NPC_ROLLS = 'hideNpcRolls';

export const isDiceSoNiceEnabled = () => game.dice3d;

export const immediatelyDisplayChatMessages = () => game.settings.get(
  DICE_SO_NICE, DICE_SO_NICE_IMMEDIATELY_DISPLAY_CHAT_MESSAGES,
);

export const hideNpcRolls = () => game.settings.get(
  DICE_SO_NICE, DICE_SO_NICE_HIDE_NPC_ROLLS,
);

export const diceSoNiceShowForRoll = async ({ roll, messageId, isPC = true }) => {
  if (isDiceSoNiceEnabled() && (isPC || !hideNpcRolls())) {
    const shouldImmediatelyDisplayChatMessage = immediatelyDisplayChatMessages();
    const whisperData = getWhisperData();
    if (shouldImmediatelyDisplayChatMessage) {
      game.dice3d.showForRoll(roll, game.user, true, whisperData.whisper, whisperData.blind);
    } else {
      // needed to disabled the buttons properly
      // https://stackoverflow.com/questions/779379/why-is-settimeoutfn-0-sometimes-useful
      await sleep(0);
      toggleAllDisabledButtonState({ messageId, isDisable: true });
      await game.dice3d.showForRoll(roll, game.user, true, whisperData.whisper, whisperData.blind);
      toggleAllDisabledButtonState({ messageId, isDisable: false });
    }
  }
};
