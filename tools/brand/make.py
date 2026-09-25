"""
MANDATE brand kit: the Seal.

Draws the mark, outlines the wordmark from the committed Instrument Sans (so
no file here needs a font to render), and writes the lockups, the favicon and
the HTML each raster is rendered from. `render.mjs` then renders the PNGs and
`publish.py` puts every file where the site serves it.

    tools/brand/.venv/bin/python tools/brand/make.py
    node tools/brand/render.mjs
    tools/brand/.venv/bin/python tools/brand/publish.py

Needs fonttools, brotli, uharfbuzz and pillow (see README in this folder).
"""

import math
import os
import tempfile

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONTS = os.path.join(ROOT, "src", "app", "fonts")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

# The palette. The site's tokens.css carries the same values.
SIG = "#13B98A"  # signature: the seal, the one primary action per view
DEEP = "#0B7A5C"  # deep: pressed, and the seal's shadow side
ON_SIG = "#06140F"  # ink on the signature colour
INK = "#0B0D0E"  # the ground
NIGHT = "#111417"  # surfaces
PAPER = "#FAFAF8"  # text on ink, and the light ground
SLATE = "#5B6168"


# ------------------------------------------------------------------ the seal
def seal_path(cx=50.0, cy=50.0, base=44.5, amp=1.5, waves=24, per_wave=6, dec=2):
    """A notary seal's edge, r = base + amp*cos(waves*t), as one closed run of cubic Beziers."""
    n = waves * per_wave
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n - math.pi / 2
        r = base + amp * math.cos(waves * (t + math.pi / 2))
        pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    f = lambda v: f"{v:.{dec}f}".rstrip("0").rstrip(".")
    d = [f"M{f(pts[0][0])} {f(pts[0][1])}"]
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}")
    return "".join(d) + "Z"


SEAL = seal_path()
M_POINTS = "31,66 31,36 50,56 69,36 69,66"


def mark_body(ring=True, seal=SIG, ink=ON_SIG):
    ring_el = f'<circle cx="50" cy="50" r="34" fill="none" stroke="{ink}" stroke-opacity=".28" stroke-width="1.6"/>' if ring else ""
    return (
        f'<path d="{SEAL}" fill="{seal}"/>{ring_el}'
        f'<polyline points="{M_POINTS}" fill="none" stroke="{ink}" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def mark_svg(ring=True, title=True):
    t = "<title>MANDATE</title>" if title else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="MANDATE">{t}{mark_body(ring)}</svg>'


# ------------------------------------------------------------- outlined text
def text_path(font_file, text, size, axes, tracking=0.0):
    """Shaped by HarfBuzz, kerning included, outlined by fontTools. Returns (d, width, cap height) in px."""
    font = TTFont(os.path.join(FONTS, font_file))
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, axes)
    font.flavor = None
    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
        font.save(tmp.name)
        path = tmp.name
    face = hb.Face(hb.Blob.from_file_path(path))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb.Font(face), buf, {"kern": True, "liga": True})
    os.unlink(path)
    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()
    scale = size / face.upem
    x = 0.0
    parts = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(glyphs)
        glyphs[order[info.codepoint]].draw(TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, 0)))
        parts.append(pen.getCommands())
        x += pos.x_advance * scale + tracking * size
    x -= tracking * size
    return " ".join(p for p in parts if p), x, font["OS/2"].sCapHeight * scale


WORD_D, WORD_W, WORD_CAP = text_path("InstrumentSans.woff2", "Mandate", 100.0, {"wght": 680, "wdth": 100}, tracking=-0.022)


def lockup_svg(word_fill, ground=None, height=120):
    """The mark and the wordmark: the mark is one and a half cap heights, the caps centred on it."""
    mark_h = WORD_CAP * 1.5
    gap = WORD_CAP * 0.42
    total_w = mark_h + gap + WORD_W
    base_y = mark_h / 2 + WORD_CAP / 2
    scale = height / mark_h
    bg = f'<rect width="100%" height="100%" fill="{ground}"/>' if ground else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w:.1f} {mark_h:.1f}" width="{total_w * scale:.0f}" height="{height}" role="img" aria-label="MANDATE">'
        f"<title>MANDATE</title>{bg}"
        f'<g transform="scale({mark_h / 100:.5f})">{mark_body()}</g>'
        f'<path transform="translate({mark_h + gap:.2f} {base_y:.2f})" d="{WORD_D}" fill="{word_fill}"/>'
        "</svg>"
    )


def wordmark_svg(fill):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-WORD_CAP:.1f} {WORD_W:.1f} {WORD_CAP:.1f}" role="img" aria-label="MANDATE"><title>MANDATE</title><path d="{WORD_D}" fill="{fill}"/></svg>'


