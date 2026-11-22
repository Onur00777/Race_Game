import { buyUpgrade, changeTeam, currentEvent, currentTeam, events, finishEvent, loadCareer, maxUpgrade, money, price, saveCareer, standings, teams, upgrades } from './career.js';
import { createRace, createTrack } from './race.js';
import { createView } from './scene.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <canvas id="circuit" aria-label="Üç boyutlu yarış pisti"></canvas>
  <div class="shade"></div>
  <div class="game-shell">
    <header class="topbar" id="topbar">
      <div class="brand"><span class="mark" aria-hidden="true"></span><div>APEX <span>CIRCUIT</span></div></div>
      <nav aria-label="Kariyer menüsü">
        <button type="button" data-tab="calendar" aria-current="page">Takvim</button>
        <button type="button" data-tab="garage">Garaj</button>
        <button type="button" data-tab="teams">Takımlar</button>
      </nav>
      <div class="top-end"><span id="balance" class="balance"></span><button type="button" data-action="sound" class="sound" aria-pressed="false">Ses kapalı</button></div>
    </header>
    <section id="menu" class="menu" aria-live="polite">
      <div class="hero" id="hero"></div>
      <div class="paddock">
        <section id="panel" class="panel" aria-label="Kariyer ayrıntıları"></section>
        <section id="championship" class="panel championship" aria-label="Şampiyona puanları"></section>
      </div>
    </section>
    <section id="hud" class="hud" hidden aria-label="Yarış bilgileri">
      <div class="race-top">
        <div class="timing"><small id="race-title"></small><div><b id="laps"></b><span id="clock"></span></div><span id="best-lap"></span></div>
        <div class="position"><small>SIRA</small><div><b id="position"></b><span> / 5</span></div></div>
        <button class="secondary pause-button" data-action="pause">Duraklat</button>
      </div>
      <div id="countdown" class="countdown" aria-live="polite"></div>
      <div class="race-bottom">
        <canvas id="map" width="180" height="156" aria-label="Pist haritası"></canvas>
        <div class="drive-help"><span id="road-warning"></span><div>WASD Sürüş <i>·</i> SPACE El freni <i>·</i> R Piste dön <i>·</i> C Kamera</div></div>
        <div class="speed"><strong id="speed"></strong><small>KM/S</small><span><i id="speed-bar"></i></span></div>
      </div>
    </section>
    <dialog id="overlay"></dialog>
    <p id="notice" role="status" hidden></p>
  </div>
