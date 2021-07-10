use iced_wgpu::{wgpu, wgpu::vertex_attr_array};
use crate::assets::AssetPack;

macro_rules! bind_group_descriptor {
    ($layout:expr, $($loc:expr => $t:ident($e:expr)),* $(,)?) => {
        wgpu::BindGroupDescriptor {
            label: None,
            layout: $layout,
            entries: &bind_group_descriptor!([] ; 0; $($loc => $t($e) ,)*),
        }
    };
    ([$($prev_entries:expr,)*] ; $off:expr ;) => { [$($prev_entries,)*] };
    ([$($prev_entries:expr,)*] ; $off:expr ; $loc:expr => $t:ident($e:expr), $($ll:expr => $tt:ident($ee:expr) ,)*) => {
        bind_group_descriptor!(
            [$($prev_entries,)*
            wgpu::BindGroupEntry {
                binding: $loc,
                resource: wgpu::BindingResource :: $t($e),
            },];
            $off + 1;
            $($ll => $tt($ee) ,)*
        )
    };
}

macro_rules! bind_group_entry {
    ($stage:ident) => {
        wgpu::ShaderStage :: $stage
    };
    ($stage:ident $($stages:ident),*) => {
        bind_group_entry!($stage) | bind_group_entry!($($stages),*)
    };
    ($loc:expr, ($stage:ident $(|$stages:ident)*), $t:ident) => {
        wgpu::BindGroupLayoutEntry {
            binding: $loc,
            visibility: bind_group_entry!($stage $($stages),*),
            ty: wgpu::BindingType::UniformBuffer {
                dynamic: false,
                min_binding_size: wgpu::BufferSize::new(std::mem::size_of::<$t>() as u64),
            },
            count: None,
        }
    };
}

macro_rules! sample_attachment {
    ($($loc:expr => $t:ident),* $(,)?) => {
        wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &sample_attachment!([] ; 0; $($loc => $t ,)*),
        }
    };
    ([$($prev_entries:expr,)*] ; $off:expr ;) => { [$($prev_entries,)*] };
    ([$($prev_entries:expr,)*] ; $off:expr ; $loc:expr => $t:ident, $($ll:expr => $tt:ident ,)*) => {
        sample_attachment!(
            [$($prev_entries,)*
            wgpu::BindGroupLayoutEntry { // Normal
                binding: $loc,
                visibility: wgpu::ShaderStage::FRAGMENT,
                ty: wgpu::BindingType::SampledTexture {
                    multisampled: false,
                    dimension: wgpu::TextureViewDimension::D2,
                    component_type: wgpu::TextureComponentType :: $t,
                },
                count: None,
            },];
            $off + 1;
            $($ll => $tt ,)*
        )
    };
}

macro_rules! create_attachment {
    ($size:expr, $format:ident) => {
        wgpu::TextureDescriptor {
            label: None,
            size: $size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat :: $format,
            usage: wgpu::TextureUsage::SAMPLED | wgpu::TextureUsage::OUTPUT_ATTACHMENT,
        }
    }
}

macro_rules! clear_attachment {
    ($attachment:expr, ($r:expr, $g:expr, $b:expr, $a:expr)) => {
        wgpu::RenderPassColorAttachmentDescriptor {
            attachment: $attachment,
            resolve_target: None,
            ops: wgpu::Operations {
                load: wgpu::LoadOp::Clear({
                    wgpu::Color { r: $r, g: $g, b: $b, a: $a }
                }),
                store: true,
            },
        }
    }
}

macro_rules! load_attachment {
    ($attachment:expr) => {
        wgpu::RenderPassColorAttachmentDescriptor {
            attachment: $attachment,
            resolve_target: None,
            ops: wgpu::Operations {
                load: wgpu::LoadOp::Load,
                store: true,
            },
        }
    }
}

macro_rules! cull_mode_none {
    () => {
        Some(wgpu::RasterizationStateDescriptor {
            front_face: wgpu::FrontFace::Ccw,
            cull_mode: wgpu::CullMode::None,
            ..Default::default()
        })
    }
}

macro_rules! stencil_none {
    () => {
        wgpu::StencilStateDescriptor {
            front: wgpu::StencilStateFaceDescriptor::IGNORE,
            back: wgpu::StencilStateFaceDescriptor::IGNORE,
            read_mask: 0,
            write_mask: 0,
        }
    }
}

macro_rules! color_state_descriptor_blend_none {
    ($format:ident) => {
        wgpu::ColorStateDescriptor {
            format: wgpu::TextureFormat :: $format,
            color_blend: wgpu::BlendDescriptor::REPLACE,
            alpha_blend: wgpu::BlendDescriptor::REPLACE,
            write_mask: wgpu::ColorWrite::ALL,
        }
    }
}

macro_rules! color_state_descriptor_blend_add {
    ($format:ident) => {
        wgpu::ColorStateDescriptor {
            format: wgpu::TextureFormat :: $format,
            color_blend: wgpu::BlendDescriptor {
                src_factor: wgpu::BlendFactor::One,
                dst_factor: wgpu::BlendFactor::One,
                operation: wgpu::BlendOperation::Add,
            },
            alpha_blend: wgpu::BlendDescriptor {
                src_factor: wgpu::BlendFactor::Zero,
                dst_factor: wgpu::BlendFactor::One,
                operation: wgpu::BlendOperation::Add,
            },
            write_mask: wgpu::ColorWrite::ALL,
        }
    }
}

