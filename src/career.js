import { carAppearance, decalSlots, defaultSetup, normalizeSetup, sponsors } from './setup.js';

export const gameName = 'Kırmızı Çizgi';

export const events = [
  {
    name: 'Sedir Pisti',
    nameEn: 'Cedar Circuit',
    date: '12 NİS',
    dateEn: '12 APR',
    laps: 2,
    width: 15,
    rivalPace: [0.80, 0.75, 0.83, 0.81],
    accent: '#ffd193',
    sky: ['#617287', '#a7a394'],
    skyYaw: 2.64,
    points: [[-55, 60], [-55, -25], [-38, -81], [16, -106], [66, -64], [69, -12], [37, 19], [51, 63], [23, 111], [-28, 109]],
  },
  {
    name: 'Körfez Virajları',
    nameEn: 'Bay Curves',
    date: '26 NİS',
    dateEn: '26 APR',
    laps: 2,
    width: 14,
    rivalPace: [0.84, 0.93, 0.91, 0.88],
    accent: '#ffb295',
    sky: ['#584e65', '#a79c96'],
    skyYaw: 2.07,
    points: [[-58, 60], [-58, -26], [-40, -92], [30, -109], [70, -83], [48, -42], [14, -21], [31, 16], [76, 28], [77, 78], [29, 112], [-23, 111]],
  },
  {
    name: 'Zirve Grand Prix',
    nameEn: 'Summit Grand Prix',
    date: '10 MAY',
    dateEn: '10 MAY',
    laps: 3,
    width: 16,
    rivalPace: [0.91, 0.98, 0.98, 0.93],
    accent: '#b9e2ff',
    sky: ['#41638a', '#8699a5'],
    skyYaw: 3.16,
    points: [[-62, 61], [-62, -34], [-36, -99], [26, -133], [83, -107], [86, -61], [55, -25], [81, 11], [88, 65], [48, 120], [-17, 122]],
  },
];

export const teams = [
  { id: 'apex', name: 'Kızıl Motor', color: '#f04b32', unlock: 0, payout: 1, power: 0, grip: 0, perk: 'Dengeli başlangıç', perkEn: 'Balanced setup' },
  { id: 'volt', name: 'Volt Motorsport', color: '#42cbc1', unlock: 1, payout: 1, power: 2.2, grip: 0, perk: 'Daha yüksek motor gücü', perkEn: 'More engine power' },
  { id: 'summit', name: 'Summit Racing', color: '#c7a5ff', unlock: 2, payout: 1.2, power: 0, grip: 0.3, perk: '+%20 ödül ve daha iyi tutuş', perkEn: '20% more prize money and extra grip' },
];

export const upgrades = [
  { id: 'engine', name: 'Motor', nameEn: 'Engine', effect: 'Hızlanma ve son hız', effectEn: 'Acceleration and top speed', baseCost: 850 },
  { id: 'tires', name: 'Lastikler', nameEn: 'Tires', effect: 'Viraj tutuşu', effectEn: 'Cornering grip', baseCost: 700 },
  { id: 'brakes', name: 'Frenler', nameEn: 'Brakes', effect: 'Daha kısa fren mesafesi', effectEn: 'Shorter braking distance', baseCost: 650 },
  { id: 'aero', name: 'Aerodinamik', nameEn: 'Aerodynamics', effect: 'Arka kanat ve yere basma kuvveti', effectEn: 'Rear wing and downforce', baseCost: 900 },
];

export const rivals = [
  { id: 'deniz', name: 'Deniz Kaya', color: '#50c7f0', pace: 1 },
  { id: 'selin', name: 'Selin Aras', color: '#f4c257', pace: 0.96 },
  { id: 'ece', name: 'Ece Demir', color: '#a88df6', pace: 0.91 },
  { id: 'mert', name: 'Mert Aydın', color: '#f2e8de', pace: 0.86 },
];

// Keep the original key and team ID so that existing careers load after the rename.
const storageKey = 'apex-circuit-career-v1';
const pointsByPlace = [25, 18, 15, 12, 10];
const prizes = [1800, 1350, 1100, 950, 850];
export const maxUpgrade = 3;
export const money = (amount, language = 'tr') => '₺' + new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR').format(amount);
export const price = (upgrade, level) => upgrade.baseCost * (level + 1);
export const teamById = id => teams.find(team => team.id === id);
export const currentTeam = career => teamById(career.team);
export const currentEvent = career => events[career.results.length];

