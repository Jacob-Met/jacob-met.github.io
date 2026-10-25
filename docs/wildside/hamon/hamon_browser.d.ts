/* tslint:disable */
/* eslint-disable */

export class HamonView {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    adapter(): string;
    /**
     * Render and present one frame. `cam` = eye xyz, target xyz, up xyz, vertical fov (deg),
     * near, far. Returns false when the browser skipped the frame.
     */
    frame(cam: Float32Array, time: number): boolean;
    look(): string;
    /**
     * Ground heights of the live place's walk grid (`nx * nz`, row-major in z; NaN = not
     * walkable).
     */
    place_heights(): Float32Array;
    /**
     * The live place's walkable layout as JSON (`null` without one): bounds, the ground grid's
     * origin, step and size (heights come from [`Self::place_heights`]), solid boxes, posts and
     * the entry viewpoint.
     */
    place_walk(): string;
    /**
     * Resize the drawing buffer and internal render scale (re-prepares).
     */
    resize(width: number, height: number, scale: number): void;
    /**
     * Column-major 4x4 world matrices for every dynamic part, in part order (16 floats each),
     * and one visibility byte per dynamic part.
     */
    set_dynamic(matrices: Float32Array, visible: Uint8Array): void;
    /**
     * Inhabitants hook: this frame's state vector for inhabitant `index` (see `inhabitants.rs`).
     */
    set_inhabitant_state(index: number, state: Float32Array): void;
    /**
     * The place's lanterns and lit windows: JSON `[{p: [x, y, z], window}]` (re-prepares, as
     * point lights are built with the scene). Lit with the night; never invented here.
     */
    set_lamps(json: string): void;
    /**
     * Switch the look (re-prepares the scene). Returns false for an unknown id.
     */
    set_look(id: string): boolean;
    /**
     * Imagined rain: the painted sky turns to light rain (wet surfaces, streaks).
     */
    set_rain(on: boolean): void;
    /**
     * Sky/weather controls hook (`sky.rs`): JSON `{tod, weather}` over the look's sky; `null`
     * clears. The change eases in over the next frames (`sky_animating`).
     */
    set_sky_json(json: string): void;
    /**
     * Show the visitor's human body standing at feet `(x, y, z)` facing `yaw` (radians, Wildside
     * heading) while they are a bird or an insect; `show = false` hides it.
     */
    set_traveller(x: number, y: number, z: number, yaw: number, show: boolean): void;
    /**
     * Receive the place. `desc` is JSON (see `WorldDesc`), `verts` 8 floats per vertex,
     * `indices` part-local triangle indices, `texels` RGBA8 for `desc.textures`.
     */
    set_world(desc: string, verts: Float32Array, indices: Uint32Array, texels: Uint8Array): void;
    /**
     * True while a sky change is easing in: keep presenting frames until it lands.
     */
    sky_animating(): boolean;
    /**
     * JSON counters for inspection.
     */
    stats(): string;
}

export function default_look(): string;

/**
 * `[{id, name, summary}]` for every look, default first (JSON).
 */
export function looks_json(): string;

/**
 * Open a HAMON view on `canvas` (WebGPU). Rejects when WebGPU is unavailable.
 */
export function open_view(canvas: HTMLCanvasElement): Promise<HamonView>;

/**
 * The input resident `i` is steered with on the next ticks (see `hamon_sculpt::residents::Drive`).
 */
export function resident_drive(i: number, forward: number, turn: number, up: number, run: boolean, act: boolean): void;

/**
 * `[{kind, pos: [x, y, z], yaw, airborne, activity}]` for every resident, live (every frame's
 * latest tick). `yaw` is the Engine heading about +Y: 0 faces +X and positive turns left.
 */
export function resident_poses_json(): string;

/**
 * Steer resident `i` from now on (one at a time); a negative `i` hands every resident back to
 * its own behaviour. False when there is no such resident.
 */
export function resident_possess(i: number): boolean;

/**
 * `[{kind, pos: [x, y, z], activity}]` for the residents of the current view (updated twice
 * a second), for inspection and browser checks.
 */
export function resident_states_json(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_hamonview_free: (a: number, b: number) => void;
    readonly default_look: () => [number, number];
    readonly hamonview_adapter: (a: number) => [number, number];
    readonly hamonview_frame: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly hamonview_look: (a: number) => [number, number];
    readonly hamonview_place_heights: (a: number) => [number, number];
    readonly hamonview_place_walk: (a: number) => [number, number];
    readonly hamonview_resize: (a: number, b: number, c: number, d: number) => [number, number];
    readonly hamonview_set_dynamic: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly hamonview_set_inhabitant_state: (a: number, b: number, c: number, d: number) => void;
    readonly hamonview_set_lamps: (a: number, b: number, c: number) => [number, number];
    readonly hamonview_set_look: (a: number, b: number, c: number) => [number, number, number];
    readonly hamonview_set_rain: (a: number, b: number) => void;
    readonly hamonview_set_sky_json: (a: number, b: number, c: number) => [number, number];
    readonly hamonview_set_traveller: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly hamonview_set_world: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly hamonview_sky_animating: (a: number) => number;
    readonly hamonview_stats: (a: number) => [number, number];
    readonly looks_json: () => [number, number];
    readonly open_view: (a: any) => any;
    readonly resident_drive: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly resident_poses_json: () => [number, number];
    readonly resident_possess: (a: number) => number;
    readonly resident_states_json: () => [number, number];
    readonly wasm_bindgen_569c88abdbd95b4d___convert__closures_____invoke___js_sys_522f2cbc6d838fb6___Function_fn_wasm_bindgen_569c88abdbd95b4d___JsValue_____wasm_bindgen_569c88abdbd95b4d___sys__Undefined___js_sys_522f2cbc6d838fb6___Function_fn_wasm_bindgen_569c88abdbd95b4d___JsValue_____wasm_bindgen_569c88abdbd95b4d___sys__Undefined_______true_: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_569c88abdbd95b4d___convert__closures_____invoke___wasm_bindgen_569c88abdbd95b4d___JsValue__core_37ee0ce0c4cd57d5___result__Result_____wasm_bindgen_569c88abdbd95b4d___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_569c88abdbd95b4d___convert__closures_____invoke___wasm_bindgen_569c88abdbd95b4d___sys__JsNullable_wgpu_f96de166a00bd368___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_37ee0ce0c4cd57d5___result__Result_____wasm_bindgen_569c88abdbd95b4d___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_569c88abdbd95b4d___convert__closures_____invoke___wasm_bindgen_569c88abdbd95b4d___sys__JsNullable_wgpu_f96de166a00bd368___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_37ee0ce0c4cd57d5___result__Result_____wasm_bindgen_569c88abdbd95b4d___JsError___true__26: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_569c88abdbd95b4d___convert__closures_____invoke___wasm_bindgen_569c88abdbd95b4d___sys__JsNullable_wgpu_f96de166a00bd368___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_37ee0ce0c4cd57d5___result__Result_____wasm_bindgen_569c88abdbd95b4d___JsError___true__27: (a: number, b: number, c: any) => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
