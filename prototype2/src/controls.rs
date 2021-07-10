use iced_wgpu::{Renderer, wgpu};
use iced_winit::{
    Text, Align, Color, Column, Command, Element, Length, Program, Row,
    // slider, Slider,
    winit::dpi::{PhysicalPosition, PhysicalSize},
    winit::event::{VirtualKeyCode, KeyboardInput, ModifiersState, MouseScrollDelta, TouchPhase, ElementState, MouseButton},
};

pub struct Controls {
    pub render_options: crate::renderer::RenderOptions,
    pub viewport_size: PhysicalSize<u32>,
    pub pointer_state: ElementState,
    pub pointer_position: PhysicalPosition<f64>,
    pub normalized_pointer_position: glam::Vec2,
    pub start_normalized_pointer_position: glam::Vec2,
    pub modifiers: ModifiersState,
    pub view_quaternion: glam::Quat,
    pub start_view_quaternion: glam::Quat,
    pub camera: crate::camera::Camera,
    pub view_zoom: f32,
    pub planet: crate::planet::Planet,
    pub selection_matrix: glam::Mat4,
    // sliders: [slider::State; 3],
}

#[derive(Debug, Clone)]
pub enum Message {
    KeyboardInput(KeyboardInput),
    ModifiersChanged(ModifiersState),
    CursorMoved(PhysicalPosition<f64>),
    CursorEntered,
    CursorLeft,
    MouseWheel(MouseScrollDelta, TouchPhase),
    MouseInput(MouseButton, ElementState),
    Resized(PhysicalSize<u32>),
    // SlidersChanged(glam::Vec3),
}

impl Controls {
    pub fn new(device: &wgpu::Device) -> Self {
        let mut controls = Self {
            render_options: crate::renderer::RenderOptions {
                scale_factor: 1.0,
                enable_frustum_culling: false,
                enable_occulsion_culling: false,
                enable_shadow_mapping: false,
            },
            viewport_size: PhysicalSize::new(0, 0),
            pointer_state: ElementState::Released,
            pointer_position: PhysicalPosition::new(0.0, 0.0),
            normalized_pointer_position: glam::Vec2::splat(0.0),
            start_normalized_pointer_position: glam::Vec2::splat(0.0),
            modifiers: ModifiersState::default(),
            view_quaternion: glam::Quat::identity(),
            start_view_quaternion: glam::Quat::identity(),
            camera: crate::camera::Camera::default(),
            view_zoom: 3.0,
            planet: crate::planet::Planet::new(device, 5),
            selection_matrix: glam::Mat4::from_scale(glam::Vec3::splat(0.0)),
            // sliders: Default::default(),
        };
        controls.update_camera_projection();
        controls
    }

    fn update_camera(&mut self) {
        self.camera.set_world_matrix(glam::Mat4::from_quat(self.view_quaternion).inverse()*glam::Mat4::from_translation(glam::Vec3::new(0.0, 0.0, self.view_zoom.exp())));
    }

    fn update_camera_projection(&mut self) {
        self.view_zoom = self.view_zoom.max(3.0).min(10.0);
        self.camera.set_perspective(self.view_zoom.exp()*0.25, 100000.0, std::f32::consts::PI*0.3, self.viewport_size.width as f32/self.viewport_size.height as f32);
        self.update_camera();
    }
}

impl Program for Controls {
    type Renderer = Renderer;
    type Message = Message;

