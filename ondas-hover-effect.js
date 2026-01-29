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
      lineWidth: 1.3,
      stepPx: 2,

      /* layout */
      centerY: 0.42,
      microOffsetPx: 18,

      /* ONDAS GRANDES */
      cyclesAcross: 0.48,
      ampBase: 0.22,

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
      { phas
