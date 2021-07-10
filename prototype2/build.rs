use std::{env, fs, path::Path, process::Command};

fn main() {
    // Compile Constants
    let pentagon_y: f64 = -1.0/(5.0 as f64).sqrt();
    let pentagon_radius: f64 = 2.0/f64::sqrt(5.0);
    let hex_wrench_factor: f64 = f64::sqrt(3.0); // 2.0*f32::sin(std::f32::consts::PI/6.0)
    let pentagon_radius_by_hex_radius: f64 = 1.0/(2.0*f64::sin(std::f64::consts::PI/5.0)); // f32::sin(0.3*std::f32::consts::PI)/f32::sin(0.4*std::f32::consts::PI)
    let icosahedron_radius_by_edge_length: f64 = f64::sin(std::f64::consts::PI*2.0/5.0); // 0.25*f32::sqrt(10.0+2.0*f32::sqrt(5.0))

    let mut icosahedron_vertices: [[f64; 3]; 12] = [[0.0; 3]; 12];
    icosahedron_vertices[0][1] = -1.0;
    icosahedron_vertices[11][1] = 1.0;
    for i in 0..5 {
        let angle = (1.1+i as f64*2.0/5.0)*std::f64::consts::PI;
        let mut southern_hemisphere = [0.0; 3];
        southern_hemisphere[0] = f64::sin(angle)*pentagon_radius;
        southern_hemisphere[1] = pentagon_y;
        southern_hemisphere[2] = f64::cos(angle)*pentagon_radius;
        let mut northern_hemisphere = [0.0; 3];
        northern_hemisphere[0] = -southern_hemisphere[0];
        northern_hemisphere[1] = -southern_hemisphere[1];
        northern_hemisphere[2] = -southern_hemisphere[2];
        icosahedron_vertices[1+i] = southern_hemisphere;
        icosahedron_vertices[6+(i+3)%5] = northern_hemisphere;
    }
    let triangle_angle: f64 = f64::acos(icosahedron_vertices[10][1]);

    let source_code = format!("\
const HEX_WRENCH_FACTOR: f32 = {:};
const PENTAGON_RADIUS_BY_HEX_RADIUS: f32 = {:};
const ICOSAHEDRON_RADIUS_BY_EDGE_LENGTH: f32 = {:};
const TRIANGLE_ANGLE: f32 = {:};
const ICOSAHEDRON_VERTICES: [[f32; 3]; 12] = {:?};",
        hex_wrench_factor,
        pentagon_radius_by_hex_radius,
        icosahedron_radius_by_edge_length,
        triangle_angle,
        icosahedron_vertices,
    );

    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("planet_consts.rs");
    fs::write(&dest_path, source_code).unwrap();

    // Compile Shader Modules
    Command::new("make").status().unwrap();
    /*for entry in fs::read_dir("src/shader/").unwrap() {
        let src_path = entry.unwrap().path();
        if src_path.is_dir() {
            continue;
        }
        let dst_path = Path::new(&out_dir).join(src_path.file_stem().unwrap()).with_extension("spv");
        let module_type = src_path.file_stem().unwrap().to_str().unwrap().split('_').last().unwrap();
        Command::new("glslangValidator").args(&[
            "-S", module_type,
            "-V460",
            "-o", dst_path.to_str().unwrap(),
            src_path.to_str().unwrap()
        ]).status().unwrap();
    }*/
}
