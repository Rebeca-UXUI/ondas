/* ondas-webflow.js
   Resonance waves — Three.js (sin dependencias extra)
   Funciona en Webflow con canvas transparente y hover interactivo
*/

/* =========================
   SETTINGS
========================= */
const SETTINGS = {
  selector: ".wave_wrapper",
  canvasId: "waves3d",

  // Color y look
  color: 0xff3b1a, // #FF3B1A
  opacity: 1,

  // Calidad
  points: 480,
  xSpan: 2.4,

  yOffsets: [-0.08, 0, 0.08],
  zOffsets: [-0.02, 0, 0.02],

  baseFreq: [0.85, 0.78, 0.92],
  baseAmp: [0.08, 0.07, 0.075],
  phase: [0.0, 1.7, 3.2],
  speed: [0.18, 0.14, 0.16],

  breatheAmp: 0.25,
  breatheSpeed: 0.22,

  hoverAmpBoost: 0.65,
  hoverRadiusN: 0.18,

  energyRise: 0.08,
  energyFall: 0.045,
  coupling: 0.28,

  pointerEase: 0.15,
  pixelRatioMax: 2,
  cameraPadding: 1.15,

  threeWaitMs: 250,
  threeMaxWaitMs: 8000
};

/* =========================
   INIT
========================= */
(() => {
  function waitForTHREE(cb) {
    const t0 = performance.now();
    (function poll() {
      if (window.THREE) return cb();
      if (performance.now() - t0 > SETTINGS.threeMaxWaitMs) {
        console.warn("[ondas] THREE not found");
        return;
      }
      setTimeout(poll, SETTINGS.threeWaitMs);
    })();
  }

  function init() {
    const wrapper = document.querySelector(SETTINGS.selector);
    if (!wrapper) return;

    let canvas = wrapper.querySelector(`#${SETTINGS.canvasId}`);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = SETTINGS.canvasId;
      wrapper.appendChild(canvas);
    }

    if (canvas.dataset.init === "1") return;
    canvas.dataset.init = "1";

    const THREE = window.THREE;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(SETTINGS.pixelRatioMax, window.devicePixelRatio));

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    camera.position.z = 2;

    const N = SETTINGS.points;
    const xSpan = SETTINGS.xSpan;
    const xMin = -xSpan / 2;
    const xMax = xSpan / 2;

    const xPositions = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      xPositions[i] = xMin + (xMax - xMin) * (i / (N - 1));
    }

    const waves = [];
    const energy = new Float32Array(3);
    let pointerX = 0;
    let pointerTarget = 0;
    let pointerInside = false;

    for (let k = 0; k < 3; k++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(N * 3);

      for (let i = 0; i < N; i++) {
        positions[i * 3] = xPositions[i];
        positions[i * 3 + 1] = SETTINGS.yOffsets[k];
        positions[i * 3 + 2] = SETTINGS.zOffsets[k];
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: SETTINGS.color,
        transparent: true,
        opacity: SETTINGS.opacity
      });

      const line = new THREE.Line(geometry, material);
      scene.add(line);

      waves.push({ geometry, positions, k });
    }

    function resize() {
      const r = wrapper.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));

      // 🔴 CRÍTICO
      canvas.width = w;
      canvas.height = h;

      renderer.setSize(w, h, false);

      const aspect = w / h;
      const halfW = (xSpan / 2) * SETTINGS.cameraPadding;
      const halfH = halfW / aspect;

      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    }

    window.addEventListener("resize", resize);
    resize();

    canvas.addEventListener("pointermove", e => {
      const rect = canvas.getBoundingClientRect();
      pointerTarget = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerInside = true;
    });

    canvas.addEventListener("pointerleave", () => {
      pointerInside = false;
    });

    const start = performance.now();

    function animate(now) {
      const t = (now - start) / 1000;
      pointerX += (pointerTarget - pointerX) * SETTINGS.pointerEase;

      const breathe = 1 + SETTINGS.breatheAmp * Math.sin(t * SETTINGS.breatheSpeed);

      for (let w = 0; w < waves.length; w++) {
        const wave = waves[w];
        const ampBase = SETTINGS.baseAmp[w] * breathe;
        const freq = SETTINGS.baseFreq[w];
        const spd = SETTINGS.speed[w];
        const ph = SETTINGS.phase[w];

        const targetE = pointerInside ? 1 : 0;
        energy[w] += (targetE - energy[w]) * (targetE ? SETTINGS.energyRise : SETTINGS.energyFall);

        for (let i = 0; i < N; i++) {
          const x = xPositions[i];
          const xn = x / (xSpan / 2);
          const dx = xn - pointerX;
          const g = Math.exp(-(dx * dx) / (2 * SETTINGS.hoverRadiusN * SETTINGS.hoverRadiusN));

          const y =
            SETTINGS.yOffsets[w] +
            Math.sin(x * freq + t * spd + ph) *
              (ampBase + SETTINGS.hoverAmpBoost * energy[w] * g);

          wave.positions[i * 3 + 1] = y;
        }

        wave.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => waitForTHREE(init));
  } else {
    waitForTHREE(init);
  }
})();