def write(name, body):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(body)


write("mandate-mark.svg", mark_svg())
write("mandate-logo-on-dark.svg", lockup_svg(PAPER))
write("mandate-logo-on-light.svg", lockup_svg(INK))
write("mandate-wordmark-on-dark.svg", wordmark_svg(PAPER))
write("mandate-wordmark-on-light.svg", wordmark_svg(INK))
# The favicon drops the inner ring, which is under a pixel at 16 and 32.
write("favicon.svg", mark_svg(ring=False, title=False))
# The navbar's inline copy: the wordmark path alone, for the component to colour.
with open(os.path.join(OUT, "wordmark.json"), "w") as fh:
    fh.write('{"d": "%s", "width": %.2f, "cap": %.2f, "seal": "%s"}' % (WORD_D, WORD_W, WORD_CAP, SEAL))


# --------------------------------------------------------------- the rasters
def composition(w, h, kind):
    """What each raster is rendered from: the ink ground, one glow, the mark, the promise."""
    fonts = "\n".join(
        f"@font-face{{font-family:'{fam}';src:url('file://{FONTS}/{file}') format('woff2');font-weight:100 900;}}"
        for fam, file in (("Instrument Sans", "InstrumentSans.woff2"), ("Inter", "Inter.woff2"))
    )
    mark = mark_svg(title=False)
    head = f"""<!doctype html><html><head><meta charset="utf-8"><style>
{fonts}
html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:{INK};}}
.g{{position:absolute;inset:0;background:radial-gradient(60% 90% at 88% 20%, rgba(19,185,138,.20), transparent 60%),radial-gradient(40% 60% at 10% 110%, rgba(11,122,92,.18), transparent 70%);}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(70% 90% at 70% 40%, #000 30%, transparent 75%);}}
.t{{font-family:'Instrument Sans',sans-serif;color:{PAPER};font-weight:600;letter-spacing:-.02em;line-height:1.02;}}
.s{{font-family:Inter,sans-serif;color:#A7ADB4;font-weight:400;}}
.u{{font-family:Inter,sans-serif;color:{SIG};font-weight:500;}}
.chip{{display:inline-flex;align-items:center;gap:10px;font-family:Inter,sans-serif;color:#C9CED3;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.05);}}
.dot{{width:8px;height:8px;border-radius:50%;background:{SIG};box-shadow:0 0 0 4px rgba(19,185,138,.18);}}
svg{{display:block;width:100%;height:100%}}
</style></head><body><div class="g"></div><div class="grid"></div>"""
    if kind == "avatar":
        return head + f'<div style="position:absolute;inset:0;display:grid;place-items:center;"><div style="width:{int(w * 0.72)}px;height:{int(w * 0.72)}px">{mark}</div></div></body></html>'
    if kind == "x-header":
        return head + f"""
<div style="position:absolute;left:520px;top:118px;">
  <div class="t" style="font-size:74px;">Hire an agent<br>you can check.</div>
  <div class="s" style="font-size:25px;margin-top:22px;max-width:760px;">The BNB Chain agent marketplace. Every agent is checked on chain before you hire it, and can only take what you sign.</div>
</div>
<div style="position:absolute;right:56px;bottom:40px;display:flex;gap:14px;align-items:center;">
  <span class="chip" style="font-size:18px"><span class="dot"></span>BNB Smart Chain · Mainnet</span><span class="u" style="font-size:22px;">mandatemarkets.com</span>
</div></body></html>"""
    if kind == "og":
        return head + f"""
<div style="position:absolute;left:80px;top:72px;display:flex;align-items:center;gap:18px;">
  <div style="width:64px;height:64px">{mark}</div><div class="t" style="font-size:40px;letter-spacing:-.01em">Mandate</div>
</div>
<div style="position:absolute;left:80px;top:212px;">
  <div class="t" style="font-size:84px;">Hire an agent<br>you can check.</div>
  <div class="s" style="font-size:28px;margin-top:26px;max-width:900px;">Every agent is checked on chain before you pay, and can only take what you sign.</div>
</div>
<div style="position:absolute;left:80px;bottom:56px;display:flex;gap:16px;align-items:center;">
  <span class="chip" style="font-size:18px"><span class="dot"></span>BNB Smart Chain · Mainnet</span><span class="u" style="font-size:24px;">mandatemarkets.com</span>
</div></body></html>"""
    raise ValueError(kind)


write("compose-avatar.html", composition(800, 800, "avatar"))
write("compose-x-header.html", composition(1500, 500, "x-header"))
write("compose-og.html", composition(1200, 630, "og"))
print(f"wordmark {WORD_W:.1f} wide, cap {WORD_CAP:.1f}; seal path {len(SEAL)} chars")