macro_rules! instance_attributes_vertex_buffer_descriptor {
    ($base_index:expr) => {
        wgpu::VertexBufferDescriptor {
            stride: std::mem::size_of::<glam::Mat4>() as wgpu::BufferAddress,
            step_mode: wgpu::InputStepMode::Instance,
            attributes: &vertex_attr_array![
                ($base_index) => Float4, ($base_index+1) => Float4, ($base_index+2) => Float4, ($base_index+3) => Float4,
            ],
        }
    }
}

macro_rules! surface_pass_pipeline_descriptor {
    ($asset_pack:ident, $pipeline_layout:expr, $vert:expr, $frag:expr, $cull_mode:ident, $primitive_topology:ident, $vertex_state:expr) => {
        wgpu::RenderPipelineDescriptor {
            label: None,
            layout: Some(&$pipeline_layout),
            vertex_stage: shader_module!($asset_pack, $vert),
            fragment_stage: Some(shader_module!($asset_pack, $frag)),
            rasterization_state: Some(wgpu::RasterizationStateDescriptor {
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: wgpu::CullMode :: $cull_mode,
                ..Default::default()
            }),
            primitive_topology: wgpu::PrimitiveTopology :: $primitive_topology,
            color_states: &[
                color_state_descriptor_blend_none!(Rgba32Float), // Position
                color_state_descriptor_blend_none!(Rgba16Sint), // Normal
                color_state_descriptor_blend_none!(Rgba16Float), // Albedo
                color_state_descriptor_blend_none!(Rgba8Unorm), // Material
            ],
            depth_stencil_state: Some(wgpu::DepthStencilStateDescriptor {
                format: wgpu::TextureFormat::Depth24PlusStencil8,
                depth_write_enabled: true,
                depth_compare: wgpu::CompareFunction::Less,
                stencil: stencil_none!(),
            }),
            vertex_state: $vertex_state,
            sample_count: 1,
            sample_mask: !0,
            alpha_to_coverage_enabled: false,
        }
    }
}

macro_rules! volumetric_pass_pipeline_descriptor {
    ($asset_pack:ident, $renderer:ident, $pipeline_layout:expr, $vert:expr, $frag:expr) => {
        wgpu::RenderPipelineDescriptor {
            label: None,
            layout: Some(&$pipeline_layout),
            vertex_stage: shader_module!($asset_pack, $vert),
            fragment_stage: Some(shader_module!($asset_pack, $frag)),
            rasterization_state: cull_mode_none!(),
            primitive_topology: wgpu::PrimitiveTopology::TriangleStrip,
            color_states: &$renderer.bind_group_layouts.light_pass_color_states,
            depth_stencil_state: Some(wgpu::DepthStencilStateDescriptor {
                format: wgpu::TextureFormat::Depth24PlusStencil8,
                depth_write_enabled: false,
                depth_compare: wgpu::CompareFunction::Less,
                stencil: stencil_none!(),
            }),
            vertex_state: wgpu::VertexStateDescriptor {
                index_format: wgpu::IndexFormat::Uint16,
                vertex_buffers: &[
                    instance_attributes_vertex_buffer_descriptor!(0),
                    instance_attributes_vertex_buffer_descriptor!(4),
                    instance_attributes_vertex_buffer_descriptor!(8),
                ],
            },
            sample_count: 1,
            sample_mask: !0,
            alpha_to_coverage_enabled: false,
        }
    }
}

macro_rules! align_to {
    ($dividend:expr, $divisor:expr) => (
        ($dividend+$divisor-1)/$divisor*$divisor
    )
}

macro_rules! shader_module {
    ($asset_pack:expr, $name:expr) => {wgpu::ProgrammableStageDescriptor {
        module: &$asset_pack.shader_modules[&std::path::PathBuf::from($name)],
        entry_point: "main",
    }}
}



#[repr(C)]
#[derive(Copy, Clone, Debug, Default)]
struct CameraUniforms {
    world_matrix: glam::Mat4,
    projection_matrix: glam::Mat4,
    inverse_view_matrix: glam::Mat4,
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Default)]
struct LightAttributes {
    color: glam::Vec3,
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Default)]
struct SpotLightAttributes {
    color: glam::Vec3,
    radius: f32,
    outer_angle_cos: f32,
    inner_angle_cos: f32,
}



pub struct RenderOptions {
    pub scale_factor: f32,
    pub enable_frustum_culling: bool,
    pub enable_occulsion_culling: bool,
    pub enable_shadow_mapping: bool,
}

struct AttributeAndUniformBuffers {
    camera_uniforms_buffer: wgpu::Buffer,
    instances_world_matrix_buffer: wgpu::Buffer,
    instances_inverse_world_matrix_buffer: wgpu::Buffer,
    instances_mvp_matrix_buffer: wgpu::Buffer,
    light_settings_buffer: wgpu::Buffer,
}

