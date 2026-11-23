export const graphicsModes = {
  performance: { pixelRatio: 1, scale: 0.9, pixels: 1920 * 1080, shadow: 1024, samples: 0, bloom: false },
  high: { pixelRatio: 1.6, scale: 1, pixels: 2688 * 1512, shadow: 2048, samples: 2, bloom: true },
  ultra: { pixelRatio: 2.5, scale: 2, pixels: 3840 * 2160, shadow: 4096, samples: 4, bloom: true },
};

export const qualityMode = value => Object.hasOwn(graphicsModes, value) ? value : 'high';
