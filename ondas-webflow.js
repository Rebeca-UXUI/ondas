/* waves3d.js
   Resonance — 3 premium sine waves (Three.js, no extra deps) for Webflow
   - Transparent background
   - 3 lines crossing, slow motion, hover resonance (local + coupled)
   - Reuses buffers (no per-frame allocations)
   - Resizes to .wave_wrapper (not the whole window)
*/

/* =========================
   SETTINGS
========================= */
const SETTINGS = {
  selector: ".wave_wrapper",
  canvasId: "waves3d",

  // Look
  color: 0xff3b1a,          // #FF3B1A
  opacity: 1.0,
  // NOTE: WebGL linewidth support is limited. We try Line2 if present, else fallback to 1px Line.
  fallbackLineWidthPx: 1,   // used only as hint; most GPUs clamp to 1

  // Geometry / quality
  points: 480,              // 300–600 recommended
  xSpan: 2.2,               // world units width of the wave
  // keep waves close vertically, but not overlapping
  yOffsets: [-0.08, 0.0, 0.08],
  zOffsets: [-0.02, 0.0, 0.02],

  // Base motion (long waves, very slow)
  baseFreq: [0.85, 0.78, 0.92],     // low = long waves
  baseAmp:  [0.08, 0.07, 0.075],    // idle amplitude
  phase:    [0.0, 1.7, 3.2],        // distinct phases
  speed:    [0.18, 0.14, 0.16],     // very slow
  // subtle “breathe” (global amplitude breathing)
  breatheAmp: 0.25,                 // 0..1 (multiplier on top)
  breatheSpeed: 0.22,               // slow

  // Hover resonance (local)
  hoverAmpBoost: 0.65,              // extra amplitude near cursor
  hoverRadiusN: 0.16,               // gaussian sigma in normalized-x (0..1-ish)
  hoverFalloffPower: 1.0,           // 1 = gaussian only; >1 sharper

  // Inertia / smoothing
  energyRise: 0.08,                 // how fast energy goes up
  energyFall: 0.045,                // how fast energy decays
  coupling: 0.28,                   // how much energy spreads to other waves
  pointerEase: 0.15,                // pointer smoothing

  // Rendering / perf
  pixelRatioMax: 2.0,
  clearAlpha: 0.0,                  // transparent background
  cameraPadding: 1.15,              // slightly zoom out

  // Startup
  threeWaitMs: 250,
  threeMaxWaitMs: 8000
};

