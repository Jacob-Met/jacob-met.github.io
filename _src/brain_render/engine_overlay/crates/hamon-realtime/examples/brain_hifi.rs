//! brain_hifi: prerendered camera journeys through a procedural, anatomically
//! laid-out brain (jacobmetoyer.com home). Geometry comes from
//! `brain_geo.py` (brain.bin); camera segments from a route JSON.
//!
//!   brain_hifi --mesh brain.bin --route seg.json --out DIR --res 1280x720 \
//!       --samples 16 --range a:b [--idpass 1]
//!
//! Route frame: {"eye":[x,y,z],"target":[x,y,z],"fov":deg,"glow":{"kind":v},
//!   "fog":density,"exposure":e,"fibres":v,"eyelight":v}
//! `--idpass 1` writes flat region colours (lights off, emission only) for
//! the browser's hit-testing masks.
use hamon_realtime::glam::{Mat4, Vec3};
use hamon_realtime::*;
use std::io::Read;
use std::path::{Path, PathBuf};

fn arg(a: &[String], k: &str) -> Option<String> {
    a.iter().position(|x| x == k).and_then(|i| a.get(i + 1).cloned())
}
fn num(a: &[String], k: &str, d: f32) -> f32 {
    arg(a, k).and_then(|s| s.parse().ok()).unwrap_or(d)
}

struct M {
    kind: u32,
    data: MeshData,
}

fn load(path: &Path) -> Vec<M> {
    let mut b = Vec::new();
    std::fs::File::open(path).expect("mesh").read_to_end(&mut b).unwrap();
    let u = |o: usize| u32::from_le_bytes(b[o..o + 4].try_into().unwrap());
    let n = u(0) as usize;
    let mut o = 4;
    let mut out = Vec::new();
    for _ in 0..n {
        let (kind, nv, ni) = (u(o), u(o + 4) as usize, u(o + 8) as usize);
        o += 12;
        let f: &[f32] = bytemuck_cast(&b[o..o + nv * 48]);
        o += nv * 48;
        let vertices = f
            .chunks_exact(12)
            .map(|v| Vertex { pos: [v[0], v[1], v[2]], nrm: [v[3], v[4], v[5]], col: [v[6], v[7], v[8], v[9]], uv: [v[10], v[11]] })
            .collect();
        let idx: Vec<u32> = (0..ni).map(|i| u(o + 4 * i)).collect();
        o += ni * 4;
        out.push(M { kind, data: MeshData { vertices, indices: idx } });
    }
    out
}
fn bytemuck_cast(b: &[u8]) -> &[f32] {
    assert!(b.len() % 4 == 0);
    // the file buffer is not guaranteed aligned: copy-free only if aligned
    let (p, m, s) = unsafe { b.align_to::<f32>() };
    assert!(p.is_empty() && s.is_empty(), "unaligned mesh buffer");
    m
}

fn v3(x: &serde_json::Value) -> Vec3 {
    Vec3::new(x[0].as_f64().unwrap() as f32, x[1].as_f64().unwrap() as f32, x[2].as_f64().unwrap() as f32)
}

/// Flat id colours for the hit-test pass (decoded by nearest colour).
fn id_color(kind: u32) -> [f32; 3] {
    match kind {
        1 => [1.0, 0.0, 0.0],
        2 => [0.0, 1.0, 0.0],
        3 => [0.0, 0.0, 1.0],
        4 => [1.0, 1.0, 0.0],
        5 => [1.0, 0.0, 1.0],
        6 => [0.0, 1.0, 1.0],
        7 => [1.0, 0.5, 0.0],
        8 => [0.5, 0.0, 1.0],
        40 => [1.0, 1.0, 1.0],          // left eye (Spire)
        41 => [0.5, 0.5, 0.5],          // right eye (HAMON)
        50 => [1.0, 1.0, 1.0],
        51 => [0.5, 0.5, 0.5],
        52 => [0.25, 0.25, 0.25],
        _ => [0.0, 0.0, 0.0],
    }
}

