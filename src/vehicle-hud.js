import { t } from './i18n.js';
import { compoundBadge } from './race-ui.js';
import { tireTemperatureWindow } from './tire-strategy.js';
import { engineWarning } from './thermals.js';
import { integrity } from './vehicle-damage.js';

const tires = [['FL', 3, 5, 29], ['FR', 1, 73, 29], ['RL', 2, 5, 87], ['RR', 0, 73, 87]];
const panels = [
  ['front', 'conditionFront', 'M31 11 Q48 1 65 11 L72 25 64 40H32L24 25Z'],
  ['left', 'zoneLeft', 'M22 30L31 44V82L24 104 19 91V49Z'],
  ['right', 'zoneRight', 'M74 30L65 44V82L72 104 77 91V49Z'],
  ['rear', 'conditionRear', 'M29 94L40 98H56L67 94 73 113 65 123H31L23 113Z'],
  ['engine', 'engineTemp', 'M35 44L40 41H56L61 44V85L55 94H41L35 85Z'],
];
const healthy = condition => condition <= 30 ? 'healthy' : condition <= 59 ? 'warn' : condition <= 79 ? 'damaged' : 'critical';
const thermal = (temp, min, max) => temp < min ? 'cold' : temp <= max ? 'optimal' : temp <= max + 13 ? 'warm' : 'critical';

export function vehicleHudMarkup() {
  const shape = (key, markup) => `<g data-zone="${key}" role="button" tabindex="0" aria-pressed="false">${markup}</g>`;
  return `<section class="vehicle-console" aria-label="${t('vehicleStatus')}" data-label="vehicleStatus">
    <header><h2 data-text="vehicleStatus"></h2><span id="race-compound"></span></header>
    <div class="vehicle-console-main">
      <svg class="car-schematic" viewBox="0 0 96 128" aria-label="${t('vehicleStatus')}">
        <path class="car-schematic-frame" d="M48 2L61 5 73 19 76 38 79 87 76 110 68 124H28L20 110 17 87 20 38 23 19 35 5Z"/>
        ${panels.map(([id, , path]) => shape(id, `<path d="${path}"/>`)).join('')}
        ${tires.map(([label, , x, y]) => shape(label, `<rect x="${x}" y="${y}" width="18" height="26" rx="4"/>`)).join('')}
        <path class="car-schematic-mark" d="M44 22L48 17 52 22M44 105H52"/>
      </svg>
      <div class="vehicle-readings">
        <div class="engine-reading" data-zone="engine"><span>ENG</span><b id="engine-temperature">86°C</b>
          <meter id="engine-heat" min="42" max="148" low="74" high="110" optimum="98" data-label="engineTemp"></meter></div>
        <div class="wheel-readings">${tires.map(([id]) => `<button class="wheel-reading" type="button" data-zone="${id}">
          <b>${id}</b><span data-life>100%</span><span data-temp>65°C</span></button>`).join('')}</div>
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
  let selected;
  let current;
  const assign = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const label = key => key.length === 2 ? key : t(panels.find(([id]) => id === key)[1]);

  function renderDetail() {
    const data = current?.[selected];
    assign(details, data ? `${label(selected)} · ${data.status}` : '');
    for (const zone of zones) {
      if (zone !== engineReading.parentElement) zone.setAttribute('aria-pressed', String(zone.dataset.zone === selected));
    }
  }
  function select(event) {
    const zone = event.target.closest('[data-zone]');
    if (!zone || zone === engineReading.parentElement) return;
    selected = selected === zone.dataset.zone ? undefined : zone.dataset.zone;
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
    const hood = Math.round((car.frontDamage ?? 0) * 100);
    current = {
      front: { damage: hood }, rear: { damage: Math.round((car.rearDamage ?? 0) * 100) },
      left: { damage: Math.round((car.leftDamage ?? 0) * 100) },
      right: { damage: Math.round((car.rightDamage ?? 0) * 100) },
      engine: { damage: hotEngine ? 100 : hood * 0.69, status: `${temperature}°C`, heat: hotEngine ? 'critical' : thermal(temperature, 70, 103) },
    };
    current.front.damage = Math.max(current.front.damage, Math.round((car.splitterDamage ?? 0) * 100));
    current.rear.damage = Math.max(current.rear.damage, Math.round((car.wingDamage ?? 0) * 100));
    const [min, max] = tireTemperatureWindow(car.compound);
    for (const [id, index] of tires) {
      const life = Math.round((car.tireLife?.[index] ?? 1) * 100);
      const temp = Math.round(car.tireTemperatures?.[index] ?? 65);
      const corner = car.corners?.[index];
      current[id] = { damage: corner?.detached || corner?.punctured ? 100 : Math.max(100 - life, Math.round((corner?.damage ?? 0) * 100)),
        life: `${life}%`, temp: `${temp}°C`, heat: thermal(temp, min, max),
        status: corner?.detached ? t('wheelDetached') : corner?.punctured ? t('wheelPunctured') : `${life}% · ${temp}°C` };
    }
    if (compound.dataset.id !== car.compound || compound.dataset.label !== t('tireCompound')) {
      compound.dataset.id = car.compound;
      compound.dataset.label = t('tireCompound');
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
      if (zone !== engineReading.parentElement) {
        const description = `${label(key)} · ${data.status}`;
        if (zone.getAttribute('aria-label') !== description) zone.setAttribute('aria-label', description);
      }
      if (zone.tagName === 'BUTTON') {
        assign(zone.querySelector('[data-life]'), data.life);
        assign(zone.querySelector('[data-temp]'), data.temp);
      }
    }
    if (selected) renderDetail();
  };
}
