use std::io::Read;
use iced_wgpu::wgpu;
use rayon::prelude::*;
pub use texture::Texture;
pub use mipmap::MipmapGenerator;
pub use mesh::{Vertex, Mesh};

mod texture;
mod mipmap;
mod mesh;
mod gltf;

#[derive(Debug)]
pub enum AssetError {
    IoError(std::io::Error),
    SerdeJsonError(serde_json::Error),
    ImageError(image::ImageError),
    // AlreadyLoaded, // TODO
    ArrayTextureSizeMismatch,
    ArrayTextureFormatMismatch,
}

impl From<std::io::Error> for AssetError {
    fn from(err: std::io::Error) -> Self {
        Self::IoError(err)
    }
}

impl From<serde_json::Error> for AssetError {
    fn from(err: serde_json::Error) -> Self {
        Self::SerdeJsonError(err)
    }
}

impl From<image::ImageError> for AssetError {
    fn from(err: image::ImageError) -> Self {
        Self::ImageError(err)
    }
}

macro_rules! map_and_collect_error {
    ($entries:expr, $closure:block, $t:ty) => {
        $entries
            .map($closure)
            .collect::<Vec<Result<$t, AssetError>>>()
            .into_iter()
            .collect::<Result<Vec<$t>, AssetError>>()?;
    }
}

/// To prefetch and cache assets
#[derive(Default)]
pub struct AssetPack {
    pub shader_modules: std::collections::HashMap<std::path::PathBuf, wgpu::ShaderModule>,
    pub textures: std::collections::HashMap<std::path::PathBuf, Texture>,
    pub meshes: std::collections::HashMap<std::path::PathBuf, Mesh>,
    // TODO: Sound, Localization
}

fn load_spirv(device: &wgpu::Device, path: std::path::PathBuf) -> Result<(std::path::PathBuf, wgpu::ShaderModule), AssetError> {
    let mut file = std::fs::File::open(&path)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
    let source = unsafe { crate::transmute_slice::<u8, u32>(&buffer[..]) };
    let shader_module = device.create_shader_module(wgpu::ShaderModuleSource::SpirV(std::borrow::Cow::from(source)));
    Ok((path, shader_module))
}

impl AssetPack {
    pub fn create_path_pool() -> std::collections::HashMap<String, std::collections::HashSet<std::path::PathBuf>>{
        let mut path_pool: std::collections::HashMap<String, std::collections::HashSet<std::path::PathBuf>> = std::collections::HashMap::new();
        for key in &["shader_modules", "textures", "meshes"] {
            path_pool.insert(key.to_string(), std::collections::HashSet::new());
        }
        path_pool
    }

    pub fn collect_paths(path_pool: &mut std::collections::HashMap<String, std::collections::HashSet<std::path::PathBuf>>, path: &std::path::PathBuf) {
        let dir_name = path.components().last().unwrap().as_os_str().to_str().unwrap();
        if dir_name.find("_array_texture_").is_some() {
            path_pool.get_mut(&"textures".to_owned()).unwrap().insert(path.clone());
            return;
        }
        for entry in std::fs::read_dir(path).unwrap() {
            let entry_path = entry.unwrap().path();
            if entry_path.is_dir() {
                Self::collect_paths(path_pool, &entry_path);
            } else {
                match entry_path.extension().and_then(|x| x.to_str()) {
                    Some("spv") => path_pool.get_mut(&"shader_modules".to_owned()).unwrap().insert(entry_path),
                    Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("bmp") | Some("tiff") | Some("webp") => path_pool.get_mut(&"textures".to_owned()).unwrap().insert(entry_path),
                    Some("gltf") | Some("glb") => path_pool.get_mut(&"meshes".to_owned()).unwrap().insert(entry_path),
                    _ => true
                };
            }
        }
    }

