# FoundryVTT-QuickRolls
A module for quicker rolling in FoundryVTT. After using both BetterRolls5e and Midi-QOL, I found some things that I liked about both but were not at the time available in either so I create my own module to get the rolling experience I wanted. Feel free to submit any bugs you find or features you'd like to see and I'll try to address them but no guarantees on whether they will be addressed in a timely manner or at all.

## Compatabilities
Anything that overrides the overriden functions in overrideItem, overrideActor, or overrideActorSetup will likely be incompatible.
* [Dice So Nice](https://gitlab.com/riccisi/foundryvtt-dice-so-nice) - Compatible. It should roll properly and respect the immediatelyDisplayChatMessages setting.
* [Tidy5e Sheet](https://github.com/sdenec/tidy5e-sheet) - Compatible. Tested using the sheet styling, maybe even more so than the default sheet since I personally use it when running my games.

All other modules may or may not be compatible.

## Acknowledgements
* A bulk of the code contained in the *Overrides.js file has been taken and modified from similar functions in the [DnD5e System](https://gitlab.com/foundrynet/dnd5e)
* Inspiration for the roll style taken from a combination of [BetterRolls5e](https://github.com/RedReign/FoundryVTT-BetterRolls5e) and [Midi-QOL](https://gitlab.com/tposney/midi-qol)
