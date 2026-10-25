"""Frame raw simulator screenshots into App Store marketing images.

  scripts/.venv/bin/python scripts/store_screens/frame.py

Reads raw captures from scripts/store_screens/raw/<device>/NN.png and writes
docs/app-store/screenshots/<device>/NN.png at the exact App Store size.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "scripts", "store_screens", "raw")
OUT = os.path.join(ROOT, "docs", "app-store", "screenshots")
FONTS = os.path.join(ROOT, "node_modules", "@expo-google-fonts")
BOLD = os.path.join(FONTS, "inter", "700Bold", "Inter_700Bold.ttf")
REG = os.path.join(FONTS, "inter", "400Regular", "Inter_400Regular.ttf")

DEVICES = {
    "iphone-6.9": {"size": (1320, 2868), "title": 86, "sub": 44, "top": 190, "shot_w": 0.80, "radius": 72},
    "android": {"size": (1080, 2160), "title": 66, "sub": 34, "top": 120, "shot_w": 0.74, "radius": 48},
    "android-tablet": {"size": (1600, 2560), "title": 92, "sub": 46, "top": 150, "shot_w": 0.80, "radius": 36},
    "ipad-13": {"size": (2064, 2752), "title": 96, "sub": 50, "top": 170, "shot_w": 0.74, "radius": 48},
}

LIGHT = {"bg": (251, 247, 241), "title": (43, 33, 24), "sub": (122, 110, 98), "accent": (168, 75, 12)}
DARK = {"bg": (14, 14, 16), "title": (242, 237, 228), "sub": (162, 157, 149), "accent": (240, 165, 91)}

# (file, title, subtitle, dark?)
SHOTS = [
    ("01", "Every verse, laid out\nas it is meant to be read", "Sanskrit, transliteration and translation", False),
    ("02", "Tap any word", "Its meaning, root and grammar", False),
    ("03", "The great commentaries", "Śaṅkara, Rāmānuja, Madhva and more —\nsearch inside them, filter by school", False),
    ("04", "Śaṅkara in English", "Select any words to highlight\nor add them to your notes", False),
    ("05", "Search the whole Gita", "Verse numbers, any script,\nno accents needed", False),
    ("06", "Read in your script", "Devanagari, Telugu, Kannada, Tamil,\nMalayalam, Bengali, Gujarati, IAST", False),
    ("07", "Chanting mode", "A chapter or the whole Gita,\nas one continuous stream", True),
    ("08", "A verse for every day", "Pick up right where you left off", False),
]


def rounded(im, r):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0], im.size[1]), r, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im, (0, 0), mask)
    return out


def frame(device, cfg, file, title, sub, dark):
    src = os.path.join(RAW, device, file + ".png")
    if not os.path.exists(src):
        return False
    W, H = cfg["size"]
    pal = DARK if dark else LIGHT
    canvas = Image.new("RGB", (W, H), pal["bg"])
    d = ImageDraw.Draw(canvas)
    ft = ImageFont.truetype(BOLD, cfg["title"])
    fs = ImageFont.truetype(REG, cfg["sub"])
    y = cfg["top"]
    for line in title.split("\n"):
        w = d.textlength(line, font=ft)
        d.text(((W - w) / 2, y), line, font=ft, fill=pal["title"])
        y += int(cfg["title"] * 1.18)
    y += int(cfg["sub"] * 0.5)
    for line in sub.split("\n"):
        w = d.textlength(line, font=fs)
        d.text(((W - w) / 2, y), line, font=fs, fill=pal["sub"])
        y += int(cfg["sub"] * 1.35)
    y += int(cfg["sub"] * 1.1)

    shot = Image.open(src).convert("RGB")
    sw = int(W * cfg["shot_w"])
    sh = int(shot.size[1] * sw / shot.size[0])
    shot = shot.resize((sw, sh), Image.LANCZOS)
    shot = rounded(shot, cfg["radius"])
    x = (W - sw) // 2
    # soft shadow
    shadow = Image.new("RGBA", (sw + 120, sh + 120), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((60, 70, sw + 60, sh + 70), cfg["radius"], fill=(0, 0, 0, 90 if dark else 55))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas.paste(shadow, (x - 60, y - 60), shadow)
    canvas.paste(shot, (x, y), shot)
    if dark:  # thin outline so a dark screen stands off a dark page
        ImageDraw.Draw(canvas).rounded_rectangle((x, y, x + sw, y + sh), cfg["radius"], outline=(60, 60, 64), width=3)
    os.makedirs(os.path.join(OUT, device), exist_ok=True)
    canvas.save(os.path.join(OUT, device, file + ".png"), optimize=True)
    return True


if __name__ == "__main__":
    for device, cfg in DEVICES.items():
        done = [s[0] for s in SHOTS if frame(device, cfg, *s)]
        print(device, "framed:", ", ".join(done) or "none")
