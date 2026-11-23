import * as T from 'three';

const roadHeight = 0.015; // Above the asphalt and baked rubber, below the racing guide.

export function createSkidMarks(capacity = 32768) {
  const geometry = new T.BufferGeometry();
  const positions = new T.BufferAttribute(new Float32Array(capacity * 12), 3).setUsage(T.DynamicDrawUsage);
  const opacity = new T.BufferAttribute(new Float32Array(capacity * 4), 1).setUsage(T.DynamicDrawUsage);
  const edge = new Float32Array(capacity * 4);
  const indices = new Uint32Array(capacity * 6);
  for (let i = 0; i < capacity; i++) {
    const v = i * 4;
    edge.set([-1, 1, -1, 1], v);
    indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
  }
  geometry.setAttribute('position', positions);
  geometry.setAttribute('opacity', opacity);
  geometry.setAttribute('edge', new T.BufferAttribute(edge, 1));
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, 0);
  const material = new T.ShaderMaterial({
    side: T.DoubleSide, transparent: true, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `
      attribute float opacity;
      attribute float edge;
      varying vec2 vGround;
      varying float vOpacity;
      varying float vEdge;
      varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vGround = position.xz;
        vOpacity = opacity;
        vEdge = edge;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec2 vGround;
      varying float vOpacity;
      varying float vEdge;
      varying float vDepth;
      void main() {
        vec2 coarse = floor(vGround * 27.);
        float grain = fract(sin(dot(coarse, vec2(37.47, 63.9))) * 1947.1);
        float tread = .82 + .18 * cos(vEdge * 24. + grain * .75);
        float edgeFade = 1. - smoothstep(.55, 1., abs(vEdge));
        float distanceFade = 1. - smoothstep(100., 220., vDepth);
        float alpha = vOpacity * edgeFade * distanceFade * tread * (.62 + grain * .38);
        gl_FragColor = vec4(.013, .012, .013, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0.5;
  const contacts = new Map();
  let run;
  let cursor = 0;
  let count = 0;
  let dirty = false;

  function stamp(a, b, nx, nz) {
    const vertex = cursor * 4;
    positions.setXYZ(vertex, a.x - nx * a.width, roadHeight, a.z - nz * a.width);
    positions.setXYZ(vertex + 1, a.x + nx * a.width, roadHeight, a.z + nz * a.width);
    positions.setXYZ(vertex + 2, b.x - nx * b.width, roadHeight, b.z - nz * b.width);
    positions.setXYZ(vertex + 3, b.x + nx * b.width, roadHeight, b.z + nz * b.width);
    opacity.setX(vertex, a.alpha);
    opacity.setX(vertex + 1, a.alpha);
    opacity.setX(vertex + 2, b.alpha);
    opacity.setX(vertex + 3, b.alpha);
    positions.addUpdateRange(vertex * 3, 12);
    opacity.addUpdateRange(vertex, 4);
    cursor = (cursor + 1) % capacity;
    count = Math.min(capacity, count + 1);
    dirty = true;
  }

  function sample(wheel, last) {
    if (!wheel.onRoad || wheel.slip < 0.16 || wheel.speed < 5.5) return null;
    const contact = { x: wheel.x, z: wheel.z, width: 0.087 + wheel.slip * 0.064,
      alpha: (0.19 + wheel.slip * 0.65) * Math.min(1, wheel.speed / 17) };
    if (!last) return contact;
    const dx = contact.x - last.x;
    const dz = contact.z - last.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.34) return last;
    if (distance < 7.5) stamp(last, contact, -dz / distance, dx / distance);
    return contact;
  }

  function update(race, moving, visible) {
    mesh.visible = visible;
    if (!visible) return;
    if (run !== race.runId) {
      run = race.runId;
      contacts.clear();
      cursor = count = 0;
      geometry.setDrawRange(0, 0);
    }
    if (!moving) return;
    for (const car of race.cars) {
      let points = contacts.get(car.id);
      if (!points) {
        points = [];
        contacts.set(car.id, points);
      }
      for (const [index, wheel] of car.wheels.entries()) points[index] = sample(wheel, points[index]);
    }
    if (dirty) {
      geometry.setDrawRange(0, count * 6);
      positions.needsUpdate = opacity.needsUpdate = true;
      dirty = false;
    }
  }

  return { mesh, update };
}
