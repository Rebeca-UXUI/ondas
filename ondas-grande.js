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
    canvas.style.zIndex = "0";

    if (getComputedStyle(wrapper).position === "static") {
      wrapper.style.position = "relative";
    }
    wrapper.style.overflow = "hidden";

    const ctx = canvas.getContext("2d", { alpha: true });

    /* ================= CONFIG ================= */

    const cfg = {
      stroke: "#ff3b1a",
      lineWidth: 1.4,
      stepPx: 2,

      /* POSICIÓN / ESCALA */
      centerY: 0.38,
      microOffsetPx: 18,

      /* 👉 ONDAS MUY GRANDES */
      cyclesAcross: 0.42,     // 🔥 MUCHO más zoom
      ampBase: 0.22,          // 🔥 más altura
      baseSpeed: 0.18,

      breatheSpeed: 0.30,
      breatheAmount: 0.22,

      /* INTERACCIÓN */
      hoverRadiusPx: 28,
      pushStrength: 0.55,     // cuánto “empujas” la onda
      pointerEase: 0.14,

      /* link feel */
      cursorThresholdPx: 26
    };

    const lines = [
      { phase: 0.0, alpha: 0.95, mo: -1, ampMul: 1.0, speedMul: 1.0 },
      { phase: 2.2, alpha: 0.80, mo:  0, ampMul: 0.9, speedMul: 0.85 },
      { phase: 4.4, alpha: 0.70, mo:  1, ampMul: 1.1, speedMul: 0.70 }
    ];

    /* ================= STATE ================= */

    let pxT = 0.5, px = 0.5;
    let pyT = 0.5, py = 0.5;
    let inside = false;

    let w = 0, h = 0;
    const t0 = performance.now();

    /* ================= RESPONSIVE ================= */

    function applyResponsive(width) {
      const isMobile = width <= 480;
      const isTablet = width <= 767;

      cfg.centerY       = isMobile ? 0.46 : isTablet ? 0.42 : 0.38;
      cfg.ampBase       = isMobile ? 0.18 : isTablet ? 0.20 : 0.22;
      cfg.cyclesAcross  = isMobile ? 0.50 : isTablet ? 0.46 : 0.42;
      cfg.microOffsetPx = isMobile ? 12  : 18;
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

    function waveY(line, t, x) {
      const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;
      const A0 = h * cfg.ampBase * line.ampMul;
      const breathe =
        1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount;

      const omega = (Math.PI * 2 * cfg.cyclesAcross) / w;
      const speed = cfg.baseSpeed * line.speedMul;

      return yBase + Math.sin(x * omega + t * speed + line.phase) * (A0 * breathe);
    }

    /* ================= POINTER ================= */

    canvas.addEventListener("pointerenter", () => inside = true, { passive: true });
    canvas.addEventListener("pointerleave", () => {
      inside = false;
      canvas.style.cursor = "default";
    }, { passive: true });

    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
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

      const speed = cfg.baseSpeed * line.speedMul;

      ctx.globalAlpha = line.alpha;
      ctx.beginPath();

      for (let x = -40; x <= w + 40; x += cfg.stepPx) {
        const xn = x / w;
        const dx = (px - xn) * w;
        const dist = Math.abs(dx);

        // 👉 empuje orgánico lateral
        const push =
          inside && dist < cfg.hoverRadiusPx
            ? (1 - dist / cfg.hoverRadiusPx) * cfg.pushStrength
            : 0;

        const phaseShift = push * Math.sign(dx);

        const y =
          yBase +
          Math.sin(
            x * omega +
            t * speed +
            line.phase +
            phaseShift
          ) * (A0 * breathe);

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

      // cursor “link”
      let nearLine = false;
      const xPx = px * w;
      const yPtr = py * h;

      for (let i = 0; i < lines.length; i++) {
        const yL = waveY(lines[i], t, xPx);
        if (Math.abs(yPtr - yL) < cfg.cursorThresholdPx) {
          nearLine = true;
          break;
        }
      }
      canvas.style.cursor = nearLine ? "pointer" : "default";

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = cfg.stroke;
      ctx.lineWidth = cfg.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // orden visual
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
