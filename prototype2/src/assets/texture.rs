use iced_wgpu::wgpu;
use crate::assets::AssetError;

pub struct Texture {
    pub size: wgpu::Extent3d,
    pub mip_level_count: u32,
    pub dimension: wgpu::TextureDimension,
    pub format: wgpu::TextureFormat,
    pub texture: wgpu::Texture,
    pub view: wgpu::TextureView,
}

pub struct ArrayTextureLayer<'a> {
    pub layer_index: u32,
    pub texture: &'a Texture,
}

impl Texture {
    pub fn new(device: &wgpu::Device, size: wgpu::Extent3d, mipmap: bool, computed: bool, dimension: wgpu::TextureDimension, format: wgpu::TextureFormat) -> Self {
        let mip_level_count = if mipmap { std::mem::size_of::<u32>() as u32*8-size.width.max(size.height).max(size.depth).leading_zeros() } else { 1 };
        let mut texture_descriptor = wgpu::TextureDescriptor {
            label: None,
            size,
            mip_level_count,
            sample_count: 1,
            dimension,
            format,
            usage: wgpu::TextureUsage::SAMPLED,
        };
        if mipmap || computed {
            texture_descriptor.usage |= wgpu::TextureUsage::STORAGE;
        }
        if !computed {
            texture_descriptor.usage |= wgpu::TextureUsage::COPY_DST;
        }
        let texture = device.create_texture(&texture_descriptor);
        let view = texture.create_view(&wgpu::TextureViewDescriptor {
            ..wgpu::TextureViewDescriptor::default()
        });
        Self {
            size: texture_descriptor.size,
            mip_level_count: texture_descriptor.mip_level_count,
            dimension: texture_descriptor.dimension,
            format: texture_descriptor.format,
            texture,
            view,
        }
    }

