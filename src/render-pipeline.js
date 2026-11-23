import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const graphicsModes = {
  performance: { pixelRatio: 1, scale: 0.9, pixels: 1920 * 1080, shadow: 1024, samples: 0, bloom: false },
  high: { pixelRatio: 1.6, scale: 1, pixels: 2688 * 1512, shadow: 2048, samples: 2, bloom: true },
  ultra: { pixelRatio: 2.5, scale: 2, pixels: 3840 * 2160, shadow: 4096, samples: 4, bloom: true },
};

export const qualityMode = value => Object.hasOwn(graphicsModes, value) ? value : 'high';

export function createRenderPipeline(renderer, mode) {
  let quality = graphicsModes[qualityMode(mode)];
  const hdr = renderer.extensions.has('EXT_color_buffer_float');
  const gl = renderer.getContext();
  const supportedSamples = hdr ? gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) : [];
  let composer;
  let scenePass;
  let bloom;

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
      composer.addPass(scenePass);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }
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

  return {
    resize, render,
    setQuality: mode => { quality = graphicsModes[qualityMode(mode)]; },
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