impl AttributeAndUniformBuffers {
    fn new(device: &wgpu::Device) -> Self {
        let camera_uniforms_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: std::mem::size_of::<CameraUniforms>() as wgpu::BufferAddress,
            usage: wgpu::BufferUsage::COPY_DST | wgpu::BufferUsage::UNIFORM,
            mapped_at_creation: false,
        });

        const MAX_INSTANCES: usize = 16;

        let instances_world_matrix_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: std::mem::size_of::<[glam::Mat4; MAX_INSTANCES]>() as wgpu::BufferAddress,
            usage: wgpu::BufferUsage::STORAGE|wgpu::BufferUsage::COPY_DST|wgpu::BufferUsage::VERTEX,
            mapped_at_creation: false,
        });

        let instances_inverse_world_matrix_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: std::mem::size_of::<[glam::Mat4; MAX_INSTANCES]>() as wgpu::BufferAddress,
            usage: wgpu::BufferUsage::STORAGE|wgpu::BufferUsage::VERTEX,
            mapped_at_creation: false,
        });

        let instances_mvp_matrix_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: std::mem::size_of::<[glam::Mat4; MAX_INSTANCES]>() as wgpu::BufferAddress,
            usage: wgpu::BufferUsage::STORAGE|wgpu::BufferUsage::VERTEX,
            mapped_at_creation: false,
        });

        let light_settings_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: std::mem::size_of::<[LightAttributes; MAX_INSTANCES]>() as wgpu::BufferAddress,
            usage: wgpu::BufferUsage::COPY_DST|wgpu::BufferUsage::VERTEX,
            mapped_at_creation: false,
        });

        Self {
            camera_uniforms_buffer,
            instances_world_matrix_buffer,
            instances_inverse_world_matrix_buffer,
            instances_mvp_matrix_buffer,
            light_settings_buffer,
        }
    }
}

pub struct BindGroupLayouts {
    pub light_pass_color_states: [wgpu::ColorStateDescriptor; 1],
    pub camera_uniforms_bind_group_layout: wgpu::BindGroupLayout,
    pub shadow_pass_bind_group_layout: wgpu::BindGroupLayout,
    pub surface_pass_bind_group_layout: wgpu::BindGroupLayout,
    pub volumetric_pass_bind_group_layout: wgpu::BindGroupLayout,
    light_pass_bind_group_layout: wgpu::BindGroupLayout,
    post_processing_pass_bind_group_layout: wgpu::BindGroupLayout,
}

impl BindGroupLayouts {
    pub fn new(device: &wgpu::Device) -> Self {
        let light_pass_color_states = [
            color_state_descriptor_blend_add!(Rgba16Float), // Color
        ];

        let camera_uniforms_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                bind_group_entry!(0, (VERTEX | FRAGMENT), CameraUniforms),
            ],
        });

        let shadow_pass_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[],
        });

        let surface_pass_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStage::FRAGMENT,
                    ty: wgpu::BindingType::Sampler {
                        comparison: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStage::FRAGMENT,
                    ty: wgpu::BindingType::SampledTexture {
                        multisampled: false,
                        dimension: wgpu::TextureViewDimension::D2,
                        component_type: wgpu::TextureComponentType::Float,
                    },
                    count: None,
                },
            ],
        });

        let volumetric_pass_bind_group_layout = device.create_bind_group_layout(&sample_attachment!(
            0 => Float, // Position
        ));

        let light_pass_bind_group_layout = device.create_bind_group_layout(&sample_attachment!(
            0 => Float, // Position
            1 => Float, // Normal
            2 => Float, // Albedo
            3 => Float, // Material
        ));

        let post_processing_pass_bind_group_layout = device.create_bind_group_layout(&sample_attachment!(
            0 => Float, // Color
            1 => Float, // Depth
        ));

        Self {
            light_pass_color_states,
            camera_uniforms_bind_group_layout,
            shadow_pass_bind_group_layout,
            surface_pass_bind_group_layout,
            volumetric_pass_bind_group_layout,
            light_pass_bind_group_layout,
            post_processing_pass_bind_group_layout,
        }
    }
}

pub struct RenderPipelines {
    general_shadow_pipeline: wgpu::RenderPipeline,
    sphere_shadow_pipeline: wgpu::RenderPipeline,
    pub surface_pass_pipeline_layout: wgpu::PipelineLayout,
    pub surface_pass_pipeline: wgpu::RenderPipeline,
    ambient_light_pipeline: wgpu::RenderPipeline,
    parallel_light_pipeline: wgpu::RenderPipeline,
    point_light_pipeline: wgpu::RenderPipeline,
    spot_light_pipeline: wgpu::RenderPipeline,
    post_processing_pass_pipeline: wgpu::RenderPipeline,
}

