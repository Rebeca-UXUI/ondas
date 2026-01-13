(() => {
  const wrapper = document.querySelector(".wave_wrapper");
  const canvas = document.getElementById("waves");
  if (!wrapper || !canvas) return;

  // evita doble init
  if (canvas.dataset.init === "1") return;
  canvas.dataset.init = "1";

  const ctx = canvas.getContext("2d", { alpha: true });

  const S = {
    color: "rgba(255,59,26,0.9)",
    lines: 3,
    points: 520,
    baseFreq: [0.9, 0.82, 0.96],
    baseAmp:  [10, 9, 9.5],     // px
    phase:    [0, 1.7, 3.2],
    speed:    [0.22, 0.18, 0.2],
    breatheAmp: 0.22,
    breatheSpeed: 0.25,
    hoverBoost: 22,             // px extra
    hoverSigma: 0.16,           // en 0..1
    energyRise: 0.08,
    energyFall: 0.05,
    coupling: 0.25,
    lineWidth: 1.2,
    centerY: 0.52,
    spacingPx: 10
  };

  let w=0,h=0,dpr=1;
  const energy = new Float32Array(3);
  let pxT=0, px=0, inside=false;

  function resize(){
    const r = wrapper.getBoundingClientRect();
    w = Math.max(1, Math.floor(r.width));
    h = Math.max(1, Math.floor(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(w*dpr);
    canvas.height = Math.floor(h*dpr);
    canvas.style.width = w+"px";
    canvas.style.height = h+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener("resize", resize, {passive:true});
  if ("ResizeObserver" in window){
    new ResizeObserver(resize).observe(wrapper);
  }

  canvas.addEventListener("pointermove", (e)=>{
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left)/r.width; //0..1
    pxT = Math.max(0, Math.min(1, x));
    inside = true;
  }, {passive:true});
  canvas.addEventListener("pointerleave", ()=> inside=false, {passive:true});

  function gauss(x, mu, sigma){
    const d = (x-mu);
    return Math.exp(-(d*d)/(2*sigma*sigma));
  }

  const t0 = performance.now();
  function frame(now){
    const t = (now - t0)/1000;
    px += (pxT - px)*0.15;

    ctx.clearRect(0,0,w,h);

    const breathe = 1 + S.breatheAmp*Math.sin(t*S.breatheSpeed);
    const y0 = h*S.centerY;

    // targets + coupling
    const baseE = inside ? 1 : 0;
    const targets = [baseE, baseE*(0.75+S.coupling*0.5), baseE*(0.65+S.coupling)];

    for (let k=0;k<3;k++){
      const rate = targets[k] > energy[k] ? S.energyRise : S.energyFall;
      energy[k] += (targets[k]-energy[k])*rate;
    }

    ctx.lineWidth = S.lineWidth;
    ctx.strokeStyle = S.color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let k=0;k<3;k++){
      const yOff = (k-1)*S.spacingPx;

      ctx.beginPath();
      for (let i=0;i<S.points;i++){
        const xn = i/(S.points-1);       // 0..1
        const x = xn*w;

        const g = gauss(xn, px, S.hoverSigma);
        const amp = (S.baseAmp[k]*breathe) + (S.hoverBoost*energy[k]*g);

        const main = Math.sin((xn*6.2831*S.baseFreq[k]) + t*S.speed[k] + S.phase[k]);
        const sub  = 0.22*Math.sin((xn*6.2831*S.baseFreq[k]*1.9) + t*S.speed[k]*0.7 + S.phase[k]);

        const y = y0 + yOff + (main+sub)*amp;

        if (i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
