import { getLanguage, t } from './i18n.js';
import { compoundBadge } from './race-ui.js';
import { tireTemperatureWindow } from './tire-strategy.js';
import { enginePowerFactor, engineWarning, radiatorDamage } from './thermals.js';
import { integrity } from './vehicle-damage.js';

const tires = [['FL', 3, 5, 29], ['FR', 1, 73, 29], ['RL', 2, 5, 87], ['RR', 0, 73, 87]];
const panels = [
  ['front', 'conditionFront', 'M31 11 Q48 1 65 11 L72 25 64 40H32L24 25Z'],
  ['left', 'zoneLeft', 'M22 30L31 44V82L24 104 19 91V49Z'],
  ['right', 'zoneRight', 'M74 30L65 44V82L72 104 77 91V49Z'],
  ['rear', 'conditionRear', 'M29 94L40 98H56L67 94 73 113 65 123H31L23 113Z'],
  ['engine', 'engineCooling', 'M35 44L40 41H56L61 44V85L55 94H41L35 85Z'],
];
const healthy = condition => condition < 15 ? 'healthy' : condition < 48 ? 'warn' : condition < 76 ? 'damaged' : 'critical';
const thermal = (temp, min, max) => temp < min ? 'cold' : temp <= max ? 'optimal' : temp <= max + 13 ? 'warm' : 'critical';

export function vehicleHudMarkup() {
  const shape = (key, markup) => `<g data-zone="${key}" role="button" tabindex="0" aria-pressed="false">${markup}</g>`;
  return `<section class="vehicle-console" aria-label="${t('vehicleStatus')}" data-label="vehicleStatus">
    <header><h2 data-text="vehicleStatus"></h2><span id="race-compound"></span></header>
    <div class="vehicle-console-main">
      <svg class="car-schematic" viewBox="0 0 96 128" aria-label="${t('vehicleStatus')}">
        <path class="car-schematic-frame" d="M48 2L61 5 73 19 76 38 79 87 76 110 68 124H28L20 110 17 87 20 38 23 19 35 5Z"/>
        ${panels.map(([id, , path]) => shape(id, `<path d="${path}"/>`)).join('')}
        ${tires.map(([label, , x, y]) => shape(label, `<rect x="${x}" y="${y}" width="18" height="26" rx="4"/>
          <path class="wheel-missing" d="M${x + 5} ${y + 8}l8 10m0 -10l-8 10"/>`)).join('')}
        <path class="car-schematic-mark" d="M44 22L48 17 52 22M44 105H52"/>
      </svg>
      <div class="vehicle-readings">
        <div class="engine-reading" data-zone="engine"><span>ENG</span><b id="engine-temperature">86°C</b>
          <meter id="engine-heat" min="42" max="148" low="74" high="110" optimum="98" data-label="engineTemp"></meter></div>
        <div class="wheel-readings">${tires.map(([id]) => `<button class="wheel-reading" type="button" data-zone="${id}">
          <b>${id}</b><span data-life>100%</span><span data-temp>65°C</span><span class="tire-life-bar" aria-hidden="true"></span></button>`).join('')}</div>
      </div>
    </div>
    <footer class="vehicle-console-foot"><span><span data-text="body"></span> <b id="condition-percent">100%</b></span><span data-detail></span></footer>
  </section>`;
}

