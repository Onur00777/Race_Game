import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const socketNames = ['WingMount', 'FrontMount', 'RearMount'];

export function extractCarAsset(root) {
  const shell = root.getObjectByName('Body');
  if (!shell) return null;
  root.updateMatrixWorld(true);
  const parts = [];
  shell.traverse(node => {
    if (!node.isMesh || node.isSkinnedMesh || !node.geometry.attributes.position) return;
    const source = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    source.applyMatrix4(node.matrixWorld);
    if (!source.attributes.normal) source.computeVertexNormals();
    const part = new T.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const attribute = source.attributes[name];
      const values = new Float32Array(attribute.count * 3);
      for (let i = 0; i < attribute.count; i++) values.set([attribute.getX(i), attribute.getY(i), attribute.getZ(i)], i * 3);
      part.setAttribute(name, new T.BufferAttribute(values, 3));
    }
    const attr = source.attributes.uv;
    const uv = new Float32Array(part.attributes.position.count * 2);
    for (let i = 0; i < uv.length / 2; i++) {
      uv[i * 2] = attr?.getX(i) ?? part.attributes.position.getX(i);
      uv[i * 2 + 1] = attr?.getY(i) ?? part.attributes.position.getZ(i);
    }
    part.setAttribute('uv', new T.BufferAttribute(uv, 2));
    parts.push(part);
    source.dispose();
  });
  if (!parts.length) return null;
  const merged = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  const body = mergeVertices(merged);
  merged.dispose();
  body.computeBoundingBox();
  const { min, max } = body.boundingBox;
  const size = body.boundingBox.getSize(new T.Vector3());
  if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite) ||
      size.x < 1.7 || size.x > 2.35 || size.z < 3.8 || size.z > 4.75 || min.y < -0.1 || max.y > 1.5 ||
      Math.abs(max.x + min.x) > 0.28 || Math.abs(max.z + min.z) > 0.32) {
    body.dispose();
    return null;
  }
  const cabinNode = root.getObjectByName('Cabin');
  const cabin = cabinNode?.clone(true);
  if (cabin) cabin.matrix.copy(cabinNode.matrixWorld).decompose(cabin.position, cabin.quaternion, cabin.scale);
  const sockets = Object.fromEntries(socketNames.map(name => {
    const node = root.getObjectByName(name);
    return [name, node?.getWorldPosition(new T.Vector3())];
  }));
  return { body, cabin, sockets };
}

export async function loadCarAsset(baseUrl) {
  const directory = new URL('models/', new URL(baseUrl, document.baseURI));
  try {
    const manifest = await fetch(new URL('car.json', directory));
    if (!manifest.ok) return null;
    const { model } = await manifest.json();
    if (!/^[\w.-]+\.glb$/i.test(model ?? '')) return null;
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { scene } = await new GLTFLoader().loadAsync(new URL(model, directory).href);
    return extractCarAsset(scene);
  } catch {
    return null;
  }
}
