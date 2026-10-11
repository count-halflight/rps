"""Original, deterministic Gothic cloth textures for Echo.

Run with Python (Pillow and NumPy):
    python3 scripts/build_echo_surfaces.py

Every scalar field wraps periodically. These are original procedural surfaces,
not photographs, stock materials, or generated labels. RGB base colors are sRGB;
roughness and OpenGL +Y tangent normals must be loaded as non-color data. Base
colors contain the finished charcoal color and require a white color multiplier.
Recommended physical repeat: leather 0.22 m, rib knit 0.16 m, hair 0.08 m.
Normal strengths are baked in: leather 1.0, rib 0.7, hair 0.45 in a shader. Metal
is zero throughout. The previews use the actual maps and a simple studio light.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


SEED = 749103


def noise(rng: np.random.Generator, size: int, radius: float) -> np.ndarray:
    """Wrapped Gaussian field; radius is in final texture pixels."""
    field = rng.normal(size=(size, size))
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.rfftfreq(size)[None, :]
    kernel = np.exp(-2 * np.pi**2 * radius**2 * (fx**2 + fy**2))
    field = np.fft.irfft2(np.fft.rfft2(field) * kernel, s=(size, size))
    return field / max(float(field.std()), 1e-9)


def bilinear(field: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    size = field.shape[0]
    xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
    tx, ty = x - xi, y - yi
    a = field[yi % size, xi % size]
    b = field[yi % size, (xi + 1) % size]
    c = field[(yi + 1) % size, xi % size]
    d = field[(yi + 1) % size, (xi + 1) % size]
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty


def worley(rng: np.random.Generator, size: int, cells: int) -> tuple[np.ndarray, np.ndarray]:
    """Periodic irregular pebble boundaries with one jittered point per cell."""
    points = rng.uniform(.10, .90, (cells, cells, 2))
    y, x = np.mgrid[:size, :size].astype(float)
    # A small wrapped warp takes the geometric regularity out of the grain.
    x = (x + noise(rng, size, size / cells * 1.2) * size / cells * .13) * cells / size
    y = (y + noise(rng, size, size / cells * 1.2) * size / cells * .13) * cells / size
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    first, second = np.full((size, size), 10.), np.full((size, size), 10.)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            point = points[(iy + oy) % cells, (ix + ox) % cells]
            distance = np.hypot(ix + ox + point[..., 0] - x, iy + oy + point[..., 1] - y)
            second = np.minimum(second, np.maximum(first, distance))
            first = np.minimum(first, distance)
    return first, second - first


def wrapped_marks(rng: np.random.Generator, size: int, count: int) -> tuple[np.ndarray, np.ndarray]:
    """Fine, sparse curved compression marks, wrapping across all tile edges."""
    scale = 3
    image = Image.new('L', (size * scale, size * scale))
    edges = Image.new('L', image.size)
    draw, edge_draw = ImageDraw.Draw(image), ImageDraw.Draw(edges)
    for _ in range(count):
        origin = rng.uniform(0, size, 2)
        angle = rng.uniform(-np.pi, np.pi)
        length = rng.uniform(size * .028, size * .16)
        arc = rng.uniform(-.23, .23) * length
        direction = np.array([np.cos(angle), np.sin(angle)])
        tangent = np.array([-direction[1], direction[0]])
        t = np.linspace(-.5, .5, 30)
        points = origin + t[:, None] * length * direction + np.sin((t + .5) * np.pi)[:, None] * arc * tangent
        weight = int(rng.integers(45, 135))
        for oy in (-size, 0, size):
            for ox in (-size, 0, size):
                shifted = (points + (ox, oy)) * scale
                draw.line([tuple(p) for p in shifted], fill=weight, width=scale)
                rim = shifted + tangent * .8 * scale
                edge_draw.line([tuple(p) for p in rim], fill=int(weight * .8), width=scale)
    return tuple(np.asarray(im.resize((size, size), Image.Resampling.LANCZOS)).astype(float) / 255 for im in (image, edges))


def normal_from_height(height: np.ndarray, amplitude: float) -> np.ndarray:
    # Texture rows run downward. Green points along positive UV V (upward).
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * .5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * .5
    normal = np.stack((-dx * amplitude, dy * amplitude, np.ones_like(height)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return normal


def leather(rng: np.random.Generator, size: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ratio = size / 512
    pebble, boundary = worley(rng, size, 69)
    crease = np.exp(-np.square(boundary / .062))
    grain = np.tanh((.42 - pebble) * 2.7)
    low = noise(rng, size, 24 * ratio)
    medium = noise(rng, size, 4.0 * ratio)
    fine = noise(rng, size, .55 * ratio)
    marks, rims = wrapped_marks(rng, size, 29)
    pores = np.maximum(noise(rng, size, .42 * ratio) - 2.2, 0)
    height = .075 * grain - .09 * crease + .021 * medium + .011 * fine - .043 * pores - .11 * marks + .063 * rims
    # Faint polished compression against dry abrasion. No hard white scratches.
    wear = np.maximum(low - .65, 0) * .50 + rims * 1.9
    value = 1.7 * low + 1.3 * medium + 1.0 * fine - 3.5 * crease + 4.5 * wear - 2.0 * marks
    color = np.stack((31 + value * 1.10, 35 + value, 37 + value * .83), axis=-1)
    color += wear[..., None] * np.array([1.8, .8, -.3])
    color = np.clip(color, [18, 21, 23], [52, 54, 55]) / 255
    rough = np.clip(.855 + .028 * low + .016 * fine + .032 * crease + .022 * wear - .055 * marks, .75, .965)
    return color, normal_from_height(height, 2.8 / ratio), rough


def rib(rng: np.random.Generator, size: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ratio = size / 512
    y, x = np.mgrid[:size, :size].astype(float)
    low = noise(rng, size, 22 * ratio)
    lint = noise(rng, size, .45 * ratio)
    displacement = .42 * ratio * noise(rng, size, 12 * ratio)
    phase = (x + displacement) * (2 * np.pi * 61 / size)
    ribs = (np.cos(phase) * .5 + .5)**1.25
    # Interlocking yarn loops, with uneven threads rather than a printed stripe.
    yarn = np.cos((y / size * 94 + .17 * np.sin(phase)) * 2 * np.pi)
    loops = np.maximum(np.cos(phase), 0) * yarn
    fuzz = noise(rng, size, 1.05 * ratio)
    height = .16 * ribs + .025 * loops + .009 * fuzz + .006 * lint
    value = 2.4 * ribs + .75 * loops + .60 * fuzz + .52 * low + .55 * lint
    color = np.stack((18 + value, 21 + value * 1.03, 23 + value * 1.08), axis=-1) / 255
    rough = np.clip(.935 + .012 * low + .01 * lint - .016 * ribs, .885, .982)
    return np.clip(color, 0, 1), normal_from_height(height, 1.7 / ratio), rough


def hair(rng: np.random.Generator, size: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ratio = size / 512
    y, x = np.mgrid[:size, :size].astype(float)
    # Irregular fibre spacings repeat, while the small wandering phase varies
    # continuously over the tile. There are no wide sculpted corrugations.
    fibre_count = 158
    fibre = np.zeros((size, size))
    dark = np.zeros_like(fibre)
    for i in range(fibre_count):
        center = i * size / fibre_count + rng.uniform(-.82, .82) * ratio
        wander = (rng.uniform(.20, .75) * np.sin(y[:, 0] * 2 * np.pi / size + rng.uniform(0, 2 * np.pi))
                  + rng.uniform(.12, .35) * np.sin(y[:, 0] * 4 * np.pi / size + rng.uniform(0, 2 * np.pi))) * ratio
        dx = np.mod(x - center - wander[:, None] + size * .5, size) - size * .5
        width = rng.uniform(.31, .57) * ratio
        line = np.exp(-np.square(dx / width))
        fibre += line * rng.uniform(.35, .95)
        dark += np.exp(-np.square((dx - .9 * ratio) / (.30 * ratio))) * rng.uniform(.25, .55)
    low = noise(rng, size, 16 * ratio)
    micro = noise(rng, size, .58 * ratio)
    height = .024 * fibre - .016 * dark + .0025 * micro
    value = 2.0 * fibre - 1.1 * dark + .28 * low + .34 * micro
    color = np.stack((17 + value, 19 + value, 20 + value * .85), axis=-1) / 255
    rough = np.clip(.86 + .016 * low - .025 * fibre + .006 * micro, .79, .93)
    return np.clip(color, 0, 1), normal_from_height(height, 2.5 / ratio), rough


def srgb_to_linear(x: np.ndarray) -> np.ndarray:
    return np.where(x <= .04045, x / 12.92, ((x + .055) / 1.055)**2.4)


def linear_to_srgb(x: np.ndarray) -> np.ndarray:
    return np.where(x <= .0031308, x * 12.92, 1.055 * np.maximum(x, 0)**(1 / 2.4) - .055)


def studio_preview(color: np.ndarray, normal: np.ndarray, rough: np.ndarray, size: int = 320) -> Image.Image:
    """Actual-map shading on a broad shallow draped patch, not baked highlights."""
    y, x = np.mgrid[:size, :size].astype(float)
    u, v = x / size, y / size
    index_y = ((v * 2) % 1 * color.shape[0]).astype(int)
    index_x = ((u * 2) % 1 * color.shape[0]).astype(int)
    base = srgb_to_linear(color[index_y, index_x])
    detail = normal[index_y, index_x]
    # A small broad bend makes the depth of the material readable.
    slope_x = .36 * np.sin(u * np.pi * 1.5)
    slope_y = .16 * np.sin(v * np.pi * 2.0 + .5)
    n = detail + np.stack((slope_x, slope_y, np.zeros_like(u)), axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    key = np.array([-.48, .54, .70]); key /= np.linalg.norm(key)
    fill = np.array([.55, -.05, .83]); fill /= np.linalg.norm(fill)
    diffuse = np.maximum(np.sum(n * key, axis=-1), 0) * 2.8 + np.maximum(np.sum(n * fill, axis=-1), 0) * .55 + .23
    # Broad dielectric glint. No metal, no clearcoat, no emissive surface.
    half = key + np.array([0., 0., 1.]); half /= np.linalg.norm(half)
    rough_local = rough[index_y, index_x]
    power = 2 / np.maximum(rough_local, .01)**4 - 2
    spec = np.maximum(np.sum(n * half, axis=-1), 0)**power * .013
    lit = base * diffuse[..., None] + spec[..., None]
    lit *= 1.8
    image = linear_to_srgb(lit / (1 + lit))
    return Image.fromarray(np.uint8(np.clip(image, 0, 1) * 255))


def save_maps(path: Path, label: str, maps: tuple[np.ndarray, np.ndarray, np.ndarray]) -> dict[str, Image.Image]:
    color, normal, rough = maps
    images = {
        'baseColor': Image.fromarray(np.uint8(np.clip(color, 0, 1) * 255), 'RGB'),
        'normal': Image.fromarray(np.uint8(np.clip(normal * .5 + .5, 0, 1) * 255), 'RGB'),
        'roughness': Image.fromarray(np.uint8(np.clip(rough, 0, 1) * 255), 'L'),
    }
    for suffix, image in images.items():
        image.save(path / f'{label}_{suffix}.png', optimize=True)
    images['studio'] = studio_preview(*maps)
    images['studio'].save(path / f'{label}_preview.png', optimize=True)
    return images


def contact_sheet(path: Path, materials: dict[str, dict[str, Image.Image]]) -> None:
    tile, pad, header, gap = 320, 18, 50, 34
    width = pad * 2 + tile * 4 + gap * 3
    height = header + (tile + gap) * len(materials) + 34
    sheet = Image.new('RGB', (width, height), '#111619')
    draw = ImageDraw.Draw(sheet)
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(font_path, 19) if Path(font_path).exists() else ImageFont.load_default()
    small = ImageFont.truetype(font_path, 14) if Path(font_path).exists() else ImageFont.load_default()
    for column, label in enumerate(('Studio patch: 2 x 2 tiles', 'sRGB base color', 'Tangent normal: +Y', 'Linear roughness')):
        draw.text((pad + column * (tile + gap), 14), label, font=small, fill='#bec8c9')
    for row, (material, images) in enumerate(materials.items()):
        y = header + row * (tile + gap)
        for column, kind in enumerate(('studio', 'baseColor', 'normal', 'roughness')):
            image = images[kind].convert('RGB').resize((tile, tile), Image.Resampling.LANCZOS)
            sheet.paste(image, (pad + column * (tile + gap), y))
        draw.text((pad, y + tile + 5), material.replace('_', ' '), font=small, fill='#9fabae')
    draw.text((pad, height - 23), 'Original periodic surfaces | no stock imagery | base color has no baked lighting', font=small, fill='#728186')
    sheet.save(path / 'echo_surface_contact_sheet.png', optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--size', type=int, default=512, choices=(512, 1024))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/generated/echo')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    materials = {}
    for index, (name, maker) in enumerate((('worn_leather', leather), ('ribbed_shirt', rib), ('fine_hair', hair))):
        maps = maker(np.random.default_rng(SEED + index * 103), args.size)
        materials[name] = save_maps(args.output, name, maps)
        color, normal, rough = maps
        tilt = np.degrees(np.arccos(np.clip(normal[..., 2], -1, 1)))
        print(f'{name}: {args.size}px, RGB={np.round(color.mean((0, 1)) * 255, 1)}, '
              f'roughness={rough.min():.3f}..{rough.max():.3f}, '
              f'normal tilt p95={np.percentile(tilt, 95):.1f} degrees')
    contact_sheet(args.output, materials)
    print(f'Preview: {args.output / "echo_surface_contact_sheet.png"}')


if __name__ == '__main__':
    main()
