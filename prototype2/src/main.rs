mod controls;
#[macro_use]
mod renderer;
mod bounding_volume;
mod camera;
mod assets;
mod particle;
mod planet;
mod star;

use iced_wgpu::{wgpu, Backend, Renderer, Settings, Viewport};
use iced_winit::{
    conversion, futures, futures::task::SpawnExt, program, Debug, Size,
    winit, winit::event::{Event, WindowEvent},
};

/*pub unsafe fn transmute_vec<S, T>(mut vec: Vec<S>) -> Vec<T> {
    let ptr = vec.as_mut_ptr() as *mut T;
    let len = vec.len()*std::mem::size_of::<S>()/std::mem::size_of::<T>();
    let capacity = vec.capacity()*std::mem::size_of::<S>()/std::mem::size_of::<T>();
    std::mem::forget(vec);
    Vec::from_raw_parts(ptr, len, capacity)
}*/

pub unsafe fn transmute_slice<S, T>(slice: &[S]) -> &[T] {
    let ptr = slice.as_ptr() as *const T;
    let len = slice.len()*std::mem::size_of::<S>()/std::mem::size_of::<T>();
    std::slice::from_raw_parts(ptr, len)
}

pub unsafe fn transmute_slice_mut<S, T>(slice: &mut [S]) -> &mut [T] {
    let ptr = slice.as_mut_ptr() as *mut T;
    let len = slice.len()*std::mem::size_of::<S>()/std::mem::size_of::<T>();
    std::slice::from_raw_parts_mut(ptr, len)
}

fn generate_swap_chain_descriptor(window: &winit::window::Window, scale_factor: f32) -> wgpu::SwapChainDescriptor {
    let size = window.inner_size();
    wgpu::SwapChainDescriptor {
        usage: wgpu::TextureUsage::OUTPUT_ATTACHMENT,
        format: wgpu::TextureFormat::Bgra8UnormSrgb,
        width: (size.width as f32*scale_factor) as u32,
        height: (size.height as f32*scale_factor) as u32,
        present_mode: wgpu::PresentMode::Mailbox,
    }
}

