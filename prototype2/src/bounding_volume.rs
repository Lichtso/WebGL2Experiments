#![allow(dead_code)]

fn ray_point_distance(origin: glam::Vec3A, direction: glam::Vec3A, point: glam::Vec3A) -> f32 {
    let parallel = direction*(point-origin).dot(direction);
    let orthogonal = point-origin-parallel;
    orthogonal.length()
}

#[derive(Default, Debug)]
pub struct BoundingBox {
    pub min: glam::Vec3A,
    pub max: glam::Vec3A,
}

#[derive(Default, Debug)]
pub struct BoundingPyramid {
    pub near: f32,
    pub far: f32,
    pub width_at_far: f32,
    pub height_at_far: f32,
}

#[derive(Default, Debug)]
pub struct BoundingSphere {
    pub radius: f32,
}

#[derive(Default, Debug)]
pub struct BoundingCone {
    pub near: f32,
    pub far: f32,
    pub radius_at_far: f32,
}

#[derive(Debug)]
pub enum BoundingVolume {
    Box(BoundingBox),
    Pyramid(BoundingPyramid),
    Sphere(BoundingSphere),
    Cone(BoundingCone),
}

impl Default for BoundingVolume {
    fn default() -> Self {
        Self::Box(BoundingBox {
            min: glam::Vec3A::splat(0.0),
            max: glam::Vec3A::splat(0.0),
        })
    }
}

pub struct HalfPlane {
    normal: glam::Vec3A,
    dist: f32,
}

pub fn point_half_plane_intersection(point: glam::Vec3A, half_plane: &HalfPlane) -> bool {
    point.dot(half_plane.normal) <= half_plane.dist
}

pub fn points_half_plane_intersection(points: &[glam::Vec3A], half_plane: &HalfPlane) -> bool {
    for p in points {
        if point_half_plane_intersection(*p, &half_plane) {
            return true;
        }
    }
    false
}

pub fn project_point_onto_half_plane(point: glam::Vec3A, half_plane: &HalfPlane) -> glam::Vec3A {
    let dist = point.dot(half_plane.normal);
    if dist < half_plane.dist {
        point+(half_plane.dist-dist)*half_plane.normal
    } else {
        point
    }
}

pub struct DoublePlane {
    normal: glam::Vec3A,
    min: f32,
    max: f32,
}

pub fn point_double_plane_intersection(point: glam::Vec3A, double_plane: &DoublePlane) -> bool {
    let dist = point.dot(double_plane.normal);
    double_plane.min <= dist && dist <= double_plane.max
}

pub fn points_double_plane_intersection(points: &[glam::Vec3A], double_plane: &DoublePlane) -> bool {
    for p in points {
        if point_double_plane_intersection(*p, &double_plane) {
            return true;
        }
    }
    false
}

pub fn project_point_into_double_plane(point: glam::Vec3A, double_plane: &DoublePlane) -> glam::Vec3A {
    let dist = point.dot(double_plane.normal);
    if dist > double_plane.max {
        point+(double_plane.max-dist)*double_plane.normal
    } else if dist < double_plane.min {
        point+(double_plane.min-dist)*double_plane.normal
    } else {
        point
    }
}

macro_rules! double_plane_of_box {
    ($center:expr, $bb:expr, $axis:expr, $i:expr) => {
        {
            let center_dist = $center.dot($axis);
            DoublePlane {
                normal: $axis,
                min: center_dist+$bb.min[$i],
                max: center_dist+$bb.max[$i],
            }
        }
    }
}

pub fn double_planes_of_box(bb: &BoundingBox, world_matrix_bb: &glam::Mat4) -> [DoublePlane; 3] {
    let center = world_matrix_bb.w_axis().truncate();
    [
        double_plane_of_box!(center, bb, world_matrix_bb.x_axis().truncate(), 0),
        double_plane_of_box!(center, bb, world_matrix_bb.y_axis().truncate(), 1),
        double_plane_of_box!(center, bb, world_matrix_bb.z_axis().truncate(), 2),
    ]
}

