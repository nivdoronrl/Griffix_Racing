#!/usr/bin/env python3
"""Convert uploads/{products,gallery}/* to compressed WebP under media/.

uploads/products/<uuid>.<png|jpg|jpeg>  ->  media/products/<uuid>.webp
(same for gallery). vercel.json rewrites /uploads/<dir>/<uuid>.<ext> to the
WebP, so every existing reference (catalog JSON, prerendered PDPs, admin)
keeps working unchanged.

- Long edge capped at 1600px, quality 78 (alpha preserved for PNGs).
- Also writes a grid thumbnail media/thumbs/<dir>/<uuid>.webp (640px, q72)
  used by the shop/templates/related-product cards.
- Files that are not real images (e.g. HTML error pages saved under an image
  name) are skipped and listed in docs/MISSING_IMAGES.txt.
- Incremental: an existing WebP newer than its source is left alone.

Usage: python3 scripts/convert-uploads-to-webp.py   (needs Pillow)
"""
import os, sys, glob
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_EDGE, QUALITY = 1600, 78
THUMB_EDGE, THUMB_QUALITY = 640, 72

def convert(src):
    rel = os.path.relpath(src, os.path.join(ROOT, 'uploads'))
    sub, name = os.path.split(rel)
    dst = os.path.join(ROOT, 'media', sub, os.path.splitext(name)[0] + '.webp')
    thumb = os.path.join(ROOT, 'media', 'thumbs', sub, os.path.splitext(name)[0] + '.webp')
    if all(os.path.exists(f) and os.path.getmtime(f) >= os.path.getmtime(src) for f in (dst, thumb)):
        return ('skip', rel, os.path.getsize(src), os.path.getsize(dst), os.path.getsize(thumb))
    try:
        im = Image.open(src)
        im.load()
    except Exception:
        return ('broken', rel, os.path.getsize(src), 0, 0)
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA' if 'A' in im.getbands() or im.mode == 'P' else 'RGB')
    if im.mode == 'RGBA' and im.getchannel('A').getextrema() == (255, 255):
        im = im.convert('RGB')  # fully opaque: drop the alpha channel
    full = im.copy()
    if max(full.size) > MAX_EDGE:
        full.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    full.save(dst, 'WEBP', quality=QUALITY, method=5)
    small = im.copy()
    small.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
    os.makedirs(os.path.dirname(thumb), exist_ok=True)
    small.save(thumb, 'WEBP', quality=THUMB_QUALITY, method=5)
    return ('ok', rel, os.path.getsize(src), os.path.getsize(dst), os.path.getsize(thumb))

def main():
    srcs = sorted(f for d in ('products', 'gallery')
                  for f in glob.glob(os.path.join(ROOT, 'uploads', d, '*'))
                  if os.path.splitext(f)[1].lower() in ('.png', '.jpg', '.jpeg', '.webp', '.gif'))
    with ProcessPoolExecutor() as ex:
        results = list(ex.map(convert, srcs, chunksize=8))
    broken = sorted(r[1] for r in results if r[0] == 'broken')
    with open(os.path.join(ROOT, 'docs', 'MISSING_IMAGES.txt'), 'w') as fh:
        fh.write('# uploads/ files that are not real images (HTML saved in place of the image).\n')
        fh.write('# The original image is not in git on any branch; it may only have existed on Render\'s disk.\n')
        fh.write(''.join('uploads/' + b + '\n' for b in broken))
    src_total = sum(r[2] for r in results if r[0] != 'broken')
    dst_total = sum(r[3] for r in results)
    thumb_total = sum(r[4] for r in results)
    print(f'{len(results)} files: {sum(r[0]=="ok" for r in results)} converted, '
          f'{sum(r[0]=="skip" for r in results)} up to date, {len(broken)} broken')
    print(f'source {src_total/1e6:.1f} MB -> webp {dst_total/1e6:.1f} MB (+ thumbs {thumb_total/1e6:.1f} MB)')

if __name__ == '__main__':
    sys.exit(main())
