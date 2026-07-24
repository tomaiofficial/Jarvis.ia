#!/usr/bin/env python3
"""
Génère les icônes PNG PWA pour JARVIS à partir du SVG source
"""
import os
import sys
from pathlib import Path

try:
    import cairosvg
except ImportError:
    print("Installation de cairosvg...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cairosvg"])
    import cairosvg

# Tailles d'icônes requises par le manifest PWA
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

# SVG source
SVG_SOURCE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0f"/>
      <stop offset="100%" style="stop-color:#1a1a2e"/>
    </linearGradient>
    <linearGradient id="orbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00d4ff"/>
      <stop offset="50%" style="stop-color:#00ff88"/>
      <stop offset="100%" style="stop-color:#00d4ff"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Fond -->
  <rect width="512" height="512" rx="80" fill="url(#bgGrad)"/>

  <!-- Anneaux externes -->
  <circle cx="256" cy="256" r="220" fill="none" stroke="url(#orbGrad)" stroke-width="2" opacity="0.15"/>
  <circle cx="256" cy="256" r="190" fill="none" stroke="url(#orbGrad)" stroke-width="1.5" opacity="0.1"/>
  <circle cx="256" cy="256" r="160" fill="none" stroke="url(#orbGrad)" stroke-width="1" opacity="0.08"/>

  <!-- Orb principal -->
  <circle cx="256" cy="256" r="120" fill="url(#orbGrad)" filter="url(#glow)"/>

  <!-- Core central -->
  <circle cx="256" cy="256" r="60" fill="url(#orbGrad)">
    <animate attributeName="r" values="60;70;60" dur="2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite"/>
  </circle>

  <!-- Particules orbitantes -->
  <g fill="url(#orbGrad)">
    <circle cx="256" cy="100" r="4">
      <animateTransform attributeName="transform" type="rotate" from="0 256 256" to="360 256 256" dur="8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="256" cy="100" r="3">
      <animateTransform attributeName="transform" type="rotate" from="120 256 256" to="480 256 256" dur="10s" repeatCount="indefinite"/>
    </circle>
    <circle cx="256" cy="100" r="2.5">
      <animateTransform attributeName="transform" type="rotate" from="240 256 256" to="600 256 256" dur="12s" repeatCount="indefinite"/>
    </circle>
  </g>

  <!-- Texte JARVIS -->
  <text x="256" y="420" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="white" letter-spacing="4">
    JARVIS
  </text>
</svg>"""

def generate_icons():
    icons_dir = Path("C:/Users/tomg-/AppData/Local/Temp/Jarvis.ia/icons")
    icons_dir.mkdir(parents=True, exist_ok=True)

    print(f"Génération de {len(SIZES)} icônes PNG...")

    for size in SIZES:
        output_path = icons_dir / f"icon-{size}.png"
        try:
            cairosvg.svg2png(
                bytestring=SVG_SOURCE.encode('utf-8'),
                write_to=str(output_path),
                output_width=size,
                output_height=size,
                background_color=None  # Transparent background
            )
            print(f"  ✅ icon-{size}.png ({size}x{size})")
        except Exception as e:
            print(f"  ❌ Erreur icon-{size}.png: {e}")

    # Créer aussi favicon.ico (16x16, 32x32, 48x48)
    try:
        cairosvg.svg2png(
            bytestring=SVG_SOURCE.encode('utf-8'),
            write_to=str(icons_dir / "favicon.ico"),
            output_width=32,
            output_height=32
        )
        print(f"  ✅ favicon.ico (32x32)")
    except Exception as e:
        print(f"  ❌ Erreur favicon.ico: {e}")

    # apple-touch-icon (180x180 pour iOS)
    try:
        cairosvg.svg2png(
            bytestring=SVG_SOURCE.encode('utf-8'),
            write_to=str(icons_dir / "apple-touch-icon.png"),
            output_width=180,
            output_height=180
        )
        print(f"  ✅ apple-touch-icon.png (180x180)")
    except Exception as e:
        print(f"  ❌ Erreur apple-touch-icon.png: {e}")

    print("\n✅ Génération terminée !")

if __name__ == "__main__":
    generate_icons()