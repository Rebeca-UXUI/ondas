(() => {
  function boot() {
    const wrapper = document.querySelector(".wave_wrapper");
    if (!wrapper) return;

    let canvas = wrapper.querySelector("#waves");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "waves";
      wrapper.appendChild(canvas);
    }

    if (canvas.dataset.init === "1") return;
    canvas.dataset.init = "1";

    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "auto";
    canvas.style.zIndex = "0"; // ✅ no tapar tu custom cursor

    if (getComputedStyle(wrapper).position === "static") wrapper.style.position = "relative";
    wrapper.style.overflow = "hidden";

    const ctx = canvas.getContext("2d", { alpha: true });

    const cfg = {
      // look
      stroke: "#ff3b1a",
      lineWidth: 1.25,
      alpha: [0.95, 0.80, 0.70],

      // layout (responsive)
      centerY: 0.40,
      microOffsetPx: 12,

      // zoom (menos = más zoom)
      cyclesAcross: 0.72, // ✅ más zoom
      baseSpeed: 0.22,

      // movimiento base (suave)
      ampBase: 0.13,
      breatheSpeed: 0.35,
      breatheAmount: 0.22,

      // interacción: “tocar la línea”
      touchThresholdPx: 18,   // distancia a la onda para activar
      breakRadiusN: 0.06,     // radio local en x (0..1) donde “se rompe”
      pointerEase: 0.16,

      // partículas magnéticas
      points: 520,            // puntos discretos (base del efecto)
      particlesMax: 220,
      spawnPerFrame: 10,      // partículas que saltan cuando “tocas”
      particleLife: 0.65,     // seg
      particleJitter: 14,     // px (impulso inicial)
      springK: 38,            // fuerza imán (más = vuelve más rápido)
      damping: 0.84,          // freno (0.80–0.90)
      particleSize: 1.15,
      particleAlpha: 0.22,

      // perf
      dprMax: 2
    };

    const lines = [
      { phase: 0.0, mo: -1, ampMul: 1.05, speedMul: 1.00, e: 0 },
      { phase: 2.1, mo:  0, ampMul: 0.92, speedMul: 0.86, e: 0 },
      { phase: 4.2, mo:  1, ampMul: 1.10, speedMul: 0.72, e: 0 }
    ];

    // pointer
    let pxT = 0.5, px = 0.5;
    let pyT = 0.5, py = 0.5;
    let inside = false;

    // precompute x normalized for points
    const xN = new Float32Array(cfg.points);
    for (let i = 0; i < cfg.points; i++) xN[i] = i / (cfg.points - 1);

    // particles pool
    const particles = Array.from({ length: cfg.particlesMax }, () => ({
      alive: 0,
      li: 0,
      s: 0,      // 0..1 along x
      x: 0, y: 0,
      vx: 0, vy: 0,
      age: 0
    }));

    let w = 0, h = 0, dpr = 1;
    const t0 = performance.now();
    let last = performance.now();

    function applyResponsive(width) {
      const isMobile = width <= 480;
      const isTablet = width <= 767;

      // que no toque el nav
      cfg.centerY = isMobile ? 0.46 : isTablet ? 0.43 : 0.40;

      // zoom (más grande)
      cfg.cyclesAcross = isMobile ? 0.78 : isTablet ? 0.75 : 0.72;

      // amplitud contenida (flow)
      cfg.ampBase = isMobile ? 0.12 : 0.13;

      // touch más exigente en mobile
      cfg.touchThresholdPx = isMobile ? 16 : 18;

      // break algo más pequeño en mobile
      cfg.breakRadiusN = isMobile ? 0.055 : 0.06;
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);

      dpr = Math.min(cfg.dprMax, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      applyResponsive(w);
    }

    function waveY(line, t, xPx, includeBreathe = true) {
      const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;

      const A0 = h * cfg.ampBase * line.ampMul;
      const breathe = includeBreathe
        ? (1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount)
        : 1;

      const omega = (Math.PI * 2 * cfg.cyclesAcross) / w;
      const speed = cfg.baseSpeed * line.speedMul;

      return yBase + Math.sin(xPx * omega + t * speed + line.phase) * (A0 * breathe);
    }

    function spawnBreakParticles(li, centerXN, t) {
      // crea partículas alrededor de la zona rota: [centerXN - breakRadiusN, +]
      let spawned = 0;

      for (let i = 0; i < particles.length && spawned < cfg.spawnPerFrame; i++) {
        const p = particles[i];
        if (p.alive) continue;

        // s en el radio de rotura
        const s = Math.max(0, Math.min(1, centerXN + (Math.random() * 2 - 1) * cfg.breakRadiusN));
        const x = s * w;
        const y = waveY(lines[li], t, x, true);

        p.alive = 1;
        p.li = li;
        p.s = s;
        p.x = x;
        p.y = y;

        // impulso inicial tipo “salto”
        const a = Math.random() * Math.PI * 2;
        const j = cfg.particleJitter * (0.6 + Math.random() * 0.9);
        p.vx = Math.cos(a) * j;
        p.vy = Math.sin(a) * j;
        p.age = 0;

        spawned++;
      }
    }

    function updateParticles(dt, t) {
      const k = cfg.springK;
      const damp = cfg.damping;

      for (const p of particles) {
        if (!p.alive) continue;

        p.age += dt;
        if (p.age >= cfg.particleLife) {
          p.alive = 0;
          continue;
        }

        // objetivo = posición de la onda en ese s (magnética, y el objetivo se mueve con la onda)
        const tx = p.s * w;
        const ty = waveY(lines[p.li], t, tx, true);

        const ax = (tx - p.x) * k;
        const ay = (ty - p.y) * k;

        p.vx = (p.vx + ax * dt) * damp;
        p.vy = (p.vy + ay * dt) * damp;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // si ya está muy cerca y “vieja”, apágala antes (evita ruido)
        if (p.age > cfg.particleLife * 0.55) {
          const dx = tx - p.x, dy = ty - p.y;
          if ((dx * dx + dy * dy) < 1.2) p.alive = 0;
        }
      }
    }

    function drawParticles() {
      ctx.save();
      ctx.fillStyle = cfg.stroke;

      for (const p of particles) {
        if (!p.alive) continue;
        const a = 1 - (p.age / cfg.particleLife);
        ctx.globalAlpha = cfg.particleAlpha * a;

        ctx.beginPath();
        ctx.arc(p.x, p.y, cfg.particleSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    function drawLineWithBreak(li, t, breakCenterXN, breakOn) {
      const line = lines[li];

      ctx.globalAlpha = cfg.alpha[li];
      ctx.beginPath();

      const br = cfg.breakRadiusN;
      const xBreakMin = breakCenterXN - br;
      const xBreakMax = breakCenterXN + br;

      let started = false;
      let skipping = false;

      for (let i = 0; i < xN.length; i++) {
        const s = xN[i];        // 0..1
        const x = s * w;
        const y = waveY(line, t, x, true);

        const inBreak = breakOn && (s >= xBreakMin && s <= xBreakMax);

        if (inBreak) {
          skipping = true;
          continue;
        }

        if (!started || skipping) {
          ctx.moveTo(x, y);
          started = true;
          skipping = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    canvas.addEventListener("pointerenter", () => inside = true, { passive: true });
    canvas.addEventListener("pointerleave", () => inside = false, { passive: true });
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      pxT = (e.clientX - r.left) / r.width;
      pyT = (e.clientY - r.top) / r.height;
      pxT = Math.max(0, Math.min(1, pxT));
      pyT = Math.max(0, Math.min(1, pyT));
      inside = true;
    }, { passive: true });

    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      const t = (now - t0) / 1000;

      // smooth pointer
      px += (pxT - px) * cfg.pointerEase;
      py += (pyT - py) * cfg.pointerEase;

      // detect “touch” = cerca de la línea más cercana
      const xPx = px * w;
      const yPtr = py * h;

      let bestI = 0, bestD = Infinity;
      for (let i = 0; i < 3; i++) {
        const yL = waveY(lines[i], t, xPx, false);
        const d = Math.abs(yPtr - yL);
        if (d < bestD) { bestD = d; bestI = i; }
      }

      const touch = inside && bestD < cfg.touchThresholdPx;

      // limpia
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = cfg.stroke;
      ctx.lineWidth = cfg.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // “rompe” solo la línea activa en un radio local
      const breakCenterXN = px;

      // si tocas, spawnea partículas (y el hueco aparece)
      if (touch) spawnBreakParticles(bestI, breakCenterXN, t);

      // dibuja líneas (solo una se rompe)
      drawLineWithBreak(1, t, breakCenterXN, touch && bestI === 1);
      drawLineWithBreak(0, t, breakCenterXN, touch && bestI === 0);
      drawLineWithBreak(2, t, breakCenterXN, touch && bestI === 2);

      // partículas magnéticas
      updateParticles(dt, t);
      drawParticles();

      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
