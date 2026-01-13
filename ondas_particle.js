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
    canvas.style.zIndex = "0"; // ✅ no tapar cursor

    if (getComputedStyle(wrapper).position === "static") wrapper.style.position = "relative";
    wrapper.style.overflow = "hidden";

    const ctx = canvas.getContext("2d", { alpha: true });

    const cfg = {
      stroke: "#ff3b1a",
      lineWidth: 1.25,
      stepPx: 2,

      // posicion (se ajusta en responsive)
      centerY: 0.40,
      microOffsetPx: 12,

      // ✅ MÁS ZOOM: baja = más grande
      cyclesAcross: 0.78,
      baseSpeed: 0.22,

      // movimiento base
      ampBase: 0.13,
      breatheSpeed: 0.35,
      breatheAmount: 0.22,

      // hover cerca de línea
      hoverBoost: 0.07,
      hoverSigmaN: 0.075,
      hoverThresholdPx: 18,

      pointerEase: 0.16,
      energyRise: 0.10,
      energyFall: 0.08,
      coupling: 0.05,

      // partículas
      particlesMax: 90,
      particleLife: 0.50,
      particleSpeed: 28,
      particleSpawn: 6,
      particleCooldown: 0.06 // segundos
    };

    const lines = [
      { phase: 0.0, alpha: 0.95, mo: -1, ampMul: 1.05, speedMul: 1.00, e: 0 },
      { phase: 2.1, alpha: 0.80, mo:  0, ampMul: 0.92, speedMul: 0.86, e: 0 },
      { phase: 4.2, alpha: 0.70, mo:  1, ampMul: 1.10, speedMul: 0.72, e: 0 }
    ];

    let pxT = 0.5, px = 0.5;
    let pyT = 0.5, py = 0.5;
    let inside = false;
    const t0 = performance.now();

    // pool partículas
    const particles = Array.from({ length: cfg.particlesMax }, () => ({
      alive: 0, x: 0, y: 0, vx: 0, vy: 0, age: 0
    }));
    let particleCd = 0;

    function applyResponsive(w) {
      const isMobile = w <= 480;
      const isTablet = w <= 767;

      // ✅ no llegar al nav
      cfg.centerY = isMobile ? 0.46 : isTablet ? 0.43 : 0.40;

      cfg.microOffsetPx = isMobile ? 9 : isTablet ? 10 : 12;

      // ✅ zoom
      cfg.cyclesAcross = isMobile ? 0.82 : isTablet ? 0.80 : 0.78;

      // amplitud base (controlada)
      cfg.ampBase = isMobile ? 0.12 : 0.13;

      // hover suave
      cfg.hoverBoost = isMobile ? 0.055 : 0.07;
      cfg.hoverSigmaN = isMobile ? 0.07 : 0.075;
      cfg.hoverThresholdPx = isMobile ? 16 : 18;
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      applyResponsive(r.width);
    }

    function gauss(x, mu, sigma) {
      const d = x - mu;
      return Math.exp(-(d * d) / (2 * sigma * sigma));
    }

    function waveY(line, t, w, h, xPx, includeHover) {
      const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;
      const A0 = h * cfg.ampBase * line.ampMul;
      const breathe = 1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount;

      const omega = (Math.PI * 2 * cfg.cyclesAcross) / w;
      const speed = cfg.baseSpeed * line.speedMul;

      const hoverA = includeHover ? (h * cfg.hoverBoost * line.e) : 0;
      const xn = xPx / w;
      const g = includeHover ? gauss(xn, px, cfg.hoverSigmaN) : 0;

      const A = (A0 * breathe) + (hoverA * g);
      return yBase + Math.sin(xPx * omega + t * speed + line.phase) * A;
    }

    function spawnParticles(x, y) {
      if (particleCd > 0) return;
      particleCd = cfg.particleCooldown;

      let spawned = 0;
      for (let i = 0; i < particles.length && spawned < cfg.particleSpawn; i++) {
        const p = particles[i];
        if (p.alive) continue;

        const a = Math.random() * Math.PI * 2;
        const s = cfg.particleSpeed * (0.7 + Math.random() * 0.7);

        p.alive = 1;
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s;
        p.age = 0;

        spawned++;
      }
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

    function drawLine(line, t, w, h) {
      const omega = (Math.PI * 2 * cfg.cyclesAcross) / w;
      const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;

      const A0 = h * cfg.ampBase * line.ampMul;
      const breathe = 1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount;

      const hoverA = h * cfg.hoverBoost * line.e;
      const speed = cfg.baseSpeed * line.speedMul;

      ctx.globalAlpha = line.alpha;
      ctx.beginPath();

      for (let x = -30; x <= w + 30; x += cfg.stepPx) {
        const xn = x / w;
        const g = gauss(xn, px, cfg.hoverSigmaN);
        const A = (A0 * breathe) + (hoverA * g);
        const y = yBase + Math.sin(x * omega + t * speed + line.phase) * A;

        if (x === -30) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    }

    let last = performance.now();

    function frame(now) {
      const r = canvas.getBoundingClientRect();
      const w = r.width, h = r.height;
      if (w < 2 || h < 2) return requestAnimationFrame(frame);

      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      particleCd = Math.max(0, particleCd - dt);

      const t = (now - t0) / 1000;

      px += (pxT - px) * cfg.pointerEase;
      py += (pyT - py) * cfg.pointerEase;

      // línea más cercana
      const xPx = px * w;
      const yPtr = py * h;

      let bestI = 0, bestD = Infinity;
      for (let i = 0; i < 3; i++) {
        const yL = waveY(lines[i], t, w, h, xPx, false);
        const d = Math.abs(yPtr - yL);
        if (d < bestD) { bestD = d; bestI = i; }
      }

      const hoverNear = inside && bestD < cfg.hoverThresholdPx;
      const base = hoverNear ? 1 : 0;

      const targets = [0, 0, 0];
      targets[bestI] = base;
      if (cfg.coupling > 0 && base > 0) {
        for (let i = 0; i < 3; i++) if (i !== bestI) targets[i] = base * cfg.coupling;
      }

      for (let i = 0; i < 3; i++) {
        const rate = targets[i] > lines[i].e ? cfg.energyRise : cfg.energyFall;
        lines[i].e += (targets[i] - lines[i].e) * rate;
      }

      // spawn micro particles cerca de la línea activa
      if (hoverNear) {
        const yOn = waveY(lines[bestI], t, w, h, xPx, true);
        spawnParticles(xPx, yOn);
      }

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = cfg.stroke;
      ctx.lineWidth = cfg.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      drawLine(lines[1], t, w, h);
      drawLine(lines[0], t, w, h);
      drawLine(lines[2], t, w, h);

      // draw particles
      for (const p of particles) {
        if (!p.alive) continue;

        p.age += dt;
        if (p.age >= cfg.particleLife) { p.alive = 0; continue; }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const a = 1 - (p.age / cfg.particleLife);
        ctx.save();
        ctx.globalAlpha = 0.14 * a;
        ctx.fillStyle = cfg.stroke;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

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

