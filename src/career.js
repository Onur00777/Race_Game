import { carAppearance, decalSlots, defaultSetup, normalizeSetup, sponsors } from './setup.js';
import { defaultPoints, defaultPrizes, events } from './events.js';
import { difficulties, difficultyId } from './difficulty.js';
import { integrity, vehicleCondition } from './vehicle-damage.js';
import { electronics, normalizeElectronics } from './ecu.js';
import { aeroAccess, electronicsMilestone, installedModels, milestoneReached, normalizeHardware, partTier, stages } from './hardware.js';

export const gameName = 'VIN VIN';

export { events };

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
const positiveMoney = value => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
export const maxUpgrade = stages;
const currencyFormats = { en: new Intl.NumberFormat('en-US'), tr: new Intl.NumberFormat('tr-TR') };
export const money = (amount, language = 'tr') => '₺' + (currencyFormats[language] ?? currencyFormats.tr).format(amount);
export const price = (upgrade, level, career) => Math.round(upgrade.baseCost * (1 + level * 0.72) *
  (1 + partTier(upgrade.id, career?.hardware?.[upgrade.id]?.installed) * 0.32));
export const teamById = id => teams.find(team => team.id === id);
export const currentTeam = career => teamById(career.team);
export const currentEvent = career => events[career.results.length];

export function newCareer() {
  return {
    cash: 1200, team: teams[0].id, upgrades: { engine: 0, tires: 0, brakes: 0, aero: 0 }, hardware: normalizeHardware(),
    setup: { ...defaultSetup }, sponsor: null, decals: [], completed: 0, season: 1, results: [],
    profile: null, activeRace: null, difficulty: 'medium', screen: 'calendar', garageTab: 'parts',
    condition: vehicleCondition(), repairDebt: 0, electronics: normalizeElectronics(),
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
  const hardware = normalizeHardware(data?.hardware);
  const models = installedModels(hardware);
  const loadout = { team: team.id, upgrades: parts, hardware, models, setup: normalizeSetup(data?.setup, aeroAccess(parts.aero, models.aero)),
    electronics: normalizeElectronics(data?.electronics), sponsor: sponsor?.id ?? null, decals };
  return { ...loadout, appearance: carAppearance(loadout) };
}

export function loadCareer(storage) {
  try {
    const career = JSON.parse(storage.getItem(storageKey));
    if (career && currentTeam(career) && Array.isArray(career.results) && career.upgrades) {
      const { team, upgrades: parts, hardware, setup, sponsor, decals, electronics: ecu } = normalizeLoadout(career);
      return { ...newCareer(), ...career, team, upgrades: parts, hardware, setup, sponsor, decals, electronics: ecu, difficulty: difficultyId(career.difficulty),
        condition: vehicleCondition(career.condition), repairDebt: positiveMoney(career.repairDebt) };
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
  const cost = price(upgrade, level, career);
  if (level >= maxUpgrade || cost > career.cash) return career;
  const hardware = normalizeHardware(career.hardware);
  const equipped = hardware[id];
  if (equipped) equipped.owned[equipped.installed] = level + 1;
  return { ...career, hardware, cash: career.cash - cost, upgrades: { ...career.upgrades, [id]: level + 1 } };
}

export function buyElectronics(career, id) {
  const spec = electronics.find(item => item.id === id);
  if (!spec) return career;
  const level = career.electronics[id];
  const cost = spec.cost * (level + 1);
  if (level >= maxUpgrade || cost > career.cash || !milestoneReached(career, electronicsMilestone(level + 1))) return career;
  return { ...career, cash: career.cash - cost, electronics: { ...career.electronics, [id]: level + 1 } };
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

export function repairQuote(career) {
  const { damage } = vehicleCondition(career.condition);
  const cost = Math.ceil((damage * 8 + damage ** 2 * 0.055) / 5) * 5;
  return { cost, shortfall: Math.max(0, cost - career.cash), canFinance: integrity(career.condition) === 0 && cost > career.cash };
}

export function repairVehicle(career, finance = false) {
  const { cost, shortfall, canFinance } = repairQuote(career);
  if (career.activeRace || !cost || (shortfall && (!finance || !canFinance))) return career;
  return {
    ...career, condition: vehicleCondition(), cash: career.cash - (cost - shortfall),
    repairDebt: positiveMoney(career.repairDebt) + shortfall,
  };
}

export function finishEvent(career, order, time, bestLap, loadout = normalizeLoadout(career), event = currentEvent(career), options = {}) {
  const retired = options.retired === true;
  const retiredDrivers = [...new Set([...(options.retiredDrivers ?? []), ...(retired ? ['player'] : [])])];
  const condition = vehicleCondition(options.condition ?? career.condition);
  const place = order.indexOf('player') + 1;
  const classificationPoints = event?.pointsByPlace ?? defaultPoints;
  const points = retired ? 0 : classificationPoints[place - 1] ?? 0;
  const bonus = !retired && loadout.decals.length ? (sponsors.find(offer => offer.id === loadout.sponsor)?.payout ?? 0) : 0;
  const difficulty = difficultyId(options.difficulty, 'easy');
  const multiplier = difficulties[difficulty].multiplier;
  const basePrize = retired ? 0 : (event?.prizes ?? defaultPrizes)[place - 1] ?? 0;
  const teamPrize = Math.round(basePrize * (teamById(loadout.team).payout - 1));
  const racePrize = Math.round((basePrize + teamPrize) * multiplier);
  const repayment = Math.min(positiveMoney(career.repairDebt), racePrize + bonus);
  const prize = racePrize + bonus - repayment;
  const result = { place, points, prize, bonus, basePrize, teamPrize, racePrize, difficulty, multiplier,
    time, bestLap, order, classificationPoints, laps: event?.laps, retired, retiredDrivers, repayment, condition,
    timePenalty: Math.max(0, options.timePenalty ?? 0) };
  return {
    ...career,
    cash: career.cash + prize,
    completed: career.completed + Number(!retired),
    condition,
    repairDebt: positiveMoney(career.repairDebt) - repayment,
    activeRace: null,
    results: [...career.results, result],
  };
}

export function standings(career) {
  const drivers = [{ id: 'player', name: career.profile?.name ?? 'Sen', color: currentTeam(career).color }, ...rivals];
  return drivers.map(driver => ({
    ...driver,
    points: career.results.reduce((sum, result) => {
      if (result.retiredDrivers?.includes(driver.id)) return sum;
      return sum + ((result.classificationPoints ?? defaultPoints)[result.order.indexOf(driver.id)] ?? 0);
    }, 0),
    places: Array.from({ length: drivers.length }, (_, index) =>
      career.results.filter(result => result.order[index] === driver.id && !result.retiredDrivers?.includes(driver.id)).length),
  })).sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    for (let index = 0; index < a.places.length; index++) {
      if (a.places[index] !== b.places[index]) return b.places[index] - a.places[index];
    }
    return 0;
  });
}