fn material(kind: u32, glow: f32, fibres: f32, eyelight: f32, rough: f32) -> (Material, bool) {
    // (material, casts shadow)
    match kind {
        1..=7 => (Material::new([1.0, 1.0, 1.0, 1.0], rough, 0.0).style(1).glow(glow), true),
        8 => (Material::new([1.0, 1.0, 1.0, 1.0], rough, 0.0).style(1).glow(0.15 + glow), true),
        20..=22 => (Material::new([1.0, 1.0, 1.0, 1.0], 0.5, 0.0).style(3).glow(0.02 + glow * 0.5), true),
        30 => (Material::new([1.0, 1.0, 1.0, 1.0], 0.6, 0.0).glow(fibres), false),
        31 => (Material::new([1.0, 1.0, 1.0, 1.0], 0.5, 0.0).glow(fibres * 1.5), false),
        40 | 41 => (Material::new([1.0, 1.0, 1.0, 1.0], 0.18, 0.0).style(2).glow(glow * 0.4), true),
        50 | 51 => (Material::new([1.0, 1.0, 1.0, 1.0], 0.35, 0.0).style(2).glow(0.08 + glow + eyelight * 0.3), false),
        52 => (Material::new([1.0, 1.0, 1.0, 1.0], 0.1, 0.0).glow(eyelight * 30.0), false),
        _ => (Material::default(), true),
    }
}

