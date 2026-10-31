"use strict";
// Controlled loader lifecycle. Does not claim DOM rendering, GPU or gameplay acceptance.
async function checkLoaderLifecycle(loader) {
  const outcomes = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  class Target {
    constructor(tag = "") { this.tag = tag; this.events = new Map(); this.children = []; this.parent = null; this.hidden = false; this.textContent = ""; }
    addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
    removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
    emit(type, fields = {}) {
      const event = { ...fields, prevented: false, preventDefault() { this.prevented = true; } };
      for (const fn of [...(this.events.get(type) || [])]) fn(event);
      return event;
    }
    append(child) { child.parent = this; this.children.push(child); }
    after(child) { this.parent.append(child); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    setAttribute(name, value) { this[name] = value; }
    setPointerCapture() {}
    getBoundingClientRect() { return { width: 640, height: 360 }; }
    listeners() { return [...this.events.values()].reduce((n, handlers) => n + handlers.size, 0); }
  }
  function environment(options = {}) {
    const body = new Target("body"), canvas = new Target("canvas"), poster = new Target("img"), status = new Target("p");
    canvas.id = "stage"; poster.id = "poster"; poster.hidden = true; status.id = "status";
    for (const el of [canvas, poster, status]) body.append(el);
    const document = new Target("document"), window = new Target("window"), created = [], inputs = [], errors = [];
    document.getElementById = id => ({ stage: canvas, poster, status })[id];
    document.createElement = tag => { const node = new Target(tag); created.push(node); return node; };
    window.devicePixelRatio = 1;
    let resolveStart, rejectStart, starts = 0, resets = 0, focusLosses = 0, imports = 0;
    const startup = new Promise((resolve, reject) => { resolveStart = resolve; rejectStart = reject; });
    const modules = {
      compatibility: async () => { imports++; if (options.importFailure) throw Error("import refused"); return { installWebGpuCompatibility() {} }; },
      runtime: async () => ({
        default: async () => { if (options.initFailure) throw Error("init refused"); },
        start: backend => { check(backend === "webgpu", "unchanged backend"); starts++; return startup; },
        input: bits => inputs.push(bits),
        reset: () => { resets++; },
        focus_lost: () => { focusLosses++; if (options.clearFailure) throw Error("release refused"); }
      })
    };
    const functionText = loader
      .replace('await import("./webgpu-compat.js")', "await modules.compatibility()")
      .replace('await import("./hamon_web.js")', "await modules.runtime()");
    check(functionText !== loader && !functionText.includes("await import("), "exact known import boundary");
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const execute = new AsyncFunction("document", "window", "navigator", "console", "modules", functionText);
    const completion = execute(document, window, { gpu: options.noGpu ? undefined : {} }, { error: (...args) => errors.push(args) }, modules);
    return { body, canvas, poster, status, document, window, created, inputs, errors, completion,
      resolveStart, rejectStart, starts: () => starts, resets: () => resets, focusLosses: () => focusLosses, imports: () => imports,
      controls: () => body.children.find(el => el.className === "controls"),
      hud: () => body.children.find(el => el.id === "hud") };
  }
  async function started(env) {
    for (let i = 0; i < 20 && !env.starts(); i++) await Promise.resolve();
    check(env.starts() === 1, "renderer start reached once");
  }
  function fallback(env, label) {
    check(env.canvas.hidden && !env.poster.hidden, label + ": fallback visible");
    check(!env.controls() && !env.hud(), label + ": gameplay controls and HUD removed");
    check(env.window.listeners() === 0 && env.document.listeners() === 0, label + ": no page listeners retained");
    check(env.created.every(node => node.listeners() === 0), label + ": no button listeners retained");
    const count = env.inputs.length, resets = env.resets(), focus = env.focusLosses();
    check(!env.window.emit("keydown", { code: "Space" }).prevented, label + ": Space keeps browser behavior");
    env.window.emit("keyup", { code: "Space" }); env.window.emit("keydown", { code: "KeyR", repeat: false });
    env.window.emit("blur"); env.document.hidden = true; env.document.emit("visibilitychange"); env.window.emit("resize");
    check(env.inputs.length === count && env.resets() === resets && env.focusLosses() === focus, label + ": no calls after fallback");
  }
  {
    const env = environment({ noGpu: true }); await env.completion;
    fallback(env, "no GPU"); check(env.imports() === 0 && env.starts() === 0, "no GPU imports nothing");
    outcomes.push("no GPU keeps ordinary poster/navigation without controls");
  }
  {
    const env = environment(); await started(env);
    const controls = env.controls();
    check(controls?.children.length === 6 && env.hud(), "controls retain existing pending-start timing");
    check(env.window.emit("keydown", { code: "KeyW" }).prevented && env.inputs.at(-1) === 1, "pending keyboard unchanged");
    controls.children[4].emit("pointerdown", { pointerId: 7 });
    check(env.inputs.at(-1) === 17, "pending pointer and keyboard combine");
    env.rejectStart(Error("adapter unavailable")); await env.completion;
    fallback(env, "rejected startup"); check(env.focusLosses() === 1 && env.errors.length === 1, "held input released once and original error retained");
    controls.children[0].emit("pointerdown", { pointerId: 8 }); controls.children[5].emit("click");
    check(env.inputs.at(-1) === 17 && env.resets() === 0, "detached controls do not invoke runtime");
    outcomes.push("startup rejection removes controls, releases held input and stops keyboard/pointer handlers");
  }
  for (const kind of ["importFailure", "initFailure"]) {
    const env = environment({ [kind]: true }); await env.completion;
    fallback(env, kind); check(env.errors.length === 1 && env.starts() === 0, kind + ": original error retained");
    outcomes.push(kind + " retires resize listener and exposes no game input");
  }
  {
    const env = environment({ clearFailure: true }); await started(env); env.rejectStart(Error("adapter unavailable"));
    let rejected;
    try { await env.completion; } catch (error) { rejected = error; }
    check(rejected?.message === "release refused", "release failure remains observable");
    fallback(env, "release failure");
    outcomes.push("fallback remains visible even when native held-input release throws");
  }
  {
    const env = environment(); await started(env); env.resolveStart(); await env.completion;
    check(!env.canvas.hidden && env.poster.hidden && env.controls()?.children.length === 6, "successful startup remains playable");
    const controls = env.controls();
    env.window.emit("keydown", { code: "KeyW" }); controls.children[4].emit("pointerdown", { pointerId: 2 });
    check(env.inputs.at(-1) === 17, "successful combined input unchanged");
    controls.children[4].emit("pointerup", { pointerId: 2 }); check(env.inputs.at(-1) === 1, "pointer release preserves keyboard");
    env.window.emit("keyup", { code: "KeyW" }); check(env.inputs.at(-1) === 0, "keyboard release unchanged");
    controls.children[5].emit("click"); check(env.resets() === 1, "ordinary restart unchanged");
    env.window.emit("blur"); check(env.focusLosses() === 1, "ordinary blur clears input");
    outcomes.push("successful startup preserves input, release, restart and blur behavior");
  }
  return { passed: outcomes.length, outcomes };
}
if (typeof module !== "undefined") {
  module.exports = { checkLoaderLifecycle };
  if (require.main === module) {
    const fs = require("node:fs");
    const paths = process.argv.slice(2);
    if (paths.length !== 1) throw Error("Usage: node game_loader_contract.cjs LOADER.js");
    checkLoaderLifecycle(fs.readFileSync(paths[0], "utf8")).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
  }
}
