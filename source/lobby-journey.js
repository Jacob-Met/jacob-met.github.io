/* Recorded native-engine route coordinator. No DOM, history, timers or rendering. */
function createLobbyJourney(options) {
  'use strict';
  const {
    routes,
    reduceMotion = false,
    readProgress = () => undefined,
    play,
    stop = () => {},
    onState = () => {},
    onArrive = () => {}
  } = options || {};
  if (!Array.isArray(routes) || !routes.length || routes.length > 16 ||
      routes.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(id)) ||
      new Set(routes).size !== routes.length) {
    throw new TypeError('Expected a bounded list of unique route identifiers');
  }
  if ([readProgress, play, stop, onState, onArrive].some(fn => typeof fn !== 'function') ||
      !['boolean', 'function'].includes(typeof reduceMotion)) {
    throw new TypeError('Invalid journey callbacks');
  }
  const known = new Set(routes);
  let revision = 0;
  let activeToken = null;
  let destroyed = false;
  let reading = false;
  let state = {phase: 'home', route: null, target: null, direction: null, progress: 0};

  const valid = token => !destroyed && token === revision;
  const snapshot = () => ({...state});
  const accepted = id => id === null || known.has(id);

  function sampleProgress() {
    if (destroyed || activeToken === null || reading) return state.progress;
    const token = revision;
    let value;
    reading = true;
    try { value = readProgress(snapshot()); } catch { value = undefined; }
    finally { reading = false; }
    if (!valid(token)) return null;
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(1, value)) : state.progress;
  }

  function pause(token) {
    activeToken = null;
    try { stop(); } catch { /* Endpoint state still supplies a usable fallback. */ }
    return valid(token);
  }

  function reduced(token) {
    let value;
    try { value = typeof reduceMotion === 'function' ? reduceMotion() : reduceMotion; }
    catch { value = true; }
    return valid(token) ? !!value : null;
  }

  function settle(target, token) {
    if (!valid(token)) return;
    state = {
      phase: target === null ? 'home' : 'arrived',
      route: target,
      target,
      direction: null,
      progress: target === null ? 0 : 1
    };
    onState(snapshot());
    if (valid(token)) onArrive(target, snapshot());
  }

  function failed(token) {
    if (!valid(token) || activeToken !== token) return;
    const next = ++revision;
    const destination = state.target;
    if (pause(next)) settle(destination, next);
  }

  function complete(token) {
    if (!valid(token) || activeToken !== token) return;
    const direction = state.direction;
    const next = ++revision;
    state = {...state, progress: direction === 'forward' ? 1 : 0};
    if (!pause(next)) return;
    // A transfer between different destinations returns to the common entrance
    // before the next route starts. The entrance is not a false final arrival.
    if (direction === 'reverse') state = {...state, route: null};
    plan(next);
  }

  function begin(route, direction, progress, token) {
    if (!valid(token)) return;
    const leg = ++revision;
    activeToken = leg;
    state = {...state, phase: 'travelling', route, direction, progress};
    onState(snapshot());
    if (!valid(leg) || activeToken !== leg) return;
    try {
      const result = play({route, direction, progress, token: leg},
        () => complete(leg), () => failed(leg));
      // A play() promise resolves when playback starts, NOT at arrival.
      // Only the adapter's explicit ended callback can finish a successful leg.
      if (result && typeof result.then === 'function') result.then(undefined, () => failed(leg));
    } catch { failed(leg); }
  }

  function plan(token) {
    if (!valid(token)) return;
    const instant = reduced(token);
    if (instant === null) return;
    if (instant) { settle(state.target, token); return; }
    if (state.route === null || state.progress === 0) {
      if (state.target === null) settle(null, token);
      else begin(state.target, 'forward', 0, token);
    } else if (state.route === state.target) {
      if (state.progress === 1) settle(state.target, token);
      else begin(state.route, 'forward', state.progress, token);
    } else {
      begin(state.route, 'reverse', state.progress, token);
    }
  }

  function navigate(target) {
    if (destroyed || !accepted(target)) return false;
    if (state.target === target &&
        (state.phase !== 'travelling' || activeToken !== null)) return true;
    const before = revision;
    const progress = sampleProgress();
    if (!valid(before) || progress === null) return true;
    const token = ++revision;
    state = {...state, target, progress};
    if (pause(token)) plan(token);
    return true;
  }

  function jump(target) {
    if (destroyed || !accepted(target)) return false;
    if (state.phase !== 'travelling' && state.target === target) return true;
    const token = ++revision;
    state = {...state, target};
    if (pause(token)) settle(target, token);
    return true;
  }

  function getState() {
    const before = revision;
    const progress = sampleProgress();
    if (valid(before) && progress !== null) state = {...state, progress};
    return snapshot();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    revision++;
    activeToken = null;
    try { stop(); } catch { /* All pending callbacks have already been invalidated. */ }
  }

  return {navigate, jump, getState, destroy};
}
