import * as T from 'three';

export function addStaticBoxes(root, geometry) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map();
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.geometry !== geometry) return;
    if (!groups.has(mesh.material)) groups.set(mesh.material, new Map());
    const flags = Number(mesh.castShadow) + 2 * Number(mesh.receiveShadow);
    const variants = groups.get(mesh.material);
    if (!variants.has(flags)) variants.set(flags, []);
    variants.get(flags).push(mesh);
  });
  for (const [material, variants] of groups) {
    for (const [flags, meshes] of variants) {
      if (meshes.length < 2) continue;
      const batch = new T.InstancedMesh(geometry, material, meshes.length);
      batch.castShadow = Boolean(flags & 1);
      batch.receiveShadow = Boolean(flags & 2);
      const matrix = new T.Matrix4();
      meshes.forEach((mesh, index) => {
        batch.setMatrixAt(index, matrix.multiplyMatrices(inverse, mesh.matrixWorld));
        mesh.removeFromParent();
      });
      root.add(batch);
    }
  }
}
