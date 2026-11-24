import { acceptSponsor, buyElectronics, buyUpgrade, changeTeam, currentEvent, currentTeam, events, finishEvent, gameName,
  loadCareer, normalizeLoadout, repairVehicle, saveCareer, saveProfile, standings, teamById, teams, toggleDecal } from './career.js';
import { createRace, createTrack, raceStep } from './race.js';
import { eventDifficulty, eventForResume, hasSavedRace, raceCheckpoint, restoreRace } from './progress.js';
import { decalSlots, normalizeSetup, sliders } from './setup.js';
import { defaultOrbit, driverForm, garageAngles, garageMoney, garagePanel, garageStats, garageTabs, previewElectronics, previewPart, setupValue } from './garage.js';
import { escapeHtml, getLanguage, setLanguage, t, translatedField, upper } from './i18n.js';
import { createAudio, updateAudio } from './audio.js';
import { animateAmount, createWallet } from './wallet.js';
import { graphicsModes, qualityMode } from './graphics-settings.js';
import { circuitMap, drawBriefingMap } from './circuit-map.js';
import { legacyEvents } from './events.js';
import { difficultyId, purseFor } from './difficulty.js';
import { compoundBadge, compoundControls, compoundOptions, difficultyBadge, difficultyControls, payoutBreakdown } from './race-ui.js';
import { integrity, vehicleCondition } from './vehicle-damage.js';
import { tireHealth } from './tire-strategy.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <div id="circuit-home"><canvas id="circuit" data-label="track"></canvas></div>
  <div class="shade"></div>
  <div class="game-shell">
    <header class="topbar" id="topbar">
      <div class="brand" aria-label="${gameName}"><span class="mark" aria-hidden="true"></span><div>KIRMIZI <span>ÇİZGİ</span></div></div>
      <nav id="career-nav" data-label="careerNav">
        <button type="button" data-tab="calendar" data-text="calendar"></button>
        <button type="button" data-tab="garage" data-text="garage"></button>
        <button type="button" data-tab="teams" data-text="teams"></button>
      </nav>
      <div class="top-end" id="top-end"><div id="wallet" class="wallet" role="status"><span class="wallet-icon" aria-hidden="true"></span><span id="balance" class="balance" aria-hidden="true"></span></div>
        <button type="button" data-action="sound" class="sound" aria-pressed="false"></button>
        <button type="button" data-action="profile" class="sound" data-text="profile"></button></div>
    </header>
    <section id="profile-screen" class="driver-screen" hidden></section>
    <section id="menu" class="menu" hidden>
      <div class="menu-top">
        <div class="hero" id="hero"></div>
        <aside id="briefing" class="panel race-briefing" hidden></aside>
      </div>
      <div class="paddock">
        <section id="panel" class="panel"></section>
        <section id="championship" class="panel championship" data-label="league"></section>
      </div>
    </section>
    <section id="garage" class="garage-screen" hidden>
      <header class="garage-heading"><div><h1 data-text="garage"></h1><p id="garage-team"></p></div>
        <div class="garage-heading-actions"><label><span data-text="graphics"></span><select id="studio-quality" data-graphics data-label="graphics"></select></label>
        <div id="garage-resume"></div></div></header>
      <div class="garage-layout">
        <section class="garage-stage">
          <div id="garage-preview" class="garage-preview" data-label="preview"></div>
          <div class="studio-controls">
            <div><button type="button" data-view="front" data-text="front"></button><button type="button" data-view="side" data-text="side"></button><button type="button" data-view="rear" data-text="rear"></button></div>
            <p data-text="orbitHelp"></p>
            <div><button type="button" data-zoom="-1" data-label="zoomOut">−</button><button type="button" data-zoom="1" data-label="zoomIn">+</button></div>
          </div>
          <div id="garage-stats" class="garage-stats"></div>
        </section>
        <section class="workbench">
          <nav class="garage-tabs" data-label="garageNav">${Object.entries(garageTabs).map(([id, label]) =>
            `<button type="button" data-garage-tab="${id}" data-text="${label}"></button>`).join('')}</nav>
          <div id="garage-panel" class="garage-panel"></div>
        </section>
      </div>
    </section>
    <section id="hud" class="hud" hidden data-label="raceInfo">
      <div class="race-top">
        <div class="timing"><small id="race-title"></small><div><b id="laps"></b><span id="clock"></span></div><span id="best-lap"></span></div>
        <div class="position"><small data-text="rank"></small><div><b id="position"></b><span> / 5</span></div></div>
        <div class="race-actions"><button type="button" class="secondary pause-button" data-action="pause" data-text="pause"></button>
          <button type="button" class="secondary" data-action="pit-menu" aria-controls="pit-menu" aria-expanded="false"><kbd>P</kbd> <span data-text="pitStrategy"></span></button></div>
      </div>
      <div id="pit-menu" class="pit-menu" hidden><label><span data-text="nextCompound"></span><select id="pit-compound" data-pit-compound></select></label>
        <label><span data-text="pitRepair"></span><input id="pit-repair" type="checkbox" data-pit-repair></label>
        <small data-text="pitStopHint"></small></div>
      <div id="pit-status" class="pit-status" hidden></div>
      <div id="hit-vignette" class="hit-vignette" aria-hidden="true"></div>
      <div id="countdown" class="countdown" aria-live="polite"></div>
      <div class="race-bottom">
        <canvas id="map" width="180" height="156" data-label="minimap"></canvas>
        <div class="drive-help"><span id="road-warning" role="status"></span><div id="drive-help"></div><div class="line-indicator" id="line-indicator"><kbd>L</kbd> <span id="line-state"></span></div>
          <div class="ecu-indicators" id="ecu-indicators" data-label="ecuTab">
            <span id="tc-indicator" hidden>TC <small></small></span><span id="abs-indicator" hidden>ABS</span>
            <span id="lc-indicator" hidden>LC <small></small></span>
          </div></div>
        <div class="speed">
          <div class="tire-widget" id="tire-widget"><span id="race-compound"></span><b id="tire-life"></b>
            <meter id="tire-meter" min="0" max="100" low="25" high="55" optimum="100" value="100" data-label="tireLife"></meter></div>
          <strong id="speed"></strong><small data-text="kmh"></small><span><i id="speed-bar"></i></span>
          <div class="condition"><small data-text="body"></small><meter id="body-condition" min="0" max="100" low="42" high="77" optimum="100" data-label="bodyCondition" value="100"></meter><b id="condition-percent">100%</b></div>
        </div>
      </div>
    </section>
    <dialog id="overlay"></dialog>
    <p id="notice" role="status" hidden></p>
  </div>
