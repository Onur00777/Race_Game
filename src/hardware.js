export const stages = 5;

export const hardware = {
  engine: [
    { id: 'i4', name: '2.0L Inline-4 Turbo', cost: 0, redline: 7200, voice: 0.92, heat: 0 },
    { id: 'v6', name: '3.0L V6 Twin-Turbo', cost: 2800, season: 1, round: 3, redline: 7700, voice: 1.04, heat: 3 },
    { id: 'v8', name: '4.2L Naturally Aspirated V8 Race', cost: 5600, season: 1, round: 5, redline: 8800, voice: 1.18, heat: 1 },
    { id: 'v10', name: '5.2L V10 GT Prototype', cost: 9200, season: 1, round: 6, redline: 9800, voice: 1.32, heat: 5 },
    { id: 'v12', name: 'Hybrid V12 Hyper-Unit', cost: 14500, season: 2, round: 1, redline: 10300, voice: 1.43, heat: -3 },
  ],
};

export function milestoneReached(career, { season = 1, round = 1 }) {
  return career.season > season || career.season === season && career.results.length + 1 >= round;
}

export function normalizeHardware(input) {
  return Object.fromEntries(Object.entries(hardware).map(([category, models]) => {
    const saved = input?.[category];
    const owned = { [models[0].id]: 0 };
    for (const { id } of models) {
      if (Number.isInteger(saved?.owned?.[id])) owned[id] = Math.max(0, Math.min(stages, saved.owned[id]));
    }
    const installed = Object.hasOwn(owned, saved?.installed) ? saved.installed : models[0].id;
    return [category, { installed, owned }];
  }));
}

export function partModel(category, id) {
  const models = hardware[category];
  return models?.find(model => model.id === id) ?? models?.[0];
}

export function partTier(category, id) {
  return hardware[category]?.findIndex(model => model.id === partModel(category, id).id) ?? 0;
}

export function installedModels(inventory) {
  return Object.fromEntries(Object.entries(inventory ?? {}).map(([category, state]) => [category, state.installed]));
}

export function fitPart(career, category, id, preview = false) {
  const model = hardware[category]?.find(item => item.id === id);
  if (!model) return career;
  const inventory = normalizeHardware(career.hardware);
  const current = inventory[category];
  if (current.installed === id) return career;
  const owned = Object.hasOwn(current.owned, id);
  const cost = owned ? 0 : model.cost;
  if (!preview && (!milestoneReached(career, model) || cost > career.cash)) return career;
  current.owned[current.installed] = career.upgrades[category] ?? current.owned[current.installed];
  current.installed = id;
  current.owned[id] ??= 0;
  return { ...career, hardware: inventory, cash: career.cash - (preview ? 0 : cost),
    upgrades: { ...career.upgrades, [category]: current.owned[id] } };
}