fn save_png(path: &Path, w: u32, h: u32, rgba: &[u8]) {
    let f = std::fs::File::create(path).unwrap();
    let mut e = png::Encoder::new(std::io::BufWriter::new(f), w, h);
    e.set_color(png::ColorType::Rgba);
    e.set_depth(png::BitDepth::Eight);
    e.write_header().unwrap().write_image_data(rgba).unwrap();
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let meshes = load(Path::new(&arg(&a, "--mesh").expect("--mesh")));
    let route: serde_json::Value = serde_json::from_slice(&std::fs::read(arg(&a, "--route").expect("--route")).unwrap()).unwrap();
    let frames = route["frames"].as_array().unwrap().clone();
    let out = PathBuf::from(arg(&a, "--out").expect("--out"));
    std::fs::create_dir_all(&out).unwrap();
    let (w, h) = arg(&a, "--res")
        .map(|r| {
            let (x, y) = r.split_once('x').unwrap();
            (x.parse::<u32>().unwrap(), y.parse::<u32>().unwrap())
        })
        .unwrap_or((1280, 720));
    let samples = num(&a, "--samples", 16.0) as u32;
    let idpass = num(&a, "--idpass", 0.0) > 0.5;
    let idonly = num(&a, "--idonly", 0.0) as u32;
    let (r0, r1) = arg(&a, "--range")
        .map(|r| {
            let (x, y) = r.split_once(':').unwrap();
            (x.parse::<usize>().unwrap(), y.parse::<usize>().unwrap())
        })
        .unwrap_or((0, frames.len() - 1));

    let mut r = Renderer::new_headless_with(w, h, Quality { shadow_res: 4096, point_shadow_res: 1024, tex_res: 512 }).expect("renderer");
    eprintln!("adapter: {:?}", r.adapter_info);
    let handles: Vec<_> = meshes.iter().map(|m| (m.kind, r.add_mesh(&m.data))).collect();
    // hemisphere of each mesh (sign of mean x), for cutaways
    let sides: Vec<f32> = meshes.iter().map(|m| { let n = m.data.vertices.len().max(1) as f32; m.data.vertices.iter().map(|v| v.pos[0]).sum::<f32>() / n }).collect();

    let mut style = Style::default();
    style.enabled = false;
    style.outlines = false;
    style.volumetric_steam = false;
    style.saturation = num(&a, "--sat", 1.04);
    style.contrast = num(&a, "--contrast", 1.06);
    style.value_curve = [0.0, 0.36, 1.18, 0.08];
    style.grade_shadow = [0.40, 0.48, 1.0, num(&a, "--gsh", 0.30)];
    style.grade_highlight = [1.0, 0.86, 0.72, num(&a, "--ghi", 0.12)];
    {
        let ll = &mut style.lifelike;
        ll.enabled = !idpass;
        ll.ao = 1.0;
        ll.ao_radius = num(&a, "--ao", 0.35);
        ll.bounce = num(&a, "--bounce", 0.8);
        ll.reflections = num(&a, "--ssr", 1.0) > 0.5;
        ll.lamp_radius = 1.2;
        ll.contact_shadows = num(&a, "--contact", 0.5);
        ll.sun_angle = 0.03;
        ll.inverse_square = true;
        ll.amb_up = [0.030, 0.034, 0.060];
        ll.amb_mid = [0.020, 0.016, 0.022];
        ll.amb_down = [0.012, 0.008, 0.010];
        ll.grade = num(&a, "--llgrade", 1.0);
        ll.vignette = num(&a, "--vig", 0.28);
        // 1: cortex / pia - wet, translucent tissue
        ll.surfaces[1] = Some(Surface { sss: num(&a, "--sss", 0.35), sss_color: [num(&a, "--sssr", 0.9), num(&a, "--sssg", 0.32), num(&a, "--sssb", 0.26)], clearcoat: num(&a, "--coat", 0.3), clearcoat_rough: num(&a, "--coatr", 0.22), f0: 0.03, ..Default::default() });
        // 2: eye - sclera / iris under a wet cornea
        ll.surfaces[2] = Some(Surface { sss: 0.5, sss_color: [0.95, 0.7, 0.6], clearcoat: 1.0, clearcoat_rough: 0.02, f0: 0.025, ..Default::default() });
        // 3: nerve - pale, fibrous, slightly translucent
        ll.surfaces[3] = Some(Surface { sss: 0.6, sss_color: [0.95, 0.8, 0.7], clearcoat: 0.3, clearcoat_rough: 0.2, sheen_color: [0.5, 0.45, 0.4], sheen_rough: 0.4, ..Default::default() });
    }

    let mut receipts = Vec::new();
    for fi in r0..=r1.min(frames.len() - 1) {
        let f = &frames[fi];
        let eye = v3(&f["eye"]);
        let target = v3(&f["target"]);
        let fov = f["fov"].as_f64().unwrap_or(32.0) as f32;
        let gl = |k: u32| f["glow"].get(k.to_string()).and_then(|x| x.as_f64()).unwrap_or(0.0) as f32;
        let fibres = f["fibres"].as_f64().unwrap_or(0.0) as f32;
        let eyelight = f["eyelight"].as_f64().unwrap_or(0.0) as f32;
        let hide = f["hide"].as_f64().unwrap_or(0.0) as f32;
        let dynamic: Vec<(MeshId, Instance)> = handles
            .iter()
            .enumerate()
            .filter(|(k, (kind, _))| !(hide != 0.0 && matches!(*kind, 1..=4 | 7) && sides[*k] * hide > 0.0))
            .filter(|(_, (kind, _))| !(matches!(*kind, 30 | 31) && fibres <= 0.0 && !idpass))
            .map(|(k, (kind, hd))| {
                let (mut m, cast) = material(*kind, gl(*kind), fibres, eyelight, num(&a, "--rough", 0.42));
                if idpass && idonly > 0 {
                    let on = match idonly { 9 => matches!(*kind, 40 | 50), 10 => matches!(*kind, 41 | 51), k => *kind == k };
                    m = Material::new(if on { [1.0, 1.0, 1.0, 1.0] } else { [0.0, 0.0, 0.0, 1.0] }, 1.0, 0.0).glow(if on { 6.0 } else { 0.0 });
                } else if idpass {
                    let c = id_color(*kind);
                    m = Material::new([c[0], c[1], c[2], 1.0], 1.0, 0.0).glow(if c == [0.0; 3] { 0.0 } else { 4.0 });
                }
                let mut i = Instance::new(Mat4::IDENTITY, m);
                i.cast_shadow = cast && !idpass;
                i.group = 1 + k as u32;
                (*hd, i)
            })
            .collect();
        // lights: warm key, cool rim, soft under-fill; and a glow at any lit region
        let mut lights = vec![
            PointLight { pos: Vec3::new(14.0, 18.0, 22.0), color: Vec3::new(1.0, 0.9, 0.8), intensity: num(&a, "--key", 2600.0), range: 90.0, shadow: num(&a, "--shadows", 1.0) > 0.5, radius: 3.0, ..Default::default() },
            PointLight { pos: Vec3::new(-16.0, 10.0, -20.0), color: Vec3::new(0.55, 0.7, 1.0), intensity: num(&a, "--rim", 2200.0), range: 90.0, shadow: num(&a, "--shadows", 1.0) > 0.5, radius: 4.0, ..Default::default() },
            PointLight { pos: Vec3::new(-10.0, -14.0, 14.0), color: Vec3::new(0.9, 0.55, 0.5), intensity: num(&a, "--fill", 500.0), range: 70.0, ..Default::default() },
        ];
        if let Some(extra) = f["lights"].as_array() {
            for l in extra {
                lights.push(PointLight { pos: v3(&l["pos"]), color: v3(&l["color"]), intensity: l["i"].as_f64().unwrap() as f32, range: l["range"].as_f64().unwrap_or(20.0) as f32, radius: 0.3, volumetric: l["vol"].as_f64().unwrap_or(0.0) as f32, ..Default::default() });
            }
        }
        if idpass {
            lights.clear();
        }
        let fog_d = if idpass { 0.0 } else { f["fog"].as_f64().unwrap_or(0.004) as f32 };
        let fog_c = f.get("fogColor").map(v3).unwrap_or(Vec3::new(0.004, 0.0035, 0.007));
        let exposure = f["exposure"].as_f64().unwrap_or(num(&a, "--exposure", 2.2) as f64) as f32;
        let mut st = style;
        if idpass {
            st.saturation = 1.0;
            st.contrast = 1.0;
            st.value_curve = [0.0, 0.5, 1.0, 0.0];
            st.grade_shadow = [1.0, 1.0, 1.0, 0.0];
            st.grade_highlight = [1.0, 1.0, 1.0, 0.0];
            st.lifelike.vignette = 0.0;
        }
        let frame = FrameDesc {
            camera: Camera { eye, target, fov_y: fov.to_radians(), near: 0.02, far: 400.0 },
            sun: Sun { dir: Vec3::new(0.3, 0.8, 0.5), color: Vec3::new(1.0, 0.95, 0.9), intensity: if idpass { 0.0 } else { num(&a, "--sun", 0.6) }, volumetric: 0.0 },
            fog: Fog { color: fog_c, density: fog_d, base: 50.0, falloff: 0.0, anisotropy: 0.6, max_dist: 120.0 },
            env: Env { sky: if idpass { Vec3::ZERO } else { Vec3::new(num(&a, "--skyr", 0.0015), num(&a, "--skyg", 0.0018), num(&a, "--skyb", 0.003)) }, ground: Vec3::ZERO, ambient: if idpass { 0.0 } else { num(&a, "--amb", 0.6) }, exposure: if idpass { 1.0 } else { exposure } },
            lights: &lights,
            dynamic: &dynamic,
            time: fi as f32 / 24.0,
            shadow_distance: 60.0,
            style: st,
            snow: Snow::default(),
            emitters: &[],
        };
        let t = std::time::Instant::now();
        r.taa_reset();
        r.taa_converge(&frame, if idpass { 1 } else { samples }).expect("render");
        let rgba = r.read_pixels().expect("pixels");
        save_png(&out.join(format!("f{fi:05}.png")), w, h, &rgba);
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        eprintln!("frame {fi} {ms:.0} ms");
        receipts.push(serde_json::json!({"frame": fi, "ms": ms}));
    }
    std::fs::write(out.join(format!("receipt-{r0:05}-{r1:05}.json")), serde_json::to_vec_pretty(&serde_json::json!({"renderer": "hamon_realtime::Renderer lifelike, TAA-converged", "adapter": format!("{:?}", r.adapter_info), "w": w, "h": h, "samples": samples, "idpass": idpass, "frames": receipts})).unwrap()).unwrap();
}