`;

const byId = id => document.getElementById(id);
const circuit = byId('circuit');
const overlay = byId('overlay');
const map = byId('map');
const mapContext = map.getContext('2d');
const garagePreview = byId('garage-preview');
const updateWallet = createWallet(byId('wallet'), garageMoney);
const keys = new Set();
const drivingKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const skidSaveKey = 'apex-circuit-skid-marks-v1';
const screens = ['calendar', 'garage', 'teams'];
const orbit = { ...defaultOrbit };
let storage;
try { storage = window.localStorage; } catch { /* Keep the current session playable. */ }
let career = loadCareer(storage);
let screen = 'calendar';
let mode = 'menu';
let paused = false;
let alternateCamera = false;
let draft;
let sound = career.sound === true;
let audio;
let audioPending;
let track;
let trackLabel;
let race;
let activeLoadout;
let garageCar;
let drag;
let view;
let noticeTimeout;
let mapShape;
let previousFrame;
let accumulator = 0;
let lastHudUpdate = -1;
let lastHudHit;
let hudFlash;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const impactZones = { frontDamage: 'zoneFront', rearDamage: 'zoneRear', leftDamage: 'zoneLeft', rightDamage: 'zoneRight' };
let lastMenuDraw = -Infinity;
let lastCheckpoint = -Infinity;
let lastSkidSave = -Infinity;
let pendingTuning = false;
let previousGarageTab;
let statTimer;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const ms = Math.floor(seconds * 1000);
  return String(Math.floor(ms / 60000)).padStart(2, '0') + ':' +
    String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
}

function notify(message) {
  const notice = byId('notice');
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { notice.hidden = true; }, 4200);
}

function persist(quiet = false) {
  const saved = saveCareer(storage, career);
  if (saved) pendingTuning = false;
  if (!saved && !quiet) notify(t('storageError'));
  return saved;
}

function refreshLanguage() {
  document.documentElement.lang = getLanguage();
  for (const node of app.querySelectorAll('[data-text]')) node.textContent = t(node.dataset.text);
  for (const node of app.querySelectorAll('[data-label]')) node.setAttribute('aria-label', t(node.dataset.label));
  byId('drive-help').innerHTML = `WASD ${t('drive')} <i>·</i> SPACE ${t('handbrake')} <i>·</i> R ${t('resetCar')} <i>·</i> C ${t('camera')}`;
  updateSoundButton();
  showLinePreference();
}

function showLinePreference() {
  const enabled = career.racingLine !== false;
  byId('line-indicator').dataset.enabled = String(enabled);
  byId('line-state').textContent = t(enabled ? 'lineOn' : 'lineOff');
  const checkbox = overlay.querySelector('[data-racing-line]');
  if (checkbox) checkbox.checked = enabled;
}

function setRacingLine(enabled) {
  career = { ...career, racingLine: enabled };
  showLinePreference();
  if (!saveActiveRace(true)) persist();
}

function updateSoundButton() {
  const button = app.querySelector('[data-action="sound"]');
  button.textContent = t(sound ? 'soundOn' : 'soundOff');
  button.setAttribute('aria-pressed', String(sound));
}

function playAudio() {
  const driving = sound && mode === 'race' && !paused;
  updateAudio(audio, race, driving, driving || sound && mode === 'result');
}

function enableAudio() {
  if (!sound || audio || audioPending) return;
  audioPending = createAudio().then(created => {
    audio = created;
    playAudio();
  }).catch(() => {
    sound = false;
    career = { ...career, sound };
    persist(true);
    updateSoundButton();
    notify(t('audioError'));
  }).finally(() => { audioPending = null; });
}

function updateHeader() {
  byId('career-nav').hidden = byId('top-end').hidden = !career.profile;
  updateWallet(career.cash);
  for (const button of byId('career-nav').querySelectorAll('[data-tab]')) {
    if (button.dataset.tab === screen) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
}

function trackFor(event) {
  return track?.event === event ? track : createTrack(event);
}

function useTrack(next, nextRace) {
  const label = translatedField(next.event);
  if (view && (track !== next || trackLabel !== label)) view.setTrack(next, nextRace.cars, label);
  track = next;
  trackLabel = label;
  race = nextRace;
  view?.snap();
  lastMenuDraw = -Infinity;
}

function previewTrack() {
  if (!view) return;
  const next = trackFor(eventForResume(career) ?? events.at(-1));
  const loadout = normalizeLoadout(career);
  const team = screen === 'profile' && !career.profile && draft ? teamById(draft.team) ?? currentTeam(career) : currentTeam(career);
  useTrack(next, createRace(next, team, loadout.upgrades, loadout.setup, loadout.appearance, { condition: career.condition }));
}

function showMenu(next = career.screen) {
  if (overlay.open) overlay.close();
  mode = 'menu';
  paused = false;
  keys.clear();
  screen = career.profile ? (screens.includes(next) || next === 'profile' ? next : 'calendar') : 'profile';
  if (screen !== 'profile' && screen !== career.screen) {
    career = { ...career, screen };
    persist();
  }
  document.body.classList.remove('driving');
  document.body.classList.toggle('in-garage', screen === 'garage');
  document.body.classList.toggle('onboarding', screen === 'profile' && !career.profile);
  byId('menu').hidden = screen !== 'calendar' && screen !== 'teams';
  byId('garage').hidden = screen !== 'garage';
  byId('profile-screen').hidden = screen !== 'profile';
  byId('hud').hidden = true;
  byId('topbar').hidden = false;
  const home = screen === 'garage' ? garagePreview : byId('circuit-home');
  if (circuit.parentNode !== home) home.append(circuit);
  refreshLanguage();
  circuit.setAttribute('aria-label', t(screen === 'garage' ? 'preview' : 'track'));
  updateHeader();
  if (screen === 'garage') updateGarage();
  else {
    previewTrack();
    if (screen === 'profile') updateProfile();
    else updateMenu();
  }
  playAudio();
}

function updateProfile() {
  draft ??= { name: career.profile?.name ?? '', language: getLanguage(), team: career.team };
  byId('profile-screen').innerHTML = driverForm(career, draft);
  if (career.profile) return;
  byId('team-choices').innerHTML = `<fieldset class="team-choices"><legend>${t('startingTeam')}</legend>
    ${teams.map(team => `<label style="--team:${team.color}"><input type="radio" name="team" value="${team.id}" ${team.id === draft.team ? 'checked' : ''}>
      <strong>${team.name}</strong><small>${translatedField(team, 'perk')}</small></label>`).join('')}
  </fieldset>`;
}

function raceButton(saved) {
  if (!saved && integrity(career.condition) === 0) return `<button type="button" class="primary" data-action="service">${t('repairRequired')} <span aria-hidden="true">↗</span></button>`;
  return `<button type="button" class="primary" data-action="race" ${view ? '' : 'disabled'}>${t(saved ? 'resumeRace' : 'startRace')} <span aria-hidden="true">↗</span></button>`;
}

function updateMenu() {
  const event = eventForResume(career);
  const team = currentTeam(career);
  const saved = hasSavedRace(career);
  const championship = standings(career);
  const action = event ? raceButton(saved) : `<button type="button" class="primary" data-action="season">${t('newSeason')} <span aria-hidden="true">↗</span></button>`;
  byId('hero').innerHTML = `
    <div class="hero-meta"><span></span> ${upper(t('season'))} ${String(career.season).padStart(2, '0')} ${event ? `<i></i> ${upper(t('round'))} ${career.results.length + 1} / ${events.length}` : ''}</div>
    <h1>${event ? translatedField(event) : t('seasonDone')}</h1>
    <p>${event ? `${t('laps', event.laps)} <i>·</i> ${t('drivers')} <i>·</i> ${team.name}` : t('champion', escapeHtml(championship[0].name))}</p>
    ${action}
    ${saved ? `<p class="saved-lap">${t('savedLap', Math.min((career.activeRace.cars?.[0]?.lap ?? 0) + 1, event.laps), event.laps, formatTime(career.activeRace.elapsed))}</p>` :
    `<div class="controls"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> <span>${t('drive')}</span><kbd>SPACE</kbd> <span>${t('handbrake')}</span></div>`}
  `;
  const briefing = byId('briefing');
  briefing.hidden = !event || screen !== 'calendar';
  if (!briefing.hidden) {
    const difficulty = eventDifficulty(career);
    const purse = purseFor(event.prizes, difficulty);
    const pool = purse.reduce((sum, award) => sum + award, 0);
    briefing.innerHTML = `<h2>${t('briefing')}</h2>
      <div class="briefing-outline"><canvas width="232" height="200" aria-label="${t('minimap')}"></canvas>
      <div class="briefing-conditions"><strong>${t(event.format)}</strong><span>${t('laps', event.laps)}</span><span>${t(event.weather)}</span><span>${event.time}</span></div></div>
      <div class="briefing-prizes"><div><small>${t('prizePool')}</small><b>${garageMoney(pool)}</b></div>
      <div><small>${t('winnerPayout')}</small><b>${garageMoney(purse[0])}</b></div></div>
      ${difficultyControls(difficulty, saved)}
      ${compoundControls(saved ? career.activeRace.cars?.[0]?.compound ?? career.activeRace.loadout?.setup?.compound : career.setup.compound, saved, event)}`;
    drawBriefingMap(briefing.querySelector('canvas'), trackFor(event));
  }
  const entries = screen === 'teams' ? teams.map(candidate => {
    const active = candidate.id === team.id;
    const locked = candidate.unlock > career.completed;
    return `<div class="entry ${active ? 'current' : ''}"><span class="team-marker" style="--team:${candidate.color}"></span><div><strong>${candidate.name}</strong><small>${translatedField(candidate, 'perk')}</small></div><button type="button" class="secondary" data-team="${candidate.id}" ${active || locked ? 'disabled' : ''}>${t(active ? 'activeTeam' : locked ? 'requiresRaces' : 'join', candidate.unlock)}</button></div>`;
  }) : events.map((item, index) => {
    const result = career.results[index];
    const active = item.id === event?.id;
    const laps = result ? result.laps ?? legacyEvents[index]?.laps ?? item.laps : active ? event.laps : item.laps;
    const status = result ? (result.retired ? 'DNF' : t('placeLine', result.place, result.points)) : active ? t(saved ? 'savedRace' : 'upcoming') : t('waiting');
    return `<div class="entry ${active ? 'current' : ''}"><span class="date">${translatedField(item, 'date')}</span><div><strong>${translatedField(item)}</strong><small>${t('laps', laps)} <i>·</i> ${result ? garageMoney(result.prize) : t(item.format)}</small></div><span class="entry-status">${status}</span></div>`;
  });
  byId('panel').innerHTML = `<h2>${t(screen === 'teams' ? 'teams' : 'schedule')}</h2><div class="entries">${entries.join('')}</div>`;
  byId('championship').innerHTML = `<h2>${t('league')}</h2><ol>${championship.map((driver, index) => `
      <li class="${driver.id === 'player' ? 'you' : ''}">
        <span class="rank">${career.results.length ? index + 1 : '–'}</span>
        <span class="driver-dot" style="--driver:${driver.color}"></span>
        <span>${escapeHtml(driver.name)}</span><b>${driver.points} <small>${upper(t('points'))}</small></b>
      </li>`).join('')}</ol>`;
}

function updateGaragePreview() {
  const loadout = normalizeLoadout(career);
  const condition = hasSavedRace(career) ? career.activeRace.cars?.[0] ?? career.condition : career.condition;
  garageCar = { x: 0, z: 0, yaw: 0, speed: 0, steer: 0, ...vehicleCondition(condition),
    color: currentTeam(career).color, appearance: loadout.appearance };
  showStats(career);
}

function showStats(before, after, applied = false) {
  clearTimeout(statTimer);
  byId('garage-stats').innerHTML = garageStats(before, after, applied, garageCar);
  if (applied) statTimer = setTimeout(() => showStats(career), 1750);
}

function updateGarage() {
  const team = currentTeam(career);
  const saved = hasSavedRace(career);
  byId('garage-team').textContent = team.name;
  byId('garage-resume').innerHTML = saved ? raceButton(true) : '';
  byId('studio-quality').innerHTML = graphicsOptions();
  const panel = byId('garage-panel');
  panel.innerHTML = (saved && career.garageTab !== 'service' ? `<p class="pending-setup">${t('nextRaceSetup')}</p>` : '') + garagePanel(career, saved);
  if (career.garageTab !== previousGarageTab) panel.scrollTop = 0;
  previousGarageTab = career.garageTab;
  for (const button of byId('garage').querySelectorAll('nav [data-garage-tab]')) {
    if (button.dataset.garageTab === career.garageTab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  updateHeader();
  updateGaragePreview();
}

function startRace(restart = false) {
  const event = eventForResume(career);
  if (!view || !event || mode !== 'menu' || !career.profile) return;
  const next = trackFor(event);
  const restored = restoreRace(career, next);
  if (hasSavedRace(career) && !restored) notify(t('invalidRace'));
  if (!restored && integrity(career.condition) === 0) return openService();
  if (!restart) {
    activeLoadout = restored?.loadout ?? normalizeLoadout(career);
    alternateCamera = restored?.alternateCamera ?? false;
  }
  const continued = !restart && restored?.race;
  useTrack(next, continued || createRace(next, teamById(activeLoadout.team), activeLoadout.upgrades, activeLoadout.setup,
    activeLoadout.appearance, { difficulty: eventDifficulty(career), condition: career.condition, electronics: activeLoadout.electronics }));
  if (continued) restoreSkids();
  else clearSkidSave();
  byId('circuit-home').append(circuit);
  circuit.setAttribute('aria-label', t('track'));
  mode = 'race';
  paused = false;
  keys.clear();
  accumulator = 0;
  lastHudUpdate = lastCheckpoint = -Infinity;
  lastSkidSave = (previousFrame ?? 0) + 1000;
  lastHudHit = null;
  hudFlash?.cancel();
  byId('menu').hidden = byId('garage').hidden = byId('topbar').hidden = true;
  byId('hud').hidden = false;
  setPitMenu(false);
  document.body.classList.remove('in-garage');
  document.body.classList.add('driving');
  byId('race-title').textContent = translatedField(event);
  mapShape = circuitMap(track, map.width, map.height);
  updateHud();
  saveActiveRace();
  enableAudio();
  circuit.focus({ preventScroll: true });
}

function updateHud() {
  const player = race.player;
  const speed = Math.round(Math.abs(player.speed) * 3.6);
  byId('laps').textContent = `${upper(t('lap'))} ${Math.min(player.lap + 1, track.event.laps)} / ${track.event.laps}`;
  byId('clock').textContent = formatTime(race.elapsed);
  byId('position').textContent = race.position();
  byId('speed').textContent = speed;
  byId('speed-bar').style.width = Math.min(100, speed / 2.35) + '%';
  const tyreLife = Math.round(tireHealth(player) * 100);
  const compound = byId('race-compound');
  const widget = byId('tire-widget');
  if (compound.dataset.id !== player.compound || compound.lang !== getLanguage()) {
    compound.dataset.id = player.compound;
    compound.lang = getLanguage();
    compound.innerHTML = compoundBadge(player.compound);
  }
  widget.dataset.worn = String(tyreLife < 23);
  byId('tire-meter').value = tyreLife;
  byId('tire-life').textContent = tyreLife + '%';
  updatePitStatus(player);
  const rpm = race.launchHold || player.actuation?.rpm || 0;
  setEcuIndicator('tc', race.electronics.traction, player.actuation?.tc, t('tc_' + race.tcMode));
  setEcuIndicator('abs', race.electronics.abs, player.actuation?.abs);
  setEcuIndicator('lc', race.electronics.launch, rpm, rpm ? `${rpm} RPM` : '');
  const condition = integrity(player);
  byId('body-condition').value = condition;
  byId('condition-percent').textContent = condition + '%';
  byId('body-condition').parentElement.dataset.level = condition < 40 ? 'critical' : condition < 70 ? 'damaged' : 'healthy';
  const impact = race.impact;
  const recent = impact && impact.impulse > 2.6 && race.elapsed - impact.time < 1.45;
  if (recent && lastHudHit !== impact) {
    lastHudHit = impact;
    if (impact.loss >= 1 && !reducedMotion.matches) {
      hudFlash?.cancel();
      hudFlash = byId('hit-vignette').animate([{ opacity: Math.min(0.65, 0.13 + impact.loss * 0.022) }, { opacity: 0 }],
        { duration: 550, easing: 'ease-out' });
    }
  }
  const message = !recent ? (player.onRoad ? '' : t('offTrack')) : impact.loss >= 1
    ? t('zoneImpact', t(impactZones[impact.zone]), Math.round(impact.loss)) : t(impact.kind === 'rail' ? 'railHit' : 'carHit');
  if (byId('road-warning').textContent !== message) byId('road-warning').textContent = message;
  byId('best-lap').textContent = player.bestLap ? `${upper(t('bestLap'))}  ${formatTime(player.bestLap)}` : '';
  const startMessage = race.countdown > 0 ? String(Math.ceil(race.countdown)) : race.elapsed < 0.8 ? t('go') : '';
  if (byId('countdown').textContent !== startMessage) byId('countdown').textContent = startMessage;
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

function setEcuIndicator(id, installed, active, detail) {
  const badge = byId(id + '-indicator');
  badge.hidden = !installed;
  badge.dataset.active = String(Boolean(active));
  if (detail !== undefined && badge.lastElementChild.textContent !== detail) badge.lastElementChild.textContent = detail;
}

function setPitMenu(open) {
  const menu = byId('pit-menu');
  app.querySelector('[data-action="pit-menu"]').setAttribute('aria-expanded', String(open));
  menu.hidden = !open;
  if (!open) return;
  byId('pit-compound').innerHTML = compoundOptions(race.pit.plan.compound);
  byId('pit-repair').checked = race.pit.plan.repair;
}

function updatePitStatus(player) {
  const status = byId('pit-status');
  const { lane, remaining } = player.pit;
  status.hidden = !lane && !remaining;
  const message = remaining ? t('pitServiceTimer', remaining.toFixed(1)) : lane ? t('pitLimiter') : '';
  if (message !== status.textContent) status.textContent = message;
}

function saveActiveRace(quiet = false) {
  if (mode !== 'race' || race.order) return false;
  career = { ...career, screen: 'calendar', activeRace: raceCheckpoint(career, race, activeLoadout, alternateCamera) };
  return persist(quiet);
}

function saveSkids() {
  if (mode !== 'race' || !storage) return;
  const data = view.captureSkids(race.runId);
  if (!data) return;
  try { storage.setItem(skidSaveKey, `${race.runId} ${data}`); } catch { /* Keep the race checkpoint playable. */ }
}

function restoreSkids() {
  try {
    const saved = storage?.getItem(skidSaveKey);
    const prefix = race.runId + ' ';
    if (saved?.startsWith(prefix)) view.restoreSkids(race.runId, saved.slice(prefix.length));
  } catch { /* Skids are optional when storage is unavailable. */ }
}

function clearSkidSave() {
  try { storage?.removeItem(skidSaveKey); } catch { /* Storage may be unavailable. */ }
}

function pauseRace() {
  if (mode !== 'race' || paused) return;
  keys.clear();
  paused = true;
  setPitMenu(false);
  const saved = saveActiveRace(true);
  if (saved) saveSkids();
  updateHud();
  renderPause(saved);
  overlay.showModal();
  playAudio();
}

function renderPause(saved) {
  overlay.innerHTML = `<h2>${t('paused')}</h2><p>${t(saved ? 'pauseSaved' : 'pauseUnsaved')}</p>
    <label class="pause-setting"><span>${t('graphics')}</span><select data-graphics>${graphicsOptions()}</select></label>
    <label class="pause-setting"><span>${t('racingLine')} <kbd>L</kbd></span><input type="checkbox" data-racing-line ${career.racingLine !== false ? 'checked' : ''}></label>
    <div class="dialog-actions">
      <button type="button" class="primary" data-action="resume">${t('resumeRace')}</button>
      <button type="button" class="secondary" data-action="save-exit">${t(saved ? 'saveExit' : 'backCalendar')}</button>
    </div>
    <div class="pause-alternatives">
      <button type="button" class="dialog-link" data-action="restart">${t('restartRace')}</button>
      <button type="button" class="dialog-link" data-action="retire">${t('retireRace')}</button>
    </div>`;
}

function graphicsOptions() {
  return Object.keys(graphicsModes).map(mode =>
    `<option value="${mode}" ${mode === qualityMode(career.graphics) ? 'selected' : ''}>${t(mode)}</option>`).join('');
}

function confirmRaceAction(action) {
  const [heading, hint] = action === 'retire' ? ['retireRace', 'retireHint'] : ['restartRace', 'restartHint'];
  overlay.innerHTML = `<h2>${t(heading)}</h2><p>${t(hint)}</p><div class="dialog-actions">
    <button type="button" class="secondary" data-action="keep-race">${t('keepRace')}</button>
    <button type="button" class="primary" data-action="confirm-${action}">${t(heading)}</button></div>`;
  overlay.querySelector('[data-action="keep-race"]').focus();
}

function resumeRace() {
  if (mode !== 'race' || !paused) return;
  paused = false;
  accumulator = 0;
  overlay.close();
  circuit.focus({ preventScroll: true });
  enableAudio();
}

function finishRace() {
  career = finishEvent(career, race.order, race.player.finishTime ?? race.elapsed, race.player.bestLap, activeLoadout, track.event, {
    difficulty: race.difficulty, retired: race.retired, retiredDrivers: race.retiredDrivers, condition: race.player,
  });
  mode = 'result';
  paused = false;
  keys.clear();
  setPitMenu(false);
  updateHud();
  if (persist()) clearSkidSave();
  const result = career.results.at(-1);
  const condition = integrity(result.condition);
  const unlocked = !result.retired && teams.find(team => team.unlock === career.completed);
  overlay.innerHTML = `
    <div class="result-heading"><div class="hero-meta"><span></span> ${translatedField(track.event)}</div>${difficultyBadge(result.difficulty)}</div>
    <h2>${result.retired ? 'DNF' : t('raceResult', result.place)}</h2>
    ${result.retired ? `<p class="retirement-reason">${t(condition === 0 ? 'mechanicalFailure' : 'driverRetired')}</p>` : ''}
    <div class="result-grid">
      <div class="result-payout"><small>${upper(t('prize'))}</small><b id="result-prize" aria-label="${garageMoney(result.prize)}">${garageMoney(0)}</b></div>
      <div><small>${upper(t('seasonPoints'))}</small><b>+${result.points}</b></div>
      <div><small>${upper(t('totalTime'))}</small><b>${formatTime(result.time)}</b></div>
      <div><small>${upper(t('bestLap'))}</small><b>${formatTime(result.bestLap)}</b></div>
    </div>
    ${result.retired ? '' : payoutBreakdown(result)}
    <p class="result-condition">${t('bodyCondition')} <b>${condition}%</b></p>
    ${unlocked ? `<p>${t('teamUnlocked', unlocked.name)}</p>` : ''}
    <div class="dialog-actions">
      <button type="button" class="primary" data-action="calendar">${t('backCalendar')}</button>
      <button type="button" class="secondary" data-action="${condition < 100 ? 'service' : 'garage'}">${t(condition < 100 ? 'openService' : 'backGarage')}</button>
    </div>
  `;
  if (overlay.open) overlay.querySelector('[data-action="calendar"]').focus();
  else overlay.showModal();
  const amount = byId('result-prize');
  animateAmount(value => { if (amount.isConnected) amount.textContent = garageMoney(value); }, 0, result.prize, 720);
  playAudio();
}

function openService() {
  career = { ...career, garageTab: 'service' };
  persist();
  showMenu('garage');
}

function aimGarage(location) {
  orbit.azimuth = location === 'right' ? -garageAngles.side : garageAngles[location];
  orbit.elevation = location === 'front' ? 0.43 : location === 'side' || location === 'right' ? 0.23 : 0.32;
}

function tune(key, value) {
  career = { ...career, setup: normalizeSetup({ ...career.setup, [key]: value }, career.upgrades.aero) };
  pendingTuning = true;
  updateGaragePreview();
  const output = byId('garage-panel').querySelector(`[data-value="${key}"]`);
  const spec = sliders.find(item => item.id === key);
  if (output && spec) output.textContent = setupValue(career.setup[key], spec.suffix);
}

app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const { dataset } = button;
  if (dataset.tab && career.profile) showMenu(dataset.tab);
  if (dataset.garageTab) {
    career = { ...career, garageTab: dataset.garageTab };
    persist();
    updateGarage();
  }
  if (dataset.buy) {
    const before = career;
    career = buyUpgrade(career, dataset.buy);
    if (dataset.buy === 'aero' && career.upgrades.aero === 1) career = { ...career, garageTab: 'aero' };
    persist();
    updateGarage();
    aimGarage(['aero', 'engine'].includes(dataset.buy) ? 'rear' : 'side');
    const samePart = byId('garage-panel').querySelector(`[data-buy="${dataset.buy}"]:not(:disabled)`);
    (samePart ?? byId('garage').querySelector('nav [aria-current]'))?.focus();
    if (before !== career) showStats(before, career, true);
  }
  if (dataset.buyEcu) {
    const before = career;
    career = buyElectronics(career, dataset.buyEcu);
    if (before !== career) {
      persist();
      updateGarage();
      const same = byId('garage-panel').querySelector(`[data-buy-ecu="${dataset.buyEcu}"]:not(:disabled)`);
      (same ?? byId('garage').querySelector('nav [aria-current]'))?.focus();
      showStats(before, career, true);
    }
  }
  if (dataset.team) {
    career = changeTeam(career, dataset.team);
    persist();
    showMenu('teams');
  }
  if (dataset.wing) {
    tune('wing', dataset.wing);
    persist();
    aimGarage('rear');
    updateGarage();
    byId('garage-panel').querySelector(`[data-wing="${dataset.wing}"]`)?.focus();
  }
  if (dataset.sponsor) {
    career = acceptSponsor(career, dataset.sponsor);
    persist();
    updateGarage();
  }
  if (dataset.view) aimGarage(dataset.view);
  if (dataset.zoom) orbit.zoom = Math.max(0.72, Math.min(1.42, orbit.zoom + Number(dataset.zoom) * 0.12));
  switch (dataset.action) {
    case 'race': startRace(); break;
    case 'pause': pauseRace(); break;
    case 'pit-menu': if (mode === 'race' && !paused) setPitMenu(byId('pit-menu').hidden); break;
    case 'resume': resumeRace(); break;
    case 'restart':
    case 'retire':
      confirmRaceAction(dataset.action);
      break;
    case 'keep-race':
      renderPause(saveActiveRace(true));
      overlay.querySelector('[data-action="resume"]').focus();
      break;
    case 'confirm-restart':
      career = { ...career, condition: vehicleCondition(race.player) };
      overlay.close();
      mode = 'menu';
      startRace(true);
      break;
    case 'confirm-retire':
      race.retire();
      finishRace();
      break;
    case 'save-exit':
      if (saveActiveRace()) saveSkids();
      showMenu('calendar');
      break;
    case 'calendar': showMenu('calendar'); break;
    case 'garage': showMenu('garage'); break;
    case 'service': openService(); break;
    case 'repair':
    case 'finance-repair': {
      if (hasSavedRace(career)) break;
      const candidate = { ...career, activeRace: null };
      const repaired = repairVehicle(candidate, dataset.action === 'finance-repair');
      if (candidate !== repaired) {
        career = repaired;
        persist();
        updateGarage();
        byId('garage-panel').querySelector('.service-condition')?.focus();
        notify(t('repairComplete'));
      }
      break;
    }
    case 'profile': draft = undefined; showMenu('profile'); break;
    case 'cancel-profile':
      draft = undefined;
      setLanguage(career.profile.language);
      showMenu(career.screen);
      break;
    case 'sound':
      sound = !sound;
      career = { ...career, sound };
      persist();
      updateSoundButton();
      enableAudio();
      playAudio();
      break;
    case 'season':
      if (!currentEvent(career)) {
        career = { ...career, season: career.season + 1, results: [], activeRace: null };
        persist();
        showMenu('calendar');
      }
      break;
  }
});

const workbench = byId('garage-panel');
function previewPartRow(event) {
  const row = event.target.closest('[data-part],[data-ecu-part]');
  if (!row || row.contains(event.relatedTarget)) return;
  showStats(career, row.dataset.ecuPart ? previewElectronics(career, row.dataset.ecuPart) : previewPart(career, row.dataset.part));
}
function clearPartRow(event) {
  const row = event.target.closest('[data-part],[data-ecu-part]');
  if (row && !row.contains(event.relatedTarget)) showStats(career);
}
workbench.addEventListener('pointerover', previewPartRow);
workbench.addEventListener('pointerout', clearPartRow);
workbench.addEventListener('focusin', previewPartRow);
workbench.addEventListener('focusout', clearPartRow);

app.addEventListener('input', event => {
  const field = event.target;
  if (field.form?.id === 'driver-form' && field.name === 'driver') draft.name = field.value;
  if (field.dataset.tune && field.tagName === 'INPUT') tune(field.dataset.tune, field.type === 'range' ? field.valueAsNumber : field.value);
});

app.addEventListener('change', event => {
  const field = event.target;
  if (mode === 'race' && (field.hasAttribute('data-pit-compound') || field.hasAttribute('data-pit-repair'))) {
    race.pit.plan = { compound: byId('pit-compound').value, repair: byId('pit-repair').checked };
    saveActiveRace(true);
  }
  if (field.hasAttribute('data-race-compound') && !hasSavedRace(career)) {
    career = { ...career, setup: normalizeSetup({ ...career.setup, compound: field.value }, career.upgrades.aero) };
    persist();
  }
  if (field.hasAttribute('data-difficulty') && !hasSavedRace(career)) {
    career = { ...career, difficulty: difficultyId(field.value) };
    persist();
    updateMenu();
    byId('briefing').querySelector('[data-difficulty]:checked')?.focus({ preventScroll: true });
  }
  if (field.hasAttribute('data-racing-line')) setRacingLine(field.checked);
  if (field.hasAttribute('data-graphics')) {
    career = { ...career, graphics: qualityMode(field.value) };
    view?.setQuality(career.graphics);
    persist();
  }
  if (field.form?.id === 'driver-form') {
    if (field.name === 'team') {
      draft.team = field.value;
      if (race) race.player.color = teamById(draft.team).color;
    }
    if (field.name === 'language') {
      draft.language = field.value;
      setLanguage(field.value);
      refreshLanguage();
      previewTrack();
      updateProfile();
      byId('driver-form').elements.language.focus();
    }
  }
  if (field.dataset.tune) {
    tune(field.dataset.tune, field.type === 'range' ? field.valueAsNumber : field.value);
    persist();
  }
  if (field.dataset.decal) {
    career = toggleDecal(career, field.dataset.decal);
    const slot = decalSlots.find(item => item.id === field.dataset.decal);
    aimGarage(slot.view);
    persist();
    updateGaragePreview();
  }
});

app.addEventListener('submit', event => {
  if (event.target.id !== 'driver-form') return;
  event.preventDefault();
  const fields = new FormData(event.target);
  const next = saveProfile(career, fields.get('driver'), fields.get('language'), fields.get('team'));
  if (next === career) {
    event.target.elements.driver.value = '';
    event.target.elements.driver.reportValidity();
    return;
  }
  career = next;
  draft = undefined;
  setLanguage(career.profile.language);
  persist();
  showMenu(career.screen);
});

garagePreview.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  garagePreview.setPointerCapture(event.pointerId);
});
garagePreview.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  orbit.azimuth -= (event.clientX - drag.x) * 0.012;
  orbit.elevation = Math.max(0.12, Math.min(1.07, orbit.elevation + (event.clientY - drag.y) * 0.008));
  drag.x = event.clientX;
  drag.y = event.clientY;
});
garagePreview.addEventListener('lostpointercapture', () => { drag = undefined; });
garagePreview.addEventListener('wheel', event => {
  event.preventDefault();
  orbit.zoom = Math.max(0.72, Math.min(1.42, orbit.zoom - Math.sign(event.deltaY) * 0.08));
}, { passive: false });

window.addEventListener('keydown', event => {
  if (mode === 'race' && !paused && event.code === 'KeyP' && !event.target.closest?.('select,input,textarea')) {
    event.preventDefault();
    if (!event.repeat) setPitMenu(byId('pit-menu').hidden);
    return;
  }
  if (mode === 'race' && event.code === 'KeyT' && race.electronics.traction && !event.target.closest?.('select,input,textarea')) {
    event.preventDefault();
    if (!event.repeat) {
      race.rotateTC();
      updateHud();
      saveActiveRace(true);
    }
    return;
  }
  if (mode === 'race' && event.code === 'KeyL' && !event.target.closest?.('select,input,textarea')) {
    event.preventDefault();
    if (!event.repeat) setRacingLine(career.racingLine === false);
    return;
  }
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
    saveActiveRace(true);
  }
  if (event.code === 'KeyC') {
    alternateCamera = !alternateCamera;
    saveActiveRace(true);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); pauseRace(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (mode === 'race') pauseRace();
  else if (pendingTuning) persist(true);
});
window.addEventListener('pagehide', () => {
  if (mode === 'race' && saveActiveRace(true)) saveSkids();
  else if (pendingTuning) persist(true);
});
overlay.addEventListener('cancel', event => {
  event.preventDefault();
  if (paused) resumeRace();
});

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, Math.max(0, (now - (previousFrame ?? now)) / 1000));
  previousFrame = now;
  if (mode === 'menu' && screen === 'garage') {
    view.drawGarage(garageCar, orbit, dt);
    return;
  }
  const braking = keys.has('KeyS') || keys.has('ArrowDown');
  if (mode === 'race' && !paused) {
    const input = {
      gas: keys.has('KeyW') || keys.has('ArrowUp'), brake: braking, handbrake: keys.has('Space'),
      steering: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
    };
    accumulator += dt;
    while (accumulator >= raceStep && !race.order) {
      race.update(raceStep, input);
      accumulator -= raceStep;
    }
    if (race.order) finishRace();
    else if (now - lastCheckpoint >= 700) {
      saveActiveRace(true);
      lastCheckpoint = now;
    }
    if (now - lastHudUpdate > 44 || mode === 'result') {
      updateHud();
      lastHudUpdate = now;
    }
    playAudio();
  }
  if (mode !== 'menu' || now - lastMenuDraw >= 100) {
    const fraction = mode === 'race' && !paused ? accumulator / raceStep : 1;
    view.draw(race, mode, dt, braking, alternateCamera, paused, fraction, career.racingLine !== false);
    if (mode === 'menu') lastMenuDraw = now;
    if (mode === 'race' && !paused && now - lastSkidSave > 10000) {
      saveSkids();
      lastSkidSave = now;
    }
  }
}

async function startGame() {
  setLanguage(career.profile?.language);
  try {
    const { createView } = await import('./scene.js');
    view = await createView(circuit, career.graphics);
    circuit.tabIndex = -1;
    showMenu();
    requestAnimationFrame(frame);
  } catch {
    view = undefined;
    showMenu();
    notify(t('webglError'));
  }
}

startGame();
