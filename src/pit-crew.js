import * as T from 'three';

const { lerp, smoothstep, clamp } = T.MathUtils;
const navy = '#253441';
const charcoal = '#252a2e';
const light = '#d0d7d8';

function joint(parent, x = 0, y = 0, z = 0) {
  const node = new T.Object3D();
  parent.add(node);
  node.position.set(x, y, z);
  return node;
}

function createRig(parts, accent, engineer) {
  const root = new T.Object3D();
  const hips = joint(root);
  const torso = joint(hips);
  const part = (parent, shape, color, x, y, z, width, height, depth) => {
    const node = joint(parent, x, y, z);
    node.scale.set(width, height, depth);
    parts[shape].pieces.push({ node, color: new T.Color(color) });
    return node;
  };
  part(torso, 'jacket', accent, 0, 0.22, 0, 0.38, 0.47, 0.23);
  part(torso, 'capsule', navy, 0, 0.018, 0, 0.31, 0.12, 0.23);
  part(torso, 'box', charcoal, 0, 0.082, 0.107, 0.285, 0.055, 0.034);
  part(torso, 'box', light, -0.092, 0.35, 0.103, 0.073, 0.038, 0.029);
  part(torso, 'capsule', charcoal, 0, 0.465, 0.005, 0.146, 0.088, 0.14);
  const head = joint(torso, 0, 0.57, 0.007);
  part(head, 'helmet', engineer ? '#dce1e2' : accent, 0, 0.047, 0, 0.222, 0.24, 0.231);
  part(head, 'helmet', '#202e3d', 0, 0.039, 0.082, 0.194, 0.104, 0.096);
  part(head, 'box', '#8cabc4', 0, 0.053, 0.126, 0.114, 0.021, 0.017);
  for (const side of [-1, 1]) {
    part(head, 'helmet', charcoal, side * 0.099, 0.029, -0.008, 0.054, 0.105, 0.091);
  }
  const legs = [-1, 1].map(side => {
    const thigh = joint(hips, side * 0.092);
    const shin = joint(thigh, 0, -0.415);
    part(thigh, 'capsule', navy, 0, -0.186, 0, 0.176, 0.43, 0.174);
    part(shin, 'capsule', navy, 0, -0.181, 0, 0.133, 0.407, 0.129);
    part(shin, 'capsule', charcoal, 0, -0.027, 0.059, 0.119, 0.16, 0.047);
    const foot = joint(shin, 0, -0.382, 0.043);
    part(foot, 'capsule', charcoal, 0, -0.018, 0.021, 0.132, 0.112, 0.228);
    return { thigh, shin, foot };
  });
  const arms = [-1, 1].map(side => {
    const shoulder = joint(torso, side * 0.198, 0.365);
    const forearm = joint(shoulder, 0, -0.247);
    part(shoulder, 'capsule', accent, 0, -0.104, 0, 0.147, 0.298, 0.149);
    part(forearm, 'capsule', navy, 0, -0.106, 0, 0.116, 0.254, 0.117);
    part(forearm, 'capsule', charcoal, 0, -0.252, 0.006, 0.11, 0.126, 0.087);
    return { shoulder, forearm };
  });
  const hand = arms[1].forearm;
  if (engineer) {
    part(hand, 'box', charcoal, -0.06, -0.266, 0.044, 0.248, 0.155, 0.033);
    part(hand, 'box', '#86bcd8', -0.06, -0.266, 0.065, 0.203, 0.113, 0.012);
  } else {
    part(hand, 'box', '#d6ac59', 0.020, -0.269, 0.037, 0.09, 0.273, 0.103);
    part(hand, 'box', charcoal, 0.020, -0.142, 0.038, 0.102, 0.081, 0.122);
    part(hand, 'box', '#9ba8aa', 0.020, -0.434, 0.038, 0.041, 0.124, 0.041);
  }
  return { root, hips, torso, head, arms, legs };
}

function poseRig(rig, walk, crouch, idle, engineer) {
  const { hips, torso, head, legs, arms } = rig;
  hips.position.y = 0.888 + Math.abs(walk) * 0.055 - crouch * 0.22;
  torso.rotation.x = crouch * 0.70 + (engineer ? 0.08 : 0.02);
  torso.rotation.z = idle * 0.035;
  head.rotation.set(engineer ? 0.25 : -crouch * 0.37, idle * 0.13, 0);
  legs.forEach(({ thigh, shin, foot }, index) => {
    const stride = walk * (index ? 1 : -1);
    thigh.rotation.x = stride * 0.62 - crouch * 0.94;
    shin.rotation.x = Math.max(0, -stride) * 0.91 + crouch * 1.48;
    foot.rotation.x = -thigh.rotation.x - shin.rotation.x;
  });
  arms.forEach(({ shoulder, forearm }, index) => {
    const armWalk = walk * (index ? -0.44 : 0.44);
    shoulder.rotation.set(engineer ? -0.61 : armWalk - crouch * (index ? 0.77 : 0.59),
      0, (index ? 1 : -1) * (engineer ? 0.08 : 0.16));
    forearm.rotation.set(engineer ? -0.89 : -0.23 - crouch * (index ? 0.31 : 0.72), 0,
      engineer ? (index ? -0.29 : 0.29) : 0);
  });
}

