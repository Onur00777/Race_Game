import * as T from 'three';

const maxSparks = 64;
const maxDust = 72;

export function createRaceEffects(scene) {
  const sparks = [];
  const sparkPositions = new Float32Array(maxSparks * 6);
  const sparkColors = new Float32Array(maxSparks * 6);
  const sparkGeometry = new T.BufferGeometry();
  const sparksMaterial = new T.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
  });
  sparkGeometry.setAttribute('position', new T.BufferAttribute(sparkPositions, 3).setUsage(T.DynamicDrawUsage));
  sparkGeometry.setAttribute('color', new T.BufferAttribute(sparkColors, 3).setUsage(T.DynamicDrawUsage));
  sparkGeometry.setDrawRange(0, 0);
  const lines = new T.LineSegments(sparkGeometry, sparksMaterial);
  lines.frustumCulled = false;
  scene.add(lines);

  const dust = [];
  const dustPositions = new Float32Array(maxDust * 3);
  const dustAges = new Float32Array(maxDust);
  const dustGeometry = new T.BufferGeometry();
  const dustMaterial = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { resolution: { value: 720 } },
    vertexShader: `
      attribute float age;
      uniform float resolution;
      varying float opacity;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        opacity = sin(min(age * 4.0, 1.57)) * pow(1.0 - age, 1.6) * 0.24;
        gl_PointSize = clamp(resolution * (0.23 + age * 1.9) / max(-view.z, 1.5), 1.0, 160.0);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying float opacity;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float noise = sin(p.x * 19.0 + p.y * 6.0) * sin(p.y * 15.0 - p.x * 4.0) * 0.07;
        float cloud = (1.0 - smoothstep(0.05, 0.49, length(p) + noise)) * opacity;
        gl_FragColor = vec4(0.47, 0.39, 0.28, cloud);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  dustGeometry.setAttribute('position', new T.BufferAttribute(dustPositions, 3).setUsage(T.DynamicDrawUsage));
  dustGeometry.setAttribute('age', new T.BufferAttribute(dustAges, 1).setUsage(T.DynamicDrawUsage));
  dustGeometry.setDrawRange(0, 0);
  const clouds = new T.Points(dustGeometry, dustMaterial);
  clouds.frustumCulled = false;
  scene.add(clouds);
  let dustTimer = 0;

  function hit(impact) {
    const count = Math.min(31, Math.ceil(impact.impulse * 1.65));
    for (let i = 0; i < count && sparks.length < maxSparks; i++) {
      const side = (Math.random() - 0.5) * 11 + Math.max(-7, Math.min(7, impact.sliding * 0.24));
      const bounce = Math.random() * (1.3 + Math.min(impact.impulse, 26) * 0.17);
      const lifetime = 0.15 + Math.random() * 0.37;
      sparks.push({
        x: impact.x - impact.nx * 0.055,
        y: 0.40 + Math.random() * 0.17,
        z: impact.z - impact.nz * 0.055,
        vx: -impact.nx * bounce + impact.nz * side,
        vy: 0.9 + Math.random() * 4.9,
        vz: -impact.nz * bounce - impact.nx * side,
        lifetime, age: 0,
      });
    }
  }

  function spawnDust(car, dt) {
    const speed = Math.hypot(car.speed, car.lateral);
    if (car.onRoad || speed < 4) return;
    dustTimer += dt * Math.min(42, speed * 2.5);
    while (dustTimer >= 1 && dust.length < maxDust) {
      dustTimer--;
      const forward = Math.sin(car.yaw);
      const across = Math.cos(car.yaw);
      const side = Math.random() < 0.5 ? -0.77 : 0.77;
      dust.push({
        x: car.x - forward * 1.39 + across * side,
        z: car.z - across * 1.39 - forward * side,
        y: 0.12,
        vx: forward * car.speed * 0.13 + (Math.random() - 0.5) * 1.25,
        vz: across * car.speed * 0.13 + (Math.random() - 0.5) * 1.25,
        lifetime: 0.63 + Math.random() * 0.72,
        age: 0,
      });
    }
    dustTimer %= 1;
  }

  function update(dt, car, height) {
    if (car) spawnDust(car, dt);
    let i = 0;
    for (const spark of sparks) {
      spark.age += dt;
      if (spark.age >= spark.lifetime || spark.y < 0.01) continue;
      spark.vy -= 9.81 * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.z += spark.vz * dt;
      sparks[i] = spark;
      const fade = 1 - spark.age / spark.lifetime;
      const trail = 0.012 + fade * 0.027;
      sparkPositions.set([spark.x, spark.y, spark.z, spark.x - spark.vx * trail, spark.y - spark.vy * trail, spark.z - spark.vz * trail], i * 6);
      sparkColors.set([2 * fade, 1.1 * fade, 0.36 * fade, fade * 0.75, fade * 0.2, fade * 0.02], i * 6);
      i++;
    }
    sparks.length = i;
    sparkGeometry.setDrawRange(0, i * 2);
    if (i) sparkGeometry.attributes.position.needsUpdate = sparkGeometry.attributes.color.needsUpdate = true;

    i = 0;
    for (const cloud of dust) {
      cloud.age += dt;
      if (cloud.age >= cloud.lifetime) continue;
      cloud.x += cloud.vx * dt;
      cloud.y += dt * 0.39;
      cloud.z += cloud.vz * dt;
      dust[i] = cloud;
      dustPositions.set([cloud.x, cloud.y, cloud.z], i * 3);
      dustAges[i++] = cloud.age / cloud.lifetime;
    }
    dust.length = i;
    dustGeometry.setDrawRange(0, i);
    dustMaterial.uniforms.resolution.value = height;
    if (i) dustGeometry.attributes.position.needsUpdate = dustGeometry.attributes.age.needsUpdate = true;
  }

  function reset() {
    sparks.length = dust.length = dustTimer = 0;
  }
  return { update, hit, reset };
}
