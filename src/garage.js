import { currentTeam, maxUpgrade, money, price, repairQuote, upgrades } from './career.js';
import { escapeHtml, getLanguage, local, t, translatedField } from './i18n.js';
import { compounds, decalSlots, sliders, sponsors, vehicleStats, wings } from './setup.js';
import { integrity, vehicleCondition } from './vehicle-damage.js';

export const garageTabs = { parts: 'parts', tuning: 'tuning', aero: 'aero', sponsors: 'livery', service: 'service' };
export const defaultOrbit = { azimuth: 0.96, elevation: 0.36, zoom: 1 };
export const garageAngles = { front: 0.80, side: 1.57, rear: 2.58 };
export const garageMoney = amount => money(amount, getLanguage());
const selected = active => active ? 'selected' : '';
const checked = active => active ? 'checked' : '';
const disabled = value => value ? 'disabled' : '';
const inspectionZones = [
  ['frontDamage', 'zoneFront', 'front'], ['rearDamage', 'zoneRear', 'rear'],
  ['leftDamage', 'zoneLeft', 'side'], ['rightDamage', 'zoneRight', 'right'],
];

function servicePanel(career, saved) {
  const condition = vehicleCondition(saved ? career.activeRace.cars?.[0] ?? career.condition : career.condition);
  const health = integrity(condition);
  const { cost, shortfall, canFinance } = repairQuote({ ...career, condition });
  const tier = health < 40 ? 'critical' : health < 70 ? 'damaged' : 'healthy';
  const status = health === 100 ? 'serviceHealthy' : health === 0 ? 'mechanicalFailure' :
    health < 40 ? 'serviceCritical' : health < 70 ? 'serviceReduced' : 'serviceCosmetic';
  return `
    <div class="service-condition" data-level="${tier}" tabindex="-1">
      <div><small>${t('bodyCondition')}</small><strong>${health}<span>%</span></strong></div>
      <meter value="${health}" min="0" max="100" low="40" high="70" optimum="100" aria-label="${t('bodyCondition')}"></meter>
      <p>${t(status)}</p>
    </div>
    <div class="inspection-grid">
      ${inspectionZones.map(([zone, label, view]) => `<button type="button" class="secondary" data-view="${view}">
        <span>${t(label)}</span><b class="${condition[zone] > 0.1 ? 'has-wear' : ''}">${Math.round(condition[zone] * 100)}%</b>
      </button>`).join('')}
    </div>
    <p class="inspection-label">${t('zoneWear')}</p>
    <div class="service-checkout">
      <div><small>${t('repairCost')}</small><b>${garageMoney(cost)}</b></div>
      <button type="button" class="primary" data-action="${canFinance ? 'finance-repair' : 'repair'}" ${disabled(saved || !cost || shortfall && !canFinance)}>
        ${t(canFinance ? 'financeRepair' : 'repairVehicle')}
      </button>
    </div>
    ${saved ? `<p>${t('serviceActiveRace')}</p>` : shortfall ? `<p>${t(canFinance ? 'financeRepairHint' : 'repairShortfall', garageMoney(shortfall))}</p>` : ''}
    ${career.repairDebt ? `<p class="repair-debt">${t('repairDebt', garageMoney(career.repairDebt))}</p>` : ''}
  `;
}

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
    return `<article class="work-row" data-part="${part.id}">
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
  service: servicePanel,
};

export function garagePanel(career, saved) {
  const id = Object.hasOwn(garageTabs, career.garageTab) ? career.garageTab : 'parts';
  return `<h3 class="work-title">${t(garageTabs[id])}</h3>${panels[id](career, saved)}`;
}

function telemetry(career) {
  const stats = vehicleStats(currentTeam(career), career.upgrades, career.setup);
  const limit = stats.topSpeed + 8;
  return {
    topSpeed: stats.topSpeed * 3.6,
    acceleration: -limit / stats.acceleration * Math.log(1 - (100 / 3.6) / limit),
    downforce: stats.load,
    stopping: (100 / 3.6) ** 2 / (2 * stats.braking),
    grip: stats.grip,
  };
}

export function previewPart(career, id) {
  if (!upgrades.some(upgrade => upgrade.id === id) || career.upgrades[id] >= maxUpgrade) return null;
  return { ...career, upgrades: { ...career.upgrades, [id]: career.upgrades[id] + 1 } };
}

export function garageStats(career, preview, applied = false) {
  const baseline = telemetry(career);
  const next = preview && telemetry(preview);
  const metrics = [
    ['topSpeed', t('kmh'), 100, 260, false, 0],
    ['acceleration', 's', 1.8, 4.7, true, 2],
    ['downforce', 'kg', 0, 120, false, 1],
    ['stopping', 'm', 8, 23, true, 1],
    ['grip', '', 5, 15, false, 1],
  ];
  return metrics.map(([id, unit, min, max, reverse, precision]) => {
    const score = number => {
      const ratio = Math.max(0, Math.min(1, (number - min) / (max - min)));
      return (reverse ? 1 - ratio : ratio) * 100;
    };
    const compare = next?.[id] ?? baseline[id];
    const difference = Number((compare - baseline[id]).toFixed(precision));
    const label = new Intl.NumberFormat(getLanguage(), { maximumFractionDigits: precision });
    const positive = reverse ? difference < 0 : difference > 0;
    const from = score(baseline[id]);
    const to = score(compare);
    const delta = difference ? `<em class="stat-delta ${positive ? 'gain' : 'loss'}">${difference > 0 ? '+' : '−'}${label.format(Math.abs(difference))}</em>` : '';
    const segment = difference ? `<i class="stat-forecast ${positive ? 'gain' : 'loss'}" style="--left:${Math.min(from, to)}%;--length:${Math.max(1.6, Math.abs(to - from))}%"></i>` : '';
    return `<div data-stat="${id}"><small>${t(id)}</small>
      <b>${label.format(applied ? compare : baseline[id])} <span>${unit}</span>${delta}</b>
      <div class="stat-bar" aria-hidden="true"><span style="width:${from}%"></span>${segment}</div></div>`;
  }).join('');
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