    fn update(&mut self, message: Message) -> Command<Message> {
        match message {
            Message::KeyboardInput(input) if input.state == ElementState::Pressed => {
                match input.virtual_keycode {
                    Some(VirtualKeyCode::Escape) => {
                        // TODO
                    },
                    Some(VirtualKeyCode::A) => {
                        self.view_quaternion = (self.view_quaternion*glam::Quat::from_rotation_y(0.1)).normalize();
                        self.update_camera();
                    },
                    Some(VirtualKeyCode::D) => {
                        self.view_quaternion = (self.view_quaternion*glam::Quat::from_rotation_y(-0.1)).normalize();
                        self.update_camera();
                    },
                    Some(VirtualKeyCode::W) => {
                        self.view_quaternion = (glam::Quat::from_rotation_x(0.1)*self.view_quaternion).normalize();
                        self.update_camera();
                    },
                    Some(VirtualKeyCode::S) => {
                        self.view_quaternion = (glam::Quat::from_rotation_x(-0.1)*self.view_quaternion).normalize();
                        self.update_camera();
                    },
                    Some(VirtualKeyCode::X) => {
                        self.view_zoom += 0.05;
                        self.update_camera_projection();
                    },
                    Some(VirtualKeyCode::Y) => {
                        self.view_zoom -= 0.05;
                        self.update_camera_projection();
                    },
                    _ => {}
                }
            },
            Message::KeyboardInput(_input) => {},
            Message::ModifiersChanged(modifiers) => {
                self.modifiers = modifiers;
            },
            Message::CursorMoved(position) => {
                self.pointer_position = position;
                self.normalized_pointer_position[0] = (position.x as f32/self.viewport_size.width as f32)*2.0-1.0;
                self.normalized_pointer_position[1] = 1.0-(position.y as f32/self.viewport_size.height as f32)*2.0;
                if self.pointer_state == ElementState::Pressed {
                    let diff = self.normalized_pointer_position-self.start_normalized_pointer_position;
                    self.view_quaternion = (glam::Quat::from_rotation_y(diff[0])*glam::Quat::from_rotation_x(-diff[1])*self.start_view_quaternion).normalize();
                    self.update_camera();
                }
            },
            Message::CursorEntered => {},
            Message::CursorLeft => {},
            Message::MouseWheel(delta, _phase) => {
                self.view_zoom += match delta {
                    MouseScrollDelta::LineDelta(_x, y) => y as f32*0.05,
                    MouseScrollDelta::PixelDelta(delta) => delta.y as f32*0.005,
                };
                self.update_camera_projection();
            },
            Message::MouseInput(button, state) => {
                if button == MouseButton::Middle {
                    if self.pointer_state == ElementState::Released && state == ElementState::Pressed {
                        self.start_normalized_pointer_position = self.normalized_pointer_position;
                        self.start_view_quaternion = self.view_quaternion;
                    }
                    self.pointer_state = state;
                }
            },
            Message::Resized(viewport_size) => {
                self.viewport_size = viewport_size;
                self.update_camera_projection();
            },
            /*Message::SlidersChanged(vector) => {
                self.vector = vector;
            }*/
        }

        Command::none()
    }

    fn view(&mut self) -> Element<Message, Renderer> {
        /*let [x, y, z] = &mut self.sliders;
        let sliders = Row::new()
            .width(Length::Units(1000))
            .spacing(20)
            .push(
                Slider::new(x, 0.0..=1.0, vector.x(), move |x| {
                    Message::SlidersChanged(glam::Vec3::new(x, vector.y(), vector.z()))
                })
                .step(0.001),
            )
            .push(
                Slider::new(y, 0.0..=1.0, vector.y(), move |y| {
                    Message::SlidersChanged(glam::Vec3::new(vector.x(), y, vector.z()))
                })
                .step(0.001),
            )
            .push(
                Slider::new(z, 0.0..=1.0, vector.z(), move |z| {
                    Message::SlidersChanged(glam::Vec3::new(vector.x(), vector.y(), z))
                })
                .step(0.001),
            );*/

        self.selection_matrix = glam::Mat4::from_scale(glam::Vec3::splat(0.0));
        let view_ray = self.camera.get_view_ray(self.normalized_pointer_position[0], self.normalized_pointer_position[1]);
        let triangle_coordinate = crate::camera::ray_sphere_intersection(&view_ray, self.planet.surface_radius()).and_then(|(_distance, first_hit, _second_hit)| {
            let direction = first_hit.normalize(); // (first_hit-center).normalize();
            let triangle_coordinate = crate::planet::TriangleCoordinate::from_direction_3d(self.planet.gp_index, direction);
            // let prev = (triangle_coordinate.cube_coord, triangle_coordinate.triangle_latitude, triangle_coordinate.triangle_longitude);
            // triangle_coordinate.navigate(self.direction);
            self.selection_matrix = self.planet.surface_matrix(&triangle_coordinate);
            // let parallelogram_coord = crate::planet::ParallelogramCoordinate::from_triangle_coordinate(triangle_coordinate);
            // let triangle_coordinate = crate::planet::TriangleCoordinate::from_parallelogram_coordinate(parallelogram_coord);
            let next = (triangle_coordinate.cube_coord, triangle_coordinate.triangle_latitude, triangle_coordinate.triangle_longitude);
            Some(next)
        });

        Row::new()
            .width(Length::Fill)
            .height(Length::Fill)
            .align_items(Align::End)
            .push(
                Column::new()
                    .width(Length::Fill)
                    .align_items(Align::End)
                    .push(
                        Column::new()
                            .padding(10)
                            .spacing(10)
                            .push(
                                Text::new("Field").color(Color::WHITE),
                            )
                            // .push(sliders)
                            .push(
                                Text::new(format!("{:?}", triangle_coordinate)).size(14).color(Color::WHITE),
                            ),
                    ),
            )
            .into()
    }
}
