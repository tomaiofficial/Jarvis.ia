#!/usr/bin/env python3
"""
Genere les icones PNG PWA pour JARVIS avec Pillow (PIL)
"""
import os
import sys
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Tailles d'icones requises par le manifest PWA
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

def create_jarvis_icon(size):
    """Cree une icone JARVIS de la taille specifiee"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Coins arrondis
    radius = int(size * 0.156)

    # Fond
    bg_color = (10, 10, 15, 255)
    draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=bg_color)

    center = size // 2

    # Couleurs JARVIS
    accent_blue = (0, 212, 255, 255)
    accent_green = (0, 255, 136, 255)
    accent_cyan = (0, 255, 255, 255)

    # Anneaux externes
    for i, (r_mult, width, alpha) in enumerate([
        (0.43, max(1, int(size * 0.004)), 40),
        (0.37, max(1, int(size * 0.003)), 25),
        (0.31, max(1, int(size * 0.002)), 20),
    ]):
        r = int(size * r_mult)
        color = (0, 255, 255, alpha)
        draw.ellipse(
            [center - r, center - r, center + r, center + r],
            outline=(0, 255, 255, alpha),
            width=width
        )

    # Orb principal
    orb_radius = int(size * 0.234)

    # Gradient simule pour l'orb (plusieurs cercles concentriques)
    for i in range(orb_radius, 0, -1):
        ratio = i / orb_radius
        # Interpolation entre bleu et vert
        r = int(0 * (1 - ratio) + 0 * ratio)
        g = int(212 * (1 - ratio) + 255 * ratio)
        b = int(255 * (1 - ratio) + 136 * ratio)
        alpha = int(255 * (0.3 + 0.7 * ratio))
        draw.ellipse(
            [center - i, center - i, center + i, center + i],
            fill=(r, g, b, alpha)
        )

    # Core central
    core_radius = int(orb_radius * 0.5)
    for i in range(core_radius, 0, -1):
        ratio = i / core_radius
        r = int(0 * (1 - ratio) + 0 * ratio)
        g = int(255 * (1 - ratio) + 255 * ratio)
        b = int(255 * (1 - ratio) + 136 * ratio)
        alpha = int(255 * (0.5 + 0.5 * ratio))
        draw.ellipse(
            [center - i, center - i, center + i, center + i],
            fill=(r, g, b, alpha)
        )

    # Particules orbitantes (3 points)
    particle_radius = max(1, size // 128)
    orbit_radius = int(size * 0.2)
    for angle_offset in [0, 120, 240]:
        angle = math.radians(angle_offset)
        x = center + int(math.cos(angle) * orbit_radius)
        y = center + int(math.sin(angle) * orbit_radius)
        draw.ellipse(
            [x - particle_radius, y - particle_radius, x + particle_radius, y + particle_radius],
            fill=(0, 255, 136, 255)
        )

    # Texte JARVIS
    try:
        font_size = max(10, size // 18)
        font = None
        for font_path in [
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/System/Library/Fonts/SFNS.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]:
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except:
                continue
        if font is None:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    text = "JARVIS"
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    text_x = center - text_width // 2
    text_y = int(size * 0.82) - text_height // 2

    # Ombre du texte
    draw.text((text_x + 1, text_y + 1), text, font=font, fill=(0, 0, 0, 180))
    # Texte principal
    draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

    return img

def generate_icons():
    icons_dir = Path("C:/Users/tomg-/AppData/Local/Temp/Jarvis.ia/icons")
    icons_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generation de {len(SIZES)} icones PNG...")

    for size in SIZES:
        output_path = icons_dir / f"icon-{size}.png"
        try:
            img = create_jarvis_icon(size)
            img.save(output_path, 'PNG')
            print(f"  OK icon-{size}.png ({size}x{size})")
        except Exception as e:
            print(f"  ERREUR icon-{size}.png: {e}")

    # favicon.ico (32x32)
    try:
        img = create_jarvis_icon(32)
        img.save(icons_dir / "favicon.ico", format='ICO', sizes=[(16,16), (32,32), (48,48)])
        print(f"  OK favicon.ico")
    except Exception as e:
        print(f"  ERREUR favicon.ico: {e}")

    # apple-touch-icon (180x180)
    try:
        img = create_jarvis_icon(180)
        img.save(icons_dir / "apple-touch-icon.png")
        print(f"  OK apple-touch-icon.png (180x180)")
    except Exception as e:
        print(f"  ERREUR apple-touch-icon.png: {e}")

    print("\nGeneration terminee !")

if __name__ == "__main__":
    generate_icons()