impl RenderPipelines {
    pub fn new(device: &wgpu::Device, bind_group_layouts: &BindGroupLayouts, render_options: &RenderOptions, asset_pack: &AssetPack) -> Self {
        let shadow_depth_stencil_state = wgpu::DepthStencilStateDescriptor {
            format: wgpu::TextureFormat::Depth32Float,
            depth_write_enabled: true,
            depth_compare: wgpu::CompareFunction::Less,
            stencil: stencil_none!(),
        };

        let shadow_pass_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[],
                bind_group_layouts: &[&bind_group_layouts.shadow_pass_bind_group_layout, &bind_group_layouts.camera_uniforms_bind_group_layout],
            });

        let general_shadow_pipeline =
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: None,
                layout: Some(&shadow_pass_pipeline_layout),
                vertex_stage: shader_module!(asset_pack, "assets/shader_modules/shadow_pass_vert"),
                fragment_stage: Some(shader_module!(asset_pack, "assets/shader_modules/shadow_pass_frag")),
                rasterization_state: Some(wgpu::RasterizationStateDescriptor {
                    front_face: wgpu::FrontFace::Ccw,
                    cull_mode: wgpu::CullMode::Front,
                    ..Default::default()
                }),
                primitive_topology: wgpu::PrimitiveTopology::TriangleStrip,
                color_states: &[],
                depth_stencil_state: Some(shadow_depth_stencil_state.clone()),
                vertex_state: wgpu::VertexStateDescriptor {
                    index_format: wgpu::IndexFormat::Uint16,
                    vertex_buffers: &[
                        instance_attributes_vertex_buffer_descriptor!(0),
                        instance_attributes_vertex_buffer_descriptor!(4),
                        instance_attributes_vertex_buffer_descriptor!(8),
                        wgpu::VertexBufferDescriptor {
                            stride: std::mem::size_of::<[f32; 8]>() as wgpu::BufferAddress,
                            step_mode: wgpu::InputStepMode::Vertex,
                            attributes: &vertex_attr_array![12 => Float3],
                        },
                    ],
                },
                sample_count: 1,
                sample_mask: !0,
                alpha_to_coverage_enabled: false,
            });

        let sphere_shadow_pipeline =
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: None,
                layout: Some(&shadow_pass_pipeline_layout),
                vertex_stage: shader_module!(asset_pack, "assets/shader_modules/sphere_billboard_vert"),
                fragment_stage: Some(shader_module!(asset_pack, "assets/shader_modules/sphere_shadow_frag")),
                rasterization_state: cull_mode_none!(),
                primitive_topology: wgpu::PrimitiveTopology::TriangleStrip,
                color_states: &[],
                depth_stencil_state: Some(shadow_depth_stencil_state.clone()),
                vertex_state: wgpu::VertexStateDescriptor {
                    index_format: wgpu::IndexFormat::Uint16,
                    vertex_buffers: &[
                        instance_attributes_vertex_buffer_descriptor!(0),
                        instance_attributes_vertex_buffer_descriptor!(4),
                        instance_attributes_vertex_buffer_descriptor!(8),
                    ],
                },
                sample_count: 1,
                sample_mask: !0,
                alpha_to_coverage_enabled: false,
            });

        let surface_pass_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[],
                bind_group_layouts: &[&bind_group_layouts.surface_pass_bind_group_layout, &bind_group_layouts.camera_uniforms_bind_group_layout],
            });

        let surface_pass_pipeline =
            device.create_render_pipeline(&surface_pass_pipeline_descriptor!(
                asset_pack,
                surface_pass_pipeline_layout,
                "assets/shader_modules/surface_pass_vert",
                "assets/shader_modules/surface_pass_frag",
                Back,
                TriangleList,
                wgpu::VertexStateDescriptor {
                    index_format: wgpu::IndexFormat::Uint16,
                    vertex_buffers: &[
                        instance_attributes_vertex_buffer_descriptor!(0),
                        instance_attributes_vertex_buffer_descriptor!(4),
                        instance_attributes_vertex_buffer_descriptor!(8),
                        wgpu::VertexBufferDescriptor {
                            stride: std::mem::size_of::<[f32; 8]>() as wgpu::BufferAddress,
                            step_mode: wgpu::InputStepMode::Vertex,
                            attributes: &vertex_attr_array![12 => Float3, 13 => Float3, 14 => Float2],
                        },
                    ],
                }
            ));

        let light_pass_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[],
                bind_group_layouts: &[&bind_group_layouts.light_pass_bind_group_layout, &bind_group_layouts.camera_uniforms_bind_group_layout],
            });

        let light_pass_depth_stencil_state = wgpu::DepthStencilStateDescriptor {
            format: wgpu::TextureFormat::Depth24PlusStencil8,
            depth_write_enabled: false,
            depth_compare: wgpu::CompareFunction::GreaterEqual,
            stencil: stencil_none!(),
        };

        let ambient_light_pipeline =
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: None,
                layout: Some(&light_pass_pipeline_layout),
                vertex_stage: shader_module!(asset_pack, "assets/shader_modules/screen_quad_vert"),
                fragment_stage: Some(shader_module!(asset_pack, "assets/shader_modules/ambient_light_frag")),
                rasterization_state: cull_mode_none!(),
                primitive_topology: wgpu::PrimitiveTopology::TriangleStrip,
                color_states: &bind_group_layouts.light_pass_color_states,
                depth_stencil_state: Some(wgpu::DepthStencilStateDescriptor {
                    format: wgpu::TextureFormat::Depth24PlusStencil8,
                    depth_write_enabled: false,
                    depth_compare: wgpu::CompareFunction::Always,
                    stencil: stencil_none!(),
                }),
                vertex_state: wgpu::VertexStateDescriptor {
                    index_format: wgpu::IndexFormat::Uint16,
                    vertex_buffers: &[],
                },
                sample_count: 1,
                sample_mask: !0,
                alpha_to_coverage_enabled: false,
            });

        let parallel_light_pipeline =
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: None,
                layout: Some(&light_pass_pipeline_layout),
                vertex_stage: shader_module!(asset_pack, "assets/shader_modules/parallel_light_vert"),
                fragment_stage: Some(shader_module!(asset_pack, "assets/shader_modules/parallel_light_frag")),
                rasterization_state: Some(wgpu::RasterizationStateDescriptor {
                    front_face: wgpu::FrontFace::Ccw,
                    cull_mode: wgpu::CullMode::Front,
                    ..Default::default()
                }),
                primitive_topology: wgpu::PrimitiveTopology::TriangleList,
                color_states: &bind_group_layouts.light_pass_color_states,
                depth_stencil_state: Some(light_pass_depth_stencil_state.clone()),
                vertex_state: wgpu::VertexStateDescriptor {
                    index_format: wgpu::IndexFormat::Uint16,
                    vertex_buffers: &[
                        instance_attributes_vertex_buffer_descriptor!(0),
                        instance_attributes_vertex_buffer_descriptor!(4),
                        instance_attributes_vertex_buffer_descriptor!(8),
                        wgpu::VertexBufferDescriptor {
                            stride: std::mem::size_of::<LightAttributes>() as wgpu::BufferAddress,
                            step_mode: wgpu::InputStepMode::Instance,
                            attributes: &vertex_attr_array![12 => Float3],
                        }, wgpu::VertexBufferDescriptor {
                            stride: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                            step_mode: wgpu::InputStepMode::Vertex,
                            attributes: &vertex_attr_array![13 => Float3],
                        },
                    ],
                },
                sample_count: 1,
                sample_mask: !0,
                alpha_to_coverage_enabled: false,
            });

        let point_light_pipeline =
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: None,
                layout: Some(&light_pass_pipeline_layout),
                vertex_stage: shader_module!(asset_pack, "assets/shader_modules/point_light_vert"),
                fragment_stage: Some(shader_module!(asset_pack, "assets/shader_modules/point_light_frag")),
                rasterization_state: cull_mode_none!(),
                primitive_topology: wgpu::PrimitiveTopology::TriangleStrip,
                color_states: &bind_group_layouts.light_pass_color_states,
                depth_stencil_state: Some(wgpu::DepthStencilStateDescriptor {
                    format: wgpu::TextureFormat::Depth24PlusStencil8,
                    depth_write_enabled: false,
                    depth_compare: wgpu::CompareFunction::Always,
                    stencil: stencil_none!(),
                }),
                vertex_state: wgpu::VertexStateDescriptor {
                    index_format: wgpu::IndexFormat::Uint16,
                    vertex_buffers: &[
                        instance_attributes_vertex_buffer_descriptor!(0),
                        instance_attributes_vertex_buffer_descriptor!(4),
                        instance_attributes_vertex_buffer_descriptor!(8),
                        wgpu::VertexBufferDescriptor {
                            stride: std::mem::size_of::<LightAttributes>() as wgpu::BufferAddress,
                            step_mode: wgpu::InputStepMode::Instance,
                            attributes: &vertex_attr_array![12 => Float3],
                        },
                    ],
                },
                sample_count: 1,
                sample_mask: !0,
                alpha_to_coverage_enabled: false,
            });

        let spot_light_pipeline =
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: None,
                layout: Some(&light_pass_pipeline_layout),
                vertex_stage: shader_module!(asset_pack, "assets/shader_modules/spot_light_vert"),
                fragment_stage: Some(shader_module!(asset_pack, "assets/shader_modules/spot_light_frag")),
                rasterization_state: Some(wgpu::RasterizationStateDescriptor {
                    front_face: wgpu::FrontFace::Ccw,
                    cull_mode: wgpu::CullMode::Front,
                    ..Default::default()
                }),
                primitive_topology: wgpu::PrimitiveTopology::TriangleList,
                color_states: &bind_group_layouts.light_pass_color_states,
                depth_stencil_state: Some(light_pass_depth_stencil_state),
                vertex_state: wgpu::VertexStateDescriptor {
                    index_format: wgpu::IndexFormat::Uint16,
                    vertex_buffers: &[
                        instance_attributes_vertex_buffer_descriptor!(0),
                        instance_attributes_vertex_buffer_descriptor!(4),
                        instance_attributes_vertex_buffer_descriptor!(8),
                        wgpu::VertexBufferDescriptor {
                            stride: std::mem::size_of::<SpotLightAttributes>() as wgpu::BufferAddress,
                            step_mode: wgpu::InputStepMode::Instance,
                            attributes: &vertex_attr_array![12 => Float3, 13 => Float, 14 => Float, 15 => Float],
                        }, wgpu::VertexBufferDescriptor {
                            stride: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                            step_mode: wgpu::InputStepMode::Vertex,
                            attributes: &vertex_attr_array![16 => Float3],
                        },
                    ],
                },
                sample_count: 1,
                sample_mask: !0,
                alpha_to_coverage_enabled: false,
            });

        let post_processing_pass_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[],
                bind_group_layouts: &[&bind_group_layouts.post_processing_pass_bind_group_layout],
            });

        let post_processing_pass_pipeline =
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: None,
                layout: Some(&post_processing_pass_pipeline_layout),
                vertex_stage: shader_module!(asset_pack, "assets/shader_modules/screen_quad_vert"),
                fragment_stage: Some(shader_module!(asset_pack, "assets/shader_modules/post_processing_pass_frag")),
                rasterization_state: cull_mode_none!(),
                primitive_topology: wgpu::PrimitiveTopology::TriangleStrip,
                color_states: &[
                    color_state_descriptor_blend_none!(Bgra8UnormSrgb), // Color
                ],
                depth_stencil_state: None,
                vertex_state: wgpu::VertexStateDescriptor {
                    index_format: wgpu::IndexFormat::Uint16,
                    vertex_buffers: &[],
                },
                sample_count: 1,
                sample_mask: !0,
                alpha_to_coverage_enabled: false,
            });

        Self {
            general_shadow_pipeline,
            sphere_shadow_pipeline,
            surface_pass_pipeline_layout,
            surface_pass_pipeline,
            ambient_light_pipeline,
            parallel_light_pipeline,
            point_light_pipeline,
            spot_light_pipeline,
            post_processing_pass_pipeline,
        }
    }
}

