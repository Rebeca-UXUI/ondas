(() => {
  function boot() {
    const wrapper = document.querySelector(".wave_wrapper");
    if (!wrapper) {
      console.error("[ondas] .wave_wrapper not found");
      return;
    }

    // ===== CANVAS (UNA SOLA VEZ) =====
    let canvas = wrapper.querySelector("#waves");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "waves";
      wrapper.appendChild(canvas);
    }

    // Evitar doble init (Webflow / recargas)
    if (canvas.dataset.init === "1") return;
    canvas.dataset.init = "1";

    // Estilos mínimos para que SIEMPRE se vea
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

    // ===== CONFIGURACIÓN =====
    const cfg = {
      stroke: "#ff3b1a",
      lineWidth: 1.3,
      stepPx: 2,

      centerY: 0.5,
      microOffsetPx: 12,

      baseFreq: 0.85,
      baseSpeed: 0.22,

      ampBase: 0.17,        // ondas MUY pronunciadas
      breatheSpeed: 0.35,
      breatheAmount: 0.55,

      hoverBoost: 0.30,     // efecto hover fuerte
      hoverSigmaN: 0.12,

      pointerEase: 0.16,
      energyRise: 0.10,
      energyFall: 0.06,
      coupling: 0.30
    };

    const lines = [
      { phase: 0.0, alpha: 0.95, mo: -1, ampMul: 1.05, speedMul: 1.00, e: 0 },
      { phase: 2.1, alpha: 0.80, mo:  0, ampMul: 0.92, speedMul: 0.86, e: 0 },
      { phase: 4.2, alpha: 0.70, mo:  1, ampMul: 1.10, speedMul: 0.72, e: 0 }
    ];

    // ===== ESTADO =====
    let pxT = 0.5;
    let px = 0.5;
    let inside = false;
    const t0 = performance.now();

    // ===== RESIZE REAL (CRÍTICO) =====
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.max(1, Math.floor(r.width  * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ===== UTIL =====
    function gauss(x, mu, sigma) {
      const d = x - mu;
      return Math.exp(-(d * d) / (2 * sigma * sigma));
    }

    // ===== POINTER =====
    canvas.addEventListener("pointerenter", () => { inside = true; }, { passive: true });
    canvas.addEventListener("pointerleave", () => { inside = false; }, { passive: true });
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      pxT = (e.clientX - r.left) / r.width;
      pxT = Math.max(0, Math.min(1, pxT));
      inside = true;
    }, { passive: true });

    // ===== DIBUJO =====
    function drawLine(line, t, w, h) {
      const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;

      const A0 = h * cfg.ampBase * line.ampMul;
      const breathe =
        1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount;

      const hoverA = h * cfg.hoverBoost * line.e;

      const k = (Math.PI * 2 * cfg.baseFreq) / w;
      const speed = cfg.baseSpeed * line.speedMul;

      ctx.globalAlpha = line.alpha;
      ctx.beginPath();

      for (let x = -30; x <= w + 30; x += cfg.stepPx) {
        const xn = x / w;
        const g = gauss(xn, px, cfg.hoverSigmaN);

        const A = (A0 * breathe) + (hoverA * g);
        const y = yBase + Math.sin(x * k + t * speed + line.phase) * A;

        if (x === -30) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    }

    function frame(now) {
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      if (w < 2 || h < 2) {
        requestAnimationFrame(frame);
        return;
      }

      const t = (now - t0) / 1000;

      // suavizado puntero
      px += (pxT - px) * cfg.pointerEase;

      // energía + coupling
      const base = inside ? 1 : 0;
      const targets = [
        base,
        base * (0.75 + cfg.coupling * 0.4),
        base * (0.65 + cfg.coupling * 0.6)
      ];

      for (let i = 0; i < 3; i++) {
        const rate = targets[i] > lines[i].e ? cfg.energyRise : cfg.energyFall;
        lines[i].e += (targets[i] - lines[i].e) * rate;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = cfg.stroke;
      ctx.lineWidth = cfg.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // orden visual “premium”
      drawLine(lines[1], t, w, h);
      drawLine(lines[0], t, w, h);
      drawLine(lines[2], t, w, h);

      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    requestAnimationFrame(frame);
  }

  // ===== ARRANQUE SEGURO =====
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();


