import * as T from 'three';
import { brakingRisk, makeRacingLine } from './racing-line.js';

const segments = 88;
const palette = [
  new T.Color('#1aff76'), new T.Color('#ecf947'), new T.Color('#ff9426'), new T.Color('#ff222e'),
];
const colorStops = [0, 0.31, 0.66, 1];

export function createRacingLineView() {
  const vertices = (segments + 1) * 2;
  const positions = new T.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(T.DynamicDrawUsage);
  const colors = new T.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(T.DynamicDrawUsage);
  const uv = new T.BufferAttribute(new Float32Array(vertices * 2), 2).setUsage(T.DynamicDrawUsage);
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const v = i * 2;
    indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colors);
  geometry.setAttribute('uv', uv);
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide,
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
      varying vec2 vLine;
      void main() {
        vColor = color; vLine = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying vec2 vLine;
      void main() {
        float side = abs(vLine.x - .5);
        float mark = abs(fract(vLine.y / 3.3 + side * .60 + .35) - .50);
        float arrow = 1. - smoothstep(.10, .19, mark);
        float edges = 1. - smoothstep(.35, .50, side);
        float fade = smoothstep(0., 4., vLine.y) * (1. - smoothstep(101., 148., vLine.y));
        gl_FragColor = vec4(vColor, edges * fade * (.24 + arrow * .70));
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 1;
  const shade = new T.Color();
  let session;
  let plan;
  let handling;

  function update(race, car, visible) {
    mesh.visible = visible;
    if (!visible) return;
    if (session !== race || handling !== race.handling) {
      session = race;
      handling = race.handling;
      plan = makeRacingLine(race.track, handling);
    }
    const speed = Math.max(0, car.speed);
    for (let i = 0; i <= segments; i++) {
      const distance = 2.25 + i * 1.65;
      const point = plan.sample(car.station + distance);
      const risk = brakingRisk(speed, point.targetSpeed, distance, race.handling.topSpeed);
      const hi = Math.max(1, colorStops.findIndex(stop => risk <= stop));
      const weight = (risk - colorStops[hi - 1]) / (colorStops[hi] - colorStops[hi - 1]);
      shade.copy(palette[hi - 1]).lerp(palette[hi], weight);
      for (const [index, side] of [-1, 1].entries()) {
        const v = i * 2 + index;
        const width = 0.31;
        positions.setXYZ(v, point.x - point.dz * side * width, 0.026, point.z + point.dx * side * width);
        colors.setXYZ(v, shade.r, shade.g, shade.b);
        uv.setXY(v, index, distance);
      }
    }
    positions.needsUpdate = colors.needsUpdate = uv.needsUpdate = true;
  }

  return { mesh, update };
}