`;

const byId = id => document.getElementById(id);
const circuit = byId('circuit');
const menu = byId('menu');
const hero = byId('hero');
const panel = byId('panel');
const topbar = byId('topbar');
const hud = byId('hud');
const overlay = byId('overlay');
const map = byId('map');
const mapContext = map.getContext('2d');
const keys = new Set();
const drivingKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const tabs = { calendar: 'Yarış Takvimi', garage: 'Garaj', teams: 'Takımlar' };
let storage;
try { storage = window.localStorage; } catch { /* Storage access can be disabled by the browser. */ }
let career = loadCareer(storage);
let tab = 'calendar';
let mode = 'menu';
let paused = false;
let alternateCamera = false;
let sound = false;
let audio;
let track;
let race;
let view;
let noticeTimeout;
let mapShape;
let previousFrame;
let accumulator = 0;
let lastHudUpdate = -1;
let lastRaceElapsed = -1;

const formatTime = seconds => {
  const milliseconds = Math.floor(seconds * 1000);
  return String(Math.floor(milliseconds / 60000)).padStart(2, '0') + ':' +
    String(Math.floor(milliseconds / 1000) % 60).padStart(2, '0') + '.' + String(milliseconds % 1000).padStart(3, '0');
};

function notify(message) {
  const notice = byId('notice');
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { notice.hidden = true; }, 3800);
}

function persist() {
  if (!saveCareer(storage, career)) notify('Tarayıcı kayda izin vermiyor. İlerleme bu oturum boyunca kullanılabilir.');
}

function prepare(event) {
  const changed = track?.event !== event;
  if (changed) track = createTrack(event);
  race = createRace(track, currentTeam(career), career.upgrades);
  if (changed) view.setTrack(track, race.cars);
  view.snap();
}

function showMenu() {
  if (overlay.open) overlay.close();
  mode = 'menu';
  paused = false;
  keys.clear();
  menu.hidden = topbar.hidden = false;
  hud.hidden = true;
  document.body.classList.remove('driving');
  if (view) prepare(currentEvent(career) ?? events.at(-1));
  updateMenu();
}

function updateMenu() {
  const event = currentEvent(career);
  const team = currentTeam(career);
  byId('balance').textContent = money(career.cash);
  for (const button of topbar.querySelectorAll('[data-tab]')) {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  const action = event
    ? `<button class="primary" data-action="race" ${view ? '' : 'disabled'}>Yarışı başlat <span aria-hidden="true">↗</span></button>`
    : '<button class="primary" data-action="season">Yeni sezona başla <span aria-hidden="true">↗</span></button>';
  hero.innerHTML = `
    <div class="hero-meta"><span></span> SEZON ${String(career.season).padStart(2, '0')} ${event ? `<i></i> ETAP ${career.results.length + 1} / ${events.length}` : ''}</div>
    <h1>${event?.name ?? 'Sezon tamamlandı'}</h1>
    <p>${event ? `${event.laps} tur <i>·</i> 5 sürücü <i>·</i> ${team.name}` : `Şampiyon: ${standings(career)[0].name}`}</p>
    ${action}
    <div class="controls"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> <span>Sürüş</span><kbd>SPACE</kbd> <span>El freni</span></div>
  `;
  const calendar = events.map((item, index) => {
    const result = career.results[index];
    const status = result ? `${result.place}. sıra <i>·</i> +${result.points} puan` : item === event ? 'Sıradaki' : 'Beklemede';
    return `<div class="entry ${item === event ? 'current' : ''}"><span class="date">${item.date}</span><div><strong>${item.name}</strong><small>${item.laps} tur${result ? ` <i>·</i> ${money(result.prize)}` : ''}</small></div><span class="entry-status">${status}</span></div>`;
  }).join('');
  const garage = upgrades.map(upgrade => {
    const level = career.upgrades[upgrade.id];
    const cost = price(upgrade, level);
    const max = level >= maxUpgrade;
    return `<div class="entry"><span class="level">${level}/${maxUpgrade}</span><div><strong>${upgrade.name}</strong><small>${upgrade.effect}</small></div><button class="secondary" data-buy="${upgrade.id}" aria-label="${upgrade.name} yükseltmesi ${money(cost)}" ${max || cost > career.cash ? 'disabled' : ''}>${max ? 'Tamamlandı' : money(cost)}</button></div>`;
  }).join('');
  const teamList = teams.map(candidate => {
    const active = candidate.id === team.id;
    const locked = candidate.unlock > career.completed;
    return `<div class="entry ${active ? 'current' : ''}"><span class="team-marker" style="--team:${candidate.color}"></span><div><strong>${candidate.name}</strong><small>${candidate.perk}</small></div><button class="secondary" data-team="${candidate.id}" ${active || locked ? 'disabled' : ''}>${active ? 'Aktif takım' : locked ? `${candidate.unlock} yarış gerekli` : 'Katıl'}</button></div>`;
  }).join('');
  panel.innerHTML = `<h2>${tabs[tab]}</h2><div class="entries">${{ calendar, garage, teams: teamList }[tab]}</div>`;
  byId('championship').innerHTML = `
    <h2>Şampiyona</h2>
    <ol>${standings(career).map((driver, index) => `
      <li class="${driver.id === 'player' ? 'you' : ''}">
        <span class="rank">${career.results.length ? index + 1 : '–'}</span>
        <span class="driver-dot" style="--driver:${driver.color}"></span>
        <span>${driver.name}</span><b>${driver.points} <small>PUAN</small></b>
      </li>`).join('')}
    </ol>
  `;
}

function startRace() {
  const event = currentEvent(career);
  if (!view || !event || mode !== 'menu') return;
  prepare(event);
  mode = 'race';
  keys.clear();
  accumulator = 0;
  lastHudUpdate = -1;
  lastRaceElapsed = -1;
  menu.hidden = topbar.hidden = true;
  hud.hidden = false;
  document.body.classList.add('driving');
  byId('race-title').textContent = event.name;
  byId('best-lap').textContent = '';
  const xs = track.samples.map(point => point.x);
  const zs = track.samples.map(point => point.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const spanX = Math.max(...xs) - minX;
  const spanZ = Math.max(...zs) - minZ;
  const scale = Math.min((map.width - 28) / spanX, (map.height - 28) / spanZ);
  const xOffset = (map.width - spanX * scale) / 2;
  const zOffset = (map.height - spanZ * scale) / 2;
  const point = ({ x, z }) => [xOffset + (x - minX) * scale, zOffset + (z - minZ) * scale];
  const path = new Path2D();
  track.samples.forEach((sample, index) => index ? path.lineTo(...point(sample)) : path.moveTo(...point(sample)));
  path.closePath();
  mapShape = { path, point };
  updateHud();
}

function updateHud() {
  const player = race.player;
  const speed = Math.round(Math.abs(player.speed) * 3.6);
  byId('laps').textContent = `TUR ${Math.min(player.lap + 1, track.event.laps)} / ${track.event.laps}`;
  byId('clock').textContent = formatTime(race.elapsed);
  byId('position').textContent = race.position();
  byId('speed').textContent = speed;
  byId('speed-bar').style.width = Math.min(100, speed / 2.35) + '%';
  byId('road-warning').textContent = player.onRoad ? '' : 'Pist dışı';
  byId('best-lap').textContent = player.bestLap ? `EN İYİ TUR  ${formatTime(player.bestLap)}` : '';
  const message = race.countdown > 0 ? String(Math.ceil(race.countdown)) : race.elapsed < 0.8 ? 'BAŞLA!' : '';
  const countdown = byId('countdown');
  if (countdown.textContent !== message) countdown.textContent = message;
  mapContext.clearRect(0, 0, map.width, map.height);
  mapContext.lineWidth = 8;
  mapContext.strokeStyle = '#121619';
  mapContext.stroke(mapShape.path);
  mapContext.lineWidth = 3;
  mapContext.strokeStyle = '#a7a9a8';
  mapContext.stroke(mapShape.path);
  for (const car of [...race.opponents, player]) {
    mapContext.fillStyle = car.color;
    mapContext.beginPath();
    mapContext.arc(...mapShape.point(car), car === player ? 5 : 3.6, 0, Math.PI * 2);
    mapContext.fill();
  }
}

function pauseRace() {
  if (mode !== 'race' || paused) return;
  keys.clear();
  paused = true;
  overlay.innerHTML = `
    <h2>Yarış duraklatıldı</h2>
    <p>Takvime dönersen bu yarış yeniden başlar.</p>
    <div class="dialog-actions">
      <button class="primary" data-action="resume">Yarışa devam et</button>
      <button class="secondary" data-action="menu">Takvime dön</button>
    </div>
  `;
  overlay.showModal();
  updateAudio();
}

function resumeRace() {
  if (mode !== 'race' || !paused) return;
  paused = false;
  accumulator = 0;
  overlay.close();
  circuit.focus({ preventScroll: true });
}

function finishRace() {
  career = finishEvent(career, race.order, race.player.finishTime, race.player.bestLap);
  persist();
  const result = career.results.at(-1);
  const unlocked = teams.find(team => team.unlock === career.completed);
  mode = 'result';
  keys.clear();
  overlay.innerHTML = `
    <div class="hero-meta"><span></span> ${track.event.name}</div>
    <h2>${result.place}. sırada bitirdin</h2>
    <div class="result-grid">
      <div><small>ÖDÜL</small><b>${money(result.prize)}</b></div>
      <div><small>SEZON PUANI</small><b>+${result.points}</b></div>
      <div><small>TOPLAM SÜRE</small><b>${formatTime(result.time)}</b></div>
      <div><small>EN İYİ TUR</small><b>${formatTime(result.bestLap)}</b></div>
    </div>
    ${unlocked ? `<p>${unlocked.name} ile sözleşme artık açık.</p>` : ''}
    <div class="dialog-actions">
      <button class="primary" data-action="menu">Takvime dön</button>
      <button class="secondary" data-action="garage">Garaja git</button>
    </div>
  `;
  overlay.showModal();
}

function updateAudio() {
  if (!audio) return;
  const speed = Math.abs(race?.player.speed ?? 0);
  const audible = sound && mode === 'race' && !paused && race.countdown === 0;
  const gearBand = speed % 10;
  audio.engine.frequency.setTargetAtTime(42 + gearBand * 6.8 + speed * 0.55, audio.context.currentTime, 0.075);
  audio.gain.gain.setTargetAtTime(audible ? 0.027 + Math.min(speed / 2500, 0.019) : 0, audio.context.currentTime, 0.08);
}

async function toggleSound(button) {
  sound = !sound;
  if (sound && !audio) {
    try {
      const context = new AudioContext();
      const engine = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      engine.type = 'sawtooth';
      filter.frequency.value = 240;
      gain.gain.value = 0;
      engine.connect(filter).connect(gain).connect(context.destination);
      engine.start();
      await context.resume();
      audio = { context, engine, gain };
    } catch {
      sound = false;
      notify('Tarayıcı ses çıkışını başlatamadı.');
    }
  }
  button.textContent = sound ? 'Ses açık' : 'Ses kapalı';
  button.setAttribute('aria-pressed', String(sound));
  updateAudio();
}

app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.tab) {
    tab = button.dataset.tab;
    updateMenu();
  }
  if (button.dataset.buy) {
    const next = buyUpgrade(career, button.dataset.buy);
    if (next !== career) {
      career = next;
      persist();
      updateMenu();
      panel.querySelector(`[data-buy="${button.dataset.buy}"]:not(:disabled)`)?.focus();
    }
  }
  if (button.dataset.team) {
    career = changeTeam(career, button.dataset.team);
    if (view) race.player.color = currentTeam(career).color;
    persist();
    updateMenu();
  }
  switch (button.dataset.action) {
    case 'race': startRace(); break;
    case 'pause': pauseRace(); break;
    case 'resume': resumeRace(); break;
    case 'menu': tab = 'calendar'; showMenu(); break;
    case 'garage': tab = 'garage'; showMenu(); break;
    case 'sound': toggleSound(button); break;
    case 'season':
      if (!currentEvent(career)) {
        career = { ...career, season: career.season + 1, results: [] };
        persist();
        showMenu();
      }
      break;
  }
});

window.addEventListener('keydown', event => {
  if (mode === 'race' && event.code === 'Escape') {
    event.preventDefault();
    if (!event.repeat) {
      if (paused) resumeRace();
      else pauseRace();
    }
    return;
  }
  if (mode !== 'race' || paused) return;
  if (drivingKeys.has(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }
  if (event.repeat) return;
  if (event.code === 'KeyR') {
    race.reset();
    view.snap();
  }
  if (event.code === 'KeyC') alternateCamera = !alternateCamera;
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); pauseRace(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRace(); });
overlay.addEventListener('cancel', event => {
  event.preventDefault();
  if (paused) resumeRace();
});

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, Math.max(0, (now - (previousFrame ?? now)) / 1000));
  previousFrame = now;
  const braking = keys.has('KeyS') || keys.has('ArrowDown');
  if (mode === 'race' && !paused) {
    const input = {
      gas: keys.has('KeyW') || keys.has('ArrowUp'),
      brake: braking,
      handbrake: keys.has('Space'),
      steering: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
    };
    accumulator += dt;
    const step = 1 / 120;
    while (accumulator >= step && !race.order) {
      race.update(step, input);
      accumulator -= step;
    }
    if (race.order) finishRace();
    if (lastHudUpdate < 0 || now - lastHudUpdate > 44 || mode === 'result') {
      updateHud();
      lastHudUpdate = now;
    }
    updateAudio();
  }
  if (mode === 'result') updateAudio();
  if (mode !== 'menu' || lastHudUpdate < 0 || lastRaceElapsed !== race.elapsed || now - lastHudUpdate >= 100) {
    view.draw(race, mode, dt, braking, alternateCamera);
    if (mode === 'menu') {
      lastHudUpdate = now;
      lastRaceElapsed = race.elapsed;
    }
  }
}

try {
  view = createView(circuit);
  circuit.tabIndex = -1;
  showMenu();
  requestAnimationFrame(frame);
} catch {
  view = undefined;
  updateMenu();
  notify('3D pist başlatılamadı. WebGL 2 destekli bir tarayıcı ve donanım hızlandırması gerekiyor.');
}