    pub fn load(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, encoder: &mut wgpu::CommandEncoder, bind_group_layout: Option<&wgpu::BindGroupLayout>, sampler: Option<&wgpu::Sampler>, mipmap_generator: Option<&MipmapGenerator>, path_pool: &std::collections::HashMap<String, std::collections::HashSet<std::path::PathBuf>>) -> Result<(), AssetError> {
        let shader_module_entries = map_and_collect_error!((&path_pool.get(&"shader_modules".to_owned()).unwrap()).into_par_iter(), {|entry_path| {
            load_spirv(device, entry_path.clone())
        }}, (std::path::PathBuf, wgpu::ShaderModule));
        for (entry_path, shader_module) in shader_module_entries {
            self.shader_modules.insert(entry_path.parent().unwrap().join(entry_path.file_stem().unwrap()), shader_module);
        }

        let mut array_texture_layers: Vec<(std::path::PathBuf, Option<(std::path::PathBuf, u32)>)> = Vec::new();
        let texture_load_tasks: Vec<(std::path::PathBuf, Option<(std::path::PathBuf, u32)>)> = (&path_pool.get(&"textures".to_owned()).unwrap()).into_iter()
            .filter(|entry_path| {
                let dir_name = entry_path.components().last().unwrap().as_os_str().to_str().unwrap();
                if let Some(first_pos) = dir_name.find("_array_texture_") {
                    let file_name = dir_name[0..first_pos].to_owned();
                    let extension_index = file_name.find(".").unwrap();
                    let file_stem = &file_name[..extension_index];
                    let extension = &file_name[extension_index+1..];
                    let mut size_descriptor = dir_name[first_pos+15..].split("_");
                    let size = wgpu::Extent3d {
                        width: size_descriptor.next().unwrap().parse::<u32>().unwrap(),
                        height: size_descriptor.next().unwrap().parse::<u32>().unwrap(),
                        depth: size_descriptor.next().unwrap().parse::<u32>().unwrap(),
                    };
                    let texture = Texture::new(device, size, mipmap_generator.is_some(), false, wgpu::TextureDimension::D2, wgpu::TextureFormat::Rgba8UnormSrgb);
                    let texture_path = entry_path.parent().unwrap().join(&file_stem);
                    self.textures.insert(texture_path.clone(), texture);
                    for i in 0..size.depth {
                        array_texture_layers.push((entry_path.join(format!("{}.{}", i, extension)), Some((texture_path.clone(), i))));
                    }
                    false
                } else {
                    true
                }
            })
            .map(|entry_path| (entry_path.clone(), Option::<(std::path::PathBuf, u32)>::None))
            .collect();
        let texture_entries = map_and_collect_error!(texture_load_tasks.into_par_iter().chain(array_texture_layers.into_par_iter()), {|(entry_path, array_texture)| {
            Texture::load(device, queue, mipmap_generator.is_some(), array_texture.and_then(|(dir_path, i)| Some(texture::ArrayTextureLayer {
                layer_index: i,
                texture: &self.textures.get(&dir_path).unwrap(),
            })), entry_path)
        }}, (std::path::PathBuf, Option<Texture>));
        for (entry_path, texture) in texture_entries {
            if let Some(texture) = texture {
                self.textures.insert(entry_path.parent().unwrap().join(entry_path.file_stem().unwrap()), texture);
            }
        }
        if let Some(mipmap_generator) = mipmap_generator {
            for (_path, texture) in self.textures.iter() {
                mipmap_generator.generate(device, encoder, &texture, None);
            }
        }

        let mesh_entry_entries = map_and_collect_error!((&path_pool.get(&"meshes".to_owned()).unwrap()).into_par_iter(), {|entry_path| {
            gltf::load_gltf(device, bind_group_layout.unwrap(), sampler.unwrap(), self, entry_path)
        }}, Vec<(std::path::PathBuf, Mesh)>);
        for mesh_entries in mesh_entry_entries {
            for (entry_path, mesh_entry) in mesh_entries {
                self.meshes.insert(entry_path, mesh_entry);
            }
        }

        Ok(())
    }
}
