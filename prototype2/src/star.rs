#![allow(dead_code)]

use iced_wgpu::{wgpu, wgpu::vertex_attr_array};

pub struct StarRenderer {
    surface_pipeline: wgpu::RenderPipeline,
    surface_bind_group_layout: wgpu::BindGroupLayout,
    surface_bind_group: wgpu::BindGroup,
    atmosphere_pipeline: wgpu::RenderPipeline,
}

impl StarRenderer {
    pub fn new(device: &wgpu::Device, renderer: &crate::renderer::Renderer, asset_pack: &crate::assets::AssetPack) -> Self {
        let surface_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[],
        });

        let surface_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[],
                bind_group_layouts: &[&surface_bind_group_layout, &renderer.bind_group_layouts.camera_uniforms_bind_group_layout],
            });

        let surface_pipeline = device.create_render_pipeline(&surface_pass_pipeline_descriptor!(
            asset_pack,
            surface_pipeline_layout,
            "assets/shader_modules/uv_sphere_billboard_vert",
            "assets/shader_modules/star_surface_frag",
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

        let surface_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &surface_bind_group_layout,
        ));

        let atmosphere_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[],
                bind_group_layouts: &[
                    &renderer.bind_group_layouts.volumetric_pass_bind_group_layout,
                    &renderer.bind_group_layouts.camera_uniforms_bind_group_layout,
                ],
            });

        let atmosphere_pipeline =
            device.create_render_pipeline(&volumetric_pass_pipeline_descriptor!(
                asset_pack, renderer,
                atmosphere_pipeline_layout,
                "assets/shader_modules/sphere_billboard_vert",
                "assets/shader_modules/star_atmosphere_frag"
            ));

        Self {
            surface_pipeline,
            surface_bind_group_layout,
            surface_bind_group,
            atmosphere_pipeline,
        }
    }

    pub fn render_surface<'a>(&'a self, render_pass: &mut wgpu::RenderPass<'a>, instances_indices: std::ops::Range<u32>) {
        render_pass.set_pipeline(&self.surface_pipeline);
        render_pass.set_bind_group(0, &self.surface_bind_group, &[]);
        render_pass.draw(0..4 as u32, instances_indices);
    }

    pub fn render_atmosphere<'a>(&'a self, render_pass: &mut wgpu::RenderPass<'a>, instances_indices: std::ops::Range<u32>) {
        render_pass.set_pipeline(&self.atmosphere_pipeline);
        render_pass.draw(0..4 as u32, instances_indices);
    }
}