struct ComputePipelines {
    instance_matrices_bind_group: wgpu::BindGroup,
    instance_matrices_pipeline: wgpu::ComputePipeline,
    mvp_matrix_bind_group: wgpu::BindGroup,
    mvp_matrix_pipeline: wgpu::ComputePipeline,
}

impl ComputePipelines {
    fn new(device: &wgpu::Device, buffers: &AttributeAndUniformBuffers, asset_pack: &AssetPack) -> Self {
        let instance_matrices_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStage::COMPUTE,
                    ty: wgpu::BindingType::StorageBuffer {
                        dynamic: false,
                        min_binding_size: wgpu::BufferSize::new(std::mem::size_of::<glam::Mat4>() as u64),
                        readonly: true,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStage::COMPUTE,
                    ty: wgpu::BindingType::StorageBuffer {
                        dynamic: false,
                        min_binding_size: wgpu::BufferSize::new(std::mem::size_of::<glam::Mat4>() as u64),
                        readonly: false,
                    },
                    count: None,
                },
            ],
        });

        let instance_matrices_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &instance_matrices_bind_group_layout,
            0 => Buffer(buffers.instances_world_matrix_buffer.slice(..)),
            1 => Buffer(buffers.instances_inverse_world_matrix_buffer.slice(..)),
        ));

        let instance_matrices_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[],
                bind_group_layouts: &[&instance_matrices_bind_group_layout],
            });

        let instance_matrices_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: None,
            layout: Some(&instance_matrices_pipeline_layout),
            compute_stage: shader_module!(asset_pack, "assets/shader_modules/compute_instance_matrices_comp"),
        });

        let mvp_matrix_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStage::COMPUTE,
                    ty: wgpu::BindingType::StorageBuffer {
                        dynamic: false,
                        min_binding_size: wgpu::BufferSize::new(std::mem::size_of::<glam::Mat4>() as u64),
                        readonly: true,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStage::COMPUTE,
                    ty: wgpu::BindingType::StorageBuffer {
                        dynamic: false,
                        min_binding_size: wgpu::BufferSize::new(std::mem::size_of::<glam::Mat4>() as u64),
                        readonly: false,
                    },
                    count: None,
                },
            ],
        });

        let mvp_matrix_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &mvp_matrix_bind_group_layout,
            0 => Buffer(buffers.instances_world_matrix_buffer.slice(..)),
            1 => Buffer(buffers.instances_mvp_matrix_buffer.slice(..)),
        ));

        let mvp_matrix_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[
                    wgpu::PushConstantRange {
                        stages: wgpu::ShaderStage::COMPUTE,
                        range: 0..std::mem::size_of::<glam::Mat4>() as u32,
                    }
                ],
                bind_group_layouts: &[&mvp_matrix_bind_group_layout],
            });

        let mvp_matrix_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: None,
            layout: Some(&mvp_matrix_pipeline_layout),
            compute_stage: shader_module!(asset_pack, "assets/shader_modules/compute_mvp_matrix_comp"),
        });

        Self {
            instance_matrices_bind_group,
            instance_matrices_pipeline,
            mvp_matrix_bind_group,
            mvp_matrix_pipeline,
        }
    }
}

