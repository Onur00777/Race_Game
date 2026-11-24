import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { extractCarAsset } from '../src/car-asset.js';

test('custom car bodies bake authored transforms and retain attachment coordinates', () => {
  const root = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(1.98, 0.50, 4.28));
  body.name = 'Body';
  body.position.y = 0.47;
  const wing = new T.Object3D();
  wing.name = 'WingMount';
  wing.position.set(0, 0.28, -1.84);
  body.add(wing);
  root.add(body);
  const asset = extractCarAsset(root);
  assert.ok(asset.body.index);
  assert.ok(Math.abs(asset.body.boundingBox.max.y - 0.72) < 0.001);
  assert.deepEqual(asset.sockets.WingMount.toArray(), [0, 0.75, -1.84]);
  body.scale.setScalar(3);
  assert.equal(extractCarAsset(root), null);
  body.name = 'Wrong';
  assert.equal(extractCarAsset(root), null);
});
