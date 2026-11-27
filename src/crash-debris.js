import * as T from 'three';

const maxFragments = 112;
const rnd = (low, high) => low + (high - low) * Math.random();

export function createCrashDebris(scene) {
  const fragments = [];
  const geometry = new T.TetrahedronGeometry(1, 0);
  const material = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.67, metalness: 0.18, flatShading: true });
  const mesh = new T.InstancedMesh(geometry, material, maxFragments);
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const transform = new T.Object3D();
  const color = new T.Color();

  function spawn(impact, energy, type, scale) {
    const size = rnd(0.035, 0.13) * scale;
    const sideways = rnd(-1, 1) * (2 + energy * 0.47) + (impact.sliding ?? 0) * 0.15;
    const recoil = rnd(0.5, 1) * (2 + energy * 0.49);
    if (fragments.length >= maxFragments) fragments.shift();
    fragments.push({
      x: impact.x, y: impact.y ?? (type === 'rubber' ? 0.19 : rnd(0.34, 0.63)), z: impact.z,
      vx: (impact.vx ?? 0) * 0.48 - impact.nx * recoil + impact.nz * sideways,
      vz: (impact.vz ?? 0) * 0.48 - impact.nz * recoil - impact.nx * sideways,
      vy: rnd(1.1, 2.9) + energy * rnd(0.02, 0.12),
      rx: rnd(0, 7), ry: rnd(0, 7), rz: rnd(0, 7),
      spinX: rnd(-14, 14), spinY: rnd(-15, 15), spinZ: rnd(-12, 12),
      life: rnd(1.4, 3.45) + (type === 'aero' ? 1 : 0), size, thickness: type === 'glass' ? 0.15 : 0.33,
      length: type === 'aero' ? 1.8 : type === 'rubber' ? 1.3 : 0.76,
      restitution: type === 'rubber' ? 0.47 : 0.34,
      color: type === 'glass' ? '#b5def1' : type === 'paint' ? (impact.color ?? '#bb3529') :
        type === 'rubber' ? '#24292c' : '#323d45',
    });
  }

  function burst(impact, rubber = false) {
    if (!rubber && impact.normalSpeed < 10.5 && !impact.parts?.length) return;
    const energy = Math.max(4, impact.normalSpeed ?? 0);
    const count = rubber ? 14 : Math.min(28, Math.round(energy * 0.71) + (impact.parts?.length ?? 0) * 5);
    for (let i = 0; i < count; i++) {
      const glass = impact.parts?.includes('headlight') && i % 3 === 0;
      const type = rubber ? 'rubber' : glass ? 'glass' : i % 2 ? 'carbon' : 'paint';
      spawn(impact, energy, type, 1);
    }
    if (rubber) return;
    for (const part of impact.parts ?? []) {
      if (part === 'wing' || part === 'splitter') {
        spawn({ ...impact, y: part === 'wing' ? 1.1 : 0.23 }, energy, 'aero', part === 'wing' ? 4.2 : 3.3);
      }
    }
  }

  function update(dt) {
    let live = 0;
    const drag = Math.exp(-dt * 0.22);
    for (const piece of fragments) {
      piece.life -= dt;
      if (piece.life <= 0) continue;
      piece.vy -= dt * 9.81;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.z += piece.vz * dt;
      piece.vx *= drag;
      piece.vz *= drag;
      const floor = piece.size * 0.23;
      if (piece.y < floor) {
        piece.y = floor;
        piece.vy = Math.abs(piece.vy) > 0.68 ? Math.abs(piece.vy) * piece.restitution : 0;
        piece.vx *= piece.vy ? 0.72 : Math.exp(-dt * 5);
        piece.vz *= piece.vy ? 0.72 : Math.exp(-dt * 5);
      }
      const free = piece.y > floor + 0.003 || piece.vy ? 1 : Math.min(1, Math.hypot(piece.vx, piece.vz) * 0.38);
      piece.rx += piece.spinX * dt * free;
      piece.ry += piece.spinY * dt * free;
      piece.rz += piece.spinZ * dt * free;
      transform.position.set(piece.x, piece.y, piece.z);
      transform.rotation.set(piece.rx, piece.ry, piece.rz);
      const size = piece.size * Math.min(1, piece.life * 4);
      transform.scale.set(size, size * piece.thickness, size * piece.length);
      transform.updateMatrix();
      mesh.setMatrixAt(live, transform.matrix);
      mesh.setColorAt(live, color.set(piece.color));
      fragments[live++] = piece;
    }
    mesh.count = fragments.length = live;
    if (live) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  return { burst, update, reset: () => { mesh.count = fragments.length = 0; } };
}
