// Kept JavaScript-compatible so the static build can copy this file to loader.js
// without pulling a bundler or any runtime dependency into the standalone demo.

const canvas = document.getElementById("stage");
const poster = document.getElementById("poster");
const status = document.getElementById("status");

function showPoster(message) {
  canvas.hidden = true;
  poster.hidden = false;
  status.textContent = message;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
}

if (!canvas || !poster || !status) {
  throw new Error("Lanternwake static shell is missing required DOM elements.");
}

if (!Reflect.get(navigator, "gpu")) {
  showPoster("This browser does not expose WebGPU. The accessible Lanternwake poster is shown instead.");
} else {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas, { passive: true });
  try {
    const { installWebGpuCompatibility } = await import("./webgpu-compat.js");
    // Generated locally by wasm-bindgen during the static bundle build.
    // @ts-ignore generated module is present in the built bundle
    const { default: init, start, input, reset, focus_lost } = await import("./hamon_web.js");
    installWebGpuCompatibility();
    await init();
    installControls(input, reset, focus_lost); await start("webgpu");
  } catch (error) {
    console.error("Lanternwake WebGPU startup failed", error);
    showPoster("WebGPU could not start here. The accessible Lanternwake poster is shown instead.");
  }
}

function installControls(input, reset, focusLost) {
  const keys = new Map([["KeyW",1],["ArrowUp",1],["KeyS",2],["ArrowDown",2],["KeyA",4],["ArrowLeft",4],["KeyD",8],["ArrowRight",8],["Space",16]]);
  const held = new Set(); const touches = new Map();
  const send = () => input([...held].reduce((bits,key) => bits | (keys.get(key) || 0),0) | [...touches.values()].reduce((a,b) => a | b,0));
  window.addEventListener("keydown", event => { if(keys.has(event.code)) { event.preventDefault(); held.add(event.code); send(); } if(event.code === "KeyR" && !event.repeat) { held.clear(); touches.clear(); reset(); } });
  window.addEventListener("keyup", event => { if(keys.has(event.code)) { event.preventDefault(); held.delete(event.code); send(); } });
  const clear = () => { held.clear(); touches.clear(); focusLost(); };
  window.addEventListener("blur", clear); document.addEventListener("visibilitychange", () => { if(document.hidden) clear(); });
  const hud=document.createElement("p"); hud.id="hud"; hud.setAttribute("role","status"); status.after(hud);
  const controls = document.createElement("div"); controls.setAttribute("aria-label","Movement controls"); controls.className="controls";
  for(const [label,bit] of [["Forward",1],["Back",2],["Left",4],["Right",8],["Pulse",16]]) {
    const button = document.createElement("button"); button.textContent=label; 
    button.addEventListener("pointerdown", event => { event.preventDefault(); button.setPointerCapture(event.pointerId); touches.set(event.pointerId,bit); send(); });
    for(const type of ["pointerup","pointercancel","lostpointercapture"]) button.addEventListener(type,event => { touches.delete(event.pointerId); send(); }); controls.append(button);
  }
  const restart=document.createElement("button"); restart.textContent="Restart (R)"; restart.addEventListener("click", () => { held.clear(); touches.clear(); reset(); }); controls.append(restart); status.after(controls);
}
