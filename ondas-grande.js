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

    // ✅ No bloquear clicks (los eventos los tomamos del hit-area)
    canvas.style.pointerEvents = "none";

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
      centerY: 0.42,
      microOffsetPx: 18,

      /* ONDAS GRANDES */
      cyclesAcross: 0.48,
      ampBase: 0.22, // sigue siendo “estilo”, pero ya no escala sin control

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
      coupling: 0.12,
    };

    const lines = [
      { phase: 0.0, alpha: 0.95, mo: -1, ampMul: 1.05, speedMul: 1.00, e: 0 },
      { phase: 2.4, alpha: 0.80, mo: 0, ampMul: 0.95, speedMul: 0.90, e: 0 },
      { phase: 4.8, alpha: 0.70, mo: 1, ampMul: 1.10, speedMul: 0.80, e: 0 },
    ];

    /* ================= STATE ================= */

    let pxT = 0.5,
      px = 0.5;
    let pyT = 0.5,
      py = 0.5;
    let inside = false;
    const t0 = performance.now();

    let w = 0,
      h = 0;

    // ✅ NEW: control


