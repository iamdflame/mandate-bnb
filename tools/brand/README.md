# Brand kit

The Seal: a notary seal around the M, in signature green `#13B98A` on ink `#0B0D0E`.
Instrument Sans for display, Inter for text, JetBrains Mono for addresses and hashes.
The fonts are the subsets committed in `src/app/fonts`, under the SIL Open Font Licence.

```
python3 -m venv tools/brand/.venv
tools/brand/.venv/bin/pip install fonttools brotli uharfbuzz pillow
tools/brand/.venv/bin/python tools/brand/make.py
node tools/brand/render.mjs
tools/brand/.venv/bin/python tools/brand/publish.py
```

`publish.py` writes the site's icons into `src/app` and the downloads, with a zip,
into `public/brand-kit`, which /brand serves.
