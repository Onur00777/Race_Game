import * as T from 'three';

export function addMarshalLights(scene, track) {
  const fixture = new T.BoxGeometry(0.72, 0.36, 0.16);
  const lamp = new T.BoxGeometry(0.54, 0.19, 0.19);
  const post = new T.CylinderGeometry(0.035, 0.052, 1.55, 10);
  const pole = new T.MeshStandardMaterial({ color: '#37414c', metalness: 0.44, roughness: 0.64 });
  const glow = new T.MeshBasicMaterial();
  const dim = new T.Color('#18232a');
  const yellow = new T.Color('#ffc11c');
  const red = new T.Color('#ff412d').multiplyScalar(2);
  const green = new T.Color('#34ed8c').multiplyScalar(1.7);
  const lights = [];
  for (let station = 10; station < track.length; station += 38) {
    const side = lights.length % 2 ? 1 : -1;
    const offset = side === track.pit.side && track.pit.wallAt(station) ?
      track.pit.wallOffset : side * (track.railAt(station, side) - 0.16);
    const point = track.at(station, offset);
    lights.push({ station, point });
  }
  const stands = new T.InstancedMesh(post, pole, lights.length);
  const cases = new T.InstancedMesh(fixture, pole, lights.length);
  const signals = new T.InstancedMesh(lamp, glow, lights.length);
  signals.instanceMatrix.setUsage(T.StaticDrawUsage);
  const pose = new T.Object3D();
  lights.forEach(({ point }, index) => {
    pose.rotation.y = point.yaw;
    pose.position.set(point.x, 0.775, point.z);
    pose.updateMatrix();
    stands.setMatrixAt(index, pose.matrix);
    pose.position.y = 1.55;
    pose.updateMatrix();
    cases.setMatrixAt(index, pose.matrix);
    signals.setMatrixAt(index, pose.matrix);
    signals.setColorAt(index, dim);
  });
  signals.instanceColor.setUsage(T.DynamicDrawUsage);
  scene.add(stands, cases, signals);
  const pulse = new T.Color();
  let lastFlag, lastSector, lastPulse;
  return (control, elapsed, dt, reducedMotion) => {
    const flag = control.flag === 'green' && (!control.changed || elapsed - control.changed >= 3.5) ? 'dim' : control.flag;
    const strength = flag !== 'yellow' ? 0 : reducedMotion ? 2.1 : 1.5 + 0.7 * (1 + Math.sin(dt * 5.6));
    if (flag === lastFlag && control.sector === lastSector && Math.abs(strength - lastPulse) < 0.04) return;
    lastFlag = flag;
    lastSector = control.sector;
    lastPulse = strength;
    pulse.copy(yellow).multiplyScalar(strength);
    for (const [index, { station }] of lights.entries()) {
      const difference = Math.abs(station - control.sector) % track.length;
      const sector = Math.min(difference, track.length - difference) < 52;
      signals.setColorAt(index, flag === 'red' ? red : flag === 'yellow' && sector ? pulse : flag === 'green' ? green : dim);
    }
    signals.instanceColor.needsUpdate = true;
  };
}
