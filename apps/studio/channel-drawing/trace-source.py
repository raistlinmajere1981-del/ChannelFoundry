"""Offline vector preparation of the entrance portrait and economical seal.
Run: python apps/studio/channel-drawing/trace-source.py
Requires pillow, numpy, opencv-python-headless, fonttools.
Never used by playback; the existing Noto Serif atlas is preserved.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from PIL import Image
from fontTools.pens.basePen import BasePen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
source = REPO / 'channels/birdesengor/web/public/scene-assets/opening/observer-portrait.webp'
seal_source = REPO / 'channels/birdesengor/web/index.html'
html = seal_source.read_text()
seal = ET.fromstring(re.search(r'<svg class="entrance-seal".*?</svg>', html, re.S).group(0))
clip = seal.find(".//clipPath[@id='entrance-portrait-clip']/circle")
portrait_radius = float(clip.get('r'))
# One shared transform preserves the actual loading portrait/casing proportions.
SCALE = 2
CENTER = (500, 320)


def drawing_point(x, y):
    return (round(CENTER[0] + (x - 140) * SCALE, 2),
            round(CENTER[1] + (y - 140) * SCALE, 2))


def data(runs, portrait=False):
    def point(x, y):
        if portrait:
            x, y = 140 + (x - 80) * portrait_radius / 80, 140 + (y - 80) * portrait_radius / 80
        return drawing_point(x, y)
    return ' '.join(' '.join(('M' if i == 0 else 'L') + ' ' + ' '.join(map(str, point(x, y)))
                             for i, (x, y) in enumerate(run)) for run in runs)


class LinePen(BasePen):
    """Flatten selected seal paths and anatomical curves into canonical ink."""
    def __init__(self):
        super().__init__(None)
        self.runs = []

    def _moveTo(self, point):
        self.runs.append([point])

    def _lineTo(self, point):
        self.runs[-1].append(point)

    def _curveToOne(self, p1, p2, p3):
        p0 = self._getCurrentPoint()
        for t in np.linspace(0, 1, 13)[1:]:
            self._lineTo(tuple((1-t)**3*p0[k] + 3*(1-t)**2*t*p1[k]
                               + 3*(1-t)*t*t*p2[k] + t**3*p3[k] for k in range(2)))

    def _qCurveToOne(self, p1, p2):
        p0 = self._getCurrentPoint()
        for t in np.linspace(0, 1, 9)[1:]:
            self._lineTo(tuple((1-t)**2*p0[k] + 2*(1-t)*t*p1[k] + t*t*p2[k] for k in range(2)))

    def _closePath(self):
        self.runs[-1].append(self.runs[-1][0])

    def _endPath(self):
        pass


def transformed(runs, transform=''):
    result = runs
    # SVG applies these existing rotate/translate operations from right to left.
    for name, args in reversed(re.findall(r'(rotate|translate)\(([^)]+)\)', transform)):
        values = list(map(float, re.findall(r'-?\d+(?:\.\d+)?', args)))
        if name == 'translate':
            dx, dy = values
            result = [[(x + dx, y + dy) for x, y in run] for run in result]
        else:
            angle, cx, cy = values
            c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
            result = [[(cx + (x-cx)*c - (y-cy)*s, cy + (x-cx)*s + (y-cy)*c)
                       for x, y in run] for run in result]
    return result


paths = []
source_geometry = []


def seal_path(identifier, element, transform='', split=False):
    pen = LinePen()
    parse_path(element.get('d'), pen)
    runs = transformed(pen.runs, transform)
    source_geometry.append({'id': identifier, 'd': element.get('d'), 'transform': transform})
    for index, group in enumerate(([run] for run in runs) if split else [runs]):
        paths.append({'id': identifier + (f'.{index}' if split else ''), 'd': data(group), 'ink': 'seal'})


# Six source boundaries retain the casing, cipher channel and portrait bezel.
# Omit three near-duplicate hairline rings and decorative highlight arcs.
for element in seal.iter('circle'):
    radius = float(element.get('r'))
    if radius not in [134, 124, 114, 104, 101, 92.5]:
        continue
    points = [(140 + radius*math.cos(t), 140 + radius*math.sin(t))
              for t in np.linspace(0, math.tau, 129)]
    paths.append({'id': f'geometry.ring.{len(paths)}', 'd': data([points]), 'ink': 'construction'})
    source_geometry.append({'radius': radius})

orbit = seal.find("g[@class='entrance-orbit']")
# Half of the 24 existing index divisions: twelve marks, no invented ornament.
for index, element in enumerate(orbit.findall('g/path')[::2]):
    seal_path(f'geometry.index.{index:02}', element, element.get('transform', ''))
counter = seal.find("g[@class='entrance-counter']")
for index, group in enumerate(counter.findall('g')):
    seal_path(f'geometry.cipher.{index}', group.find('path'), group.get('transform', ''))
seal_path('geometry.cardinal', counter.find('path'), split=True)
for index, group in enumerate(g for g in seal.findall('g') if g.find("path[@class='entrance-tumbler']") is not None):
    seal_path(f'geometry.pin.{index}', group.find("path[@class='entrance-tumbler']"), group.get('transform', ''))

image = Image.open(source).convert('RGB')
if image.size != (160, 160):
    raise ValueError('Expected the unchanged 160×160 entrance portrait')
# Preserve the real portrait's likeness instead of inventing sparse face shapes.
# Upsampling smooths the source's sampling grid; it does not invent image detail.
gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
gray = cv2.resize(gray, (640, 640), interpolation=cv2.INTER_CUBIC)
gray = cv2.GaussianBlur(gray, (5, 5), 1.1)
gray = np.clip((gray.astype(float) - 7) * 255 / 188, 0, 255)
yy, xx = np.mgrid[:640, :640]
inside = ((xx/4 - 80)**2 + (yy/4 - 80)**2) < 79.7**2

# Three source-derived contour levels retain eye, nose, lip, cheek and ear detail.
# Each is a separate real stroke; small photographic grain is excluded.
for level in [65, 140, 205]:
    binary = ((gray >= level) & inside).astype(np.uint8) * 255
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    for index, contour in enumerate(sorted(contours, key=cv2.contourArea, reverse=True)):
        if cv2.arcLength(contour, True)/4 < 3 or cv2.contourArea(contour)/16 < .7:
            continue
        points = (cv2.approxPolyDP(contour, .7, True).reshape(-1, 2)/4).tolist()
        points.append(points[0])
        # The existing seal owns the portrait boundary; do not redraw the crop.
        if len(points) > 150 and sum((x-80)**2 + (y-80)**2 > 78.5**2
                                     for x, y in points) > len(points)*.6:
            continue
        paths.append({'id': f'portrait.contour.{level}.{index}',
                      'd': data([points], portrait=True), 'ink': 'portraitFeature'})

# Complementary engraving passes rebuild the photograph's actual tonal masses.
# Every gap over a light region is an actual pen lift handled by the existing
# player. No image, fill, stipple texture or reveal overlay is used at runtime.
for direction, threshold, step in [(1, 180, 1.3), (-1, 70, 1.4)]:
    for index, intercept in enumerate(np.arange(-158, 319, step)):
        runs, run = [], []
        for y in np.arange(.125, 159.9, .25):
            x = intercept - direction*y
            visible = (0 <= x < 160 and (x-80)**2 + (y-80)**2 < 79.7**2
                       and gray[min(639, int(y*4)), min(639, int(x*4))] < threshold)
            if visible:
                run.append((float(x), float(y)))
            else:
                if len(run) >= 3:
                    runs.append([run[0], run[-1]])
                run = []
        if len(run) >= 3:
            runs.append([run[0], run[-1]])
        if runs:
            paths.append({'id': f'portrait.hatch.{direction}.{index}',
                          'd': data(runs, portrait=True), 'ink': 'hatch'})

metadata = {
    'source': source.relative_to(REPO).as_posix(),
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'crop': [0, 0, 160, 160], 'artBounds': [220, 40, 560, 560],
    'portraitSource': {'method': 'photo-engraving', 'sourceSize': [160, 160],
                       'processingSize': [640, 640], 'contourLevels': [65, 140, 205],
                       'engravingPasses': 2},
    'sealSource': {'source': seal_source.relative_to(REPO).as_posix() + '#entrance-seal',
                   'sha256': hashlib.sha256(json.dumps(source_geometry, sort_keys=True).encode()).hexdigest(),
                   'viewBox': [0, 0, 280, 280], 'portraitRadius': portrait_radius,
                   'outerRadius': 134, 'scale': SCALE, 'center': CENTER,
                   'ringRadii': [134, 124, 114, 104, 101, 92.5], 'indexMarks': 12, 'cipherMarks': 8},
    'paths': paths,
}
(ROOT / 'artwork.json').write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + '\n')
print(json.dumps({'basePaths': len(paths), 'sealPaths': sum(p['id'].startswith('geometry.') for p in paths),
                  'portraitPaths': sum(p['id'].startswith('portrait.') for p in paths)}))
