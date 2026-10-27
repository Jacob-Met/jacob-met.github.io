# brain_render sources

Box snapshot (2026-10-27 01:00 PT) of the scripts that build the jacobmetoyer.com brain footage.
Not served by Pages (Pages builds from `main:/docs`; this is on a side branch under `_src/`).

- `gen/`, `gen2/`: geometry, label, route, recolor and preview scripts, plus small route/look configs.
- `engine_overlay/`: `brain_hifi.rs` render example (with `brain_hifi.rs.v1/.v2` history copies).

Not committed: the generated `.bin` meshes and their `.bin.json`, `brain_*.json` atlas/graph dumps, rendered frames,
`ref/` (third-party BigBrain surfaces checkout), the Python venv, and any MNE sample data, whose licence for
redistribution is still unconfirmed.
