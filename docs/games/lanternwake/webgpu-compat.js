// wgpu 22 still requests the removed WebGPU component-count limit.
// Chromium rejects unknown requiredLimits before creating a device. Preserve all
// supported limits and only omit this obsolete spelling on adapters lacking it.
const patchedPrototypes = new WeakSet();

export function compatibleDeviceDescriptor(descriptor, limits) {
  const name = "maxInterStageShaderComponents";
  if (!descriptor?.requiredLimits || name in limits || !(name in descriptor.requiredLimits)) {
    return descriptor;
  }
  const requiredLimits = { ...descriptor.requiredLimits };
  delete requiredLimits[name];
  return { ...descriptor, requiredLimits };
}

export function installWebGpuCompatibility(Adapter = globalThis.GPUAdapter) {
  if (!Adapter || patchedPrototypes.has(Adapter.prototype)) return;
  const original = Adapter.prototype.requestDevice;
  Adapter.prototype.requestDevice = function (descriptor) {
    return Reflect.apply(original, this, [compatibleDeviceDescriptor(descriptor, this.limits)]);
  };
  patchedPrototypes.add(Adapter.prototype);
}
