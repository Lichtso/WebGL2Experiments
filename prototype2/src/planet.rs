#![allow(dead_code)]

use iced_wgpu::{wgpu, wgpu::vertex_attr_array};
use rand::{rngs::SmallRng, Rng, SeedableRng};
use num_integer::Integer;

include!(concat!(env!("OUT_DIR"), "/planet_consts.rs"));

fn icosahedron_vertex(i: u8) -> glam::Vec3A {
    glam::Vec3A::from_slice_unaligned(&ICOSAHEDRON_VERTICES[i as usize])
}

fn side_of_half_plane(direction: glam::Vec3A, pole_index_a: u8, pole_index_b: u8) -> bool {
    return direction.dot(icosahedron_vertex(pole_index_a).cross(icosahedron_vertex(pole_index_b))) > 0.0;
}

fn barycentric_interpolation(mut barycentric: glam::Vec3A, poles: [glam::Vec3A; 3]) -> glam::Vec3A {
    for i in 0..3 {
        barycentric[i] = f32::sin(barycentric[i])+barycentric[i]*0.25;
    }
    (poles[0]*barycentric[0]+poles[1]*barycentric[1]+poles[2]*barycentric[2]).normalize()
}

fn inverse_barycentric_interpolation(point: glam::Vec3A, poles: [glam::Vec3A; 3]) -> glam::Vec3A {
    let mut sum = 0.0;
    let mut barycentric = glam::Vec3A::default();
    for i in 0..3 {
        barycentric[i] = f32::asin(poles[(i+1)%3].cross(poles[(i+2)%3]).dot(point));
        sum += barycentric[i];
    }
    barycentric/sum
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Direction {
    NX,
    PX,
    NY,
    PY,
    NZ,
    PZ,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct ParallelogramCoordinate {
    pub gp_index: usize,
    pub rect_coord: [isize; 2],
    pub parallelogram_latitude: u8,
}

impl ParallelogramCoordinate {
    pub fn parallelogram_width(gp_index: usize) -> usize {
        gp_index/2*3+gp_index%2
    }

    pub fn parallelogram_height(gp_index: usize) -> usize {
        gp_index*4
    }

    pub fn parallelogram_area(gp_index: usize) -> usize {
        gp_index*gp_index*6
    }

    pub fn new(gp_index: usize, rect_coord: [isize; 2], parallelogram_latitude: u8) -> Self {
        Self {
            gp_index,
            rect_coord,
            parallelogram_latitude,
        }
    }

    pub fn from_triangle_coordinate(triangle_coordinate: &TriangleCoordinate) -> Self {
        let mut parallelogram_coordinate = Self {
            gp_index: triangle_coordinate.gp_index,
            rect_coord: [triangle_coordinate.cube_coord[0], triangle_coordinate.cube_coord[1]],
            parallelogram_latitude: triangle_coordinate.triangle_latitude,
        };
        if (triangle_coordinate.triangle_longitude&1) == 1 {
            parallelogram_coordinate.rect_coord[0] = 3*triangle_coordinate.gp_index as isize-parallelogram_coordinate.rect_coord[0];
            parallelogram_coordinate.rect_coord[1] = 3*triangle_coordinate.gp_index as isize-parallelogram_coordinate.rect_coord[1];
        }
        if triangle_coordinate.triangle_longitude >= 2 {
            parallelogram_coordinate.rect_coord[1] += 3*triangle_coordinate.gp_index as isize;
        }
        parallelogram_coordinate.rect_coord[1] = parallelogram_coordinate.rect_coord[1]*2+parallelogram_coordinate.rect_coord[0]%2;
        parallelogram_coordinate.rect_coord[0] = parallelogram_coordinate.rect_coord[0].div_floor(&2);
        parallelogram_coordinate.rect_coord[1] = parallelogram_coordinate.rect_coord[1].div_floor(&3);
        parallelogram_coordinate
    }

    pub fn index_in_total(&self) -> usize {
        let width = Self::parallelogram_width(self.gp_index);
        let height = Self::parallelogram_height(self.gp_index);
        let area = Self::parallelogram_area(self.gp_index);
        if self.rect_coord[0] == 0 && self.rect_coord[1] == 0 {
            return 0; // South Pole
        } else if self.rect_coord[0] as usize == width && self.rect_coord[1] as usize == height {
            return area*5+1; // North Pole
        }
        self.parallelogram_latitude as usize*area+
        self.rect_coord[1] as usize*width+
        self.rect_coord[0] as usize+
        self.rect_coord[1] as usize%2+
        self.rect_coord[1] as usize/2*(self.gp_index%2)
    }
}

/*
triangle_index:
   *     *     *     *     * North pole
  / \   / \   / \   / \   / \
 / P \ / Q \ / R \ / S \ / T \
*-----*-----*-----*-----*-----* Northern poles
 \ K / \ L / \ M / \ N / \ O / \
  \ / F \ / G \ / H \ / I \ / J \
   *-----*-----*-----*-----*-----* Southern poles
    \ A / \ B / \ C / \ D / \ E /
     \ /   \ /   \ /   \ /   \ /
      *     *     *     *     * South pole

barycentric:
     Z
 Y       X

 X       Y
     Z
*/

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct TriangleCoordinate {
    pub gp_index: usize,
    pub cube_coord: [isize; 3],
    pub triangle_latitude: u8,
    pub triangle_longitude: u8,
}

impl TriangleCoordinate {
    pub fn round_cube_coord(mut barycentric: glam::Vec3A) -> [isize; 3] {
        let mut rounded = barycentric.round();
        let mut diff = rounded-barycentric;
        let mut max: f32 = 0.0;
        for i in 0..3 {
            diff[i] = f32::abs(diff[i]);
            max = f32::max(max, diff[i]);
        }
        if diff[0] == max {
            rounded[0] = -rounded[1]-rounded[2];
        } else if diff[1] == max {
            rounded[1] = -rounded[0]-rounded[2];
        } else { // if diff[2] == max
            rounded[2] = -rounded[0]-rounded[1];
        }
        barycentric = rounded.round();
        [barycentric[0] as isize, barycentric[1] as isize, barycentric[2] as isize]
    }

    pub fn rotate_cube_coord(cube_coord: [isize; 3]) -> [isize; 3] {
        [cube_coord[1]-cube_coord[2], cube_coord[2]-cube_coord[0], cube_coord[0]-cube_coord[1]]
    }

    pub fn new(gp_index: usize, cube_coord: [isize; 3], triangle_latitude: u8, triangle_longitude: u8) -> Self {
        Self {
            gp_index,
            cube_coord,
            triangle_latitude,
            triangle_longitude,
        }
    }

    pub fn from_parallelogram_coordinate(parallelogram_coordinate: &ParallelogramCoordinate) -> Self {
        let mut triangle_coordinate = Self {
            gp_index: parallelogram_coordinate.gp_index,
            cube_coord: [0, 0, 0],
            triangle_latitude: parallelogram_coordinate.parallelogram_latitude,
            triangle_longitude: if parallelogram_coordinate.rect_coord[1] > parallelogram_coordinate.gp_index as isize*4-(parallelogram_coordinate.rect_coord[0]+2)/3-parallelogram_coordinate.rect_coord[0]-1 {
                3
            } else if parallelogram_coordinate.rect_coord[1] >= parallelogram_coordinate.gp_index as isize*2 {
                2
            } else if parallelogram_coordinate.rect_coord[1] > parallelogram_coordinate.gp_index as isize*2-(parallelogram_coordinate.rect_coord[0]-parallelogram_coordinate.rect_coord[0]/3)*2 {
                1
            } else {
                0
            },
        };
        let odd_row = (parallelogram_coordinate.rect_coord[0] as isize+parallelogram_coordinate.rect_coord[1] as isize-(parallelogram_coordinate.rect_coord[0] as isize).div_floor(&3)).mod_floor(&2);
        triangle_coordinate.cube_coord = [parallelogram_coordinate.rect_coord[0] as isize*2, (parallelogram_coordinate.rect_coord[1] as isize*3).div_floor(&2) as isize, 0];
        triangle_coordinate.cube_coord[0] += odd_row;
        triangle_coordinate.cube_coord[1] += if (parallelogram_coordinate.rect_coord[0] as isize).mod_floor(&3) >= 1+odd_row { 1 } else { 0 };
        if triangle_coordinate.triangle_longitude >= 2 {
            triangle_coordinate.cube_coord[1] -= 3*parallelogram_coordinate.gp_index as isize;
        }
        if (triangle_coordinate.triangle_longitude&1) == 1 {
            triangle_coordinate.cube_coord[0] = 3*parallelogram_coordinate.gp_index as isize-triangle_coordinate.cube_coord[0];
            triangle_coordinate.cube_coord[1] = 3*parallelogram_coordinate.gp_index as isize-triangle_coordinate.cube_coord[1];
        }
        triangle_coordinate.cube_coord[2] = 3*parallelogram_coordinate.gp_index as isize-triangle_coordinate.cube_coord[0]-triangle_coordinate.cube_coord[1];
        triangle_coordinate
    }

    pub fn from_direction_3d(gp_index: usize, direction: glam::Vec3A) -> Self {
        let direction = direction.normalize();
        // let longitude = 1.0-f32::acos(direction[1])/std::f32::consts::PI;
        let latitude = f32::atan2(direction[0], direction[2])/std::f32::consts::PI;
        let triangle_latitude_south = ((2.9+latitude)*2.5%5.0) as u8;
        let triangle_latitude_north = ((3.1+latitude)*2.5%5.0) as u8;
        let (triangle_latitude, triangle_longitude) =
            if side_of_half_plane(direction, 1+(triangle_latitude_south+1)%5, 1+triangle_latitude_south) {
                (triangle_latitude_south, 0)
            } else if side_of_half_plane(direction, 6+triangle_latitude_north, 6+(triangle_latitude_north+1)%5) {
                (triangle_latitude_north, 3)
            } else if side_of_half_plane(direction, 6+triangle_latitude_north, 1+triangle_latitude_north) &&
                      side_of_half_plane(direction, 1+triangle_latitude_north, 6+(triangle_latitude_north+1)%5) {
                (triangle_latitude_north, 2)
            } else {
                (triangle_latitude_south, 1)
            };
        let mut triangle_coordinate = Self {
            gp_index,
            cube_coord: [0; 3],
            triangle_latitude,
            triangle_longitude,
        };
        let barycentric = inverse_barycentric_interpolation(direction, triangle_coordinate.poles())*triangle_coordinate.gp_index as f32;
        triangle_coordinate.cube_coord = Self::round_cube_coord(glam::Vec3A::new(barycentric[1]-barycentric[2], barycentric[2]-barycentric[0], barycentric[0]-barycentric[1]));
        triangle_coordinate.cube_coord = Self::rotate_cube_coord(triangle_coordinate.cube_coord);
        for i in 0..3 {
            triangle_coordinate.cube_coord[i] = gp_index as isize-triangle_coordinate.cube_coord[i];
        }
        triangle_coordinate.normalize();
        triangle_coordinate
    }

    pub fn normalize(&mut self) -> bool {
        match self.triangle_longitude {
            3 => {
                if self.cube_coord[2] == 3*self.gp_index as isize {
                    if self.triangle_latitude == 0 && self.cube_coord == [0, 0, 3*self.gp_index as isize] {
                        false
                    } else {
                        self.cube_coord = [0, 0, 3*self.gp_index as isize];
                        self.triangle_latitude = 0;
                        true
                    }
                } else if self.cube_coord[2] < 0 {
                    if self.cube_coord[1] > 3*self.gp_index as isize {
                        self.cube_coord = [1, 1, 3*self.gp_index as isize-2];
                        self.triangle_longitude ^= 2;
                    } else {
                        self.cube_coord = [self.cube_coord[1]+self.cube_coord[2], self.cube_coord[0]+self.cube_coord[2], -self.cube_coord[2]];
                        self.triangle_longitude ^= 1;
                    }
                    true
                } else if self.cube_coord[0] < 0 {
                    if self.cube_coord[1] > 3*self.gp_index as isize {
                        self.cube_coord = [1, 3*self.gp_index as isize-2, 1];
                        self.triangle_latitude = (self.triangle_latitude+1)%5;
                        self.triangle_longitude ^= 1;
                    } else if self.cube_coord[2] > 3*self.gp_index as isize {
                        self.cube_coord = [1, 1, 3*self.gp_index as isize-2];
                        self.triangle_latitude = (self.triangle_latitude+2)%5;
                    } else {
                        self.cube_coord = [self.cube_coord[1]+self.cube_coord[0], -self.cube_coord[0], self.cube_coord[2]+self.cube_coord[0]];
                        self.triangle_latitude = (self.triangle_latitude+1)%5;
                    }
                    true
                } else if self.cube_coord[1] < 1 {
                    if self.cube_coord[2] > 3*self.gp_index as isize {
                        self.cube_coord = [1, 1, 3*self.gp_index as isize-2];
                        self.triangle_latitude = (self.triangle_latitude+3)%5;
                    } else {
                        self.cube_coord = [-self.cube_coord[1], self.cube_coord[0]+self.cube_coord[1], self.cube_coord[2]+self.cube_coord[1]];
                        self.triangle_latitude = (self.triangle_latitude+4)%5;
                    }
                    true
                } else {
                    false
                }
            },
            2 => {
                if self.cube_coord[1] == 3*self.gp_index as isize {
                    self.cube_coord = [0, 3*self.gp_index as isize, 0];
                    self.triangle_latitude = (self.triangle_latitude+4)%5;
                    self.triangle_longitude ^= 1;
                    true
                } else if self.cube_coord[2] == 3*self.gp_index as isize {
                    self.cube_coord = [3*self.gp_index as isize, 0, 0];
                    self.triangle_latitude = (self.triangle_latitude+4)%5;
                    self.triangle_longitude ^= 2;
                    true
                } else if self.cube_coord[0] < 1 {
                    self.cube_coord = [-self.cube_coord[0], self.cube_coord[2]+self.cube_coord[0], self.cube_coord[1]+self.cube_coord[0]];
                    self.triangle_latitude = (self.triangle_latitude+4)%5;
                    self.triangle_longitude = 3-self.triangle_longitude;
                    true
                } else if self.cube_coord[1] < 0 {
                    self.cube_coord = [self.cube_coord[2]+self.cube_coord[1], -self.cube_coord[1], self.cube_coord[0]+self.cube_coord[1]];
                    self.triangle_longitude = 3-self.triangle_longitude;
                    true
                } else if self.cube_coord[2] < 1 {
                    self.cube_coord = [self.cube_coord[1]+self.cube_coord[2], self.cube_coord[0]+self.cube_coord[2], -self.cube_coord[2]];
                    self.triangle_longitude ^= 1;
                    true
                } else {
                    false
                }
            },
            1 => {
                if self.cube_coord[0] == 3*self.gp_index as isize {
                    self.cube_coord = [3*self.gp_index as isize, 0, 0];
                    self.triangle_latitude = (self.triangle_latitude+4)%5;
                    self.triangle_longitude ^= 1;
                    true
                } else if self.cube_coord[2] == 3*self.gp_index as isize {
                    self.cube_coord = [0, 3*self.gp_index as isize, 0];
                    self.triangle_longitude ^= 2;
                    true
                } else if self.cube_coord[0] < 0 {
                    self.cube_coord = [-self.cube_coord[0], self.cube_coord[2]+self.cube_coord[0], self.cube_coord[1]+self.cube_coord[0]];
                    self.triangle_latitude = (self.triangle_latitude+1)%5;
                    self.triangle_longitude = 3-self.triangle_longitude;
                    true
                } else if self.cube_coord[1] < 1 {
                    self.cube_coord = [self.cube_coord[2]+self.cube_coord[1], -self.cube_coord[1], self.cube_coord[0]+self.cube_coord[1]];
                    self.triangle_longitude = 3-self.triangle_longitude;
                    true
                } else if self.cube_coord[2] < 1 {
                    self.cube_coord = [self.cube_coord[1]+self.cube_coord[2], self.cube_coord[0]+self.cube_coord[2], -self.cube_coord[2]];
                    self.triangle_longitude ^= 1;
                    true
                } else {
                    false
                }
            },
            0 => {
                if self.cube_coord[2] == 3*self.gp_index as isize {
                    if self.triangle_latitude == 0 && self.cube_coord == [0, 0, 3*self.gp_index as isize] {
                        false
                    } else {
                        self.cube_coord = [0, 0, 3*self.gp_index as isize];
                        self.triangle_latitude = 0;
                        true
                    }
                } else if self.cube_coord[2] < 0 {
                    if self.cube_coord[0] > 3*self.gp_index as isize {
                        self.cube_coord = [1, 1, 3*self.gp_index as isize-2];
                        self.triangle_latitude = (self.triangle_latitude+1)%5;
                        self.triangle_longitude ^= 2;
                    } else {
                        self.cube_coord = [self.cube_coord[1]+self.cube_coord[2], self.cube_coord[0]+self.cube_coord[2], -self.cube_coord[2]];
                        self.triangle_longitude ^= 1;
                    }
                    true
                } else if self.cube_coord[0] < 1 {
                    if self.cube_coord[2] > 3*self.gp_index as isize {
                        self.cube_coord = [1, 1, 3*self.gp_index as isize-2];
                        self.triangle_latitude = (self.triangle_latitude+3)%5;
                    } else {
                        self.cube_coord = [self.cube_coord[1]+self.cube_coord[0], -self.cube_coord[0], self.cube_coord[2]+self.cube_coord[0]];
                        self.triangle_latitude = (self.triangle_latitude+4)%5;
                    }
                    true
                } else if self.cube_coord[1] < 0 {
                    if self.cube_coord[0] > 3*self.gp_index as isize {
                        self.cube_coord = [3*self.gp_index as isize-2, 1, 1];
                        self.triangle_latitude = (self.triangle_latitude+1)%5;
                        self.triangle_longitude ^= 1;
                    } else if self.cube_coord[2] > 3*self.gp_index as isize {
                        self.cube_coord = [1, 1, 3*self.gp_index as isize-2];
                        self.triangle_latitude = (self.triangle_latitude+2)%5;
                    } else {
                        self.cube_coord = [-self.cube_coord[1], self.cube_coord[0]+self.cube_coord[1], self.cube_coord[2]+self.cube_coord[1]];
                        self.triangle_latitude = (self.triangle_latitude+1)%5;
                    }
                    true
                } else {
                    false
                }
            },
            _ => unreachable!()
        }
    }

    pub fn navigate(&mut self, direction: Direction) {
        let dir = match direction {
            Direction::NX => [-2, 1, 1],
            Direction::PX => [2, -1, -1],
            Direction::NY => [1, -2, 1],
            Direction::PY => [-1, 2, -1],
            Direction::NZ => [1, 1, -2],
            Direction::PZ => [-1, -1, 2],
        };
        let sign = if self.triangle_longitude%2 == 1 { -1 } else { 1 };
        for i in 0..3 {
            self.cube_coord[i] += sign*dir[i];
        }
        self.normalize();
    }

    pub fn pole_indices(&self) -> [u8; 3] {
        match self.triangle_longitude {
            3 => [6+self.triangle_latitude, 6+(self.triangle_latitude+1)%5, 11],
            2 => [6+(self.triangle_latitude +1)%5, 6+self.triangle_latitude, 1+self.triangle_latitude],
            1 => [1+self.triangle_latitude, 1+(self.triangle_latitude+1)%5, 6+(self.triangle_latitude+1)%5],
            0 => [1+(self.triangle_latitude+1)%5, 1+self.triangle_latitude, 0],
            _ => panic!()
        }
    }

    pub fn poles(&self) -> [glam::Vec3A; 3] {
        let pole_indices = self.pole_indices();
        [
            icosahedron_vertex(pole_indices[0]),
            icosahedron_vertex(pole_indices[1]),
            icosahedron_vertex(pole_indices[2]),
        ]
    }

    /*pub fn distance_to_closest_pole(&self) -> usize {
        return self.gp_index-isize::max(isize::max(self.cube_coord[0], self.cube_coord[1]), self.cube_coord[2]) as usize/3;
    }

    pub fn closest_pole(&self) -> u8 {
        let max_coord = isize::max(isize::max(self.cube_coord[0], self.cube_coord[1]), self.cube_coord[2]);
        let pole_indices = self.pole_indices();
        for i in 0..3 {
            if self.cube_coord[i] == max_coord {
                return pole_indices[i];
            }
        }
        unreachable!();
    }*/

    pub fn is_pole(&self) -> bool {
        return self.cube_coord[0] == self.gp_index as isize*3 || self.cube_coord[1] == self.gp_index as isize*3 || self.cube_coord[2] == self.gp_index as isize*3;
    }

    pub fn direction_3d(&self) -> glam::Vec3A {
        let barycentric = glam::Vec3A::new(self.cube_coord[0] as f32, self.cube_coord[1] as f32, self.cube_coord[2] as f32)/(self.gp_index as f32*3.0);
        barycentric_interpolation(barycentric, self.poles())
    }

    pub fn shortest_path<C: FnMut(&Self)>(start: &Self, end: &Self, mut callback: C) {
        let start_dir = start.direction_3d();
        let end_dir = end.direction_3d();
        let great_cricle_normal = start_dir.cross(end_dir).normalize();
        let mut current = *start;
        loop {
            callback(&current);
            if current == *end {
                break;
            }
            let current_dir = current.direction_3d();
            let forward_normal = great_cricle_normal.cross(current_dir);
            let mut best_distance = std::f32::INFINITY;
            let mut best_candidate = current;
            for side in &[Direction::NX, Direction::PX, Direction::NY, Direction::PY, Direction::NZ, Direction::PZ] {
                let mut candidate = current;
                candidate.navigate(*side);
                let candidate_dir = candidate.direction_3d();
                if candidate_dir.dot(forward_normal) < 0.0 {
                    continue;
                }
                let dist_to_great_cricle = candidate_dir.dot(great_cricle_normal).abs();
                if dist_to_great_cricle < best_distance {
                    best_distance = dist_to_great_cricle;
                    best_candidate = candidate;
                }
            }
            current = best_candidate;
        }
    }
}

#[derive(Default, Clone)]
pub struct Field {
    terrain: u8,
    selection: (u8, u8, u8),
}

pub struct Planet {
    pub gp_index: usize,
    fields: Vec<Field>,
    terrain_and_selection_texture: crate::assets::Texture,
    atmosphere_density_texture: Option<crate::assets::Texture>,
}

impl Planet {
    pub fn new(device: &wgpu::Device, gp_index: usize) -> Self {
        let mut fields = vec![Field::default(); ParallelogramCoordinate::parallelogram_area(gp_index)*5+2];
        let mut prng = SmallRng::from_seed([0; 16]);
        for field in &mut fields {
            field.terrain = prng.gen::<u8>()%5;
            field.selection = (0, 0, 0); // (prng.gen::<u8>()%2)*0x0F
        }

        /*TriangleCoordinate::shortest_path(
            &TriangleCoordinate::new(gp_index, [0, 12, 3], 1, 1),
            &TriangleCoordinate::new(gp_index, [5, 8, 2], 3, 1),
            |triangle_coordinate: &TriangleCoordinate| {
                let parallelogram_coordinate = ParallelogramCoordinate::from_triangle_coordinate(triangle_coordinate);
                let field = &mut fields[parallelogram_coordinate.index_in_total()];
                field.selection.0 = 15;
                println!("{:?}", triangle_coordinate);
            }
        );*/

        let block_width = ParallelogramCoordinate::parallelogram_width(gp_index)+3;
        let block_height = ParallelogramCoordinate::parallelogram_height(gp_index)+4;
        let size = wgpu::Extent3d { width: block_width as u32*5, height: block_height as u32, depth: 1 };
        let terrain_and_selection_texture = crate::assets::Texture::new(device, size, false, false, wgpu::TextureDimension::D2, wgpu::TextureFormat::Rg8Uint);
        let atmosphere_density_texture = Some(crate::assets::Texture::new(device, wgpu::Extent3d { width: 128, height: 128, depth: 1 }, false, true, wgpu::TextureDimension::D2, wgpu::TextureFormat::Rg16Float));

        Self {
            gp_index,
            fields,
            terrain_and_selection_texture,
            atmosphere_density_texture,
        }
    }

    pub fn surface_radius(&self) -> f32 {
        self.gp_index as f32*3.0*ICOSAHEDRON_RADIUS_BY_EDGE_LENGTH
    }

    pub fn atmosphere_radius(&self) -> f32 {
        self.surface_radius()*1.2
    }

    pub fn surface_matrix(&self, triangle_coordinate: &TriangleCoordinate) -> glam::Mat4 {
        let poles = triangle_coordinate.poles();
        let barycentric = glam::Vec3A::new(triangle_coordinate.cube_coord[0] as f32, triangle_coordinate.cube_coord[1] as f32, triangle_coordinate.cube_coord[2] as f32)/(triangle_coordinate.gp_index as f32*3.0);
        let up = barycentric_interpolation(barycentric, poles);
        let mut pole_cotangets = poles;
        pole_cotangets[0] = pole_cotangets[0].cross(glam::Vec3A::new(0.0, 1.0, 0.0)).normalize();
        pole_cotangets[1] = pole_cotangets[1].cross(glam::Vec3A::new(0.0, 1.0, 0.0)).normalize();
        pole_cotangets[2] = (pole_cotangets[0]+pole_cotangets[1])*0.5;
        let cotanget = barycentric_interpolation(barycentric, pole_cotangets);
        let tanget = cotanget.cross(up);
        let pos = up*self.surface_radius();
        glam::Mat4::from_cols(
            cotanget.extend(0.0),
            up.extend(0.0),
            tanget.extend(0.0),
            pos.extend(1.0),
        )
    }

    pub fn generate_terrain_and_selection_texture(&self, queue: &wgpu::Queue) {
        let block_width = ParallelogramCoordinate::parallelogram_width(self.gp_index)+3;
        let size = &self.terrain_and_selection_texture.size;
        let mut pixels: Vec<(u8, u8)> = vec![(255, 255); (size.width*size.height*size.depth) as usize];
        for parallelogram_latitude in 0..5 {
            for x in 0..block_width {
                for y in 0..size.height as usize {
                    let mut parallelogram_coordinate = ParallelogramCoordinate::new(self.gp_index, [x as isize-1, y as isize-2], parallelogram_latitude as u8);
                    let mut triangle_coordinate = TriangleCoordinate::from_parallelogram_coordinate(&parallelogram_coordinate);
                    if triangle_coordinate.normalize() {
                        if x == block_width-1 {
                            if y == self.gp_index*2+1 {
                                triangle_coordinate.triangle_longitude = 3;
                                triangle_coordinate.cube_coord = [self.gp_index as isize*3-2, 1, 1];
                            } else if y == 1 {
                                triangle_coordinate.triangle_longitude = 1;
                                triangle_coordinate.cube_coord = [self.gp_index as isize*3-2, 1, 1];
                            }
                        } else if x == block_width-2 && y == 1 {
                            triangle_coordinate.triangle_longitude = 0;
                            triangle_coordinate.cube_coord = [1, self.gp_index as isize*3-2, 1];
                        }
                        parallelogram_coordinate = ParallelogramCoordinate::from_triangle_coordinate(&triangle_coordinate);
                    }
                    let field = &self.fields[parallelogram_coordinate.index_in_total()];
                    pixels[y*size.width as usize+parallelogram_latitude*block_width+x] = (field.terrain|(field.selection.0<<4), (field.selection.1<<4)|field.selection.2);
                }
            }
        }
        self.terrain_and_selection_texture.upload_pixels(queue, 0, unsafe { crate::transmute_slice(&pixels[..]) });
    }

    pub fn generate_atmosphere(&mut self, device: &wgpu::Device, encoder: &mut wgpu::CommandEncoder, planet_renderer: &PlanetRenderer) {
        let atmosphere_density_texture = self.atmosphere_density_texture.as_ref().unwrap();
        let meta_data = &[
            self.atmosphere_radius(),
            self.surface_radius(),
            4.0,
        ];
        let atmosphere_precompute_bind_group = device.create_bind_group(&bind_group_descriptor!(
            &planet_renderer.atmosphere_precompute_bind_group_layout,
            0 => TextureView(&atmosphere_density_texture.view),
        ));
        let mut pass = encoder.begin_compute_pass();
        pass.set_pipeline(&planet_renderer.atmosphere_precompute_pipeline);
        pass.set_push_constants(0, unsafe { crate::transmute_slice::<f32, u32>(meta_data) });
        pass.set_bind_group(0, &atmosphere_precompute_bind_group, &[]);
        let x_work_group_count = 32;
        let y_work_group_count = 32;
        pass.dispatch(
            (atmosphere_density_texture.size.width+x_work_group_count-1)/x_work_group_count,
            (atmosphere_density_texture.size.height+y_work_group_count-1)/y_work_group_count,
            1,
        );
    }
}

pub struct PlanetRenderer {
    pub atmosphere_precompute_bind_group_layout: wgpu::BindGroupLayout,
    pub atmosphere_precompute_pipeline: wgpu::ComputePipeline,
    atmosphere_sampler: wgpu::Sampler,
    surface_pipeline: wgpu::RenderPipeline,
    surface_bind_group_layout: wgpu::BindGroupLayout,
    surface_bind_group: Option<wgpu::BindGroup>,
    atmosphere_pipeline: wgpu::RenderPipeline,
    atmosphere_bind_group_layout: wgpu::BindGroupLayout,
    atmosphere_bind_group: Option<wgpu::BindGroup>,
}

impl PlanetRenderer {
    pub fn new(device: &wgpu::Device, renderer: &crate::renderer::Renderer, asset_pack: &crate::assets::AssetPack) -> Self {
        let atmosphere_precompute_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStage::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        dimension: wgpu::TextureViewDimension::D2,
                        format: wgpu::TextureFormat::Rg16Float,
                        readonly: false,
                    },
                    count: None,
                },
            ],
        });

        let atmosphere_precompute_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[
                    wgpu::PushConstantRange {
                        stages: wgpu::ShaderStage::COMPUTE,
                        range: 0..std::mem::size_of::<[f32; 3]>() as u32,
                    }
                ],
                bind_group_layouts: &[&atmosphere_precompute_bind_group_layout],
            });

        let atmosphere_precompute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: None,
            layout: Some(&atmosphere_precompute_pipeline_layout),
            compute_stage: shader_module!(asset_pack, "assets/shader_modules/atmosphere_pre_comp"),
        });

        let atmosphere_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: None,
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            lod_min_clamp: 0.0,
            lod_max_clamp: std::f32::INFINITY,
            compare: None,
            anisotropy_clamp: None,
        });

        let surface_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
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
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStage::FRAGMENT,
                    ty: wgpu::BindingType::SampledTexture {
                        multisampled: false,
                        dimension: wgpu::TextureViewDimension::D2,
                        component_type: wgpu::TextureComponentType::Uint,
                    },
                    count: None,
                },
            ],
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
            "assets/shader_modules/planet_surface_frag",
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

        let atmosphere_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
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

        let atmosphere_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                push_constant_ranges: &[
                    wgpu::PushConstantRange {
                        stages: wgpu::ShaderStage::FRAGMENT,
                        range: 0..std::mem::size_of::<[f32; 3]>() as u32,
                    }
                ],
                bind_group_layouts: &[
                    &renderer.bind_group_layouts.volumetric_pass_bind_group_layout,
                    &renderer.bind_group_layouts.camera_uniforms_bind_group_layout,
                    &atmosphere_bind_group_layout,
                ],
            });

        let atmosphere_pipeline =
            device.create_render_pipeline(&volumetric_pass_pipeline_descriptor!(
                asset_pack, renderer,
                atmosphere_pipeline_layout,
                "assets/shader_modules/sphere_billboard_vert",
                "assets/shader_modules/planet_atmosphere_frag"
            ));

        Self {
            atmosphere_precompute_bind_group_layout,
            atmosphere_precompute_pipeline,
            atmosphere_sampler,
            surface_pipeline,
            surface_bind_group_layout,
            surface_bind_group: None,
            atmosphere_pipeline,
            atmosphere_bind_group_layout,
            atmosphere_bind_group: None,
        }
    }

    pub fn generate_bind_group(&mut self, device: &wgpu::Device, renderer: &crate::renderer::Renderer, asset_pack: &crate::assets::AssetPack, planet: &Planet) {
        self.surface_bind_group = Some(device.create_bind_group(&bind_group_descriptor!(
            &self.surface_bind_group_layout,
            0 => Sampler(&renderer.sampler),
            1 => TextureView(&asset_pack.textures[&std::path::PathBuf::from("assets/textures/terrain")].view),
            2 => TextureView(&planet.terrain_and_selection_texture.view),
        )));
        self.atmosphere_bind_group = Some(device.create_bind_group(&bind_group_descriptor!(
            &self.atmosphere_bind_group_layout,
            0 => Sampler(&self.atmosphere_sampler),
            1 => TextureView(&planet.atmosphere_density_texture.as_ref().unwrap().view),
        )));
    }

    pub fn render_surface<'a>(&'a self, render_pass: &mut wgpu::RenderPass<'a>, instances_indices: std::ops::Range<u32>) {
        render_pass.set_pipeline(&self.surface_pipeline);
        render_pass.set_bind_group(0, self.surface_bind_group.as_ref().unwrap(), &[]);
        render_pass.draw(0..4 as u32, instances_indices);
    }

    pub fn render_atmosphere<'a>(&'a self, render_pass: &mut wgpu::RenderPass<'a>, instances_indices: std::ops::Range<u32>) {
        let meta_data = &[0.0, 0.0, -1.0];
        render_pass.set_pipeline(&self.atmosphere_pipeline);
        render_pass.set_push_constants(wgpu::ShaderStage::FRAGMENT, 0, unsafe { crate::transmute_slice::<f32, u32>(meta_data) });
        render_pass.set_bind_group(2, self.atmosphere_bind_group.as_ref().unwrap(), &[]);
        render_pass.draw(0..4 as u32, instances_indices);
    }
}