macro_rules! half_plane_of_pyramid {
    ($center:expr, $z_axis:expr, $far_point:expr) => {
        {
            let diagonal = $far_point-$center;
            let normal = $z_axis.cross(diagonal).cross(diagonal);
            HalfPlane {
                normal,
                dist: $center.dot(normal),
            }
        }
    }
}

pub fn half_planes_of_pyramid(pyramid: &BoundingPyramid, world_matrix_pyramid: &glam::Mat4) -> [HalfPlane; 6] {
    let center = world_matrix_pyramid.w_axis().truncate();
    let z_axis = world_matrix_pyramid.z_axis().truncate();
    let center_dist = center.dot(z_axis);
    [
        half_plane_of_pyramid!(center, z_axis, world_matrix_pyramid.mul_vec4(glam::Vec4::new(-pyramid.width_at_far, 0.0, pyramid.far, 1.0)).truncate()),
        half_plane_of_pyramid!(center, z_axis, world_matrix_pyramid.mul_vec4(glam::Vec4::new(pyramid.width_at_far, 0.0, pyramid.far, 1.0)).truncate()),
        half_plane_of_pyramid!(center, z_axis, world_matrix_pyramid.mul_vec4(glam::Vec4::new(0.0, -pyramid.height_at_far, pyramid.far, 1.0)).truncate()),
        half_plane_of_pyramid!(center, z_axis, world_matrix_pyramid.mul_vec4(glam::Vec4::new(0.0, pyramid.height_at_far, pyramid.far, 1.0)).truncate()),
        HalfPlane {
            normal: -z_axis,
            dist: center_dist+pyramid.near,
        },
        HalfPlane {
            normal: z_axis,
            dist: center_dist+pyramid.far,
        },
    ]
}

pub fn points_of_bounding_box(bb: &BoundingBox, world_matrix_bb: &glam::Mat4) -> [glam::Vec3A; 8] {
    [
        world_matrix_bb.mul_vec4(glam::Vec4::new(bb.min[0], bb.min[1], bb.min[2], 1.0)).truncate(),
        world_matrix_bb.mul_vec4(glam::Vec4::new(bb.max[0], bb.min[1], bb.min[2], 1.0)).truncate(),
        world_matrix_bb.mul_vec4(glam::Vec4::new(bb.min[0], bb.max[1], bb.min[2], 1.0)).truncate(),
        world_matrix_bb.mul_vec4(glam::Vec4::new(bb.max[0], bb.max[1], bb.min[2], 1.0)).truncate(),
        world_matrix_bb.mul_vec4(glam::Vec4::new(bb.min[0], bb.min[1], bb.max[2], 1.0)).truncate(),
        world_matrix_bb.mul_vec4(glam::Vec4::new(bb.max[0], bb.min[1], bb.max[2], 1.0)).truncate(),
        world_matrix_bb.mul_vec4(glam::Vec4::new(bb.min[0], bb.max[1], bb.max[2], 1.0)).truncate(),
        world_matrix_bb.mul_vec4(glam::Vec4::new(bb.max[0], bb.max[1], bb.max[2], 1.0)).truncate(),
    ]
}

