import * as T from 'three';

export function addMarshalLights(scene, track) {
  const fixture = new T.BoxGeometry(0.72, 0.36, 0.16);
  const lamp = new T.BoxGeometry(0.54, 0.19, 0.19);
  const post = new T.CylinderGeometry(0.035, 0.052, 1.55, 10);
  const pole = new T.MeshStandardMaterial({ color: '#37414c', metalness: 0.44, roughness: 0.64 });
  const dim = new T.MeshStandardMaterial({ color: '#15202a', emissive: '#182329', emissiveIntensity: 0.1 });
  const yellow = new T.MeshStandardMaterial({ color: '#ffb816', emissive: '#ffc11c', emissiveIntensity: 2.1 });
  const red = new T.MeshStandardMaterial({ color: '#fb3e35', emissive: '#ff2815', emissiveIntensity: 2.0 });
  const green = new T.MeshStandardMaterial({ color: '#37e486', emissive: '#34ed8c', emissiveIntensity: 1.7 });
  const lights = [];
  for (let station = 10; station < track.length; station += 38) {
    const side = lights.length % 2 ? 1 : -1;
    const point = track.at(station, side * (track.railOffset - 0.16));
    const group = new T.Group();
    group.position.set(point.x, 0, point.z);
    group.rotation.y = point.yaw;
    const stand = new T.Mesh(post, pole);
    stand.position.y = 0.775;
    const body = new T.Mesh(fixture, pole);
    body.position.y = 1.55;
    const glow = new T.Mesh(lamp, dim);
    glow.position.y = 1.55;
    group.add(stand, body, glow);
    scene.add(group);
    lights.push({ station, glow });
  }
  return (control, elapsed, dt, reducedMotion) => {
    yellow.emissiveIntensity = reducedMotion ? 2.1 : 1.5 + 0.7 * (1 + Math.sin(dt * 5.6));
    for (const { glow, station } of lights) {
      const difference = Math.abs(station - control.sector) % track.length;
      const sector = Math.min(difference, track.length - difference) < 52;
      glow.material = control.flag === 'red' ? red : control.flag === 'yellow' && sector ? yellow :
        control.flag === 'green' && control.changed > 0 && elapsed - control.changed < 3.5 ? green : dim;
    }
  };
}
