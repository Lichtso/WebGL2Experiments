use std::io::{Read, Seek};
use iced_wgpu::wgpu;
use serde::Deserialize;
use crate::assets::{AssetError, AssetPack, Texture, Vertex, Mesh};

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfAccessor {
    bufferView: usize,
    byteOffset: Option<usize>,
    componentType: usize,
    count: usize,
    max: Option<Vec<serde_json::Value>>,
    min: Option<Vec<serde_json::Value>>,
    #[serde(rename="type")]
    ty: String,
}

#[repr(C)]
struct GltfHeader {
    magic: u32,
    version: u32,
    length: u32,
}

#[repr(C)]
struct GltfChunkHeader {
    length: u32,
    kind: u32,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfBuffer {
    // byteLength: usize,
    uri: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfBufferView {
    buffer: usize,
    // byteLength: usize,
    byteOffset: Option<usize>,
    // target: usize,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfImage {
    uri: String,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfTextureIndex {
    index: usize,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfMaterialMetallicRoughness {
    baseColorTexture: GltfTextureIndex,
    // metallicFactor: f32,
    // roughnessFactor: f32,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfMaterial {
    // name: String,
    pbrMetallicRoughness: GltfMaterialMetallicRoughness,
    // normalTexture: GltfTextureIndex,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfMeshPrimitive {
    attributes: serde_json::Map<String, serde_json::Value>,
    indices: usize,
    material: Option<usize>,
    mode: Option<usize>,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfMesh {
    name: String,
    primitives: Vec<GltfMeshPrimitive>,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct GltfTexture {
    // sampler: usize,
    source: usize,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct Gltf {
    accessors: Vec<GltfAccessor>,
    buffers: Vec<GltfBuffer>,
    bufferViews: Vec<GltfBufferView>,
    images: Option<Vec<GltfImage>>,
    materials: Option<Vec<GltfMaterial>>,
    meshes: Option<Vec<GltfMesh>>,
    textures: Option<Vec<GltfTexture>>,
}

fn access_gltf_buffer<'a>(buffers: &'a Vec<Vec<u8>>, gltf: &Gltf, accessor: &GltfAccessor, scalars_per_element: usize) -> &'a [u8] {
    assert_eq!(accessor.ty, match scalars_per_element {
        1 => "SCALAR",
        2 => "VEC2",
        3 => "VEC3",
        _ => panic!()
    });
    let buffer_view = &gltf.bufferViews[accessor.bufferView];
    let offset = buffer_view.byteOffset.unwrap_or(0)+accessor.byteOffset.unwrap_or(0);
    let buffer = &buffers[buffer_view.buffer];
    &buffer[offset..]
}

pub fn load_gltf(device: &wgpu::Device, bind_group_layout: &wgpu::BindGroupLayout, sampler: &wgpu::Sampler, asset_pack: &AssetPack, path: &std::path::PathBuf) -> Result<Vec<(std::path::PathBuf, Mesh)>, AssetError> {
    let directory = path.parent().unwrap();
    let file = std::fs::File::open(path)?;
    // let file_len = file.metadata()?.len();
    let mut reader = std::io::BufReader::new(file);
    let mut buffers: Vec<Vec<u8>> = Vec::new();
    let gltf: Gltf = if path.extension().unwrap() == ".glb" {
        let mut slice = [0; std::mem::size_of::<GltfHeader>()];
        reader.read(&mut slice)?;
        let header: GltfHeader = unsafe { std::mem::transmute(slice) };
        assert_eq!(header.magic, 0x46546C67);
        assert_eq!(header.version, 2);
        let mut slice = [0; std::mem::size_of::<GltfChunkHeader>()];
        reader.read(&mut slice)?;
        let json_chunk_header: GltfChunkHeader = unsafe { std::mem::transmute(slice) };
        assert_eq!(json_chunk_header.kind, 0x4E4F534A);
        reader.seek(std::io::SeekFrom::Current(json_chunk_header.length as i64))?;
        let mut slice = [0; std::mem::size_of::<GltfChunkHeader>()];
        reader.read(&mut slice)?;
        let bin_chunk_header: GltfChunkHeader = unsafe { std::mem::transmute(slice) };
        assert_eq!(bin_chunk_header.kind, 0x004E4942);
        let mut buffer: Vec<u8> = Vec::new();
        reader.read_to_end(&mut buffer)?;
        buffers.push(buffer);
        reader.seek(std::io::SeekFrom::Start(std::mem::size_of::<GltfHeader>() as u64+std::mem::size_of::<GltfChunkHeader>() as u64))?;
        serde_json::from_reader(reader.take(json_chunk_header.length as u64))?
    } else {
        serde_json::from_reader(reader)?
    };
    let path = path.parent().unwrap().join(path.file_stem().unwrap());
    let images = match &gltf.images {
        Some(gltf_images) => {
            let mut images: Vec<&Texture> = Vec::with_capacity(gltf_images.len());
            for gltf_image in gltf_images {
                let image_path = std::path::PathBuf::from(&gltf_image.uri);
                images.push(&asset_pack.textures[&directory.join(image_path.parent().unwrap()).join(image_path.file_stem().unwrap())]);
            }
            images
        },
        None => Vec::new(),
    };
    for gltf_buffer in &gltf.buffers {
        if let Some(uri) = &gltf_buffer.uri {
            buffers.push(std::fs::read(&directory.join(uri))?);
        }
    }
    let mut result: Vec<(std::path::PathBuf, Mesh)> = Vec::new();
    if let Some(gltf_meshes) = &gltf.meshes {
        for gltf_mesh in gltf_meshes {
            let gltf_primitive = &gltf_mesh.primitives[0];
            let mode = gltf_primitive.mode.unwrap_or(4);
            assert_eq!(mode, 4);
            let element_count = gltf.accessors[gltf_primitive.attributes["POSITION"].as_u64().unwrap() as usize].count;
            let mut vertices: Vec<Vertex> = Vec::with_capacity(std::mem::size_of::<Vertex>()*element_count);
            vertices.resize_with(element_count, || { Vertex::default() });
            let mut offset_in_vertex = 0;
            for (attribute, scalars_per_element) in &[("POSITION", 3), ("NORMAL", 3), ("TEXCOORD_0", 2)] {
                let element_size = *scalars_per_element*std::mem::size_of::<f32>();
                let accessor = &gltf.accessors[gltf_primitive.attributes[*attribute].as_u64().unwrap() as usize];
                assert_eq!(accessor.componentType, 5126); // FLOAT
                let slice = access_gltf_buffer(&buffers, &gltf, &accessor, *scalars_per_element);
                unsafe {
                    let mut dst_ptr = (vertices.as_mut_ptr() as *mut u8).offset(offset_in_vertex as isize);
                    let mut src_ptr = slice.as_ptr() as *const u8;
                    for _ in 0..accessor.count {
                        std::slice::from_raw_parts_mut(dst_ptr, element_size).clone_from_slice(std::slice::from_raw_parts(src_ptr, element_size));
                        dst_ptr = dst_ptr.offset(std::mem::size_of::<Vertex>() as isize);
                        src_ptr = src_ptr.offset(element_size as isize);
                    }
                }
                offset_in_vertex += element_size;
            }
            let accessor = &gltf.accessors[gltf_primitive.attributes["POSITION"].as_u64().unwrap() as usize];
            let (min, max) = if accessor.min.is_some() && accessor.max.is_some() {
                let min = accessor.min.as_ref().unwrap();
                let max = accessor.max.as_ref().unwrap();
                (glam::Vec3A::new(min[0].as_f64().unwrap() as f32, min[1].as_f64().unwrap() as f32, min[2].as_f64().unwrap() as f32),
                glam::Vec3A::new(max[0].as_f64().unwrap() as f32, max[1].as_f64().unwrap() as f32, max[2].as_f64().unwrap() as f32))
            } else {
                let mut min = glam::Vec3A::splat(f32::INFINITY);
                let mut max = glam::Vec3A::splat(-f32::INFINITY);
                for vertex in &vertices {
                    min = min.min(vertex.position.into());
                    max = max.max(vertex.position.into());
                }
                (min, max)
            };
            let bounding_volume = crate::bounding_volume::BoundingVolume::Box(crate::bounding_volume::BoundingBox { min, max });
            let accessor = &gltf.accessors[gltf_primitive.indices];
            assert_eq!(accessor.componentType, 5123); // UNSIGNED_SHORT
            let indices = access_gltf_buffer(&buffers, &gltf, &accessor, 1);
            let bind_group = gltf_primitive.material.and_then(|gltf_material_index| {
                let gltf_material = &gltf.materials.as_ref().unwrap()[gltf_material_index];
                let albedo_texture = &images[gltf.textures.as_ref().unwrap()[gltf_material.pbrMetallicRoughness.baseColorTexture.index].source];
                // let normal_texture = images[gltf.textures.as_ref().unwrap()[gltf_material.normalTexture.index].source];
                Some(device.create_bind_group(&bind_group_descriptor!(
                    &bind_group_layout,
                    0 => Sampler(&sampler),
                    1 => TextureView(&albedo_texture.view),
                )))
            });
            let mesh = Mesh::new(device, unsafe { crate::transmute_slice::<_, u8>(&vertices[..]) }, indices, accessor.count, bounding_volume, bind_group);
            result.push((path.join(&gltf_mesh.name), mesh));
        }
    }
    Ok(result)
}
