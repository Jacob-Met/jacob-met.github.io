/** Authored proximity response to the maintained actor's actual position.
 * This is an illustrative behavior policy, not an inference about wildlife. */
const finite3 = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
export function createBirdAwareness() {
  let alert = false, birdId = null, position = null, distance = null, closeAge = 0, clearAge = 0;
  const snapshot = () => ({alert, birdId, position: position ? [...position] : null, distance, closeAge, clearAge});
  function reset() {
    alert = false; birdId = null; position = null; distance = null; closeAge = 0; clearAge = 0;
    return snapshot();
  }
  function step(dt, spiderPosition, bird) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 10) throw new RangeError('Step requires 0–10 seconds');
    if (!finite3(spiderPosition)) throw new TypeError('Expected finite spider position');
    if (bird !== null && (!bird || typeof bird.id !== 'string' || !bird.id || typeof bird.state !== 'string' || !bird.state || !finite3(bird.position))) throw new TypeError('Expected null or a positioned bird snapshot with id and state');
    let entered = false, cleared = false;
    const present = bird !== null && bird.state !== 'unplaced';
    if (present) {
      if (bird.id !== birdId) closeAge = 0; // A different actor cannot inherit a partly held approach.
      birdId = bird.id; position = [...bird.position];
      distance = Math.hypot(...position.map((v, i) => v - spiderPosition[i]));
    }
    // Absent/unplaced actors retain the last actual observation for inspection;
    // it is never treated as a fresh nearby position.
    if (!alert) {
      clearAge = 0;
      closeAge = present && distance <= .35 ? Math.min(.15, closeAge + dt) : 0;
      if (closeAge >= .15 - 1e-12) { alert = true; entered = true; }
    } else {
      closeAge = 0;
      clearAge = !present || distance >= .55 ? Math.min(2, clearAge + dt) : 0;
      if (clearAge >= 2 - 1e-12) { alert = false; cleared = true; clearAge = 0; }
    }
    return {...snapshot(), entered, cleared};
  }
  return {step, reset, snapshot};
}
