#[derive(Default, Debug)]
pub struct Ray {
    origin: glam::Vec3A,
    direction: glam::Vec3A,
}

pub fn ray_sphere_intersection(ray: &Ray, sphere_radius: f32) -> Option<(f32, glam::Vec3A, glam::Vec3A)> {
    let parallel = ray.direction*ray.origin.dot(ray.direction);
    let orthogonal = ray.origin-parallel;
    let orthogonal_dist = orthogonal.length();
    if orthogonal_dist > sphere_radius {
        return None;
    }
    let parallel_dist = (1.0-(orthogonal_dist/sphere_radius).powi(2)).sqrt()*sphere_radius;
    let origin = ray.origin-parallel;
    return Some((parallel_dist*2.0, origin-parallel_dist*ray.direction, origin+parallel_dist*ray.direction));
}

#[derive(Default, Debug)]
pub struct Camera {
    near: f32,
    far: f32,
    world_matrix: glam::Mat4,
    inverse_world_matrix: glam::Mat4,
    projection_matrix: glam::Mat4,
    view_matrix: glam::Mat4,
    inverse_view_matrix: glam::Mat4,
    bounding_volume: crate::bounding_volume::BoundingVolume,
}

impl Camera {
    fn update(&mut self) {
        self.inverse_world_matrix = self.world_matrix.inverse();
        self.view_matrix = self.projection_matrix*self.inverse_world_matrix;
        self.inverse_view_matrix = self.view_matrix.inverse();
    }

    pub fn set_orthographic(&mut self, near: f32, far: f32, width: f32, height: f32) {
        self.near = near;
        self.far = far;
        self.projection_matrix = glam::Mat4::orthographic_rh(
            -0.5*width,
            0.5*width,
            -0.5*height,
            0.5*height,
            self.near,
            self.far
        );
        self.bounding_volume = crate::bounding_volume::BoundingVolume::Box(crate::bounding_volume::BoundingBox {
            min: glam::Vec3A::new(-0.5*width, -0.5*height, near),
            max: glam::Vec3A::new(0.5*width, 0.5*height, far),
        });
        self.update();
    }

    pub fn set_perspective(&mut self, near: f32, far: f32, fov_y_radians: f32, aspect_ratio: f32) {
        self.near = near;
        self.far = far;
        self.projection_matrix = glam::Mat4::perspective_rh(
            fov_y_radians,
            aspect_ratio,
            self.near,
            self.far
        );
        let height_at_far = fov_y_radians.tan()*far;
        self.bounding_volume = crate::bounding_volume::BoundingVolume::Pyramid(crate::bounding_volume::BoundingPyramid {
            near,
            far,
            width_at_far: height_at_far*aspect_ratio,
            height_at_far,
        });
        self.update();
    }

    pub fn set_world_matrix(&mut self, world_matrix: glam::Mat4) {
        self.world_matrix = world_matrix;
        self.update();
    }

    pub fn get_world_matrix(&self) -> glam::Mat4{
        self.world_matrix
    }

    pub fn get_projection_matrix(&self) -> glam::Mat4{
        self.projection_matrix
    }

    pub fn get_view_matrix(&self) -> glam::Mat4{
        self.view_matrix
    }

    pub fn get_inverse_view_matrix(&self) -> glam::Mat4{
        self.inverse_view_matrix
    }

    pub fn get_view_ray(&self, x: f32, y: f32) -> Ray {
        let ndc_pos = glam::Vec3A::new(x, y, 0.0);
        let mut clip_pos = ndc_pos.extend(self.projection_matrix.w_axis().z()/(ndc_pos.z()-self.projection_matrix.z_axis().z()/self.projection_matrix.z_axis().w()));
        *clip_pos.x_mut() *= clip_pos.w();
        *clip_pos.y_mut() *= clip_pos.w();
        *clip_pos.z_mut() *= clip_pos.w();
        let origin = self.world_matrix.w_axis().truncate();
        let hit = (self.inverse_view_matrix*clip_pos).truncate();
        let direction = (hit-origin).normalize();
        Ray {
            origin,
            direction
        }
    }
}