struct GBuffer {
    size: wgpu::Extent3d,
    position_view: wgpu::TextureView,
    normal_view: wgpu::TextureView,
    albedo_view: wgpu::TextureView,
    material_view: wgpu::TextureView,
    color_view: wgpu::TextureView,
    depth_stencil_view: wgpu::TextureView,
    depth_view: wgpu::TextureView,
    stencil_view: wgpu::TextureView,
    volumetric_pass_bind_group: wgpu::BindGroup,
    light_pass_bind_group: wgpu::BindGroup,
    post_processing_pass_bind_group: wgpu::BindGroup,
}

impl GBuffer {
    fn new(device: &wgpu::Device, bind_group_layouts: &BindGroupLayouts, size: wgpu::Extent3d) -> Self {
        let texture_view_descriptor = wgpu::TextureViewDescriptor {
            ..wgpu::TextureViewDescriptor::default()
        };

        let position_buffer = device.create_texture(&create_attachment!(size, Rgba32Float));
        let position_view = position_buffer.create_view(&texture_view_descriptor);

        let normal_buffer = device.create_texture(&create_attachment!(size, Rgba16Sint));
        let normal_view = normal_buffer.create_view(&texture_view_descriptor);

        let albedo_buffer = device.create_texture(&create_attachment!(size, Rgba16Float));
        let albedo_view = albedo_buffer.create_view(&texture_view_descriptor);

        let material_buffer = device.create_texture(&create_attachment!(size, Rgba8Unorm));
        let material_view = material_buffer.create_view(&texture_view_descriptor);

        let color_buffer = device.create_texture(&create_attachment!(size, Rgba16Float));
        let color_view = color_buffer.create_view(&texture_view_descriptor);

        let depth_stencil_buffer = device.create_texture(&create_attachment!(size, Depth24PlusStencil8));
        let depth_stencil_view = depth_stencil_buffer.create_view(&texture_view_descriptor);
        let depth_view = depth_stencil_buffer.create_view(&wgpu::TextureViewDescriptor {
            aspect: wgpu::TextureAspect::DepthOnly,
            ..wgpu::TextureViewDescriptor::default()
        });
        let stencil_view = depth_stencil_buffer.create_view(&wgpu::TextureViewDescriptor {
            aspect: wgpu::TextureAspect::StencilOnly,
            ..wgpu::TextureViewDescriptor::default()
        });

        let volumetric_pass_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &bind_group_layouts.volumetric_pass_bind_group_layout,
            0 => TextureView(&position_view),
        ));

        let light_pass_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &bind_group_layouts.light_pass_bind_group_layout,
            0 => TextureView(&position_view),
            1 => TextureView(&normal_view),
            2 => TextureView(&albedo_view),
            3 => TextureView(&material_view),
        ));

        let post_processing_pass_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &bind_group_layouts.post_processing_pass_bind_group_layout,
            0 => TextureView(&color_view),
            1 => TextureView(&depth_view),
        ));

        Self {
            size,
            position_view,
            normal_view,
            albedo_view,
            material_view,
            color_view,
            depth_stencil_view,
            depth_view,
            stencil_view,
            volumetric_pass_bind_group,
            light_pass_bind_group,
            post_processing_pass_bind_group,
        }
    }
}

