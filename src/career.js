export const gameName = 'Kırmızı Çizgi';

export const events = [
  {
    name: 'Sedir Pisti',
    date: '12 NİS',
    laps: 2,
    width: 15,
    rivalPace: [0.80, 0.75, 0.83, 0.81],
    accent: '#ffd193',
    sky: ['#263653', '#e8a174', '#fff0c1'],
    points: [[-55, 60], [-55, -25], [-38, -81], [16, -106], [66, -64], [69, -12], [37, 19], [51, 63], [23, 111], [-28, 109]],
  },
  {
    name: 'Körfez Virajları',
    date: '26 NİS',
    laps: 2,
    width: 14,
    rivalPace: [0.84, 0.93, 0.91, 0.88],
    accent: '#ffb295',
    sky: ['#393452', '#bb746f', '#ffd8ab'],
    points: [[-58, 60], [-58, -26], [-40, -92], [30, -109], [70, -83], [48, -42], [14, -21], [31, 16], [76, 28], [77, 78], [29, 112], [-23, 111]],
  },
  {
    name: 'Zirve Grand Prix',
    date: '10 MAY',
    laps: 3,
    width: 16,
    rivalPace: [0.91, 0.98, 0.98, 0.93],
    accent: '#b9e2ff',
    sky: ['#142d4b', '#7292ad', '#f9dfc5'],
    points: [[-62, 61], [-62, -34], [-36, -99], [26, -133], [83, -107], [86, -61], [55, -25], [81, 11], [88, 65], [48, 120], [-17, 122]],
  },
];

export const teams = [
  { id: 'apex', name: 'Kızıl Motor', color: '#f04b32', unlock: 0, payout: 1, power: 0, grip: 0, perk: 'Dengeli başlangıç' },
  { id: 'volt', name: 'Volt Motorsport', color: '#42cbc1', unlock: 1, payout: 1, power: 2.2, grip: 0, perk: 'Daha yüksek motor gücü' },
  { id: 'summit', name: 'Summit Racing', color: '#c7a5ff', unlock: 2, payout: 1.2, power: 0, grip: 0.3, perk: '+%20 ödül ve daha iyi tutuş' },
];

export const upgrades = [
  { id: 'engine', name: 'Motor', effect: 'Hızlanma ve son hız', baseCost: 850 },
  { id: 'tires', name: 'Lastikler', effect: 'Viraj tutuşu', baseCost: 700 },
  { id: 'brakes', name: 'Frenler', effect: 'Daha kısa fren mesafesi', baseCost: 650 },
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
export const money = amount => '₺' + new Intl.NumberFormat('tr-TR').format(amount);
export const price = (upgrade, level) => upgrade.baseCost * (level + 1);
export const currentTeam = career => teams.find(team => team.id === career.team);
export const currentEvent = career => events[career.results.length];

export function newCareer() {
  return { cash: 400, team: teams[0].id, upgrades: { engine: 0, tires: 0, brakes: 0 }, completed: 0, season: 1, results: [] };
}

export function loadCareer(storage) {
  try {
    const career = JSON.parse(storage.getItem(storageKey));
    if (career && currentTeam(career) && Array.isArray(career.results) && career.upgrades) return career;
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

export function finishEvent(career, order, time, bestLap) {
  const place = order.indexOf('player') + 1;
  const points = pointsByPlace[place - 1];
  const prize = Math.round(prizes[place - 1] * currentTeam(career).payout);
  const result = { place, points, prize, time, bestLap, order };
  return {
    ...career,
    cash: career.cash + prize,
    completed: career.completed + 1,
    results: [...career.results, result],
  };
}

export function standings(career) {
  const drivers = [{ id: 'player', name: 'Sen', color: currentTeam(career).color }, ...rivals];
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
