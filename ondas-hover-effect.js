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

    if (getComputedStyle(wrapper).position === "static") {
      wrapper.style.position = "relative";
    }
    wrapper.style.overflow = "hidden";

    const ctx = canvas.getContext("2d", { alpha: true });

    /* ================= CONFIG ================= */

    const cfg = {
      stroke: "#ff3b1a",
      lineWidth: 1.3,
      stepPx: 2,

      /* layout */
      centerY: 0.52,          // ✅ más centrado (antes 0.42)
      microOffsetPx: 18,

      /* ONDAS GRANDES */
      cyclesAcross: 0.78,     // ✅ más ondulado, pero no exagerado (antes 2)
      ampBase: 0.24,          // ✅ un poco más de amplitud (antes 0.28)

      /* MOVIMIENTO MUY LENTO */
      baseSpeed: 0.085,
      breatheSpeed: 0.18,
      breatheAmount: 0.22,

      /* HOVER ORGÁNICO */
      hoverBoost: 0.10,
      hoverSigmaN: 0.14,
      hoverThresholdPx: 26,

      pointerEase: 0.12,
      energyRise: 0.08,
      energyFall: 0.06,
      coupling: 0.12
    };

    const lines = [
      { phase: 0.0, alpha: 0.95, mo: -1, ampMul: 1.05, speedMul: 1.00, e: 0 },
      { phase: 2.4, alpha: 0.80, mo:  0, ampMul: 0.95, speedMul: 0.90, e: 0 },
      { phase: 4.8, alpha: 0.70, mo:  1, ampMul: 1.10, speedMul: 0.80, e: 0 }
    ];

    /* ================= STATE ================= */

    let pxT = 0.5, px = 0.5;
    let pyT = 0.5, py = 0.5;
    let inside = false;
    const t0 = performance.now();

    let w = 0, h = 0;

    /* ================= RESPONSIVE ================= */

    function applyResponsive(width) {
      const isMobile = width <= 480;
      const isTablet = width <= 767;

      // ✅ más centrado en todos los breakpoints
      cfg.centerY = isMobile ? 0.58 : isTablet ? 0.55 : 0.52;

      cfg.microOffsetPx = isMobile ? 12 : 16;

      // ✅ más ondulado, pero controlado (no "2")
      cfg.cyclesAcross = isMobile ? 0.95 : isTablet ? 0.88 : 0.78;

      // ✅ un poco más de amplitud que antes (sin pasarse)
      cfg.ampBase = isMobile ? 0.20 : isTablet ? 0.22 : 0.24;

      cfg.hoverBoost = isMobile ? 0.07 : 0.10;
      cfg.hoverSigmaN = isMobile ? 0.18 : 0.14;
      cfg.hoverThresholdPx = isMobile ? 22 : 26;
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width  = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      applyResponsive(w);
    }

    /* ================= MATH ================= */

    function gauss(x, mu, sigma) {
      const d = x - mu;
      return Math.exp(-(d * d) / (2 * sigma * sigma));
    }

    function waveY(line, t, xPx, includeHover) {
      const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;

      const A0 = h * cfg.ampBase * line.ampMul;
      const breathe =
        1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount;

      const omega = (Math.PI * 2 * cfg.cyclesAcross) / w;
      const speed = cfg.baseSpeed * line.speedMul;

      const hoverA = includeHover ? (h * cfg.hoverBoost * line.e) : 0;
      const xn = xPx / w;
      const g = includeHover ? gauss(xn, px, cfg.hoverSigmaN) : 0;

      return yBase + Math.sin(
        xPx * omega +
        t * speed +
        line.phase
      ) * ((A0 * breathe) + (hoverA * g));
    }

    /* ================= POINTER (HIT AREA) ================= */

    const hit = wrapper.querySelector(".wave-hit-area") || wrapper;

    hit.addEventListener("pointerenter", () => inside = true, { passive: true });
    hit.addEventListener("pointerleave", () => inside = false, { passive: true });
    hit.addEventListener("pointermove", (e) => {
      const r = hit.getBoundingClientRect();
      pxT = (e.clientX - r.left) / r.width;
      pyT = (e.clientY - r.top) / r.height;
      pxT = Math.max(0, Math.min(1, pxT));
      pyT = Math.max(0, Math.min(1, pyT));
      inside = true;
    }, { passive: true });

    /* ================= DRAW ================= */

    function drawLine(line, t) {
      const omega = (Math.PI * 2 * cfg.cyclesAcross) / w;
      const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;

      const A0 = h * cfg.ampBase * line.ampMul;
      const breathe =
        1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount;

      const hoverA = h * cfg.hoverBoost * line.e;
      const speed = cfg.baseSpeed * line.speedMul;

      ctx.globalAlpha = line.alpha;
      ctx.beginPath();

      for (let x = -40; x <= w + 40; x += cfg.stepPx) {
        const xn = x / w;
        const g = gauss(xn, px, cfg.hoverSigmaN);
        const A = (A0 * breathe) + (hoverA * g);
        const y = yBase + Math.sin(
          x * omega +
          t * speed +
          line.phase
        ) * A;

        if (x === -40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    }

    /* ================= LOOP ================= */

    function frame(now) {
      const t = (now - t0) / 1000;

      px += (pxT - px) * cfg.pointerEase;
      py += (pyT - py) * cfg.pointerEase;

      const xPx = px * w;
      const yPtr = py * h;

      let bestI = 0;
      let bestD = Infinity;
      for (let i = 0; i < lines.length; i++) {
        const yL = waveY(lines[i], t, xPx, false);
        const d = Math.abs(yPtr - yL);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }

      const hoverNear = inside && bestD < cfg.hoverThresholdPx;
      const base = hoverNear ? 1 : 0;

      const targets = [0, 0, 0];
      targets[bestI] = base;
      if (cfg.coupling && base) {
        for (let i = 0; i < lines.length; i++) {
          if (i !== bestI) targets[i] = base * cfg.coupling;
        }
      }

      for (let i = 0; i < lines.length; i++) {
        const rate = targets[i] > lines[i].e ? cfg.energyRise : cfg.energyFall;
        lines[i].e += (targets[i] - lines[i].e) * rate;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = cfg.stroke;
      ctx.lineWidth = cfg.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      drawLine(lines[1], t);
      drawLine(lines[0], t);
      drawLine(lines[2], t);

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