(() => {
  /* =========================
     Helpers
  ========================= */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function waitForTHREE(cb) {
    const t0 = performance.now();
    (function poll() {
      if (typeof window.THREE !== "undefined") return cb();
      if (performance.now() - t0 > SETTINGS.threeMaxWaitMs) {
        console.warn("[Resonance] THREE not found. Make sure Three.js is loaded with defer before waves3d.js");
        return;
      }
      setTimeout(poll, SETTINGS.threeWaitMs);
    })();
  }

  function ensureCanvas(wrapper) {
    let canvas = wrapper.querySelector(`#${SETTINGS.canvasId}`);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = SETTINGS.canvasId;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      wrapper.appendChild(canvas);
    }
    return canvas;
  }

  function getWrapper() {
    return document.querySelector(SETTINGS.selector);
  }

  function getSize(el) {
    // Use bounding box to respect Webflow layouts/overflows
    const r = el.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    return { w, h };
  }

  /* =========================
     Main init
  ========================= */
  function init() {
    const wrapper = getWrapper();
    if (!wrapper) {
      console.warn(`[Resonance] Wrapper not found: ${SETTINGS.selector}`);
      return;
    }

    const canvas = ensureCanvas(wrapper);

    // Avoid double init (Webflow)
    if (canvas.dataset.init === "1") return;
    canvas.dataset.init = "1";

    const THREE = window.THREE;

    // Renderer (transparent)
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, SETTINGS.clearAlpha);
    renderer.setPixelRatio(Math.min(SETTINGS.pixelRatioMax, window.devicePixelRatio || 1));

    const scene = new THREE.Scene();

    // Orthographic camera for clean “2D premium lines”
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    camera.position.set(0, 0, 2);
    camera.lookAt(0, 0, 0);

    // Precompute x positions in world units (shared)
    const N = SETTINGS.points;
    const xSpan = SETTINGS.xSpan;
    const xMin = -xSpan * 0.5;
    const xMax =  xSpan * 0.5;
    const xPositions = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      xPositions[i] = xMin + (xMax - xMin) * t;
    }

    // Pointer state (normalized -1..1)
    let pointerXTarget = 0;
    let pointerX = 0;
    let pointerInside = false;

    // Energy per wave (smoothed)
    const energy = new Float32Array(3);
    const energyTarget = new Float32Array(3);

    // Create 3 wave lines with BufferGeometry (reused positions)
    const waves = [];

    // Try Line2 if present (rare unless you load it explicitly).
    const hasLine2 = !!(THREE.Line2 && THREE.LineGeometry && THREE.LineMaterial);

    function makeWave(index) {
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(N * 3);

      // init straight line
      const y0 = SETTINGS.yOffsets[index];
      const z0 = SETTINGS.zOffsets[index];

      for (let i = 0; i < N; i++) {
        const o = i * 3;
        positions[o]     = xPositions[i];
        positions[o + 1] = y0;
        positions[o + 2] = z0;
      }

      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.computeBoundingSphere();

      let obj;
      if (hasLine2) {
        // If user loaded Line2 extras globally, use them.
        const g2 = new THREE.LineGeometry();
        // LineGeometry uses a flat array [x,y,z,x,y,z,...]
        g2.setPositions(Array.from(positions));

        const m2 = new THREE.LineMaterial({
          color: SETTINGS.color,
          linewidth: 1.6, // in px-ish, depends on resolution
          transparent: true,
          opacity: SETTINGS.opacity,
          depthTest: false,
          depthWrite: false
        });

        obj = new THREE.Line2(g2, m2);
        obj.computeLineDistances();
        obj.frustumCulled = false;
        return { index, obj, geom: g2, positions, isLine2: true, mat: m2, y0, z0 };
      } else {
        // Fallback: classic Line (linewidth generally clamped to 1 on most systems)
        const mat = new THREE.LineBasicMaterial({
          color: SETTINGS.color,
          transparent: true,
          opacity: SETTINGS.opacity,
          depthTest: false,
          depthWrite: false
          // linewidth: SETTINGS.fallbackLineWidthPx // ignored on most platforms
        });

        obj = new THREE.Line(geom, mat);
        obj.frustumCulled = false;
        return { index, obj, geom, positions, isLine2: false, mat, y0, z0 };
      }
    }

    for (let k = 0; k < 3; k++) {
      const w = makeWave(k);
      waves.push(w);
      scene.add(w.obj);
    }

    // Fit camera to wrapper aspect with padding
    function resize() {
      const { w, h } = getSize(wrapper);
      renderer.setSize(w, h, false);

      const aspect = w / h;
      const pad = SETTINGS.cameraPadding;

      // Our world xSpan is fixed; yRange adapts by aspect
      const halfW = (xSpan * 0.5) * pad;
      const halfH = (halfW / aspect) * pad;

      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();

      // If Line2 exists, it needs resolution
      if (hasLine2) {
        for (const wv of waves) {
          if (wv.isLine2) wv.mat.resolution.set(w, h);
        }
      }
    }

    // Resize observers (best effort)
    let ro = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(resize);
      ro.observe(wrapper);
    }
    window.addEventListener("resize", resize, { passive: true });
    resize();

    // Pointer events (hover resonance)
    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width; // 0..1
      pointerXTarget = clamp(x * 2 - 1, -1, 1);       // -1..1
      pointerInside = true;
    }
    function onEnter() { pointerInside = true; }
    function onLeave() { pointerInside = false; }

    canvas.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerenter", onEnter, { passive: true });
    canvas.addEventListener("pointerleave", onLeave, { passive: true });

    // Animation loop (reuses buffers)
    const tStart = performance.now();
    let lastT = tStart;

    function animate(now) {
      const dt = Math.min(0.033, (now - lastT) / 1000);
      lastT = now;

      const t = (now - tStart) / 1000;

      // Smooth pointer
      pointerX = lerp(pointerX, pointerXTarget, SETTINGS.pointerEase);

      // Global breathe (0.75..1.25-ish)
      const breathe = 1.0 + SETTINGS.breatheAmp * 0.5 * Math.sin(t * SETTINGS.breatheSpeed);

      // Energy targets:
      // When inside canvas, energize around pointer; otherwise decay to 0.
      // Each wave has its own energy but coupled.
      const baseE = pointerInside ? 1.0 : 0.0;

      // Coupling logic:
      // - primary wave gets full energy
      // - others get portion (propagation)
      energyTarget[0] = baseE;
      energyTarget[1] = baseE * (0.75 + SETTINGS.coupling * 0.5);
      energyTarget[2] = baseE * (0.65 + SETTINGS.coupling);

      // Smooth energies (rise faster than fall)
      for (let k = 0; k < 3; k++) {
        const e = energy[k];
        const target = energyTarget[k];
        const rate = target > e ? SETTINGS.energyRise : SETTINGS.energyFall;
        energy[k] = lerp(e, target, 1 - Math.pow(1 - rate, dt * 60));
      }

      // Precompute sigma in normalized-x domain
      const sigma = Math.max(0.0001, SETTINGS.hoverRadiusN);
      const inv2s2 = 1.0 / (2.0 * sigma * sigma);

      // Update each wave positions
      for (const wv of waves) {
        const k = wv.index;

        // Slightly different crossing: use distinct freq/speed/phase + small base tilt
        const freq = SETTINGS.baseFreq[k];
        const spd = SETTINGS.speed[k];
        const ph  = SETTINGS.phase[k];

        // Base amplitude with breathe
        const ampBase = SETTINGS.baseAmp[k] * breathe;

        // Hover boost amount for this wave (smoothed)
        const e = energy[k];
        const ampBoost = SETTINGS.hoverAmpBoost * e;

        const y0 = wv.y0;
        const z0 = wv.z0;

        // Update positions in-place
        // We do a localized gaussian boost along x around the pointer.
        const pos = wv.positions;
        for (let i = 0; i < N; i++) {
          const x = xPositions[i];

          // normalized x in -1..1 relative to xSpan
          const xn = (x / (xSpan * 0.5)); // roughly -1..1

          // Local influence around pointerX
          const dx = (xn - pointerX);
          let g = Math.exp(-(dx * dx) * inv2s2); // gaussian

          if (SETTINGS.hoverFalloffPower !== 1.0) {
            g = Math.pow(g, SETTINGS.hoverFalloffPower);
          }

          // Wave function: clean sine, long wavelength, slow phase shift
          // Add a tiny secondary harmonic for richness (still clean, not noisy)
          const phaseT = (t * spd + ph);
          const main = Math.sin((x * freq) + phaseT);
          const sub  = 0.22 * Math.sin((x * (freq * 1.9)) + phaseT * 0.7);

          const amp = ampBase + ampBoost * g;

          const y = y0 + (main + sub) * amp;

          const o = i * 3;
          pos[o]     = x;
          pos[o + 1] = y;
          pos[o + 2] = z0;
        }

        if (wv.isLine2) {
          // Line2 uses LineGeometry positions setter (needs an array)
          // To avoid allocations, we update the underlying attribute if present.
          // If not accessible, fall back to setPositions (may allocate). Still OK at 480 points.
          if (wv.geom.attributes && wv.geom.attributes.position) {
            wv.geom.attributes.position.needsUpdate = true;
          } else if (wv.geom.setPositions) {
            wv.geom.setPositions(Array.from(pos));
          }
          if (wv.obj.computeLineDistances) wv.obj.computeLineDistances();
        } else {
          wv.geom.attributes.position.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

    // Cleanup hook (optional)
    // If you navigate in Webflow with IX2, you can extend this to dispose resources.
  }

  // Start when DOM is ready AND THREE exists
  function start() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => waitForTHREE(init), { once: true });
    } else {
      waitForTHREE(init);
    }
  }

  start();
})();

/* =========================
   WEBFLOW — Instrucciones mínimas
=========================

1) En tu página:
   - Crea un div con clase: .wave_wrapper (altura: 100vh)
   - Dentro puedes poner:
     <canvas id="waves3d"></canvas>
   (Si no lo pones, el script lo crea automáticamente.)

2) En Webflow (Before </body>):
   Carga Three.js con defer y después este script, también con defer.

   <script defer src="https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"></script>
   <script defer src="https://TU_GITHUB_PAGES_O_RAW/waves3d.js"></script>

Notas:
- Fondo transparente (alpha: true).
- Si quieres “grosor real” > 1px en TODOS los dispositivos, tendrías que cargar
  los extras de Three (Line2/LineMaterial) desde examples (no incluido aquí).
*/