export function newCareer() {
  return {
    cash: 400, team: teams[0].id, upgrades: { engine: 0, tires: 0, brakes: 0, aero: 0 },
    setup: { ...defaultSetup }, sponsor: null, decals: [], completed: 0, season: 1, results: [],
    profile: null, activeRace: null, screen: 'calendar', garageTab: 'parts',
  };
}

export function normalizeLoadout(data) {
  const team = teamById(data?.team) ?? teams[0];
  const parts = Object.fromEntries(upgrades.map(({ id }) => {
    const level = data?.upgrades?.[id];
    return [id, Number.isInteger(level) ? Math.max(0, Math.min(maxUpgrade, level)) : 0];
  }));
  const sponsor = sponsors.find(offer => offer.id === data?.sponsor);
  const decals = decalSlots.filter(slot => sponsor && Array.isArray(data?.decals) && data.decals.includes(slot.id)).map(slot => slot.id);
  const loadout = { team: team.id, upgrades: parts, setup: normalizeSetup(data?.setup, parts.aero), sponsor: sponsor?.id ?? null, decals };
  return { ...loadout, appearance: carAppearance(loadout) };
}

export function loadCareer(storage) {
  try {
    const career = JSON.parse(storage.getItem(storageKey));
    if (career && currentTeam(career) && Array.isArray(career.results) && career.upgrades) {
      const { team, upgrades: parts, setup, sponsor, decals } = normalizeLoadout(career);
      return { ...newCareer(), ...career, team, upgrades: parts, setup, sponsor, decals };
    }
  } catch {
    // The career still works for the current session when storage is unavailable.
  }
  return newCareer();
}

export function saveCareer(storage, career) {
  try {
    storage.setItem(storageKey, JSON.stringify(career));
    return true;
  } catch {
    return false;
  }
}

export function buyUpgrade(career, id) {
  const upgrade = upgrades.find(item => item.id === id);
  if (!upgrade) return career;
  const level = career.upgrades[id];
  const cost = price(upgrade, level);
  if (level >= maxUpgrade || cost > career.cash) return career;
  return { ...career, cash: career.cash - cost, upgrades: { ...career.upgrades, [id]: level + 1 } };
}

export function changeTeam(career, id) {
  const team = teams.find(item => item.id === id);
  if (!team || career.completed < team.unlock) return career;
  return { ...career, team: team.id };
}

export function saveProfile(career, name, language, team) {
  const cleaned = (typeof name === 'string' ? name : '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!cleaned) return career;
  return {
    ...career,
    team: !career.profile && !career.activeRace && teamById(team) ? team : career.team,
    profile: { name: cleaned, language: language === 'en' ? 'en' : 'tr' },
  };
}

export function acceptSponsor(career, id) {
  const offer = sponsors.find(sponsor => sponsor.id === id);
  if (!offer || career.completed < offer.unlock) return career;
  return { ...career, sponsor: id };
}

export function toggleDecal(career, slot) {
  if (!career.sponsor || !decalSlots.some(item => item.id === slot)) return career;
  const decals = career.decals.includes(slot) ? career.decals.filter(id => id !== slot) : [...career.decals, slot];
  return { ...career, decals };
}

export function finishEvent(career, order, time, bestLap, loadout = normalizeLoadout(career)) {
  const place = order.indexOf('player') + 1;
  const points = pointsByPlace[place - 1];
  const bonus = loadout.decals.length ? (sponsors.find(offer => offer.id === loadout.sponsor)?.payout ?? 0) : 0;
  const prize = Math.round(prizes[place - 1] * teamById(loadout.team).payout) + bonus;
  const result = { place, points, prize, bonus, time, bestLap, order };
  return {
    ...career,
    cash: career.cash + prize,
    completed: career.completed + 1,
    activeRace: null,
    results: [...career.results, result],
  };
}

export function standings(career) {
  const drivers = [{ id: 'player', name: career.profile?.name ?? 'Sen', color: currentTeam(career).color }, ...rivals];
  return drivers.map(driver => ({
    ...driver,
    points: career.results.reduce((sum, result) => sum + pointsByPlace[result.order.indexOf(driver.id)], 0),
    places: Array.from({ length: drivers.length }, (_, index) =>
      career.results.filter(result => result.order[index] === driver.id).length),
  })).sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    for (let index = 0; index < a.places.length; index++) {
      if (a.places[index] !== b.places[index]) return b.places[index] - a.places[index];
    }
    return 0;
  });
}
