export const defaultPoints = [25, 18, 15, 12, 10];
export const defaultPrizes = [1800, 1350, 1100, 950, 850];

export const events = [
  {
    id: 'cedar', name: 'Sedir Pisti', nameEn: 'Cedar Circuit', date: '12 NİS', dateEn: '12 APR',
    format: 'sprint', weather: 'sunset', time: '19:20', laps: 2, width: 15,
    rivalPace: [0.80, 0.75, 0.83, 0.81], aggression: 0.25, surfaceGrip: 1,
    prizes: defaultPrizes, pointsByPlace: defaultPoints, skyYaw: 2.64,
    points: [[-55, 60], [-55, -25], [-38, -81], [16, -106], [66, -64], [69, -12], [37, 19], [51, 63], [23, 111], [-28, 109]],
  },
  {
    id: 'bay', name: 'Körfez Virajları', nameEn: 'Bay Curves', date: '26 NİS', dateEn: '26 APR',
    format: 'nightGp', weather: 'night', time: '22:10', laps: 4, width: 14,
    rivalPace: [0.84, 0.93, 0.91, 0.88], aggression: 0.61, surfaceGrip: 0.94,
    prizes: [2700, 2100, 1700, 1500, 1300], pointsByPlace: defaultPoints, skyYaw: 2.07,
    points: [[-58, 60], [-58, -26], [-40, -92], [30, -109], [70, -83], [48, -42], [14, -21], [31, 16], [76, 28], [77, 78], [29, 112], [-23, 111]],
  },
  {
    id: 'summit', name: 'Zirve Grand Prix', nameEn: 'Summit Grand Prix', date: '10 MAY', dateEn: '10 MAY',
    format: 'endurance', weather: 'cloud', time: '16:30', laps: 6, width: 16,
    rivalPace: [0.91, 0.98, 0.98, 0.93], aggression: 0.47, surfaceGrip: 0.88,
    prizes: [4200, 3400, 2800, 2350, 2050], pointsByPlace: [32, 24, 19, 15, 12], skyYaw: 3.16,
    points: [[-62, 61], [-62, -34], [-36, -99], [26, -133], [83, -107], [86, -61], [55, -25], [81, 11], [88, 65], [48, 120], [-17, 122]],
  },
  {
    id: 'marmara', name: 'Marmara GP', nameEn: 'Marmara GP', date: '24 MAY', dateEn: '24 MAY',
    format: 'standardGp', weather: 'noon', time: '12:40', laps: 4, width: 16,
    rivalPace: [0.94, 0.97, 0.98, 0.99], aggression: 0.78, surfaceGrip: 1.04,
    prizes: [3200, 2550, 2150, 1750, 1550], pointsByPlace: defaultPoints, skyYaw: 2.9,
    points: [[-98, 76], [-98, -44], [-77, -112], [-5, -133], [67, -115], [116, -78], [119, -5], [87, 18], [48, 30], [25, 58], [48, 105], [14, 127], [-53, 128]],
  },
];

export const legacyEvents = events.slice(0, 3).map((event, index) => ({
  ...event, laps: [2, 2, 3][index], prizes: defaultPrizes, pointsByPlace: defaultPoints,
  format: index ? 'standardGp' : 'sprint', weather: 'sunset', time: '19:20',
  skyYaw: [2.64, 2.07, 3.16][index], surfaceGrip: 1, legacy: true,
}));
