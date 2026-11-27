export const graphicsModes = {
  low: { pixelRatio: 0.78, scale: 0.78, pixels: 1600 * 900, shadow: 0, samples: 0, bloom: false },
  medium: { pixelRatio: 1, scale: 0.9, pixels: 1920 * 1080, shadow: 1024, samples: 0, bloom: false },
  high: { pixelRatio: 1.5, scale: 1, pixels: 2560 * 1440, shadow: 1536, samples: 2, bloom: true },
  ultra: { pixelRatio: 2.5, scale: 2, pixels: 3840 * 2160, shadow: 3072, samples: 4, bloom: true },
};

export const qualityMode = value => value === 'performance' ? 'medium' : Object.hasOwn(graphicsModes, value) ? value : 'high';
