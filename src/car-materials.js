import * as T from 'three';

function detailMap(height, repeatX, repeatY, strength, lowRoughness, highRoughness) {
  const size = 128;
  const normals = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(normals.length);
  const at = (x, y) => height(((x + size) % size) / size, ((y + size) % size) / size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const ny = (at(x, y - 1) - at(x, y + 1)) * strength;
      const length = Math.hypot(nx, ny, 1);
      normals.set([128 + 127 * nx / length, 128 + 127 * ny / length, 128 + 127 / length, 255], i);
      const rough = T.MathUtils.lerp(lowRoughness, highRoughness, T.MathUtils.clamp(at(x, y), 0, 1)) * 255;
      roughness.set([rough, rough, rough, 255], i);
    }
  }
  const texture = data => {
    const map = new T.DataTexture(data, size, size);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.generateMipmaps = true;
    map.minFilter = T.LinearMipmapLinearFilter;
    map.magFilter = T.LinearFilter;
    map.anisotropy = 4;
    map.needsUpdate = true;
    return map;
  };
  return { normalMap: texture(normals), roughnessMap: texture(roughness) };
}

export function carSurfaceMaps() {
  const carbon = detailMap((u, v) => {
    const x = u * 8, y = v * 8;
    const warp = (Math.floor(x) - Math.floor(y) + 8) % 4 < 2;
    return 0.49 + 0.35 * Math.sin(Math.PI * (warp ? x % 1 : y % 1)) +
      0.12 * Math.cos((warp ? y : x) * 12 * Math.PI);
  }, 7, 6, 0.53, 0.52, 0.85);
  const paint = detailMap((u, v) => {
    const grain = Math.sin((Math.floor(u * 128) * 127.1 + Math.floor(v * 128) * 311.7)) * 43758.5453;
    return grain - Math.floor(grain);
  }, 9, 15, 0.12, 0.64, 1);
  const rubber = detailMap((u, v) => {
    const rib = 0.5 + 0.5 * Math.cos(8 * Math.PI * u + 19 * Math.abs(v - 0.50));
    const tread = Math.exp(-((v - 0.50) ** 6) * 44000);
    const score = Math.max(0, rib - 0.72) * tread;
    return 0.76 - score * 1.5 + 0.07 * Math.cos(v * Math.PI * 32) * Math.sin(u * Math.PI * 76);
  }, 22, 1, 1.2, 0.77, 1);
  return { carbon, paint, rubber };
}

export function createStudioHDR() {
  const width = 512, height = 256;
  const values = new Uint16Array(width * height * 4);
  const lamps = [
    [0.10, 0.37, 0.165, 0.063, 6.8, [1, 0.90, 0.81]],
    [0.52, 0.39, 0.17, 0.047, 5.0, [0.73, 0.86, 1]],
    [0.76, 0.55, 0.086, 0.019, 8.8, [1, 0.75, 0.61]],
    [0.32, 0.60, 0.042, 0.022, 2.9, [0.86, 0.93, 1]],
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width, v = (y + 0.5) / height;
      const fill = 0.039 + 0.14 * T.MathUtils.smoothstep(v, 0.31, 0.90);
      const radiance = [fill * 0.80, fill * 0.91, fill];
      for (const [cx, cy, rx, ry, intensity, tint] of lamps) {
        const distance = Math.abs(u - cx);
        const dx = Math.min(distance, 1 - distance) / rx, dy = Math.abs(v - cy) / ry;
        const edge = 1 - T.MathUtils.smoothstep(Math.max(dx, dy), 0.72, 1);
        if (edge) tint.forEach((color, channel) => { radiance[channel] += color * intensity * edge; });
      }
      values.set([...radiance.map(T.DataUtils.toHalfFloat), T.DataUtils.toHalfFloat(1)], (y * width + x) * 4);
    }
  }
  const map = new T.DataTexture(values, width, height, T.RGBAFormat, T.HalfFloatType);
  map.colorSpace = T.LinearSRGBColorSpace;
  map.mapping = T.EquirectangularReflectionMapping;
  map.minFilter = map.magFilter = T.LinearFilter;
  map.needsUpdate = true;
  return map;
}
