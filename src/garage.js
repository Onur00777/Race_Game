import { currentTeam, maxUpgrade, money, price, upgrades } from './career.js';
import { escapeHtml, getLanguage, local, t, translatedField } from './i18n.js';
import { compounds, decalSlots, sliders, sponsors, vehicleStats, wings } from './setup.js';

export const garageTabs = { parts: 'parts', tuning: 'tuning', aero: 'aero', sponsors: 'livery' };
export const garageMoney = amount => money(amount, getLanguage());
const selected = active => active ? 'selected' : '';
const checked = active => active ? 'checked' : '';
const disabled = value => value ? 'disabled' : '';

export function setupValue(value, suffix) {
  const display = new Intl.NumberFormat(getLanguage(), { maximumFractionDigits: 1 }).format(value);
  return display + suffix;
}

function sliderMarkup(career, id) {
  const spec = sliders.find(slider => slider.id === id);
  const value = career.setup[id];
  return `<label class="tune-slider">
    <span><strong>${local(spec.name)}</strong><output for="tune-${id}" data-value="${id}">${setupValue(value, spec.suffix)}</output></span>
    <input id="tune-${id}" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}" data-tune="${id}" aria-describedby="help-${id}">
    <small id="help-${id}">${local(spec.help)}</small>
  </label>`;
}

const panels = {
  parts: career => upgrades.map(part => {
    const level = career.upgrades[part.id];
    const cost = price(part, level);
    const max = level >= maxUpgrade;
    return `<article class="work-row">
      <div><small>${t('upgradeLevel', level, maxUpgrade)}</small><h3>${translatedField(part)}</h3><p>${translatedField(part, 'effect')}</p></div>
      <button type="button" class="secondary" data-buy="${part.id}" aria-label="${max ? t('maxLevel') : t('partPrice', translatedField(part), garageMoney(cost))}" ${disabled(max || cost > career.cash)}>${max ? t('maxLevel') : garageMoney(cost)}</button>
    </article>`;
  }).join(''),
  tuning: career => `
    <label class="tune-field"><strong>${t('tireCompound')}</strong>
      <select data-tune="compound">${compounds.map(compound => `<option value="${compound.id}" ${selected(career.setup.compound === compound.id)}>${local(compound.name)}</option>`).join('')}</select>
      <small>${t('compoundHint')}</small>
    </label>
    ${sliders.filter(slider => slider.id !== 'downforce').map(spec => sliderMarkup(career, spec.id)).join('')}
  `,
  aero: career => {
    if (!career.upgrades.aero) return `<p class="garage-empty">${t('wingMissing')}</p><button type="button" class="secondary" data-garage-tab="parts">${t('parts')}</button>`;
    return `
      <fieldset class="wing-options"><legend>${t('wingShape')}</legend>
        ${wings.map(wing => {
          const locked = career.upgrades.aero < wing.level;
          const active = career.setup.wing === wing.id;
          return `<button type="button" class="wing-option" data-wing="${wing.id}" aria-pressed="${active}" ${disabled(locked)}>
            <span class="wing-diagram wing-${wing.id}" aria-hidden="true"></span>
            <strong>${local(wing.name)}</strong><small>${locked ? t('wingLocked', wing.level) : active ? t('applied') : t('apply')}</small>
          </button>`;
        }).join('')}
      </fieldset>
      ${sliderMarkup(career, 'downforce')}
      <label class="color-input"><strong>${t('wingColor')}</strong><input type="color" value="${career.setup.wingColor}" data-tune="wingColor" aria-label="${t('wingColor')}"></label>`;
  },
  sponsors: career => `
    ${sponsors.map(sponsor => {
      const active = sponsor.id === career.sponsor;
      const locked = career.completed < sponsor.unlock;
      return `<article class="work-row sponsor-row">
        <div><h3 style="--sponsor:${sponsor.color}">${sponsor.brand}</h3><p>${t('sponsorRate', garageMoney(sponsor.payout))}</p></div>
        <button type="button" class="secondary" data-sponsor="${sponsor.id}" ${disabled(active || locked)}>${active ? t('sponsorActive') : locked ? t('requiresRaces', sponsor.unlock) : t('signSponsor')}</button>
      </article>`;
    }).join('')}
    <fieldset class="decal-options" ${disabled(!career.sponsor)}><legend>${t('decal')}</legend>
      <p>${t('decalHint')}</p>
      ${decalSlots.map(slot => `<label><input type="checkbox" data-decal="${slot.id}" ${checked(career.decals.includes(slot.id))}> ${local(slot.name)}</label>`).join('')}
    </fieldset>`,
};

export function garagePanel(career) {
  const id = Object.hasOwn(garageTabs, career.garageTab) ? career.garageTab : 'parts';
  return `<h3 class="work-title">${t(garageTabs[id])}</h3>${panels[id](career)}`;
}

export function garageStats(career) {
  const stats = vehicleStats(currentTeam(career), career.upgrades, career.setup);
  const limit = stats.topSpeed + 8;
  const zeroToHundred = -limit / stats.acceleration * Math.log(1 - (100 / 3.6) / limit);
  return `<div><small>${t('topSpeed')}</small><b>${setupValue(Math.round(stats.topSpeed * 3.6), '')} <span>${t('kmh')}</span></b></div>
    <div><small>${t('acceleration')}</small><b>${setupValue(zeroToHundred, '')} <span>s</span></b></div>
    <div><small>${t('downforce')}</small><b>${setupValue(stats.load, '')} <span>kg</span></b></div>`;
}

export function driverForm(career, draft) {
  const isNew = !career.profile;
  return `<form id="driver-form" class="profile-card">
    <div class="profile-top"><h1>${t(isNew ? 'chooseDriver' : 'editDriver')}</h1>
      <label><span>${t('language')}</span><select name="language"><option value="tr" ${selected(draft.language === 'tr')}>Türkçe</option><option value="en" ${selected(draft.language === 'en')}>English</option></select></label>
    </div>
    <p>${t(isNew ? 'profileIntro' : 'profileEditHint')}</p>
    <label class="profile-name"><strong>${t('driverName')}</strong><input name="driver" type="text" autocomplete="nickname" placeholder="${t('namePlaceholder')}" required maxlength="24" value="${escapeHtml(draft.name)}"></label>
    ${isNew ? `<div id="team-choices"></div>` : ''}
    <div class="profile-actions">
      <button type="submit" class="primary">${t(isNew ? 'enterCareer' : 'saveProfile')} <span aria-hidden="true">↗</span></button>
      ${isNew ? '' : `<button type="button" class="secondary" data-action="cancel-profile">${t('cancel')}</button>`}
    </div>
  </form>`;
}
