(() => {
  function boot() {
    const wrapper = document.querySelector(".wave_wrapper");
    if (!wrapper) {
      console.error("[ondas] .wave_wrapper not found");
      return;
    }

    let canvas = wrapper.querySelector("#waves");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "waves";
      wrapper.appendChild(canvas);
    }

    if (canvas.dataset.init === "1") return;
    canvas.dataset.init = "1";

    // estilos mínimos
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
    
  const canvas = document.getElementById("waves");
  if (!canvas) { console.error("[Waves] canvas #waves not found"); return; }

  if (canvas.dataset.init === "1") return;
  canvas.dataset.init = "1";

  const ctx = canvas.getContext("2d", { alpha: true });

  const cfg = {
    stroke: "#ff3b1a",
    lineWidth: 1.25,
    stepPx: 2,

    centerY: 0.50,
    microOffsetPx: 10,

    baseFreq: 0.85,
    baseSpeed: 0.22,

    ampBase: 0.16,
    breatheSpeed: 0.35,
    breatheAmount: 0.55,

    hoverBoost: 0.26,
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

  let pxT = 0.5, px = 0.5, inside = false;
  let t0 = performance.now();

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.max(1, Math.floor(r.width  * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function gauss(x, m, s) {
    const d = x - m;
    return Math.exp(-(d * d) / (2 * s * s));
  }

  canvas.addEventListener("pointerenter", () => inside = true);
  canvas.addEventListener("pointerleave", () => inside = false);
  canvas.addEventListener("pointermove", e => {
    const r = canvas.getBoundingClientRect();
    pxT = (e.clientX - r.left) / r.width;
    pxT = Math.max(0, Math.min(1, pxT));
  });

  function draw(now) {
    const r = canvas.getBoundingClientRect();
    const w = r.width, h = r.height;
    if (w < 2 || h < 2) return requestAnimationFrame(draw);

    const t = (now - t0) / 1000;
    px += (pxT - px) * cfg.pointerEase;

    const target = inside ? 1 : 0;
    const targets = [
      target,
      target * (0.75 + cfg.coupling * 0.4),
      target * (0.65 + cfg.coupling * 0.6)
    ];

    lines.forEach((l, i) => {
      const rate = targets[i] > l.e ? cfg.energyRise : cfg.energyFall;
      l.e += (targets[i] - l.e) * rate;
    });

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = cfg.stroke;
    ctx.lineWidth = cfg.lineWidth;
    ctx.lineCap = "round";

    lines.forEach(line => {
      const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;
      const A0 = h * cfg.ampBase * line.ampMul;
      const breathe = 1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount;
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
        x === -30 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }

      ctx.stroke();
    });

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(draw);
})();

