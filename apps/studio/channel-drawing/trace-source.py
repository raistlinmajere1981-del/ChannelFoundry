"""Offline asset preparation, never part of web playback or publication.
Usage: python trace-source.py /path/to/Screenshot_20261109_151819.png
Requires pillow, numpy, opencv-python-headless, scikit-image, fonttools.
The screenshot crop is the actual supplied artwork, excluding UI/green selection.
"""
from pathlib import Path
import sys, json, hashlib
import numpy as np
import cv2
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
ROOT = Path(__file__).resolve().parent
source = Path(sys.argv[1])
CROP = (488, 198, 1430, 825)
im = Image.open(source).convert('RGB').crop(CROP)
a = np.array(im)
gray = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
# Suppress parchment grain while retaining the supplied contours.
gray = cv2.bilateralFilter(gray, 7, 42, 5)
edges = cv2.Canny(gray, 46, 100)
portrait = np.zeros(gray.shape, np.uint8)
cv2.ellipse(portrait, (471,313), (174,171), 0, 0, 360, 255, -1)
# The portrait needs fine contours plus tonal pen hatching; it is never a bitmap.
skel = skeletonize(edges > 0)
H,W = skel.shape
neighbors = lambda p: [(y,x) for y in range(max(0,p[0]-1),min(H,p[0]+2)) for x in range(max(0,p[1]-1),min(W,p[1]+2)) if (y,x)!=p and skel[y,x]]
vertices = set(zip(*np.where(skel)))
used=set(); lines=[]
for p in sorted(vertices, key=lambda p:(len(neighbors(p))==2,p)):
    for n in neighbors(p):
        edge=tuple(sorted((p,n)))
        if edge in used: continue
        line=[p,n]; used.add(edge); prev,cur=p,n
        while True:
            candidates=[v for v in neighbors(cur) if tuple(sorted((cur,v))) not in used]
            if not candidates or len(neighbors(cur))!=2: break
            nxt=candidates[0]; used.add(tuple(sorted((cur,nxt))));line.append(nxt);prev,cur=cur,nxt
            if cur==p: break
        if len(line)<5: continue
        pts=np.array([(x+29,y+24) for y,x in line],dtype=np.float32).reshape(-1,1,2)
        pts=cv2.approxPolyDP(pts,.65,False).reshape(-1,2)
        if len(pts)<2:continue
        center=np.mean(line,axis=0).astype(int)
        group='portrait' if portrait[center[0],center[1]] else 'ornament'
        lines.append((group,len(line),pts.tolist()))
# Retain longest contour runs first within the fixed 1024-path Studio budget.
lines=sorted(lines,key=lambda l:-l[1])[:1600]
lines.sort(key=lambda l:(l[0]=='portrait', min(p[1] for p in l[2]),min(p[0] for p in l[2])))
paths=[]
def d(pts):return ' '.join(('M' if i==0 else 'L')+' '+str(round(float(x),2))+' '+str(round(float(y),2)) for i,(x,y) in enumerate(pts))
# Batch nearby contour runs into legal multi-subpath strokes. The canonical
# player schedules every internal lift; no lines are replaced by image reveals.
for group in ['ornament','portrait']:
    selected=[item for item in lines if item[0]==group]
    for start in range(0,len(selected),4):
        chunk=selected[start:start+4]
        paths.append({'id':f'{group}.contour.{len(paths):03}', 'd':' '.join(d(pts) for _,_,pts in chunk),'ink':'contour' if group=='ornament' else 'portrait'})
# The faint concentric construction lines in the screenshot are below the
# parchment texture threshold. Sample their measured source geometry explicitly.
import math
for i,r in enumerate([178,185,193,216,234,242,284]):
    pts=[(500+r*math.cos(t),337+r*math.sin(t)) for t in np.linspace(0,2*math.pi,181)]
    paths.insert(i,{'id':f'geometry.ring.{i}', 'd':d(pts),'ink':'construction'})
# Tonal diagonal hatches preserve the hat, nose, eyes, beard and silhouette.
# Each row has independent pen lifts; the existing engine handles the travel.
for diagonal in range(150,950,3):
    runs=[];run=[]
    for y in range(H):
        x=diagonal-y//2
        if 0<=x<W and portrait[y,x] and gray[y,x] < 155:
            run.append((x+29,y+24))
        else:
            if len(run)>=3:runs.append([run[0],run[-1]])
            run=[]
    if len(run)>=3:runs.append([run[0],run[-1]])
    if runs: paths.append({'id':f'portrait.hatch.{len(paths):03}', 'd':' '.join(d(r) for r in runs),'ink':'hatch'})
meta={'source':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'crop':CROP,'artBounds':[29,24,W,H], 'paths':paths}
(ROOT/'artwork.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':'))+'\n')
# A preview is diagnostic output only and is never consumed by Studio/site.
preview=Image.new('RGB',(1000,740),'#e2c797');draw=ImageDraw.Draw(preview)
import re
for p in paths:
    for sub in p['d'].split('M ')[1:]:
        coords=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',sub)))
        draw.line(list(zip(coords[::2],coords[1::2])),fill='#3a291e',width=1)
preview.save('/tmp/channel-drawing-vector-preview.png')
# Pre-flatten licensed Noto outlines so export needs only Node, never system fonts.
font=TTFont('/usr/share/fonts/noto/NotoSerif-Regular.ttf'); glyphs=font.getGlyphSet();upm=font['head'].unitsPerEm
class FlatPen(BasePen):
    def __init__(self):super().__init__(glyphs);self.runs=[];self.current=[]
    def _moveTo(self,p):self.current=[p];self.runs.append(self.current)
    def _lineTo(self,p):self.current.append(p)
    def _qCurveToOne(self,p1,p2):
        p0=self._getCurrentPoint()
        for t in np.linspace(0,1,9)[1:]:self.current.append(tuple((1-t)**2*p0[k]+2*(1-t)*t*p1[k]+t*t*p2[k] for k in range(2)))
    def _curveToOne(self,p1,p2,p3):
        p0=self._getCurrentPoint()
        for t in np.linspace(0,1,13)[1:]:self.current.append(tuple((1-t)**3*p0[k]+3*(1-t)**2*t*p1[k]+3*(1-t)*t*t*p2[k]+t**3*p3[k] for k in range(2)))
    def _closePath(self):
        if self.current and self.current[-1]!=self.current[0]:self.current.append(self.current[0])
    def _endPath(self):pass
atlas={}
for cp,name in font.getBestCmap().items():
    if not(32<=cp<=1327 or 8192<=cp<=8303):continue
    pen=FlatPen();glyphs[name].draw(pen)
    atlas[chr(cp)]={'advance':round(glyphs[name].width*1000/upm,2),'runs':[[[round(x*1000/upm,1),round(-y*1000/upm,1)] for x,y in run] for run in pen.runs if len(run)>1]}
(ROOT/'letter-outlines.json').write_text(json.dumps(atlas,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'paths':len(paths),'portraitPaths':sum(p['id'].startswith('portrait') for p in paths),'glyphs':len(atlas),'preview':'/tmp/channel-drawing-vector-preview.png'}))
