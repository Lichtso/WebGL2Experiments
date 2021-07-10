use iced_wgpu::wgpu;
use crate::assets::{AssetPack, Texture};

struct MipmapGeneratorPipeline {
    bind_group_layout: wgpu::BindGroupLayout,
    pot_pipeline: wgpu::ComputePipeline,
    general_pipeline: wgpu::ComputePipeline,
}

pub struct MipmapGenerator {
    pipelines: Vec<std::collections::HashMap<wgpu::TextureFormat, MipmapGeneratorPipeline>>,
}

impl MipmapGenerator {
    pub fn new(device: &wgpu::Device, asset_pack: &AssetPack) -> Self {
        let formats = [
            wgpu::TextureFormat::R8Unorm,
            wgpu::TextureFormat::Rgba8UnormSrgb,
            wgpu::TextureFormat::R16Uint,
            wgpu::TextureFormat::Rgba16Uint,
        ];
        let mut pipelines: Vec<std::collections::HashMap<wgpu::TextureFormat, MipmapGeneratorPipeline>> = Vec::new();
        for dimensions in 2..4 {
            let dimension = if dimensions == 2 { wgpu::TextureViewDimension::D2 } else { wgpu::TextureViewDimension::D3 };
            let mut dimension_pipelines = std::collections::HashMap::new();
            for format in &formats {
                let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                    label: None,
                    entries: &[
                        wgpu::BindGroupLayoutEntry {
                            binding: 0,
                            visibility: wgpu::ShaderStage::COMPUTE,
                            ty: wgpu::BindingType::StorageTexture {
                                dimension,
                                format: *format,
                                readonly: true,
                            },
                            count: None,
                        },
                        wgpu::BindGroupLayoutEntry {
                            binding: 1,
                            visibility: wgpu::ShaderStage::COMPUTE,
                            ty: wgpu::BindingType::StorageTexture {
                                dimension,
                                format: *format,
                                readonly: false,
                            },
                            count: None,
                        },
                    ],
                });
                let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: None,
                    bind_group_layouts: &[&bind_group_layout],
                    push_constant_ranges: &[],
                });
                let pot_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                    label: None,
                    layout: Some(&pipeline_layout),
                    compute_stage: shader_module!(asset_pack, format!("assets/shader_modules/mipmap_{}d_pot_comp", dimensions)),
                });
                let general_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                    label: None,
                    layout: Some(&pipeline_layout),
                    compute_stage: shader_module!(asset_pack, format!("assets/shader_modules/mipmap_{}d_general_comp", dimensions)),
                });
                dimension_pipelines.insert(*format, MipmapGeneratorPipeline {
                    bind_group_layout,
                    pot_pipeline,
                    general_pipeline,
                });
            }
            pipelines.push(dimension_pipelines);
        }
        Self {
            pipelines,
        }
    }

    pub fn size_of_level(extent: &wgpu::Extent3d, level: u32, is_array: bool) -> wgpu::Extent3d {
        wgpu::Extent3d {
            width: (extent.width>>level).max(1),
            height: (extent.height>>level).max(1),
            depth: if is_array { extent.depth } else { (extent.depth>>level).max(1) },
        }
    }

    pub fn generate(&self, device: &wgpu::Device, encoder: &mut wgpu::CommandEncoder, texture: &Texture, base_array_layer: Option<u32>) {
        assert_ne!(texture.dimension, wgpu::TextureDimension::D1);
        let dimensions = if texture.dimension == wgpu::TextureDimension::D2 { 2 } else { 3 };
        assert!(base_array_layer.is_none() || dimensions != 3);
        let pipelines = &self.pipelines[dimensions-2];
        assert!(pipelines.contains_key(&texture.format));
        let mipmap_pipeline = &pipelines[&texture.format];
        let views = (0..texture.mip_level_count)
            .map(|level| {
                texture.texture.create_view(&wgpu::TextureViewDescriptor {
                    label: None,
                    format: None,
                    dimension: None,
                    aspect: wgpu::TextureAspect::All,
                    base_mip_level: level,
                    level_count: std::num::NonZeroU32::new(1),
                    array_layer_count: if base_array_layer.is_some() { std::num::NonZeroU32::new(1) } else { None },
                    base_array_layer: base_array_layer.unwrap_or(0),
                })
            })
            .collect::<Vec<_>>();
        let x_work_group_count = 32;
        let y_work_group_count = 32;
        let z_work_group_count = 1;
        let is_pot = texture.size.width.is_power_of_two() && texture.size.height.is_power_of_two() && (dimensions == 2 || texture.size.depth.is_power_of_two());
        for level in 1..texture.mip_level_count as usize {
            let src_view = &views[level-1];
            let dst_view = &views[level];
            let mut mip_ext = Self::size_of_level(&texture.size, level as u32, dimensions == 2);
            if base_array_layer.is_some() {
                mip_ext.depth = 1;
            }
            let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: None,
                layout: &mipmap_pipeline.bind_group_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&src_view),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::TextureView(&dst_view),
                    },
                ],
            });
            let mut pass = encoder.begin_compute_pass();
            pass.set_pipeline(if is_pot { &mipmap_pipeline.pot_pipeline } else { &mipmap_pipeline.general_pipeline });
            pass.set_bind_group(0, &bind_group, &[]);
            pass.dispatch(
                (mip_ext.width+x_work_group_count-1)/x_work_group_count,
                (mip_ext.height+y_work_group_count-1)/y_work_group_count,
                (mip_ext.depth+z_work_group_count-1)/z_work_group_count,
            );
        }
    }
}