    pub fn upload_pixels<'a>(&self, queue: &wgpu::Queue, base_array_layer: u32, pixels: &[u8]) {
        let bytes_per_pixel = match self.format {
            wgpu::TextureFormat::R8Unorm|wgpu::TextureFormat::R8Snorm|wgpu::TextureFormat::R8Uint|wgpu::TextureFormat::R8Sint => 1,
            wgpu::TextureFormat::R16Uint|wgpu::TextureFormat::R16Sint|wgpu::TextureFormat::R16Float => 2,
            wgpu::TextureFormat::Rg8Unorm|wgpu::TextureFormat::Rg8Snorm|wgpu::TextureFormat::Rg8Uint|wgpu::TextureFormat::Rg8Sint => 2,
            wgpu::TextureFormat::R32Uint|wgpu::TextureFormat::R32Sint|wgpu::TextureFormat::R32Float => 4,
            wgpu::TextureFormat::Rg16Uint|wgpu::TextureFormat::Rg16Sint|wgpu::TextureFormat::Rg16Float => 4,
            wgpu::TextureFormat::Rgba8Unorm|wgpu::TextureFormat::Rgba8UnormSrgb|wgpu::TextureFormat::Rgba8Snorm|wgpu::TextureFormat::Rgba8Uint|wgpu::TextureFormat::Rgba8Sint => 4,
            wgpu::TextureFormat::Bgra8Unorm|wgpu::TextureFormat::Bgra8UnormSrgb => 4,
            wgpu::TextureFormat::Rgb10a2Unorm|wgpu::TextureFormat::Rg11b10Float => 4,
            wgpu::TextureFormat::Rg32Uint|wgpu::TextureFormat::Rg32Sint|wgpu::TextureFormat::Rg32Float => 8,
            wgpu::TextureFormat::Rgba16Uint|wgpu::TextureFormat::Rgba16Sint|wgpu::TextureFormat::Rgba16Float => 8,
            wgpu::TextureFormat::Rgba32Uint|wgpu::TextureFormat::Rgba32Sint|wgpu::TextureFormat::Rgba32Float => 16,
            wgpu::TextureFormat::Depth32Float|wgpu::TextureFormat::Depth24Plus|wgpu::TextureFormat::Depth24PlusStencil8 => 4,
            _ => unimplemented!(),
        };
        let aligned_width = align_to!(self.size.width*bytes_per_pixel, wgpu::COPY_BYTES_PER_ROW_ALIGNMENT)/bytes_per_pixel;
        let texture_copy_view = wgpu::TextureCopyView {
            texture: &self.texture,
            mip_level: 0,
            origin: wgpu::Origin3d {
                x: 0,
                y: 0,
                z: base_array_layer,
            },
        };
        let texture_data_layout = wgpu::TextureDataLayout {
            offset: 0,
            bytes_per_row: aligned_width*bytes_per_pixel,
            rows_per_image: self.size.height,
        };
        let upload_size = wgpu::Extent3d {
            width: self.size.width,
            height: self.size.height,
            depth: 1,
        };
        if self.size.width < aligned_width {
            let mut padded_pixels = vec![0; (aligned_width*self.size.height*bytes_per_pixel) as usize];
            for y in 0..self.size.height {
                let src_range = (y*self.size.width*bytes_per_pixel) as usize..((y+1)*self.size.width*bytes_per_pixel) as usize;
                let dst_start = (y*aligned_width*bytes_per_pixel) as usize;
                padded_pixels[dst_start..dst_start+src_range.len()].copy_from_slice(&pixels[src_range]);
            }
            queue.write_texture(texture_copy_view, &padded_pixels, texture_data_layout, upload_size);
        } else {
            queue.write_texture(texture_copy_view, &pixels, texture_data_layout, upload_size);
        }
    }

    pub fn from_image<'a>(device: &wgpu::Device, queue: &wgpu::Queue, mipmap: bool, array_texture_layer: Option<ArrayTextureLayer>, image: image::DynamicImage) -> Result<Option<Self>, AssetError> {
        let image = match image {
            image::DynamicImage::ImageLumaA8(_) => image::DynamicImage::ImageRgba8(image.into_rgba()),
            image::DynamicImage::ImageRgb8(_) => image::DynamicImage::ImageRgba8(image.into_rgba()),
            image::DynamicImage::ImageBgr8(_) => image::DynamicImage::ImageRgba8(image.to_rgba()),
            image::DynamicImage::ImageBgra8(_) => image::DynamicImage::ImageRgba8(image.to_rgba()),
            image::DynamicImage::ImageLumaA16(_) => image::DynamicImage::ImageRgba8(image.to_rgba()),
            image::DynamicImage::ImageRgb16(_) => image::DynamicImage::ImageRgba8(image.to_rgba()),
            _ => image
        };
        let (dimensions, pixels, format) = match &image {
            image::DynamicImage::ImageLuma8(image) => (image.dimensions(), &image.as_raw()[..], wgpu::TextureFormat::R8Unorm),
            image::DynamicImage::ImageRgba8(image) => (image.dimensions(), &image.as_raw()[..], wgpu::TextureFormat::Rgba8UnormSrgb),
            image::DynamicImage::ImageLuma16(image) => (image.dimensions(), unsafe { crate::transmute_slice::<_, _>(&image.as_raw()[..]) }, wgpu::TextureFormat::R16Uint),
            image::DynamicImage::ImageRgba16(image) => (image.dimensions(), unsafe { crate::transmute_slice::<_, _>(&image.as_raw()[..]) }, wgpu::TextureFormat::Rgba16Uint),
            _ => panic!()
        };
        let mut size = wgpu::Extent3d { width: dimensions.0, height: dimensions.1, depth: 1 };
        let mut base_array_layer = 0;
        if let Some(array_texture_layer) = array_texture_layer {
            base_array_layer = array_texture_layer.layer_index;
            if size.width != array_texture_layer.texture.size.width || size.height != array_texture_layer.texture.size.height {
                return Err(AssetError::ArrayTextureSizeMismatch);
            }
            if format != array_texture_layer.texture.format {
                return Err(AssetError::ArrayTextureFormatMismatch);
            }
            size.depth = array_texture_layer.texture.size.depth;
            array_texture_layer.texture.upload_pixels(queue, base_array_layer, &pixels[..]);
            Ok(None)
        } else {
            let texture = Self::new(device, size, mipmap, false, wgpu::TextureDimension::D2, format);
            texture.upload_pixels(queue, base_array_layer, &pixels[..]);
            Ok(Some(texture))
        }
    }

    pub fn load(device: &wgpu::Device, queue: &wgpu::Queue, mipmap: bool, array_texture_layer: Option<ArrayTextureLayer>, path: std::path::PathBuf) -> Result<(std::path::PathBuf, Option<Texture>), AssetError> {
        let file = image::io::Reader::open(&path)?.decode()?;
        let texture = Self::from_image(device, queue, mipmap, array_texture_layer, file)?;
        Ok((path, texture))
    }
}