pub fn points_of_bounding_pyramid(pyramid: &BoundingPyramid, world_matrix_pyramid: &glam::Mat4) -> [glam::Vec3A; 8] {
    let near_factor = pyramid.near/pyramid.far;
    let width_at_near = near_factor*pyramid.width_at_far;
    let height_at_near = near_factor*pyramid.height_at_far;
    [
        world_matrix_pyramid.mul_vec4(glam::Vec4::new(-width_at_near, -height_at_near, pyramid.near, 1.0)).truncate(),
        world_matrix_pyramid.mul_vec4(glam::Vec4::new(width_at_near, -height_at_near, pyramid.near, 1.0)).truncate(),
        world_matrix_pyramid.mul_vec4(glam::Vec4::new(-width_at_near, height_at_near, pyramid.near, 1.0)).truncate(),
        world_matrix_pyramid.mul_vec4(glam::Vec4::new(width_at_near, height_at_near, pyramid.near, 1.0)).truncate(),
        world_matrix_pyramid.mul_vec4(glam::Vec4::new(-pyramid.width_at_far, -pyramid.height_at_far, pyramid.far, 1.0)).truncate(),
        world_matrix_pyramid.mul_vec4(glam::Vec4::new(pyramid.width_at_far, -pyramid.height_at_far, pyramid.far, 1.0)).truncate(),
        world_matrix_pyramid.mul_vec4(glam::Vec4::new(-pyramid.width_at_far, pyramid.height_at_far, pyramid.far, 1.0)).truncate(),
        world_matrix_pyramid.mul_vec4(glam::Vec4::new(pyramid.width_at_far, pyramid.height_at_far, pyramid.far, 1.0)).truncate(),
    ]
}

pub fn half_box_box_intersection(a: &BoundingBox, b: &BoundingBox, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    let double_planes_of_box_a = double_planes_of_box(a, world_matrix_a);
    let points_of_bounding_box_b = points_of_bounding_box(b, world_matrix_b);
    for double_plane in &double_planes_of_box_a {
        if !points_double_plane_intersection(&points_of_bounding_box_b, &double_plane) {
            return false;
        }
    }
    true
}

pub fn box_box_intersection(a: &BoundingBox, b: &BoundingBox, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    half_box_box_intersection(a, b, world_matrix_a, world_matrix_b) && half_box_box_intersection(b, a, world_matrix_b, world_matrix_a)
}

pub fn box_pyramid_intersection(a: &BoundingBox, b: &BoundingPyramid, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    let double_planes_of_box_a = double_planes_of_box(a, world_matrix_a);
    let points_of_bounding_pyramid_b = points_of_bounding_pyramid(b, world_matrix_b);
    for double_plane in &double_planes_of_box_a {
        if !points_double_plane_intersection(&points_of_bounding_pyramid_b, &double_plane) {
            return false;
        }
    }
    let half_planes_of_pyramid_b = half_planes_of_pyramid(b, world_matrix_b);
    let points_of_bounding_box_a = points_of_bounding_box(a, world_matrix_a);
    for half_plane in &half_planes_of_pyramid_b {
        if !points_half_plane_intersection(&points_of_bounding_box_a, &half_plane) {
            return false;
        }
    }
    true
}

pub fn box_sphere_intersection(a: &BoundingBox, b: &BoundingSphere, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    let double_planes_of_box_a = double_planes_of_box(a, world_matrix_a);
    let point_of_sphere_b = world_matrix_b.w_axis().truncate();
    let mut closest_point = project_point_into_double_plane(point_of_sphere_b, &double_planes_of_box_a[0]);
    closest_point = project_point_into_double_plane(closest_point, &double_planes_of_box_a[1]);
    closest_point = project_point_into_double_plane(closest_point, &double_planes_of_box_a[2]);
    (closest_point-point_of_sphere_b).length() <= b.radius
}

pub fn box_cone_intersection(a: &BoundingBox, b: &BoundingCone, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    // TODO
    unimplemented!();
}

pub fn half_pyramid_pyramid_intersection(a: &BoundingPyramid, b: &BoundingPyramid, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    let half_planes_of_pyramid_a = half_planes_of_pyramid(a, world_matrix_a);
    let points_of_bounding_pyramid_b = points_of_bounding_pyramid(b, world_matrix_b);
    for half_plane in &half_planes_of_pyramid_a {
        if !points_half_plane_intersection(&points_of_bounding_pyramid_b, &half_plane) {
            return false;
        }
    }
    true
}