pub fn main() {
    // env_logger::init();

    let event_loop = winit::event_loop::EventLoop::new();
    let window = winit::window::Window::new(&event_loop).unwrap();

    let physical_size = window.inner_size();
    let mut viewport = Viewport::with_physical_size(
        Size::new(physical_size.width, physical_size.height),
        window.scale_factor(),
    );

    let instance = wgpu::Instance::new(wgpu::BackendBit::PRIMARY);
    let surface = unsafe { instance.create_surface(&window) };

    let (mut device, queue) = futures::executor::block_on(async {
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::Default,
                compatible_surface: Some(&surface),
            })
            .await
            .unwrap();

        adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    features: wgpu::Features::PUSH_CONSTANTS|wgpu::Features::SAMPLED_TEXTURE_ARRAY_NON_UNIFORM_INDEXING,
                    limits: wgpu::Limits {
                        max_push_constant_size: 128,
                        ..Default::default()
                    },
                    shader_validation: false,
                },
                None,
            )
            .await
            .unwrap()
    });

    let mut resized = false;
    let mut staging_belt = wgpu::util::StagingBelt::new(5 * 1024);
    let mut local_pool = futures::executor::LocalPool::new();
    let mut controls = controls::Controls::new(&device);

    let (mut swap_chain, mut renderer, asset_pack, particle_renderer, particle_system, planet_renderer, star_renderer) = {
        let mut encoder = device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: None },
        );
        let swap_chain_descriptor = generate_swap_chain_descriptor(&window, controls.render_options.scale_factor);
        let swap_chain = device.create_swap_chain(&surface, &swap_chain_descriptor);
        let mut path_pool = assets::AssetPack::create_path_pool();
        assets::AssetPack::collect_paths(&mut path_pool, &std::path::PathBuf::from("assets/shader_modules/"));
        let mut asset_pack = assets::AssetPack::default();
        asset_pack.load(&device, &queue, &mut encoder, None, None, None, &path_pool).unwrap();
        let mipmap_generator = assets::MipmapGenerator::new(&device, &asset_pack);
        let renderer = renderer::Renderer::new(&mut device, &swap_chain_descriptor, &controls.render_options, &asset_pack);
        let mut path_pool = assets::AssetPack::create_path_pool();
        assets::AssetPack::collect_paths(&mut path_pool, &std::path::PathBuf::from("assets/example/meshes/hex/"));
        assets::AssetPack::collect_paths(&mut path_pool, &std::path::PathBuf::from("assets/textures/"));
        asset_pack.load(&device, &queue, &mut encoder, Some(&renderer.bind_group_layouts.surface_pass_bind_group_layout), Some(&renderer.sampler), Some(&mipmap_generator), &path_pool).unwrap();
        let particle_renderer = particle::ParticleRenderer::new(&device, &renderer, &asset_pack);
        let particle_system = crate::particle::ParticleSystem::new(&device, &particle_renderer, 512);
        {
            let matrices = [
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 0, 0)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 0, 1)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 0, 2)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 0, 3)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 1, 0)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 1, 1)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 1, 2)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 1, 3)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 2, 0)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 2, 1)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 2, 2)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 2, 3)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 3, 0)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 3, 1)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 3, 2)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 3, 3)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 4, 0)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 4, 1)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 4, 2)),
                controls.planet.surface_matrix(&crate::planet::TriangleCoordinate::new(controls.planet.gp_index, [5, 5, 5], 4, 3)),
            ];
            particle_system.generate_clouds(&queue, &matrices);
        }
        let mut planet_renderer = planet::PlanetRenderer::new(&device, &renderer, &asset_pack);
        controls.planet.generate_terrain_and_selection_texture(&queue);
        controls.planet.generate_atmosphere(&device, &mut encoder, &planet_renderer);
        planet_renderer.generate_bind_group(&device, &renderer, &asset_pack, &controls.planet);
        let star_renderer = star::StarRenderer::new(&device, &renderer, &asset_pack);
        staging_belt.finish();
        queue.submit(Some(encoder.finish()));
        (swap_chain, renderer, asset_pack, particle_renderer, particle_system, planet_renderer, star_renderer)
    };

    let cursor_position = conversion::cursor_position(controls.pointer_position, viewport.scale_factor());
    let mut gui_debug = Debug::new();
    let mut gui_renderer = Renderer::new(Backend::new(&mut device, Settings::default()));
    let mut gui_state = program::State::new(
        controls,
        viewport.logical_size(),
        cursor_position,
        &mut gui_renderer,
        &mut gui_debug,
    );
    gui_state.queue_message(controls::Message::Resized(physical_size));

    event_loop.run(move |event, _, control_flow| {
        *control_flow = winit::event_loop::ControlFlow::Wait;

        match event {
            Event::WindowEvent { event, .. } => {
                match event {
                    WindowEvent::KeyboardInput { input, .. } => {
                        gui_state.queue_message(controls::Message::KeyboardInput(input));
                    },
                    WindowEvent::CursorEntered { .. } => {
                        gui_state.queue_message(controls::Message::CursorEntered);
                    },
                    WindowEvent::CursorLeft { .. } => {
                        gui_state.queue_message(controls::Message::CursorLeft);
                    },
                    WindowEvent::MouseWheel { delta, phase, .. } => {
                        gui_state.queue_message(controls::Message::MouseWheel(delta, phase));
                    },
                    WindowEvent::ModifiersChanged(new_modifiers) => {
                        gui_state.queue_message(controls::Message::ModifiersChanged(new_modifiers));
                    },
                    WindowEvent::CursorMoved { position, .. } => {
                        gui_state.queue_message(controls::Message::CursorMoved(position));
                    },
                    WindowEvent::MouseInput { state, button, .. } => {
                        gui_state.queue_message(controls::Message::MouseInput(button, state));
                    },
                    WindowEvent::Resized(new_size) => {
                        gui_state.queue_message(controls::Message::Resized(new_size));
                        viewport = Viewport::with_physical_size(
                            Size::new(new_size.width, new_size.height),
                            window.scale_factor(),
                        );
                        resized = true;
                    },
                    WindowEvent::CloseRequested => {
                        *control_flow = winit::event_loop::ControlFlow::Exit;
                    },
                    _ => {}
                }

                let program = gui_state.program();
                if let Some(event) = iced_winit::conversion::window_event(
                    &event,
                    window.scale_factor(),
                    program.modifiers,
                ) {
                    gui_state.queue_event(event);
                }
            }
            Event::MainEventsCleared => {
                if !gui_state.is_queue_empty() {
                    let program = gui_state.program();
                    let cursor_position = conversion::cursor_position(program.pointer_position, viewport.scale_factor());
                    let _ = gui_state.update(
                        viewport.logical_size(),
                        cursor_position,
                        None,
                        &mut gui_renderer,
                        &mut gui_debug,
                    );
                    window.request_redraw();
                }
            }
            Event::RedrawRequested(_) => {
                let controls = gui_state.program();

                if resized {
                    let swap_chain_descriptor = generate_swap_chain_descriptor(&window, controls.render_options.scale_factor);
                    swap_chain = device.create_swap_chain(&surface, &swap_chain_descriptor);
                    renderer.resize(&mut device, &swap_chain_descriptor);
                    resized = false;
                }

                let mut encoder = device.create_command_encoder(
                    &wgpu::CommandEncoderDescriptor { label: None },
                );

                renderer.update_instances(
                    &mut encoder,
                    &queue,
                    &[
                        glam::Mat4::from_scale_rotation_translation(glam::Vec3::splat(2.0), glam::Quat::from_rotation_x(-0.1*std::f32::consts::PI), glam::Vec3::new(0.0, 14.5, 0.0)),
                        glam::Mat4::from_scale_rotation_translation(glam::Vec3::splat(2.0), glam::Quat::identity(), glam::Vec3::new(14.5, 0.0, 0.0)),
                        glam::Mat4::from_scale_rotation_translation(glam::Vec3::new(20.0, 20.0, 40.0), glam::Quat::identity(), glam::Vec3::new(0.0, 0.0, 20.0)),
                        controls.selection_matrix,
                        glam::Mat4::from_scale(glam::Vec3::splat(controls.planet.surface_radius())),
                        glam::Mat4::from_scale(glam::Vec3::splat(controls.planet.atmosphere_radius())),
                        glam::Mat4::from_scale_rotation_translation(glam::Vec3::splat(500.0), glam::Quat::identity(), glam::Vec3::new(0.0, 0.0, 5000.0)),
                        glam::Mat4::from_scale_rotation_translation(glam::Vec3::splat(500.0*1.75), glam::Quat::identity(), glam::Vec3::new(0.0, 0.0, 5000.0)),
                        glam::Mat4::identity(),
                    ]
                );
                renderer.update_camera(&mut encoder, &queue, 8, &controls.camera);
                {
                    let mut surface_pass = renderer.render_surface_pass(&mut encoder);
                    surface_pass.set_pipeline(&renderer.render_pipelines.surface_pass_pipeline);
                    asset_pack.meshes[&std::path::PathBuf::from("assets/example/meshes/hex/hex/Circle")].render(&mut surface_pass, 3..4);
                    star_renderer.render_surface(&mut surface_pass, 6..7);
                    planet_renderer.render_surface(&mut surface_pass, 4..5);
                    particle_renderer.render_surface(&mut surface_pass, &particle_system, 8..9);
                }
                {
                    let mut volumetric_pass = renderer.render_volumetric_pass(&mut encoder);
                    planet_renderer.render_atmosphere(&mut volumetric_pass, 5..6);
                    star_renderer.render_atmosphere(&mut volumetric_pass, 7..8);
                }
                let frame = swap_chain.get_current_frame().unwrap();
                renderer.render_frame(&mut encoder, &frame.output.view);

                let mouse_interaction = gui_renderer.backend_mut().draw(
                    &mut device,
                    &mut staging_belt,
                    &mut encoder,
                    &frame.output.view,
                    &viewport,
                    gui_state.primitive(),
                    &gui_debug.overlay(),
                );
                window.set_cursor_icon(
                    iced_winit::conversion::mouse_interaction(mouse_interaction)
                );

                staging_belt.finish();
                queue.submit(Some(encoder.finish()));

                local_pool.spawner().spawn(staging_belt.recall()).unwrap();
                local_pool.run_until_stalled();
            }
            _ => {}
        }
    })
}