pub struct Renderer {
    pub sampler: wgpu::Sampler,
    buffers: AttributeAndUniformBuffers,
    pub bind_group_layouts: BindGroupLayouts,
    pub render_pipelines: RenderPipelines,
    compute_pipelines: ComputePipelines,
    gbuffer: GBuffer,
    camera_uniforms_bind_group: wgpu::BindGroup,
    parallel_light_mesh: crate::assets::Mesh,
    spot_light_mesh: crate::assets::Mesh,
}

impl Renderer {
    pub fn new(device: &wgpu::Device, swap_chain_descriptor: &wgpu::SwapChainDescriptor, render_options: &RenderOptions, asset_pack: &AssetPack) -> Self {
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: None,
            address_mode_u: wgpu::AddressMode::Repeat,
            address_mode_v: wgpu::AddressMode::Repeat,
            address_mode_w: wgpu::AddressMode::Repeat,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            lod_min_clamp: 0.0,
            lod_max_clamp: std::f32::INFINITY,
            compare: None, // wgpu::CompareFunction::LessEqual
            anisotropy_clamp: None, // std::num::NonZeroU8::new(16),
        });
        let buffers = AttributeAndUniformBuffers::new(device);
        let bind_group_layouts = BindGroupLayouts::new(device);
        let render_pipelines = RenderPipelines::new(device, &bind_group_layouts, render_options, asset_pack);
        let compute_pipelines = ComputePipelines::new(&device, &buffers, asset_pack);
        let size = wgpu::Extent3d { width: swap_chain_descriptor.width, height: swap_chain_descriptor.height, depth: 1 };
        let gbuffer = GBuffer::new(device, &bind_group_layouts, size);
        let camera_uniforms_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &bind_group_layouts.camera_uniforms_bind_group_layout,
            0 => Buffer(buffers.camera_uniforms_buffer.slice(0..std::mem::size_of::<CameraUniforms>() as wgpu::BufferAddress)),
        ));
        Self {
            sampler,
            buffers,
            bind_group_layouts,
            render_pipelines,
            compute_pipelines,
            gbuffer,
            camera_uniforms_bind_group,
            parallel_light_mesh: crate::assets::Mesh::new_light_cube(device, true),
            spot_light_mesh: crate::assets::Mesh::new_light_cone(device, 8),
        }
    }

    pub fn resize(&mut self, device: &wgpu::Device, swap_chain_descriptor: &wgpu::SwapChainDescriptor) {
        let size = wgpu::Extent3d { width: swap_chain_descriptor.width, height: swap_chain_descriptor.height, depth: 1 };
        self.gbuffer = GBuffer::new(&device, &self.bind_group_layouts, size);
    }

    pub fn apply_render_options(&mut self, device: &wgpu::Device, render_options: &RenderOptions, asset_pack: &AssetPack) {
        self.render_pipelines = RenderPipelines::new(&device, &self.bind_group_layouts, render_options, asset_pack);
    }

    pub fn update_instances<'a>(&'a self, encoder: &'a mut wgpu::CommandEncoder, queue: &wgpu::Queue, world_matrices: &[glam::Mat4]) {
        let data = unsafe { std::slice::from_raw_parts(world_matrices.as_ptr() as *const u8, world_matrices.len()*std::mem::size_of::<glam::Mat4>()) };
        queue.write_buffer(&self.buffers.instances_world_matrix_buffer, 0, data);

        let mut pass = encoder.begin_compute_pass();
        pass.set_pipeline(&self.compute_pipelines.instance_matrices_pipeline);
        pass.set_bind_group(0, &self.compute_pipelines.instance_matrices_bind_group, &[]);
        let x_work_group_count = 32;
        pass.dispatch((world_matrices.len() as u32+x_work_group_count-1)/x_work_group_count, 1, 1);

        let mut light_settings_buffer = [LightAttributes::default(); 4];
        let spot_light_settings = unsafe { crate::transmute_slice_mut::<LightAttributes, SpotLightAttributes>(&mut light_settings_buffer[0..2]) };
        spot_light_settings[0] = SpotLightAttributes {
            color: glam::Vec3::splat(1.0),
            radius: 2.0,
            outer_angle_cos: (std::f32::consts::PI*0.25).cos(),
            inner_angle_cos: (std::f32::consts::PI*0.2).cos(),
        };
        light_settings_buffer[2] = LightAttributes {
            color: glam::Vec3::splat(1.0),
        };
        light_settings_buffer[3] = LightAttributes {
            color: glam::Vec3::splat(0.8),
        };
        queue.write_buffer(&self.buffers.light_settings_buffer, 0, unsafe { crate::transmute_slice::<LightAttributes, u8>(&light_settings_buffer[..]) });
    }

    pub fn update_camera<'a>(&'a self, encoder: &'a mut wgpu::CommandEncoder, queue: &wgpu::Queue, instance_count: usize, camera: &crate::camera::Camera) {
        let camera_uniforms = CameraUniforms {
            world_matrix: camera.get_world_matrix(),
            projection_matrix: camera.get_projection_matrix(),
            inverse_view_matrix: camera.get_inverse_view_matrix(),
        };
        let data = unsafe { std::slice::from_raw_parts(&camera_uniforms as *const _ as *const u8, std::mem::size_of::<CameraUniforms>()) };
        queue.write_buffer(&self.buffers.camera_uniforms_buffer, 0, data);

        let mut pass = encoder.begin_compute_pass();
        pass.set_pipeline(&self.compute_pipelines.mvp_matrix_pipeline);
        let camera_uniforms = camera.get_view_matrix().to_cols_array();
        pass.set_push_constants(0, unsafe { crate::transmute_slice::<f32, u32>(&camera_uniforms[..]) });
        pass.set_bind_group(0, &self.compute_pipelines.mvp_matrix_bind_group, &[]);
        let x_work_group_count = 32;
        pass.dispatch((instance_count as u32+x_work_group_count-1)/x_work_group_count, 1, 1);
    }

    pub fn render_surface_pass<'a>(&'a self, encoder: &'a mut wgpu::CommandEncoder) -> wgpu::RenderPass<'a> {
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            color_attachments: &[
                clear_attachment!(&self.gbuffer.position_view, (0.0, 0.0, 0.0, 0.0)),
                clear_attachment!(&self.gbuffer.normal_view, (0.0, 0.0, 0.0, 0.0)),
                clear_attachment!(&self.gbuffer.albedo_view, (0.0, 0.0, 0.0, 0.0)),
                clear_attachment!(&self.gbuffer.material_view, (0.0, 0.0, 0.0, 0.0)),
            ],
            depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachmentDescriptor {
                attachment: &self.gbuffer.depth_stencil_view,
                depth_ops: Some(wgpu::Operations {
                    load: wgpu::LoadOp::Clear(1.0),
                    store: true,
                }),
                stencil_ops: None,
            }),
        });
        // render_pass.set_viewport(0.0, 0.0, self.size.width as f32, self.size.height as f32, 0.0, 1.0);
        render_pass.set_bind_group(1, &self.camera_uniforms_bind_group, &[]);
        render_pass.set_vertex_buffer(0, self.buffers.instances_world_matrix_buffer.slice(..));
        render_pass.set_vertex_buffer(1, self.buffers.instances_inverse_world_matrix_buffer.slice(..));
        render_pass.set_vertex_buffer(2, self.buffers.instances_mvp_matrix_buffer.slice(..));
        render_pass
    }

    pub fn render_volumetric_pass<'a>(&'a self, encoder: &'a mut wgpu::CommandEncoder) -> wgpu::RenderPass<'a> {
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            color_attachments: &[
                clear_attachment!(&self.gbuffer.color_view, (0.0, 0.0, 0.0, 0.0)),
            ],
            depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachmentDescriptor {
                attachment: &self.gbuffer.depth_view,
                depth_ops: Some(wgpu::Operations {
                    load: wgpu::LoadOp::Load,
                    store: false,
                }),
                stencil_ops: None,
            }),
        });
        render_pass.set_vertex_buffer(0, self.buffers.instances_world_matrix_buffer.slice(..));
        render_pass.set_vertex_buffer(1, self.buffers.instances_inverse_world_matrix_buffer.slice(..));
        render_pass.set_vertex_buffer(2, self.buffers.instances_mvp_matrix_buffer.slice(..));
        render_pass.set_bind_group(0, &self.gbuffer.volumetric_pass_bind_group, &[]);
        render_pass.set_bind_group(1, &self.camera_uniforms_bind_group, &[]);
        render_pass
    }

    pub fn render_frame(&self, encoder: &mut wgpu::CommandEncoder, frame_view: &wgpu::TextureView) {
        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                color_attachments: &[
                    load_attachment!(&self.gbuffer.color_view),
                ],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachmentDescriptor {
                    attachment: &self.gbuffer.depth_stencil_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: false,
                    }),
                    stencil_ops: None,
                }),
            });
            render_pass.set_vertex_buffer(0, self.buffers.instances_world_matrix_buffer.slice(..));
            render_pass.set_vertex_buffer(1, self.buffers.instances_inverse_world_matrix_buffer.slice(..));
            render_pass.set_vertex_buffer(2, self.buffers.instances_mvp_matrix_buffer.slice(..));

            render_pass.set_pipeline(&self.render_pipelines.ambient_light_pipeline);
            render_pass.set_bind_group(0, &self.gbuffer.light_pass_bind_group, &[]);
            render_pass.set_bind_group(1, &self.camera_uniforms_bind_group, &[]);
            render_pass.draw(0..4 as u32, 0..1);

            render_pass.set_pipeline(&self.render_pipelines.spot_light_pipeline);
            render_pass.set_vertex_buffer(3, self.buffers.light_settings_buffer.slice(0..std::mem::size_of::<SpotLightAttributes>() as wgpu::BufferAddress*1));
            self.spot_light_mesh.render(&mut render_pass, 0..1);

            render_pass.set_pipeline(&self.render_pipelines.point_light_pipeline);
            render_pass.set_vertex_buffer(3, self.buffers.light_settings_buffer.slice(std::mem::size_of::<LightAttributes>() as wgpu::BufferAddress*1..));
            render_pass.draw(0..4 as u32, 1..2);

            render_pass.set_pipeline(&self.render_pipelines.parallel_light_pipeline);
            self.parallel_light_mesh.render(&mut render_pass, 2..3);
        }

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                color_attachments: &[
                    load_attachment!(&frame_view),
                ],
                depth_stencil_attachment: None,
            });
            render_pass.set_pipeline(&self.render_pipelines.post_processing_pass_pipeline);
            render_pass.set_bind_group(0, &self.gbuffer.post_processing_pass_bind_group, &[]);
            render_pass.draw(0..4 as u32, 0..1);
        }
    }
}
