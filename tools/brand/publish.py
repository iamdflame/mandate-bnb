"""
Sizes the rendered kit and puts each file where it is served:
the site's icons in src/app, the downloads in public/brand-kit, and a zip.
"""

import os
import shutil
import zipfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(HERE, "out")
APP = os.path.join(ROOT, "src", "app")
KIT = os.path.join(ROOT, "public", "brand-kit")
os.makedirs(KIT, exist_ok=True)
o = lambda f: os.path.join(OUT, f)

Image.open(o("avatar@800.png")).resize((400, 400), Image.LANCZOS).save(o("x-avatar-400.png"))
Image.open(o("avatar@800.png")).resize((640, 640), Image.LANCZOS).save(o("telegram-avatar-640.png"))
Image.open(o("x-header@2x.png")).resize((1500, 500), Image.LANCZOS).save(o("x-header-1500x500.png"))
Image.open(o("og@2x.png")).resize((1200, 630), Image.LANCZOS).convert("RGB").save(o("og-1200x630.png"))
icons = [Image.open(o(f"favicon-{s}.png")) for s in (16, 32, 48)]
icons[2].save(o("favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)], append_images=icons[:2])

# The site's own icons and link previews, by Next's file conventions.
shutil.copy(o("favicon.svg"), os.path.join(APP, "icon.svg"))
shutil.copy(o("favicon.ico"), os.path.join(APP, "favicon.ico"))
shutil.copy(o("favicon-180.png"), os.path.join(APP, "apple-icon.png"))
shutil.copy(o("og-1200x630.png"), os.path.join(APP, "opengraph-image.png"))
shutil.copy(o("og-1200x630.png"), os.path.join(APP, "twitter-image.png"))

KIT_FILES = [
    "mandate-mark.svg", "mandate-mark-512.png", "mandate-mark-1024.png",
    "mandate-logo-on-dark.svg", "mandate-logo-on-dark.png", "mandate-logo-on-light.svg", "mandate-logo-on-light.png",
    "mandate-wordmark-on-dark.svg", "mandate-wordmark-on-light.svg",
    "favicon.svg", "favicon.ico", "favicon-192.png", "favicon-512.png",
    "x-avatar-400.png", "x-header-1500x500.png", "telegram-avatar-640.png", "og-1200x630.png",
]
for f in KIT_FILES:
    shutil.copy(o(f), os.path.join(KIT, f))
with zipfile.ZipFile(os.path.join(KIT, "mandate-brand-kit.zip"), "w", zipfile.ZIP_DEFLATED) as z:
    for f in KIT_FILES:
        z.write(o(f), f"mandate-brand-kit/{f}")
    for lic in ("OFL-instrumentsans.txt", "OFL-inter.txt", "OFL-jetbrainsmono.txt"):
        z.write(os.path.join(APP, "fonts", lic), f"mandate-brand-kit/fonts/{lic}")
print("published", len(KIT_FILES), "files and the zip")
