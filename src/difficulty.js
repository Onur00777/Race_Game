export const difficulties = {
  easy: { multiplier: 1, speed: 0.75, grip: 0.59, braking: 6.2, apex: 0.35, look: 0.48,
    exit: 0.68, trailer: 0, attack: 0.20, guard: false, draft: false, room: 3.7 },
  medium: { multiplier: 1.25, speed: 0.86, grip: 0.76, braking: 8.3, apex: 0.58, look: 0.45,
    exit: 0.83, trailer: 0.09, attack: 0.48, guard: false, draft: false, room: 3.15 },
  hard: { multiplier: 1.6, speed: 0.95, grip: 0.91, braking: 11.3, apex: 0.77, look: 0.40,
    exit: 0.99, trailer: 0.17, attack: 0.76, guard: false, draft: true, room: 2.8 },
  legend: { multiplier: 2.25, speed: 1, grip: 1.03, braking: 12.9, apex: 0.90, look: 0.39,
    exit: 1, trailer: 0.30, attack: 0.93, guard: true, draft: true, room: 2.68 },
};

export const difficultyId = (id, fallback = 'medium') => Object.hasOwn(difficulties, id) ? id : fallback;

export function purseFor(prizes, id) {
  const { multiplier } = difficulties[difficultyId(id)];
  return prizes.map(prize => Math.round(prize * multiplier));
}