pub fn pyramid_pyramid_intersection(a: &BoundingPyramid, b: &BoundingPyramid, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    half_pyramid_pyramid_intersection(a, b, world_matrix_a, world_matrix_b) && half_pyramid_pyramid_intersection(b, a, world_matrix_b, world_matrix_a)
}

pub fn pyramid_sphere_intersection(a: &BoundingPyramid, b: &BoundingSphere, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    let half_planes_of_pyramid_a = half_planes_of_pyramid(a, world_matrix_a);
    let point_of_sphere_b = world_matrix_b.w_axis().truncate();
    let mut closest_point = point_of_sphere_b;
    for i in 0..4 {
        closest_point = project_point_onto_half_plane(closest_point, &half_planes_of_pyramid_a[i]);
    }
    let behind_near_plane = !point_half_plane_intersection(closest_point, &half_planes_of_pyramid_a[4]);
    let behind_far_plane = !point_half_plane_intersection(closest_point, &half_planes_of_pyramid_a[5]);
    if behind_near_plane || behind_far_plane {
        let x_axis = world_matrix_a.x_axis().truncate();
        let y_axis = world_matrix_a.y_axis().truncate();
        let center = world_matrix_a.w_axis().truncate();
        let (x_dist, y_dist) = if behind_near_plane {
            closest_point = project_point_onto_half_plane(point_of_sphere_b, &half_planes_of_pyramid_a[4]);
            let near_factor = a.near/a.far;
            let width_at_near = near_factor*a.width_at_far;
            let height_at_near = near_factor*a.height_at_far;
            (width_at_near, height_at_near)
        } else {
            closest_point = project_point_onto_half_plane(point_of_sphere_b, &half_planes_of_pyramid_a[5]);
            (a.width_at_far, a.height_at_far)
        };
        let center_dist = center.dot(x_axis);
        let double_plane_x = DoublePlane {
            normal: x_axis,
            min: center_dist-x_dist,
            max: center_dist+x_dist,
        };
        let center_dist = center.dot(y_axis);
        let double_plane_y = DoublePlane {
            normal: y_axis,
            min: center_dist-y_dist,
            max: center_dist+y_dist,
        };
        closest_point = project_point_into_double_plane(closest_point, &double_plane_x);
        closest_point = project_point_into_double_plane(closest_point, &double_plane_y);
    }
    (closest_point-point_of_sphere_b).length() <= b.radius
}

pub fn pyramid_cone_intersection(a: &BoundingPyramid, b: &BoundingCone, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    // TODO
    unimplemented!();
}

pub fn sphere_sphere_intersection(a: &BoundingSphere, b: &BoundingSphere, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    let distance = (world_matrix_a.w_axis().truncate()-world_matrix_b.w_axis().truncate()).length();
    distance <= a.radius+b.radius
}

pub fn sphere_cone_intersection(a: &BoundingSphere, b: &BoundingCone, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    let origin = world_matrix_a.w_axis().truncate();
    let direction = world_matrix_a.z_axis().truncate();
    let point = world_matrix_b.z_axis().truncate();
    let diagonal = point-origin;
    let parallel_distance = diagonal.dot(direction);
    if parallel_distance < b.near-a.radius || parallel_distance > b.far+a.radius {
        return false;
    }
    let orthogonal = (diagonal-direction*parallel_distance).normalize();
    let near_end = origin+direction*b.near+orthogonal*(b.radius_at_far*b.near/b.far);
    let far_end = origin+direction*b.far+orthogonal*b.radius_at_far;
    let normal = direction.cross(orthogonal).cross(far_end-origin).normalize();
    let normal_distance = diagonal.dot(normal);
    if normal_distance > a.radius {
        return false;
    }
    if normal_distance < 0.0 {
        return true;
    }
    if parallel_distance < b.near && (near_end-point).length() > a.radius {
        return false;
    }
    if parallel_distance > b.far && (far_end-point).length() > a.radius {
        return false;
    }
    true
}

