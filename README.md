# FoundryVTT-QuickRolls
A module for quicker rolling in FoundryVTT. After using both BetterRolls5e and Midi-QOL, I found some things that I liked about both but were not at the time available in either so I create my own module to get the rolling experience I wanted. Feel free to submit any bugs you find or features you'd like to see and I'll try to address them but no guarantees on whether they will be addressed in a timely manner or at all.

## Installation
You can install this module in a couple different ways outlined below.

### Install through FoundryVTT Add-on Modules Tab (Recommended)
* Go to the Add-on Modules tab.
* Click Install Module.
* Search for QuickRolls and click install.

### Direct URL Install
* Go to the Add-on Modules tab.
* Click Install Module.
* Copy https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/module.json into the Manifest URL and click install.

### Manual
* Clone and extract the repo into the `Data/modules/quick-rolls` folder.
* You can either clone the repo or download a zip archive from the tags.

## Features
### In-Card Item Roll
* Rolling an item from a character sheet will automatically do an attack roll if it has it.
![Item Card Attack Roll](https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/screenshots/item-roll-attack.gif)
* Buttons on the card will also be replaced when with the actual roll result as they are rolled for attack/damage/versatile/formula rolls.
![Item Card Button Roll](https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/screenshots/item-roll-buttons.gif)
* Alt clicking the item roll will automatically roll the item with advantage. Similarly, ctrl clicking will automatically roll with disadvantage.
![Item Card Vantage](https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/screenshots/item-roll-vantage.gif)
* The (dis)advantage button will automatically roll with advantage if clicked. Ctrl clicking will roll with disadvantage.
![Item Card Vantage Button](https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/screenshots/item-roll-vantage-button.gif)
* Alt clicking will roll damage with critical damage.
![Item Card Critical Override](https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/screenshots/item-roll-crit-override.gif)
* Advantage/Disadvantage is highlighted properly on the card.
![Attack Highlighting](https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/screenshots/attack-highlighting.jpg)

### Automatic Crit Calculation
* A setting can be enabled to roll either the default dnd5e critical calculation or roll with the crit die as the max amount.
* If the attack roll is a critical, the damage will automatically be rolled as a critical. Ctrl clicking the damage button will do a normal attack instead of critical.
![Crit Auto](https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/screenshots/crit-auto.gif)

### Automatic Damage Rolls
* You can set the damage roll to automatically roll for no one, GM-only owned actors, or all actors.
![Auto Damage](https://raw.githubusercontent.com/slcao2/FoundryVTT-QuickRolls/main/screenshots/auto-damage.gif)

### Dice So Nice Integration
* Rolls show the Dice So Nice animation as they are rolled.
* The result will wait to be displayed on the card if the immediatelyDisplayChatMessages setting is false.

## Compatabilities
Anything that overrides the overriden functions in overrideItem, overrideActor, or overrideActorSetup will likely be incompatible.
* [Dice So Nice](https://gitlab.com/riccisi/foundryvtt-dice-so-nice) - Compatible. It should roll properly and respect the immediatelyDisplayChatMessages setting.
* [Tidy5e Sheet](https://github.com/sdenec/tidy5e-sheet) - Compatible. Tested using the sheet styling, maybe even more so than the default sheet since I personally use it when running my games.

All other modules may or may not be compatible.

## Acknowledgements
* A bulk of the code contained in the *Overrides.js file has been taken and modified from similar functions in the [DnD5e System](https://gitlab.com/foundrynet/dnd5e)
* Inspiration for the roll style taken from a combination of [BetterRolls5e](https://github.com/RedReign/FoundryVTT-BetterRolls5e) and [Midi-QOL](https://gitlab.com/tposney/midi-qol)
