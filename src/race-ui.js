import { difficulties } from './difficulty.js';
import { getLanguage, t } from './i18n.js';
import { garageMoney } from './garage.js';

const labels = { easy: 'difficultyEasy', medium: 'difficultyMedium', hard: 'difficultyHard', legend: 'difficultyLegend' };
const hints = { easy: 'difficultyEasyHint', medium: 'difficultyMediumHint', hard: 'difficultyHardHint', legend: 'difficultyLegendHint' };
const factors = {
  tr: new Intl.NumberFormat('tr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  en: new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

export const multiplierLabel = value => factors[getLanguage()].format(value) + '×';

export function difficultyBadge(id) {
  return `<span class="difficulty-badge" data-tier="${id}"><strong>${t(labels[id])}</strong><b>${multiplierLabel(difficulties[id].multiplier)}</b></span>`;
}

export function difficultyControls(active, saved) {
  return `<div class="difficulty-config">
    <div class="difficulty-heading"><strong>${t('difficulty')}</strong>${difficultyBadge(active)}</div>
    ${saved ? `<p>${t('difficultyLocked')}</p>` : `<fieldset class="difficulty-options" aria-label="${t('difficulty')}">
      ${Object.keys(difficulties).map(id => `<label><input type="radio" name="difficulty" value="${id}" data-difficulty ${id === active ? 'checked' : ''}><span>${t(labels[id])}</span></label>`).join('')}
    </fieldset><p>${t(hints[active])}</p>`}
  </div>`;
}

export function payoutBreakdown(result) {
  return `<dl class="payout-breakdown">
    <div><dt>${t('difficultyBasePrize')}</dt><dd>${garageMoney(result.basePrize)}</dd></div>
    ${result.teamPrize ? `<div><dt>${t('difficultyTeamPrize')}</dt><dd>+${garageMoney(result.teamPrize)}</dd></div>` : ''}
    <div><dt>${t('difficultyBonus')}</dt><dd>${multiplierLabel(result.multiplier)} · +${garageMoney(result.racePrize - result.teamPrize - result.basePrize)}</dd></div>
    ${result.bonus ? `<div><dt>${t('fixedSponsorBonus')}</dt><dd>+${garageMoney(result.bonus)}</dd></div>` : ''}
  </dl>`;
}
