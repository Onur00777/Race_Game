import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { graphicsModes, qualityMode } from './graphics-settings.js';

export function createRenderPipeline(renderer, mode) {
  let quality = graphicsModes[qualityMode(mode)];
  const hdr = renderer.extensions.has('EXT_color_buffer_float');
  const gl = renderer.getContext();
  const supportedSamples = hdr ? (gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) ?? []) : [];
  let composer;
  let scenePass;
  let bloom;
  let smaa;

  function resize(width, height) {
    const ratio = Math.min(quality.pixelRatio, Math.max(quality.scale, window.devicePixelRatio * quality.scale),
      Math.sqrt(quality.pixels / (width * height)), 3840 / width, 2160 / height);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    if (!quality.bloom || !hdr) return;
    const cap = ratio * ratio * width * height > 4600000 ? 2 : quality.samples;
    const samples = [...supportedSamples].reduce((best, value) => value <= cap ? Math.max(best, value) : best, 0);
    if (!composer) {
      const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples });
      composer = new EffectComposer(renderer, target);
      scenePass = new RenderPass(null, null);
      bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.28, 0.32, 1.16);
      smaa = new SMAAPass();
      composer.addPass(scenePass);
      composer.addPass(bloom);
      composer.addPass(smaa);
      composer.addPass(new OutputPass());
    }
    smaa.enabled = samples < 2;
    composer.renderTarget1.samples = composer.renderTarget2.samples = samples;
    composer.setSize(width, height);
    composer.setPixelRatio(ratio);
  }

  function render(scene, camera, dt, glow = 1) {
    if (!composer || !quality.bloom || !hdr) {
      renderer.render(scene, camera);
      return;
    }
    scenePass.scene = scene;
    scenePass.camera = camera;
    bloom.strength = 0.28 * glow;
    composer.render(dt);
  }

  function setQuality(mode) {
    quality = graphicsModes[qualityMode(mode)];
    if (composer && !quality.bloom) {
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
      composer = null;
    }
  }

  return {
    resize, render, setQuality,
    shadowSize: () => Math.min(quality.shadow, renderer.capabilities.maxTextureSize),
  };
}

export function fitShadowResolution(scene, size) {
  scene?.traverse(object => {
    const { shadow } = object;
    if (!object.castShadow || !shadow || shadow.mapSize.x === size) return;
    shadow.map?.dispose();
    shadow.map = null;
    shadow.mapSize.set(size, size);
    shadow.needsUpdate = true;
  });
}
