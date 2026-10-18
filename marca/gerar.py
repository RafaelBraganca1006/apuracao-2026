import json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
pts = json.load(open('../site/data/brasil-pontos.json'))
lons=[p[0] for p in pts]; lats=[p[1] for p in pts]
minx,maxx,miny,maxy=min(lons),max(lons),min(lats),max(lats)
S=3  # supersample
def proj(lon,lat):
    k=math.cos(math.radians(-14))
    return (lon-minx)*k, (maxy-lat)
W0=(maxx-minx)*math.cos(math.radians(-14)); H0=maxy-miny
pops=[p[2] for p in pts]
def mapa(draw,x0,y0,h,glow=None):
    sc=h/H0
    for lon,lat,pop,_ in pts:
        x,y=proj(lon,lat)
        r=(0.9+2.6*math.sqrt(pop/max(pops)))*sc/ (h/ H0) * (h/700)
        t=min(1,math.sqrt(pop/max(pops))*1.6)
        # verde -> branco-esverdeado conforme população
        c=(int(40+180*t),int(200+55*t),int(110+110*t))
        X=x0+x*sc; Y=y0+y*sc
        draw.ellipse([X-r,Y-r,X+r,Y+r],fill=c)
BG=(10,10,12)
def fonte(p,s,i=0): return ImageFont.truetype(p,s,index=i)

# PFP 400x400 (render 1200)
n=400*S
im=Image.new('RGB',(n,n),BG); d=ImageDraw.Draw(im)
h=n*0.80; w=h*W0/H0
mapa(d,(n-w)/2,(n-h)/2,h)
im.resize((400,400),Image.LANCZOS).save('pfp.png')

# Banner 1500x500
bw,bh=1500*S,500*S
im=Image.new('RGB',(bw,bh),BG); d=ImageDraw.Draw(im)
# glow
g=Image.new('RGB',(bw,bh),(0,0,0)); gd=ImageDraw.Draw(g)
h=bh*0.92; w=h*W0/H0
x0=bw*0.80-w/2; y0=(bh-h)/2
mapa(gd,x0,y0,h)
glow=g.filter(ImageFilter.GaussianBlur(14*S))
im=Image.blend(im,Image.eval(glow,lambda v:min(255,int(v*1.0))),0.0)
from PIL import ImageChops
im=ImageChops.add(im,Image.eval(glow,lambda v:int(v*0.5)))
d=ImageDraw.Draw(im)
mapa(d,x0,y0,h)
serif=fonte('/System/Library/Fonts/NewYork.ttf',54*S)
sans=fonte('/System/Library/Fonts/SFNS.ttf',26*S)
mono=fonte('/System/Library/Fonts/SFNSMono.ttf',20*S)
tx=300*S  # deixa a área do avatar livre
d.text((tx,160*S),"Dados, IA e visualização",font=serif,fill=(240,240,240))
d.text((tx,228*S),"para entender o Brasil.",font=serif,fill=(240,240,240))
d.text((tx,318*S),"PESQUISA APLICADA  ·  DATA SCIENCE  ·  DATAVIZ  ·  IA",font=mono,fill=(120,220,150))
im.resize((1500,500),Image.LANCZOS).save('banner.png')
