/* eslint-disable max-len */
const applyDamageButtonsPartial = `
<ol class="dice-rolls qr-damage-apply-buttons">
  <li class="qr-damage-apply-button" data-damage-multiplier="1" title="Apply normal damage"><i class="fas fa-user-minus fa-sm"></i></li>
  <li class="qr-damage-apply-button" data-damage-multiplier="2" title="Apply double damage"><i class="fas fa-user-times fa-sm"></i></li>
  <li class="qr-damage-apply-button" data-damage-multiplier=".5" title="Apply half damage"><i class="fas fa-user-slash fa-sm"></i></li>
  <li class="qr-damage-apply-button" data-damage-multiplier="-1" title="Apply normal healing"><i class="fas fa-user-plus fa-sm"></i></li>
</ol>`;

export const registerPartials = () => {
  Handlebars.registerPartial('applyDamageButtons', applyDamageButtonsPartial);
};
