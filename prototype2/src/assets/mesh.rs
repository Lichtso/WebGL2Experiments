use iced_wgpu::{wgpu, wgpu::util::DeviceExt};

#[repr(C)]
#[derive(Copy, Clone, Debug, Default)]
pub struct Vertex {
    pub position: glam::Vec3,
    pub normal: glam::Vec3,
    pub texcoord: glam::Vec2,
}

pub struct Mesh {
    pub bind_group: Option<wgpu::BindGroup>,
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    index_count: usize,
    bounding_volume: crate::bounding_volume::BoundingVolume,
}

impl Mesh {
    pub fn new(device: &wgpu::Device, vertices: &[u8], indices: &[u8], index_count: usize, bounding_volume: crate::bounding_volume::BoundingVolume, bind_group: Option<wgpu::BindGroup>) -> Self {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: None,
            contents: vertices,
            usage: wgpu::BufferUsage::VERTEX,
        });
        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: None,
            contents: indices,
            usage: wgpu::BufferUsage::INDEX,
        });
        Self {
            bind_group,
            vertex_buffer,
            index_buffer,
            index_count,
            bounding_volume,
        }
    }

    /*pub fn new_test_triangle(device: &wgpu::Device) -> Self {
        let vertices: &[Vertex] = &[
            Vertex { position: glam::Vec3::new(0.0, 0.5, 0.0), normal: glam::Vec3::new(0.0, 0.0, 1.0), texcoord: glam::Vec2::new(0.5, 1.0) },
            Vertex { position: glam::Vec3::new(-0.5, -0.5, 0.0), normal: glam::Vec3::new(0.0, 0.0, 1.0), texcoord: glam::Vec2::new(0.0, 0.0) },
            Vertex { position: glam::Vec3::new(0.5, -0.5, 0.0), normal: glam::Vec3::new(0.0, 0.0, 1.0), texcoord: glam::Vec2::new(1.0, 0.0) },
        ];
        let indices: &[u16] = &[
            0, 1, 2,
        ];
        Self::new(device, unsafe { crate::transmute_slice::<_, u8>(vertices) }, unsafe { crate::transmute_slice::<_, u8>(indices) }, 3, None)
    }*/

    fn from_positions_only(device: &wgpu::Device, vertices: &[glam::Vec3], indices: &[u16], bounding_volume: crate::bounding_volume::BoundingVolume) -> Self {
        Self::new(device, unsafe { crate::transmute_slice::<_, u8>(vertices) }, unsafe { crate::transmute_slice::<_, u8>(indices) }, indices.len(), bounding_volume, None)
    }

    pub fn new_light_cube(device: &wgpu::Device, half_z: bool) -> Self {
        let max_z = if half_z { 0.0 } else { 1.0 };
        let mut vertices: [glam::Vec3; 8] = [glam::Vec3::default(); 8];
        for i in 0..8 {
            vertices[i] = glam::Vec3::new(
                if i%2 < 1 { -1.0 } else { 1.0 },
                if i%4 < 2 { -1.0 } else { 1.0 },
                if i%8 < 4 { -1.0 } else { max_z }
            );
        }
        let indices: [u16; 36] = [
            0, 4, 2, 2, 4, 6,
            3, 5, 1, 7, 5, 3,
            0, 1, 4, 1, 5, 4,
            6, 3, 2, 6, 7, 3,
            2, 1, 0, 1, 2, 3,
            4, 5, 6, 7, 6, 5,
        ];
        let bounding_volume = crate::bounding_volume::BoundingVolume::Box(crate::bounding_volume::BoundingBox {
            min: glam::Vec3A::new(-1.0, -1.0, -1.0),
            max: glam::Vec3A::new(1.0, 1.0, max_z),
        });
        Self::from_positions_only(device, &vertices, &indices, bounding_volume)
    }

    pub fn new_light_cone(device: &wgpu::Device, circle_resolution: usize) -> Self {
        let mut vertices: Vec<glam::Vec3> = Vec::with_capacity(1+circle_resolution);
        vertices.push(glam::Vec3::default());
        for i in 0..circle_resolution {
            let angle = i as f32/circle_resolution as f32*std::f32::consts::PI*2.0;
            vertices.push(glam::Vec3::new(f32::cos(angle), f32::sin(angle), -1.0));
        }
        let mut indices: Vec<u16> = Vec::with_capacity((circle_resolution*2-2)*3);
        for i in 0..circle_resolution {
            indices.push(0);
            indices.push(1+i as u16);
            indices.push(1+((i+1)%circle_resolution) as u16);
        }
        for i in 1..circle_resolution-1 {
            indices.push(1);
            indices.push(1+((i+1)%circle_resolution) as u16);
            indices.push(1+i as u16);
        }
        let bounding_volume = crate::bounding_volume::BoundingVolume::Cone(crate::bounding_volume::BoundingCone {
            near: 0.0,
            far: 1.0,
            radius_at_far: 1.0,
        });
        Self::from_positions_only(device, &vertices, &indices, bounding_volume)
    }

    pub fn render<'a>(&'a self, render_pass: &mut wgpu::RenderPass<'a>, instances_indices: std::ops::Range<u32>) {
        if let Some(bind_group) = &self.bind_group {
            render_pass.set_bind_group(0, bind_group, &[]);
        }
        render_pass.set_vertex_buffer(if self.bind_group.is_some() { 3 } else { 4 }, self.vertex_buffer.slice(..));
        render_pass.set_index_buffer(self.index_buffer.slice(..));
        render_pass.draw_indexed(0..self.index_count as u32, 0, instances_indices);
    }
}