export function createVehicleHud(root) {
  const zones = [...root.querySelectorAll('[data-zone]')];
  const engineReading = root.querySelector('#engine-temperature');
  const engineMeter = root.querySelector('#engine-heat');
  const compound = root.querySelector('#race-compound');
  const body = root.querySelector('#condition-percent');
  const details = root.querySelector('[data-detail]');
  const lifeReadings = [...root.querySelectorAll('.wheel-reading')].map(button =>
    ({ button, life: button.querySelector('[data-life]'), temp: button.querySelector('[data-temp]') }));
  let selected;
  let current;
  const assign = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const label = key => key.length === 2 ? key : t(panels.find(([id]) => id === key)[1]);

  function renderDetail() {
    if (!current) return;
    const focused = selected ?? tires.find(([id]) => current[id].missing)?.[0] ??
      tires.find(([id]) => current[id].flat)?.[0] ?? (current.engine.heat === 'critical' ? 'engine' : undefined);
    assign(details, focused ? `${label(focused)} · ${current[focused].status}` : '');
    const alert = focused && (current[focused].missing || current[focused].flat || current[focused].heat === 'critical');
    details.classList.toggle('telemetry-critical', Boolean(alert));
  }
  function select(event) {
    const zone = event.target.closest('[data-zone]');
    if (!zone || zone === engineReading.parentElement) return;
    selected = selected === zone.dataset.zone ? undefined : zone.dataset.zone;
    for (const control of zones) {
      if (control !== engineReading.parentElement) control.setAttribute('aria-pressed', String(control.dataset.zone === selected));
    }
    renderDetail();
  }
  root.addEventListener('click', select);
  root.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('svg [data-zone]')) {
      event.preventDefault();
      event.stopPropagation();
      select(event);
    }
  });
  return function update(car) {
    const temperature = Math.round(car.engineTemperature ?? 86);
    const hotEngine = (car.engineTemperature ?? 86) > engineWarning;
    const hood = Math.round(Math.max(car.frontDamage ?? 0, car.hoodDamage ?? 0, car.splitterDamage ?? 0) * 100);
    const radiator = Math.round(radiatorDamage(car) * 100);
    const derating = Math.round((1 - enginePowerFactor(car)) * 100);
    current = {
      front: { damage: hood }, rear: { damage: Math.round((car.rearDamage ?? 0) * 100) },
      left: { damage: Math.round((car.leftDamage ?? 0) * 100) },
      right: { damage: Math.round((car.rightDamage ?? 0) * 100) },
      engine: { damage: hotEngine ? 100 : radiator,
        status: hotEngine ? `${temperature}°C · ${t('engineDerating', derating)}` : `${temperature}°C · ${t('radiatorHealth', 100 - radiator)}`,
        heat: hotEngine ? 'critical' : thermal(car.engineTemperature ?? 86, 70, engineWarning) },
    };
    current.rear.damage = Math.max(current.rear.damage, Math.round((car.wingDamage ?? 0) * 100));
    const [min, max] = tireTemperatureWindow(car.compound);
    for (const [id, index] of tires) {
      const corner = car.corners?.[index];
      const life = corner?.punctured || corner?.detached ? 0 : Math.round((car.tireLife?.[index] ?? 1) * 100);
      const temp = Math.round(car.tireTemperatures?.[index] ?? 65);
      const suspension = Math.round((corner?.damage ?? 0) * 100);
      current[id] = { damage: Math.max(100 - life, suspension), missing: corner?.detached, flat: corner?.punctured,
        life: `${life}%`, temp: corner?.detached ? '—' : `${temp}°C`, heat: corner?.detached ? 'absent' : thermal(temp, min, max),
        status: corner?.detached ? t('wheelDetached') : corner?.punctured ? t('wheelPunctured') :
          suspension >= 30 ? t('suspensionWear', suspension) : `${life}% · ${temp}°C` };
    }
    if (compound.dataset.id !== car.compound || compound.lang !== getLanguage()) {
      compound.dataset.id = car.compound;
      compound.lang = getLanguage();
      compound.innerHTML = compoundBadge(car.compound);
    }
    assign(engineReading, `${temperature}°C`);
    engineMeter.value = temperature;
    assign(body, `${integrity(car)}%`);
    for (const zone of zones) {
      const key = zone.dataset.zone;
      const data = current[key];
      data.status ??= `${Math.round(100 - data.damage)}%`;
      const condition = healthy(data.damage);
      if (zone.dataset.health !== condition) zone.dataset.health = condition;
      if (data.heat && zone.dataset.heat !== data.heat) zone.dataset.heat = data.heat;
      zone.toggleAttribute('data-missing', Boolean(data.missing));
      if (zone !== engineReading.parentElement) {
        const description = `${label(key)} · ${data.status}`;
        if (zone.getAttribute('aria-label') !== description) zone.setAttribute('aria-label', description);
      }
    }
    for (const { button, life, temp } of lifeReadings) {
      const data = current[button.dataset.zone];
      if (life.textContent !== data.life) button.style.setProperty('--tire-life', data.life);
      assign(life, data.life);
      assign(temp, data.temp);
    }
    renderDetail();
  };
}
