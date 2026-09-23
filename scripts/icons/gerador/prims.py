"""SVG primitives in a 100x100 box (the medallion). Objects are matte black #1E1B18."""
import math

K = '#1E1B18'      # object black
D = '#4E443B'      # stitch / engraving detail on black
CR = '#F8E6C2'     # cream (shows medallion colour) for cut-out details
O = '#F57C1F'      # brand orange accent


class Pal:
    def __init__(self, act):
        self.act = act
        self.a = O if act else K      # accent solid part
        self.ad = O if act else D     # accent detail (stitch etc.)
        self.ac = O if act else CR    # accent on a cream detail


def P(d, fill=K, extra=''):
    return f'<path d="{d}" fill="{fill}" fill-rule="evenodd" {extra}/>'


def S(d, w=4.5, col=K, extra=''):
    return (f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round" {extra}/>')


def stitch(d, col=D, w=1.1):
    return S(d, w, col, 'stroke-dasharray="2.2 1.8"')


def C(x, y, r, fill=K, extra=''):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" {extra}/>'


def RR(x, y, w, h, rx=3, fill=K, extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" {extra}/>'


def G(inner, t=''):
    return f'<g transform="{t}">{inner}</g>' if t else f'<g>{inner}</g>'


def circ_d(x, y, r):
    """circle as sub-path (for evenodd holes)"""
    return f'M{x - r},{y} a{r},{r} 0 1,0 {2 * r},0 a{r},{r} 0 1,0 {-2 * r},0 Z'


def rect_d(x, y, w, h):
    return f'M{x},{y} h{w} v{h} h{-w} Z'


def sparkle(x, y, r, fill=K):
    q = r * 0.16
    d = (f'M{x},{y - r} Q{x + q},{y - q} {x + r},{y} Q{x + q},{y + q} {x},{y + r} '
         f'Q{x - q},{y + q} {x - r},{y} Q{x - q},{y - q} {x},{y - r} Z')
    return P(d, fill) + S(d, r * 0.12, fill)


def plus(x, y, r, t, fill=K):
    return RR(x - r, y - t / 2, 2 * r, t, t / 2, fill) + RR(x - t / 2, y - r, t, 2 * r, t / 2, fill)


def minus(x, y, r, t, fill=K):
    return RR(x - r, y - t / 2, 2 * r, t, t / 2, fill)


def check(x, y, s, col=CR, w=3):
    return S(f'M{x - s},{y} L{x - s * 0.3},{y + s * 0.7} L{x + s},{y - s * 0.75}', w, col)


def hook(cx, y0, hr, col=K, sw=4.5):
    yc = y0 - 0.6 * hr - hr
    return S(f'M{cx},{y0} L{cx},{y0 - 0.6 * hr} A{hr},{hr} 0 1 0 {cx - hr},{yc} l0,{hr * 0.35}', sw, col)


def hanger(cx, y0, w, h, col=K, sw=4.5, hook_col=None, hr=None):
    hr = hr or max(3.2, w * 0.1)
    bar = S(f'M{cx},{y0} L{cx + w / 2},{y0 + h} L{cx - w / 2},{y0 + h} Z', sw, col)
    return hook(cx, y0, hr, hook_col or col, sw) + bar


def button(x, y, r, fill=K, rim=D, holes=True):
    d = circ_d(x, y, r)
    if holes:
        o, hr = r * 0.3, r * 0.14
        for dx, dy in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
            d += ' ' + circ_d(x + dx * o, y + dy * o, hr)
    s = P(d, fill)
    if rim:
        s += f'<circle cx="{x}" cy="{y}" r="{r * 0.72}" fill="none" stroke="{rim}" stroke-width="{r * 0.08}"/>'
    return s


def swing_tag(x, y, w, h, fill=K, rot=0, hole=True, extra=''):
    """tag pointing left; (x,y)=top-left; hole near the point"""
    d = (f'M{x},{y + h * 0.5} L{x + h * 0.45},{y} L{x + w},{y} L{x + w},{y + h} '
         f'L{x + h * 0.45},{y + h} Z')
    if hole:
        d += ' ' + circ_d(x + h * 0.42, y + h * 0.5, h * 0.12)
    t = f'rotate({rot} {x} {y + h / 2})' if rot else ''
    return G(P(d, fill) + extra, t)


def star_d(x, y, r, ri=None, n=5, rot=-90):
    ri = ri or r * 0.45
    pts = []
    for i in range(2 * n):
        rr = r if i % 2 == 0 else ri
        a = math.radians(rot + i * 180 / n)
        pts.append(f'{x + rr * math.cos(a):.2f},{y + rr * math.sin(a):.2f}')
    return 'M' + ' L'.join(pts) + ' Z'


def star(x, y, r, fill=K, ri=None):
    d = star_d(x, y, r, ri)
    return P(d, fill) + S(d, r * 0.14, fill)


def dressform(t='', kind='n', col=K, neck=None, stand=True):
    """dress form in local box ~ x30..70, y20..86"""
    if kind == 'm':
        body = ('M38,29 C28,30 25,34 25,41 C25,48 32,52 33,58 C34,64 33,68 34,72 L66,72 '
                'C67,68 66,64 67,58 C68,52 75,48 75,41 C75,34 72,30 62,29 Z')
    elif kind == 'f':
        body = ('M41,28 C33,29 30,33 30,40 C30,47 35,51 38,56 C40,60 35,66 34,72 L66,72 '
                'C65,66 60,60 62,56 C65,51 70,47 70,40 C70,33 67,29 59,28 Z')
    else:
        body = ('M40,28 C33,29 29,33 29,40 C29,48 35,52 35,58 C35,64 33,68 33,72 L67,72 '
                'C67,68 65,64 65,58 C65,52 71,48 71,40 C71,33 67,29 60,28 Z')
    s = RR(45, 21, 10, 7, 2.5, neck or col) + P(body, col)
    s += S('M50,30 L50,70', 0.9, D)  # centre seam
    if stand:
        s += RR(48, 72, 4, 10, 1.2, col) + S('M39,87 L50,81 L61,87', 4, col)
    return G(s, t)


def tshirt_d(x, y, s):
    """t-shirt silhouette, centre-top (x,y), scale s (~width 2*s)"""
    p = [(-0.35, 0), (-1, 0.3), (-0.8, 0.75), (-0.55, 0.62), (-0.55, 1.5), (0.55, 1.5), (0.55, 0.62),
         (0.8, 0.75), (1, 0.3), (0.35, 0)]
    d = 'M' + ' L'.join(f'{x + a * s:.2f},{y + b * s:.2f}' for a, b in p)
    d += f' Q{x},{y + 0.35 * s} {x - 0.35 * s},{y} Z'
    return d


def tshirt(x, y, s, fill=K):
    d = tshirt_d(x, y, s)
    return P(d, fill) + S(d, s * 0.12, fill)


def folded_shirt(x, y, w, h, fill=K, det=D):
    """folded shirt seen from the front: body block with collar"""
    s = RR(x, y, w, h, 2.5, fill)
    cx = x + w / 2
    s += P(f'M{cx - w * 0.22},{y} L{cx},{y + h * 0.32} L{cx + w * 0.22},{y} Z', det)
    s += S(f'M{cx - w * 0.22},{y} L{cx},{y + h * 0.32} L{cx + w * 0.22},{y}', 1.2, fill)
    s += S(f'M{x + w * 0.25},{y + h * 0.22} L{x + w * 0.25},{y + h - 2}', 1, det)
    s += S(f'M{x + w * 0.75},{y + h * 0.22} L{x + w * 0.75},{y + h - 2}', 1, det)
    return s


def scissors(t='', col=K, hole=CR):
    """tailor's scissors pointing right, pivot at (46,50)"""
    s = P('M44,48 L80,44 Q82,45 80,47 L46,53 Z', col)
    s += P('M44,52 L80,56 Q82,55 80,53 L46,47 Z', col)
    s += S('M45,49 L33,40', 4, col) + S('M45,51 L33,60', 4, col)
    s += P(circ_d(27, 37, 7.5) + ' ' + circ_d(27, 37, 4), col)
    s += P(circ_d(27, 63, 7.5) + ' ' + circ_d(27, 63, 4), col)
    s += C(45.5, 50, 1.6, hole)
    return G(s, t)


def tape_ticks(d_path, col=CR):
    return S(d_path, 1.2, col, 'stroke-dasharray="0.8 2.4"')
