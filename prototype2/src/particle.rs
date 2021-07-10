#![allow(dead_code)]

use iced_wgpu::{wgpu, wgpu::vertex_attr_array};
use rand::{rngs::SmallRng, Rng, SeedableRng};

#[repr(C)]
#[derive(Copy, Clone, Debug, Default)]
pub struct ParticleAttributes {
    position: glam::Vec3,
    radius: f32,
    color: glam::Vec4,
}

pub struct ParticleSystem {
    particle_count: usize,
    particle_buffer: wgpu::Buffer,
    particle_system_bind_group: wgpu::BindGroup,
}

impl ParticleSystem {
    pub fn new(device: &wgpu::Device, particle_renderer: &ParticleRenderer, particle_count: usize) -> Self {
        let particle_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: (std::mem::size_of::<ParticleAttributes>()*particle_count) as wgpu::BufferAddress,
            usage: wgpu::BufferUsage::STORAGE|wgpu::BufferUsage::COPY_DST|wgpu::BufferUsage::VERTEX,
            mapped_at_creation: false,
        });

        let particle_system_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &particle_renderer.particle_system_bind_group_layout,
            0 => Buffer(particle_buffer.slice(..)),
        ));

        Self {
            particle_count,
            particle_buffer,
            particle_system_bind_group,
        }
    }

    pub fn generate_clouds(&self, queue: &wgpu::Queue, matrices: &[glam::Mat4]) {
        let mut prng = SmallRng::from_seed([0; 16]);
        let mut particle_attributes = vec![ParticleAttributes::default(); self.particle_count];
        let particles_per_cloud = self.particle_count/matrices.len();
        for j in 0..matrices.len() {
            for i in 0..particles_per_cloud {
                let angle = prng.gen::<f32>()*std::f32::consts::PI*2.0;
                let dist = prng.gen::<f32>()*1.1;
                let mut particle = &mut particle_attributes[j*particles_per_cloud+i];
                particle.position = (matrices[j]*glam::Vec4::new(angle.cos()*dist, 2.0+(prng.gen::<f32>()-0.5).max(0.0), angle.sin()*dist*0.5, 1.0)).truncate().into();
                particle.radius = 0.3;
                particle.color = glam::Vec4::new(1.0, 1.0, 1.0, 0.0);
            }
        }
        let data = unsafe { std::slice::from_raw_parts(particle_attributes.as_ptr() as *const _ as *const u8, std::mem::size_of::<ParticleAttributes>()*self.particle_count) };
        queue.write_buffer(&self.particle_buffer, 0, data);
    }
}

pub struct ParticleRenderer {
    surface_pipeline: wgpu::RenderPipeline,
    surface_bind_group_layout: wgpu::BindGroupLayout,
    surface_bind_group: wgpu::BindGroup,
    particle_system_bind_group_layout: wgpu::BindGroupLayout,
}

impl ParticleRenderer {
    pub fn new(device: &wgpu::Device, renderer: &crate::renderer::Renderer, asset_pack: &crate::assets::AssetPack) -> Self {
        let surface_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[],
        });

        let surface_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &surface_bind_group_layout,
        ));

        let particle_system_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStage::VERTEX,
                    ty: wgpu::BindingType::StorageBuffer {
                        dynamic: false,
                        min_binding_size: wgpu::BufferSize::new(std::mem::size_of::<ParticleAttributes>() as u64),
                        readonly: true,
                    },
                    count: None,
                },
            ],
        });

        let surface_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[],
                bind_group_layouts: &[&surface_bind_group_layout, &renderer.bind_group_layouts.camera_uniforms_bind_group_layout, &particle_system_bind_group_layout],
            });

        let surface_pipeline = device.create_render_pipeline(&surface_pass_pipeline_descriptor!(
            asset_pack,
            surface_pipeline_layout,
            "assets/shader_modules/particle_vert",
            "assets/shader_modules/particle_frag",
            None,
            TriangleStrip,
            wgpu::VertexStateDescriptor {
                index_format: wgpu::IndexFormat::Uint16,
                vertex_buffers: &[
                    instance_attributes_vertex_buffer_descriptor!(0),
                    instance_attributes_vertex_buffer_descriptor!(4),
                    instance_attributes_vertex_buffer_descriptor!(8),
                ],
            }
        ));

        Self {
            surface_pipeline,
            surface_bind_group_layout,
            surface_bind_group,
            particle_system_bind_group_layout,
        }
    }

    pub fn render_surface<'a>(&'a self, render_pass: &mut wgpu::RenderPass<'a>, particle_system: &'a ParticleSystem, instances_indices: std::ops::Range<u32>) {
        render_pass.set_pipeline(&self.surface_pipeline);
        render_pass.set_bind_group(0, &self.surface_bind_group, &[]);
        render_pass.set_bind_group(2, &particle_system.particle_system_bind_group, &[]);
        render_pass.draw(0..(particle_system.particle_count*4) as u32, instances_indices);
    }
}