export function addPitCrew(scene, track, bays) {
  const lane = track.pit;
  const parts = {
    box: { geometry: new T.BoxGeometry(1, 1, 1), pieces: [] },
    jacket: { geometry: new T.CylinderGeometry(0.52, 0.41, 1, 8), pieces: [] },
    capsule: { geometry: new T.CapsuleGeometry(0.5, 1, 3, 7).scale(1, 0.5, 1), pieces: [] },
    helmet: { geometry: new T.SphereGeometry(0.5, 10, 7), pieces: [] },
  };
  const uniform = new T.MeshStandardMaterial({ roughness: 0.78 });
  const shell = new T.MeshStandardMaterial({ roughness: 0.34, metalness: 0.15 });
  const apron = lane.side * lane.garageFace - lane.edge;
  const stall = lane.side * lane.stallCenter - lane.edge;
  const crew = bays.flatMap((bay, index) => {
    const accent = bay.color;
    const engineerSide = index % 2 ? -1 : 1;
    return [
      { bay, rig: createRig(parts, accent, false), berth: -1, offset: apron + 0.30, shift: -1.04 },
      { bay, rig: createRig(parts, accent, false), berth: 1, offset: apron + 0.30, shift: 1.04 },
      { bay, rig: createRig(parts, accent, true), berth: 0, offset: apron - 0.04, shift: engineerSide * 2.22 },
    ];
  });
  const batches = Object.entries(parts).map(([shape, { geometry, pieces }]) => {
    const mesh = new T.InstancedMesh(geometry, shape === 'helmet' ? shell : uniform, pieces.length);
    mesh.name = `Pit crew ${shape}`;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.castShadow = mesh.receiveShadow = true;
    pieces.forEach(({ color }, index) => mesh.setColorAt(index, color));
    scene.add(mesh);
    return { mesh, pieces };
  });

  function place(race, reducedMotion) {
    crew.forEach(({ bay, rig, berth, offset, shift }, index) => {
      const car = race?.cars[bay.index];
      const service = car?.pit;
      const phase = berth && service?.remaining > 0 ? 1 - service.remaining / service.duration : 0;
      const working = smoothstep(phase, 0, 0.19) * (1 - smoothstep(phase, 0.73, 1));
      const crouch = smoothstep(phase, 0.16, 0.28) * (1 - smoothstep(phase, 0.69, 0.81));
      const time = race?.elapsed ?? 0;
      const stride = reducedMotion ? 0 : Math.sin(working * 3 * Math.PI) * Math.sin(working * Math.PI);
      const idle = reducedMotion ? 0 : Math.sin(time * 1.37 + index * 1.08);
      let station = bay.station + shift;
      let distance = offset;
      if (working > 0) {
        const alignment = clamp(lane.wrap(car.station) - bay.station, -0.70, 0.70);
        station = lerp(station, bay.station + alignment + berth * 1.25, working);
        distance = lerp(offset, clamp(lane.side * car.offset - lane.edge + 1.59, stall + 0.96, stall + 2.22), working);
      }
      const point = track.at(station, lane.side * (lane.edge + distance));
      const facing = lerp(berth * 0.43, berth * 0.15, working);
      rig.root.position.set(point.x, 0.018, point.z);
      rig.root.rotation.y = point.yaw + lane.side * (Math.PI / 2 + facing);
      poseRig(rig, stride, crouch, idle, !berth);
      rig.root.updateMatrixWorld(true);
    });
    for (const { mesh, pieces } of batches) {
      pieces.forEach(({ node }, index) => mesh.setMatrixAt(index, node.matrixWorld));
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  place(null, true);
  for (const { mesh } of batches) {
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += 4;
  }
  let lastRace;
  let lastTick;
  let lastReducedMotion;
  return (race, reducedMotion) => {
    if (Math.abs(lane.wrap(race.player.station) - lane.box) > 92) return;
    const tick = Math.floor(race.elapsed * 24);
    if (race === lastRace && tick === lastTick && reducedMotion === lastReducedMotion) return;
    place(race, reducedMotion);
    lastRace = race;
    lastTick = tick;
    lastReducedMotion = reducedMotion;
  };
}