pub fn cone_cone_intersection(a: &BoundingCone, b: &BoundingCone, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    /*let origin_a = world_matrix_a.w_axis().truncate();
    let direction_a = world_matrix_a.z_axis().truncate();
    let origin_b = world_matrix_b.w_axis().truncate();
    let direction_b = world_matrix_b.z_axis().truncate();
    let normal = direction_a.cross(direction_b);
    let normal_length = normal.length();
    if normal_length == 0.0 {
        // TODO
    }
    let normal = normal/normal_length;*/

    unimplemented!();
}

pub fn bounding_volume_intersection(a: &BoundingVolume, b: &BoundingVolume, world_matrix_a: &glam::Mat4, world_matrix_b: &glam::Mat4) -> bool {
    match a {
        BoundingVolume::Box(box_a) => {
            match b {
                BoundingVolume::Box(box_b) => box_box_intersection(box_a, box_b, world_matrix_a, world_matrix_b),
                BoundingVolume::Pyramid(pyramid_b) => box_pyramid_intersection(box_a, pyramid_b, world_matrix_a, world_matrix_b),
                BoundingVolume::Sphere(sphere_b) => box_sphere_intersection(box_a, sphere_b, world_matrix_a, world_matrix_b),
                BoundingVolume::Cone(cone_b) => box_cone_intersection(box_a, cone_b, world_matrix_a, world_matrix_b),
            }
        },
        BoundingVolume::Pyramid(pyramid_a) => {
            match b {
                BoundingVolume::Box(box_b) => box_pyramid_intersection(box_b, pyramid_a, world_matrix_b, world_matrix_a),
                BoundingVolume::Pyramid(pyramid_b) => pyramid_pyramid_intersection(pyramid_a, pyramid_b, world_matrix_a, world_matrix_b),
                BoundingVolume::Sphere(sphere_b) => pyramid_sphere_intersection(pyramid_a, sphere_b, world_matrix_a, world_matrix_b),
                BoundingVolume::Cone(cone_b) => pyramid_cone_intersection(pyramid_a, cone_b, world_matrix_a, world_matrix_b),
            }
        },
        BoundingVolume::Sphere(sphere_a) => {
            match b {
                BoundingVolume::Box(box_b) => box_sphere_intersection(box_b, sphere_a, world_matrix_b, world_matrix_a),
                BoundingVolume::Pyramid(pyramid_b) => pyramid_sphere_intersection(pyramid_b, sphere_a, world_matrix_b, world_matrix_a),
                BoundingVolume::Sphere(sphere_b) => sphere_sphere_intersection(sphere_a, sphere_b, world_matrix_a, world_matrix_b),
                BoundingVolume::Cone(cone_b) => sphere_cone_intersection(sphere_a, cone_b, world_matrix_a, world_matrix_b),
            }
        },
        BoundingVolume::Cone(cone_a) => {
            match b {
                BoundingVolume::Box(box_b) => box_cone_intersection(box_b, cone_a, world_matrix_b, world_matrix_a),
                BoundingVolume::Pyramid(pyramid_b) => pyramid_cone_intersection(pyramid_b, cone_a, world_matrix_b, world_matrix_a),
                BoundingVolume::Sphere(sphere_b) => sphere_cone_intersection(sphere_b, cone_a, world_matrix_b, world_matrix_a),
                BoundingVolume::Cone(cone_b) => cone_cone_intersection(cone_a, cone_b, world_matrix_a, world_matrix_b),
            }
        },
    }
}


/*#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sphere_cone_intersection() {
        let sphere = BoundingSphere {
            radius: 1.0,
        };
        let cone = BoundingCone {
            near: 1.0,
            far: 10.0,
            radius_at_far: 5.0,
        };
        let world_matrix_a = glam::Mat4::from_translation(glam::Vec3::new(1.0, 0.0, 0.0));
        let world_matrix_b = glam::Mat4::identity();

        assert_eq!(sphere_cone_intersection(&sphere, &cone, world_matrix_a, world_matrix_b), true);
    }
}*/
