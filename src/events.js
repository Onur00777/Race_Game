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
    wetness: 0, forecast: [{ lap: 2, wetness: 0.68 }, { lap: 5, wetness: 0.16 }],
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
  {
    id: 'north', name: 'Kuzey 10', nameEn: 'Northern 10', date: '7 HAZ', dateEn: '7 JUN',
    format: 'endurance', weather: 'cloud', time: '17:10', laps: 10, width: 17,
    wetness: 0.04, forecast: [{ lap: 3, wetness: 0.68 }, { lap: 7, wetness: 0.13 }],
    rivalPace: [1.02, 0.98, 1.04, 0.93], aggression: 0.62, surfaceGrip: 0.98,
    prizes: [6500, 5250, 4050, 3400, 2800], pointsByPlace: [42, 33, 25, 20, 16], skyYaw: 2.41,
    points: [[-106, 88], [-106, -39], [-81, -117], [13, -135], [104, -83], [75, -24], [113, 34], [118, 95], [61, 133], [-32, 145]],
  },
  {
    id: 'strait', name: 'Boğaz 15', nameEn: 'Strait 15', date: '21 HAZ', dateEn: '21 JUN',
    format: 'endurance', weather: 'cloud', time: '18:45', laps: 15, width: 18, pitSide: 1,
    wetness: 0.73, forecast: [{ lap: 5, wetness: 0.14 }, { lap: 11, wetness: 0.78 }],
    rivalPace: [1.04, 0.96, 1.01, 1.02], aggression: 0.76, surfaceGrip: 0.96,
    prizes: [9700, 7650, 5950, 4650, 3900], pointsByPlace: [55, 43, 34, 26, 20], skyYaw: 3.55,
    points: [[-120, 78], [-120, -41], [-87, -126], [-9, -156], [76, -134], [125, -68], [93, -7], [67, 43], [117, 86], [103, 140], [16, 156], [-68, 135]],
  },
];

export const legacyEvents = events.slice(0, 3).map((event, index) => ({
  ...event, laps: [2, 2, 3][index], prizes: defaultPrizes, pointsByPlace: defaultPoints,
  format: index ? 'standardGp' : 'sprint', weather: 'sunset', time: '19:20',
  skyYaw: [2.64, 2.07, 3.16][index], surfaceGrip: 1, legacy: true,
}));
