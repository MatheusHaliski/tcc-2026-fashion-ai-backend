from prims import *

OBJ = {}
HAS_ACTIVE = {}
LABEL = {}


def reg(oid, label, active=True):
    def deco(fn):
        def wrap(act):
            return fn(Pal(act))
        OBJ[oid] = wrap
        HAS_ACTIVE[oid] = active
        LABEL[oid] = label
        return fn
    return deco


# ───────────────────────── SOC ─────────────────────────
HEART = 'M50,79 C22,60 17,38 30,29 C40,23 48,29 50,36 C52,29 60,23 70,29 C83,38 78,60 50,79 Z'


@reg('soc-01', 'Curtir')
def _(p):
    s = P(HEART) + S(HEART, 2)
    s += '<clipPath id="hc"><path d="M50,74 C26,57 22,39 32,32 C40,27 47,32 50,38 C53,32 60,27 68,32 C78,39 74,57 50,74 Z"/></clipPath>'
    lines = ''
    for k in range(-60, 80, 9):
        lines += stitch(f'M{k},20 L{k + 60},80', p.ad, 1.3) + stitch(f'M{k + 60},20 L{k},80', p.ad, 1.3)
    s += f'<g clip-path="url(#hc)">{lines}</g>'
    s += stitch('M50,74 C26,57 22,39 32,32 C40,27 47,32 50,38 C53,32 60,27 68,32 C78,39 74,57 50,74 Z', p.ad, 1.3)
    return s


@reg('soc-02', 'Comentar')
def _(p):
    d = 'M27,28 Q24,28 24,31 L24,63 Q24,66 27,66 L34,66 L30,77 L44,66 L73,66 Q76,66 76,63 L76,31 Q76,28 73,28 Z'
    s = P(d) + S(d, 2)
    s += stitch('M29,33 L71,33 L71,61 L29,61 Z', D, 1.2)
    s += C(38, 47, 3.6, p.ac if p.act else D) + C(50, 47, 3.6, p.ac if p.act else D) + C(62, 47, 3.6, p.ac if p.act else D)
    return s


@reg('soc-03', 'Compartilhar')
def _(p):
    s = ''
    if p.act:
        s += S('M13,64 L27,58', 3.2, O) + S('M18,73 L34,66', 3.2, O) + S('M26,80 L40,72', 3.2, O)
    f1 = 'M80,24 L20,50 L45,57 Z'
    f2 = 'M80,24 L45,57 L57,77 Z'
    s += P(f1 + ' ' + circ_d(33, 49, 2.8)) + S(f1, 2)
    s += P(f2, '#2A2622') + S(f2, 2)
    s += P('M45,57 L49,70 L57,64 Z', K)
    s += f'<circle cx="33" cy="49" r="4.3" fill="none" stroke="{D}" stroke-width="1.2"/>'
    s += S('M80,24 L45,57', 1, D)
    return s


@reg('soc-04', 'Remixar')
def _(p):
    one = (S('M36,42 L64,42 L50,31 Z', 4) +
           S('M50,31 L50,24 A26,26 0 0 1 76,50', 4.5, p.a) +
           P('M69.5,47 L82.5,47 L76,57 Z', p.a) + S('M69.5,47 L82.5,47 L76,57 Z', 1.5, p.a))
    return one + G(one, 'rotate(180 50 50)')


@reg('soc-05', 'Salvar')
def _(p):
    s = hook(50, 27, 4)
    d = 'M50,27 L32,35 Q31,36 31,38 L31,78 Q31,81 34,81 L66,81 Q69,81 69,78 L69,38 Q69,36 68,35 Z'
    s += P(d) + S(d, 1.5)
    s += S('M50,36 L50,78', 1.4, D, 'stroke-dasharray="1 1"')
    s += RR(47.5, 38, 5, 8, 1.5, D)
    rb = 'M62,40 L72,40 L72,66 L67,61 L62,66 Z'
    s += P(rb, p.a) + S(rb, 1.2, p.a)
    return s


@reg('soc-06', 'Favoritar')
def _(p):
    s = S('M26,74 L76,32', 2.6) + C(76, 32, 2.6)
    s += star(50, 52, 28, p.a, 12.5)
    s += f'<path d="{star_d(50, 52, 17, 7.8)}" fill="none" stroke="{CR if p.act else D}" stroke-width="1.2" stroke-linejoin="round"/>'
    return s


@reg('soc-07', 'Reação Trend')
def _(p):
    z = 'M22,74 L40,55 L52,65 L68,46'
    s = S(z, 9) + S(z, 9, D, 'stroke-dasharray="1.3 1.5" stroke-linecap="butt" opacity="0.9"') + S(z, 1.4, K)
    s += P('M60,40 L78,33 L73,52 Z') + S('M60,40 L78,33 L73,52 Z', 2.5)
    pull = 'M77,34 L84,27 Q86,25 88,27 L89,28 Q91,30 89,32 L82,38 Z'
    s += P(pull + ' ' + circ_d(85.5, 30.5, 1.3), p.a)
    return s


@reg('soc-08', 'Reação Elegante')
def _(p):
    L = 'M50,50 C42,38 30,32 23,36 C18,40 18,60 23,64 C30,68 42,62 50,50 Z'
    s = P(L) + G(P(L), 'translate(100 0) scale(-1 1)')
    s += S('M26,42 C32,45 36,48 42,50', 1.2, D) + S('M26,58 C32,55 36,52 42,50', 1.2, D)
    s += S('M74,42 C68,45 64,48 58,50', 1.2, D) + S('M74,58 C68,55 64,52 58,50', 1.2, D)
    s += RR(43, 41, 14, 18, 5, p.a)
    return s


@reg('soc-09', 'Reação Criativo')
def _(p):
    s = RR(26, 30, 34, 7, 2.5) + RR(26, 71, 34, 7, 2.5) + RR(30, 36, 26, 36, 1)
    for y in range(40, 70, 4):
        s += S(f'M31,{y} L55,{y + 1.5}', 0.9, D)
    s += S('M56,42 C66,38 66,28 70,24', 1.8, K)
    s += sparkle(73, 21, 8, p.a)
    s += S('M66,78 L80,38', 2.8) + P('M79,38 m-2,1 a2.5,4 20 1,1 4,0 a2.5,4 20 1,1 -4,0 Z', K)
    s += C(79.6, 40.5, 0.8, CR)
    return s


@reg('soc-10', 'Retornar')
def _(p):
    s = S('M50,48 L76,68 L24,68 Z', 4.5)
    s += S('M50,48 L50,38 A11,11 0 0 0 28,38', 4.5, p.a)
    s += P('M21,37 L35,37 L28,47 Z', p.a) + S('M21,37 L35,37 L28,47 Z', 1.5, p.a)
    return s


@reg('soc-11', 'Editar')
def _(p):
    s = G(RR(0, -5, 40, 10, 1.2, p.a) + tape_ticks('M4,-2.5 L38,-2.5', CR if not p.act else '#7a3a0a'),
          'translate(36 70) rotate(-14)')
    s += P(circ_d(36, 58, 18) + ' ' + circ_d(36, 58, 5), p.a)
    s += f'<circle cx="36" cy="58" r="12" fill="none" stroke="{CR if p.act else D}" stroke-width="1.1"/>'
    tri = 'M50,26 L76,31 L60,52 Z'
    s += P(tri) + S(tri, 6)
    s += S('M53,30 L70,33', 1, D)
    return s


@reg('soc-12', 'Seguir / Deixar de seguir')
def _(p):
    if not p.act:
        s = S('M50,28 L50,72', 6) + S('M26,50 L74,50', 6)
        s += f'<circle cx="50" cy="77.5" r="5" fill="none" stroke="{K}" stroke-width="4"/>'
        s += RR(42, 16, 16, 13, 3.5) + S('M45,22.5 L55,22.5', 1, D)
        s += C(76, 50, 4) + C(24, 50, 4)
    else:
        s = S('M27,53 L43,69 L72,35', 6, O)
        s += f'<circle cx="24" cy="50" r="4.5" fill="none" stroke="{O}" stroke-width="3.5"/>'
        s += G(RR(-7, -5.5, 14, 11, 3, O) + S('M-4,0 L4,0', 1, '#8a4210'), 'translate(74 32) rotate(-50)')
    return s


@reg('soc-13', 'Excluir comentário', active=False)
def _(p):
    s = G(RR(0, 0, 22, 13, 1.5) + stitch('M3,3 L19,3', D), 'translate(60 31) rotate(-10)')
    s += G(RR(0, 0, 22, 13, 1.5) + stitch('M3,10 L19,10', D), 'translate(60 55) rotate(10)')
    s += scissors('translate(-4 0)')
    return s


@reg('soc-14', 'Disponível')
def _(p):
    s = hanger(46, 36, 50, 18)
    s += S('M66,54 L66,60', 1.4)
    s += C(66, 69, 11, p.a) + check(66, 69, 5.5, CR, 2.8)
    return s


@reg('soc-15', 'Indisponível', active=False)
def _(p):
    s = '<clipPath id="bk"><path d="M27,52 L73,52 L67,80 L33,80 Z"/></clipPath>'
    s += P('M27,52 L73,52 L67,80 Q66.5,82 64,82 L36,82 Q33.5,82 33,80 Z')
    w = ''.join(S(f'M20,{y} L80,{y}', 1, D) for y in (58, 64, 70, 76))
    w += ''.join(S(f'M{x},50 L{x + (x - 50) * -0.12},84', 1, D) for x in (36, 43, 50, 57, 64))
    s += f'<g clip-path="url(#bk)">{w}</g>'
    s += RR(24, 47, 52, 7, 3.5)
    s += P('M36,47 L36,37 L44,32 L50,36 L56,32 L64,37 L64,47 Z') + S('M36,47 L36,37 L44,32 L50,36 L56,32 L64,37 L64,47 Z', 1.5)
    s += S('M44,32 L50,40 L56,32', 1.2, D)
    return s


# ───────────────────────── NAV ─────────────────────────
@reg('nav-01', 'Dashboard')
def _(p):
    s = dressform('translate(0 -3)')
    s += C(50, 45, 10.5, CR) + C(50, 45, 8.5)
    for a in (-150, -120, -90, -60, -30):
        import math
        r1, r2 = 5.5, 7.5
        x1, y1 = 50 + r1 * math.cos(math.radians(a)), 45 + r1 * math.sin(math.radians(a))
        x2, y2 = 50 + r2 * math.cos(math.radians(a)), 45 + r2 * math.sin(math.radians(a))
        s += S(f'M{x1:.2f},{y1:.2f} L{x2:.2f},{y2:.2f}', 0.9, CR)
    s += S('M50,45 L55,39', 1.8, p.ac) + C(50, 45, 1.6, p.ac)
    return s


@reg('nav-02', 'Guarda-Roupa')
def _(p):
    s = RR(26, 20, 48, 60, 3) + RR(29, 80, 4, 4, 1) + RR(67, 80, 4, 4, 1)
    s += RR(51.5, 24, 19, 52, 1, CR)
    s += S('M53,30 L69,30', 1.6)
    s += hanger(57.5, 34, 8, 5, p.a, 1.6, hr=2) + hanger(64.5, 34, 8, 5, p.a, 1.6, hr=2)
    s += P('M72,23 L84,28 L84,74 L72,78 Z') + S('M72,23 L84,28 L84,74 L72,78 Z', 1.5)
    s += S('M30,26 L30,74', 0.8, D) + S('M47,26 L47,74', 0.8, D)
    s += C(45, 50, 1.8, D) + C(80, 51, 1.6, D)
    return s


@reg('nav-03', 'Criar Look')
def _(p):
    return dressform('translate(-6 0)') + sparkle(71, 24, 9, p.a)


@reg('nav-04', 'Looks Salvos')
def _(p):
    s = S('M20,26 L80,26', 3.2) + C(20, 26, 2.8) + C(80, 26, 2.8)
    for x, c in ((31, K), (50, p.a), (69, K)):
        s += S(f'M{x},34 L{x},28 A2.5,2.5 0 1 0 {x - 2.5},25.5', 1.8, c)
        d = f'M{x},33 L{x - 8},37 L{x - 8},78 Q{x - 8},80 {x - 6},80 L{x + 6},80 Q{x + 8},80 {x + 8},78 L{x + 8},37 Z'
        s += P(d, c) + S(d, 1.2, c)
        s += S(f'M{x},39 L{x},77', 1, CR if c == O else D, 'stroke-dasharray="1 1"')
    return s


@reg('nav-05', 'The Runway')
def _(p):
    s = P('M40,19 L60,19 L57,26 L43,26 Z', p.a)
    s += P('M44,26 L56,26 L70,66 L30,66 Z', '#FFF8E6' if not p.act else '#FBB57A', 'opacity="0.85"')
    s += P('M18,78 L82,78 L74,66 L26,66 Z') + S('M18,78 L82,78', 2)
    s += S('M26,72 L74,72', 0.8, D, 'stroke-dasharray="3 2"')
    shoe = ('M33,65 C33,60 37,58 43,58 C50,58 55,52 59,45 C61,42 65,43 65,46 L65,51 L63,52 L62,65 '
            'L59,65 L59,56 C53,62 45,65 33,65 Z')
    s += P(shoe) + S(shoe, 1.5)
    return s


@reg('nav-06', 'Autopiloto')
def _(p):
    s = S('M50,43 L77,66 L23,66 Z', 4.5) + S('M50,43 L50,40', 4.5)
    s += C(50, 29, 12.5) + C(50, 29, 9.5, CR)
    for a in range(0, 360, 90):
        import math
        s += C(50 + 7.6 * math.cos(math.radians(a)), 29 + 7.6 * math.sin(math.radians(a)), 0.9)
    s += S('M50,29 L50,23', 1.8, p.a) + S('M50,29 L54.5,31', 1.8, p.a) + C(50, 29, 1.4, p.a)
    return s


@reg('nav-07', 'Provador 2D')
def _(p):
    s = S('M27,82 L27,22 L73,22 L73,82', 5) + S('M22,22 L78,22', 3)
    cur = 'M29,24 L58,24 C56,40 60,55 54,80 L29,80 Z'
    s += P(cur, p.a) + S(cur, 1.2, p.a)
    for x in (35, 42, 49):
        s += S(f'M{x},26 C{x + 2},45 {x - 1},60 {x + 1},78', 1.1, CR if p.act else D)
    for x in range(30, 60, 5):
        s += C(x, 24, 1.3, D)
    return s


@reg('nav-08', 'Peças Públicas')
def _(p):
    s = S('M22,82 L22,24 L78,24 L78,82', 3.6) + S('M16,82 L28,82', 3.6) + S('M72,82 L84,82', 3.6)
    s += hanger(34, 31, 14, 5, K, 1.6, hr=2) + tshirt(34, 36, 9)
    s += hanger(50, 31, 14, 5, p.a, 1.6, hr=2)
    dress = 'M46,36 L54,36 L55,44 L62,68 L38,68 L45,44 Z'
    s += P(dress, p.a) + S(dress, 1.2, p.a)
    s += hanger(66, 31, 14, 5, K, 1.6, hr=2)
    pants = 'M59,36 L73,36 L74,64 L68,64 L66,44 L64,64 L58,64 Z'
    s += P(pants) + S(pants, 1)
    return s


@reg('nav-09', 'Buscar')
def _(p):
    s = G(RR(-4.5, 0, 9, 26, 4.5, p.a), 'translate(56 56) rotate(-45)')
    s += button(43, 43, 20)
    return s


@reg('nav-10', 'Minhas Fotos')
def _(p):
    s = RR(34, 54, 32, 28, 1.5) + RR(37, 57, 26, 19, 0.5, CR)
    s += tshirt(50, 59.5, 7, p.a)
    s += RR(24, 22, 52, 35, 6) + S('M24,50 L76,50', 1, D)
    s += C(50, 37, 11, D) + C(50, 37, 8.5) + C(50, 37, 3.5, D) + C(47.5, 34.5, 1.2, '#8b7d6d')
    s += RR(29, 26, 8, 5, 1.5, D) + C(69, 28, 2.2, D)
    return s


@reg('nav-11', 'Marcas')
def _(p):
    d = 'M20,33 L80,33 L76,50 L80,67 L20,67 L24,50 Z'
    s = P(d) + S(d, 2)
    s += stitch('M27,37.5 L73,37.5 L70,50 L73,62.5 L27,62.5 L30,50 Z', D, 1.2)
    dm = 'M50,42 L58,50 L50,58 L42,50 Z'
    s += P(dm, p.ac if p.act else D) + stitch(dm, CR if not p.act else '#8a4210', 0.9)
    return s


@reg('nav-12', 'Art Celebrity')
def _(p):
    rug = 'M22,80 L78,80 L70,66 L30,66 Z'
    s = P(rug, p.a) + S(rug, 1.5, p.a)
    s += S('M27,77 L73,77', 0.8, CR if p.act else D, 'stroke-dasharray="2 2"')
    s += star(50, 42, 22, K, 10)
    return s


@reg('nav-13', 'Temas Futuros')
def _(p):
    s = S('M50,58 L36,84', 3.2) + S('M50,58 L64,84', 3.2) + S('M50,58 L50,84', 3.2)
    s += C(50, 58, 3.5)
    body = RR(-19, -7.5, 38, 15, 1, p.a)
    for x in range(-15, 17, 4):
        body += S(f'M{x},-7 L{x + 1.5},7', 0.9, CR if p.act else D)
    tele = (body + RR(-23, -11, 5, 22, 2) + RR(18, -11, 5, 22, 2) +
            RR(-31, -4, 8, 8, 1.5) + RR(23, -12.5, 7, 25, 2.5) + P(circ_d(26.5, 0, 3), D))
    s += G(tele, 'translate(50 44) rotate(-28)')
    return s


@reg('nav-14', 'Configurações')
def _(p):
    import math
    pts = []
    for i in range(8):
        a0 = i * 45
        for da, r in ((-14, 26), (-9, 31), (9, 31), (14, 26), (22.5, 26)):
            a = math.radians(a0 + da)
            pts.append(f'{50 + r * math.cos(a):.2f},{50 + r * math.sin(a):.2f}')
    d = 'M' + ' L'.join(pts) + ' Z ' + circ_d(50, 50, 14)
    s = P(d) + S('M' + ' L'.join(pts) + ' Z', 1.5)
    s += button(50, 50, 11, p.a, CR if p.act else D)
    return s


@reg('nav-15', 'Perfil Lookbook')
def _(p):
    L = 'M50,32 C42,27 30,26 20,29 L20,73 C30,70 42,71 50,76 Z'
    R = 'M50,32 C58,27 70,26 80,29 L80,73 C70,70 58,71 50,76 Z'
    s = P(L + ' ' + circ_d(35, 44, 7.5) + ' M26,64 Q35,52 44,64 Z') + P(R)
    s += f'<circle cx="35" cy="44" r="9.2" fill="none" stroke="{p.a if p.act else D}" stroke-width="1.6"/>'
    s += S('M26,64 Q35,52 44,64', 1.6, p.a if p.act else D)
    for y in (40, 46, 52, 58):
        s += S(f'M57,{y - 3} L74,{y - 4}', 1.3, D)
    s += S('M50,32 L50,76', 1, D)
    return s


@reg('nav-16', 'Meu Quarto')
def _(p):
    s = RR(18, 26, 34, 54, 2.5) + RR(20, 80, 4, 4, 1) + RR(46, 80, 4, 4, 1)
    s += S('M35,30 L35,76', 1.1, D) + C(32, 52, 1.6, D) + C(38, 52, 1.6, D)
    s += f'<ellipse cx="68" cy="45" rx="11" ry="21" fill="{p.a}"/>'
    s += f'<ellipse cx="68" cy="45" rx="7.5" ry="17.5" fill="{CR}"/>'
    s += S('M63,38 L67,33', 1.3, '#FFFFFF') + S('M63,44 L70,36', 1.3, '#FFFFFF')
    s += S('M68,66 L68,78', 3) + S('M60,84 L68,78 L76,84', 3)
    return s


# ───────────────────────── ACT ─────────────────────────
@reg('act-01', 'Criar conta')
def _(p):
    s = swing_tag(20, 30, 60, 40)
    s += f'<circle cx="{20 + 40 * 0.42}" cy="50" r="7" fill="none" stroke="{D}" stroke-width="1.2"/>'
    if p.act:
        s += plus(56, 50, 10, 5, O)
    else:
        s += stitch('M56,40 L56,60 M46,50 L66,50', CR, 1.6)
    return s


@reg('act-02', 'Entrar')
def _(p):
    s = P(circ_d(31, 38, 11) + ' ' + circ_d(31, 38, 5))
    s += RR(40, 35.5, 38, 6, 2) + RR(68, 40, 5, 10, 1) + RR(74, 40, 4, 7, 1)
    s += S('M28,48 C26,54 30,56 29,60', 1.4)
    s += swing_tag(22, 60, 26, 16, p.a, rot=-78)
    return s


@reg('act-03', 'Notificações')
def _(p):
    s = S('M50,34 L50,27 A5,5 0 1 0 45,22', 3.2)
    bell = 'M36,64 C36,47 40,36 50,36 C60,36 64,47 64,64 L69,69 L31,69 Z'
    s += P(bell) + S(bell, 2)
    s += S('M38,63 L62,63', 1, D)
    s += C(50, 74, 4.6, p.a)
    return s


@reg('act-04', 'Privacidade')
def _(p):
    s = S('M38,42 L38,34 A12,12 0 0 1 62,34 L62,42', 5)
    s += C(44.5, 22.5, 4.2, p.a) + C(55.5, 22.5, 4.2, p.a)
    body = 'M28,44 Q28,40 32,40 L68,40 Q72,40 72,44 L70,74 Q70,79 65,79 L35,79 Q30,79 30,74 Z'
    kh = 'M50,53 m-4,0 a4,4 0 1,1 8,0 a4,4 0 0,1 -2,3.4 L53,66 L47,66 L48,56.4 A4,4 0 0,1 46,53 Z'
    s += P(body + ' ' + kh)
    s += S('M30,47 L70,47', 1, D)
    return s


@reg('act-05', 'Sair', active=False)
def _(p):
    s = S('M28,82 L28,20 L68,20 L68,82', 4.2) + S('M20,82 L76,82', 3)
    door = 'M30,22 L54,28 L54,80 L30,80 Z'
    s += P(door) + S(door, 1.5)
    s += C(49, 54, 2.2, D)
    s += S('M40,36 L40,42 Q40,46 44,46', 2.4, CR) + C(40, 35.5, 1.8, CR)
    return s


@reg('act-06', 'Adicionar peça')
def _(p):
    s = hanger(44, 36, 48, 18)
    s += S('M62,54 L64,58', 1.4)
    s += C(66, 68, 11.5, p.a) + plus(66, 68, 6, 2.8, CR)
    return s


@reg('act-07', 'Enviar foto')
def _(p):
    s = RR(22, 42, 56, 36, 6) + RR(34, 38, 16, 6, 2)
    s += C(50, 60, 12, D) + C(50, 60, 9.5) + C(50, 60, 4.5, p.a if p.act else D) + C(47, 57, 1.3, '#8b7d6d')
    s += C(70, 49, 2.2, D)
    s += folded_shirt(36, 24, 28, 14)
    return s


@reg('act-08', 'Detectar com IA')
def _(p):
    return folded_shirt(24, 36, 46, 40) + sparkle(64, 25, 10, p.a)


@reg('act-09', 'Gerar com IA')
def _(p):
    s = S('M27,76 L66,37', 4.6) + C(26, 77, 6.5) + C(26, 77, 2.5, D)
    s += sparkle(72, 30, 12, p.a) + sparkle(58, 22, 4.5, p.a) + sparkle(80, 46, 4, p.a)
    return s


@reg('act-10', 'Salvar esquema')
def _(p):
    s = RR(26, 48, 48, 30, 2.5) + RR(22, 34, 56, 16, 3)
    s += S('M26,50 L74,50', 1.2, D)
    s += hanger(50, 39.5, 20, 7, p.ac, 1.6, hr=2.2)
    s += S('M50,52 L50,76', 1, D)
    return s


@reg('act-11', 'Publicar no feed')
def _(p):
    s = S('M50,60 L36,84', 3.4) + S('M50,60 L64,84', 3.4) + S('M50,60 L50,84', 3.4) + C(50, 60, 4)
    s += S('M42,56 L50,60 L58,56', 3.2)
    head = (RR(-13, -10, 24, 20, 3) + P('M9,-14 L16,-14 L16,14 L9,14 Z') +
            S('M-8,-10 L-8,10 M-3,-10 L-3,10', 1, D) + P(circ_d(15.5, 0, 0.1), K))
    s += G(head, 'translate(50 46) rotate(-70)')
    s += S('M44,16 L41,9', 2.8, p.a) + S('M52,14 L52,6', 2.8, p.a) + S('M60,17 L64,10', 2.8, p.a)
    return s


@reg('act-12', 'Filtrar')
def _(p):
    s = RR(34, 22, 32, 8, 3, p.a)
    sk = 'M36,29 L64,29 L76,58 Q76,60 74,60 L26,60 Q24,60 24,58 Z'
    s += P(sk) + S(sk, 1.5)
    for x in (42, 50, 58):
        s += S(f'M{x},31 L{x + (x - 50) * 0.8},58', 1, D)
    s += P('M42,60 L58,60 L54,66 L54,80 Q54,82 52,82 L48,82 Q46,82 46,80 L46,66 Z')
    return s


@reg('act-13', 'Abrir Copilot')
def _(p):
    s = dressform('translate(-10 4) scale(0.9) translate(5 0)')
    b = 'M60,18 L82,18 Q86,18 86,22 L86,34 Q86,38 82,38 L68,38 L62,44 L63,38 L60,38 Q56,38 56,34 L56,22 Q56,18 60,18 Z'
    s += P(b, p.a) + S(b, 1, p.a)
    for x in (64, 71, 78):
        s += C(x, 28, 2, CR)
    return s


@reg('act-14', 'Abrir Background Studio')
def _(p):
    pal = ('M50,22 C70,22 82,34 82,48 C82,58 74,60 68,58 C62,56 58,60 60,66 C62,74 56,80 46,78 '
           'C30,76 20,64 20,50 C20,34 32,22 50,22 Z')
    s = P(pal + ' ' + circ_d(62, 66, 0.1) + ' ' + circ_d(66, 45, 4.5))
    import math

    def swatch(x, y, fill):
        pts = []
        n = 6; w = 10
        for i in range(n):
            pts.append((x + i * w / n, y + (0 if i % 2 == 0 else 1.2)))
        for i in range(n):
            pts.append((x + w + (0 if i % 2 == 0 else -1.2), y + i * w / n))
        for i in range(n):
            pts.append((x + w - i * w / n, y + w - (0 if i % 2 == 0 else 1.2)))
        for i in range(n):
            pts.append((x + (0 if i % 2 == 0 else 1.2), y + w - i * w / n))
        return P('M' + ' L'.join(f'{a:.2f},{b:.2f}' for a, b in pts) + ' Z', fill)
    s += swatch(30, 40, CR) + swatch(40, 28, p.ac) + swatch(55, 28, CR) + swatch(34, 56, CR)
    return s


@reg('act-15', 'Gerar fundo com IA')
def _(p):
    s = RR(20, 34, 50, 42, 2.5) + RR(25, 39, 40, 32, 0.5, CR)
    s += P('M25,71 L38,52 L46,62 L52,55 L65,71 Z') + C(56, 46, 3.5)
    s += sparkle(74, 26, 11, p.a)
    return s


@reg('act-16', 'Enviar imagem de fundo')
def _(p):
    s = RR(24, 46, 52, 36, 2.5) + RR(29, 51, 42, 26, 0.5, CR)
    s += P('M29,77 L42,60 L50,69 L56,63 L71,77 Z') + C(61, 57, 3)
    s += S('M50,40 L50,20', 5, p.a) + P('M40,26 L50,14 L60,26 Z', p.a) + S('M40,26 L50,14 L60,26 Z', 2, p.a)
    return s


@reg('act-17', 'Baixar foto', active=False)
def _(p):
    s = G(RR(0, 0, 26, 30, 1.5) + RR(3, 3, 20, 20, 0.5, CR) + P('M3,23 L10,14 L15,19 L18,16 L23,23 Z'), 'translate(36 18) rotate(-8 13 15)')
    s += S('M50,20 L50,15', 0)
    s += S('M40,56 L40,48 A10,10 0 0 1 60,48 L60,56', 3.6)
    bag = 'M24,54 L76,54 L71,82 Q70.5,84 68,84 L32,84 Q29.5,84 29,82 Z'
    s += P(bag) + S(bag, 1.5) + S('M26,60 L74,60', 1, D)
    return s


@reg('act-18', 'Excluir em lote')
def _(p):
    s = ''
    for i, (x, y, r) in enumerate(((30, 22, -10), (38, 26, 0), (46, 30, 10))):
        s += G(RR(0, 0, 28, 32, 1.5) + RR(3, 3, 22, 22, 0.5, CR if i == 2 else D) +
               (P('M3,25 L10,15 L15,20 L18,17 L25,25 Z') if i == 2 else ''), f'translate({x} {y}) rotate({r} 14 16)')
    s += scissors('translate(56 60) rotate(-30) scale(0.72) translate(-50 -50)', p.a, CR)
    return s


@reg('act-19', 'Abrir DNA de Estilo')
def _(p):
    import math
    a = []; b = []
    for i in range(61):
        y = 18 + i
        t = i / 60 * 2 * math.pi * 1.25
        a.append(f'{50 + 15 * math.sin(t):.2f},{y}')
        b.append(f'{50 - 15 * math.sin(t):.2f},{y}')
    s = S('M' + ' L'.join(a), 3.4) + S('M' + ' L'.join(b), 3.4)
    for i in range(3, 61, 6):
        t = i / 60 * 2 * math.pi * 1.25
        dx = 15 * math.sin(t)
        if abs(dx) < 5:
            continue
        y = 18 + i
        s += S(f'M{50 - abs(dx)},{y} L{50 + abs(dx)},{y}', 1.1, D)
        bd = circ_d(50, y, 3.4) + ' ' + circ_d(48.8, y, 0.7) + ' ' + circ_d(51.2, y, 0.7)
        s += P(bd, p.a)
    return s


def cube(ox=0, oy=0, sc=1, col=K, w=2.4):
    t = f'translate({ox} {oy}) scale({sc})'
    e = ('M28,40 L60,40 L60,72 L28,72 Z M40,28 L72,28 L72,60 L40,60 Z '
         'M28,40 L40,28 M60,40 L72,28 M60,72 L72,60 M28,72 L40,60')
    return G(S(e, w, col) + ''.join(C(x, y, w * 0.9, col) for x, y in
             ((28, 40), (60, 40), (60, 72), (28, 72), (40, 28), (72, 28), (72, 60), (40, 60))), t)


@reg('act-20', 'Gerar 3D')
def _(p):
    return cube(0, 0, 1, K, 2) + tshirt(50, 38, 14, p.a)


@reg('act-21', 'Reprocessar 3D')
def _(p):
    s = cube(50 * 0.3, 50 * 0.3, 0.7, K, 3)
    s += S('M76,64 A30,30 0 1 1 78,42', 4, p.a)
    s += P('M71,40 L84,36 L82,50 Z', p.a) + S('M71,40 L84,36 L82,50 Z', 1.5, p.a)
    return s


@reg('act-22', 'Manequim masculino')
def _(p):
    return dressform('', 'm', K, p.a)


@reg('act-23', 'Manequim feminino')
def _(p):
    return dressform('', 'f', K, p.a)


@reg('act-24', 'Limpar manequim', active=False)
def _(p):
    s = RR(24, 22, 52, 26, 8)
    for x in range(30, 72, 5):
        s += S(f'M{x},24 L{x},46', 0.9, D)
    s += S('M24,35 L20,35 L20,54 L50,54 L50,60', 3.4)
    s += RR(45, 58, 10, 26, 4)
    s += S('M47,64 L53,64 M47,69 L53,69 M47,74 L53,74', 1, D)
    return s


@reg('act-25', 'Salvar como esquema')
def _(p):
    s = dressform('translate(-6 0)')
    rb = 'M47,74 L57,74 L57,90 L52,86 L47,90 Z'
    s += G(P(rb, p.a) + S(rb, 1, p.a), 'translate(6 -2)')
    return s


def rosette(center, p):
    import math
    s = ''
    t1 = 'M38,54 L30,82 L37,77 L41,85 L49,58 Z'
    t2 = 'M62,54 L70,82 L63,77 L59,85 L51,58 Z'
    s += P(t1, p.a) + P(t2, p.a)
    pts = []
    for i in range(48):
        a = math.radians(i * 7.5)
        r = 22 + (1.8 if i % 2 == 0 else -0.6)
        pts.append(f'{50 + r * math.cos(a):.2f},{42 + r * math.sin(a):.2f}')
    d = 'M' + ' L'.join(pts) + ' Z'
    s += P(d) + S(d, 1)
    s += f'<circle cx="50" cy="42" r="16" fill="none" stroke="{D}" stroke-width="1.2" stroke-dasharray="2 1.6"/>'
    return s + center


@reg('act-26', 'Selo de marca')
def _(p):
    return rosette(RR(40, 37, 20, 10, 1.5, CR), p)


@reg('act-27', 'Selo de celebridade')
def _(p):
    return rosette(star(50, 42.5, 9.5, CR, 4.3), p)


@reg('act-28', 'Tema claro/escuro')
def _(p):
    s = RR(30, 18, 40, 64, 6)
    s += C(50, 23.5, 1.5, D) + C(50, 76.5, 1.5, D)
    s += RR(39, 30, 22, 40, 3, D)
    s += RR(41, 32, 18, 18, 2, '#FFF6DE' if not p.act else O)
    s += RR(41, 50, 18, 18, 2)
    if not p.act:
        s += f'<rect x="41" y="32" width="18" height="18" rx="2" fill="none" stroke="#FFFFFF" stroke-width="0.8"/>'
    return s


@reg('act-29', 'Idioma')
def _(p):
    s = C(50, 50, 24)
    s += '<clipPath id="gl"><circle cx="50" cy="50" r="24"/></clipPath>'
    g = S('M26,50 L74,50 M50,26 L50,74', 1, D)
    g += f'<ellipse cx="50" cy="50" rx="11" ry="24" fill="none" stroke="{D}" stroke-width="1"/>'
    g += S('M29,38 Q50,34 71,38 M29,62 Q50,66 71,62', 1, D)
    s += f'<g clip-path="url(#gl)">{g}</g>'
    band = 'M18,62 Q50,40 82,34 L83,42 Q52,48 20,70 Z'
    s += P(band, p.a) + tape_ticks('M21,64 Q51,44 81,38', CR if not p.act else '#7a3a0a')
    return s


@reg('act-30', 'Organizar o quarto')
def _(p):
    s = RR(26, 22, 48, 56, 2.5) + RR(29, 78, 4, 5, 1) + RR(67, 78, 4, 5, 1)
    s += S('M28,40 L72,40', 1.4, CR) + S('M28,58 L72,58', 1.4, CR)
    s += RR(45, 29, 10, 3, 1.5, D) + RR(45, 67, 10, 3, 1.5, D)
    s += RR(30, 41.5, 54, 15.5, 2, p.a) + RR(56, 47.5, 10, 3.2, 1.6, CR if p.act else D)
    s += S('M30,43 L84,43', 0.9, CR if p.act else D)
    return s


@reg('act-31', 'Mostrar no quarto')
def _(p):
    s = P('M42,20 L58,20 L55,27 L45,27 Z', p.a)
    s += P('M45,27 L55,27 L74,56 L26,56 Z', '#FFF8E6' if not p.act else '#FBB57A', 'opacity="0.85"')
    s += RR(24, 56, 52, 24, 2.5) + S('M28,60 L72,60', 1, D)
    s += RR(43, 66, 14, 4, 2, D)
    return s


@reg('act-32', 'Vista-me')
def _(p):
    s = f'<ellipse cx="50" cy="44" rx="16" ry="26" fill="{K}"/>'
    s += f'<ellipse cx="50" cy="44" rx="12" ry="22" fill="{CR}"/>'
    s += sparkle(50, 44, 10, p.a)
    s += S('M41,33 L45,28', 1.2, '#FFFFFF')
    s += S('M50,70 L50,80', 3.4) + S('M38,86 L50,80 L62,86', 3.4)
    return s


@reg('act-33', 'Tira uma coisa')
def _(p):
    s = hanger(42, 56, 50, 18)
    s += S('M26,26 Q42,58 58,26', 3.2, K, 'stroke-dasharray="0.1 4.2"')
    s += G(P('M0,-6 L5,0 L0,6 L-5,0 Z') + S('M0,-6 L5,0 L0,6 L-5,0 Z', 1.5), 'translate(42 46)')
    s += minus(76, 28, 8, 5, p.a)
    return s


@reg('act-34', 'Trocar uma peça')
def _(p):
    s = hanger(28, 50, 22, 10, K, 3.4, hr=3) + hanger(72, 50, 22, 10, K, 3.4, hr=3)
    s += S('M30,34 Q50,16 68,32', 3.2, p.a) + P('M64,26 L74,32 L64,37 Z', p.a)
    s += S('M70,70 Q50,86 32,72', 3.2, p.a) + P('M36,66 L26,70 L35,77 Z', p.a)
    return s


@reg('act-35', 'Sugerir calçado')
def _(p):
    sh = ('M20,72 L20,62 C20,56 26,52 32,50 L40,46 C44,52 50,54 56,54 C64,55 74,58 78,64 '
          'C80,67 80,72 78,74 L22,74 Q20,74 20,72 Z')
    s = P(sh) + S(sh, 1.5)
    s += S('M20,68 L80,68', 1.3, CR)
    s += S('M43,50 L48,55 M47,48 L52,54 M52,48 L56,54', 1.3, CR)
    s += C(28, 58, 1.2, D)
    s += sparkle(66, 30, 11, p.a)
    return s


@reg('act-36', 'Usar este look')
def _(p):
    s = hanger(46, 28, 36, 10, K, 3.2, hr=3)
    s += tshirt(46, 38, 14)
    pants = 'M36,60 L56,60 L57,84 L49,84 L46,68 L43,84 L35,84 Z'
    s += P(pants) + S(pants, 1)
    s += S('M68,62 L66,58', 1.3)
    s += C(72, 66, 10, p.a) + check(72, 66, 5, CR, 2.6)
    return s


@reg('act-37', 'Destaques')
def _(p):
    cup = 'M32,24 L68,24 L66,44 C64,54 58,58 50,58 C42,58 36,54 34,44 Z'
    s = P(cup) + S(cup, 1.5)
    s += S('M32,28 L20,40 L32,44', 3, p.a) + S('M26,28 L26,26', 0)
    s += S('M68,28 L80,40 L68,44', 3, p.a)
    s += S('M32,28 L32,22 A2.5,2.5 0 1 0 29.5,19.5', 0)
    s += RR(46, 58, 8, 10, 1) + RR(36, 68, 28, 6, 2) + RR(32, 74, 36, 6, 2)
    s += S('M38,30 L62,30', 1, D)
    return s


@reg('act-38', 'Como melhorar meu inventário')
def _(p):
    bulb = 'M50,16 C63,16 71,26 71,37 C71,46 64,51 61,58 L61,64 L39,64 L39,58 C36,51 29,46 29,37 C29,26 37,16 50,16 Z'
    s = P(bulb) + P('M50,21 C60,21 66,29 66,37 C66,44 60,48 57,56 L43,56 C40,48 34,44 34,37 C34,29 40,21 50,21 Z', CR)
    s += S('M43,56 L43,46 Q46,36 50,44 Q54,52 57,40 L57,56', 1.6, p.a)
    s += S('M57,40 L60,28', 1.4, p.a) + C(60, 27.5, 1, p.a)
    s += RR(39, 64, 22, 12, 2) + S('M39,68 L61,68 M39,72 L61,72', 1, D) + RR(44, 76, 12, 5, 2)
    return s


@reg('act-39', 'Rankings')
def _(p):
    s = RR(38, 48, 24, 32, 1.5) + RR(18, 60, 21, 20, 1.5) + RR(61, 66, 21, 14, 1.5)
    s += S('M39,48 L39,80 M61,60 L61,80', 1, D)
    s += C(50, 64, 3, D) + C(28.5, 70, 2.5, D) + C(71.5, 73, 2.5, D)
    s += folded_shirt(41, 32, 18, 14, p.a, CR if p.act else D)
    return s


@reg('act-40', 'Saldo de FAI Points')
def _(p):
    s = P(circ_d(50, 55, 27) + ' ' + circ_d(50, 49, 27), '#15120F')
    s += button(50, 49, 27, K, None)
    s += f'<circle cx="50" cy="49" r="20" fill="none" stroke="{p.a if p.act else D}" stroke-width="2.2"/>'
    return s


@reg('act-41', 'Loja do quarto')
def _(p):
    s = S('M38,42 L38,34 A12,12 0 0 1 62,34 L62,42', 5, p.a)
    bag = 'M22,42 Q22,40 24,40 L76,40 Q78,40 78,42 L70,76 Q69,80 65,80 L35,80 Q31,80 30,76 Z'
    s += P(bag) + S(bag, 1.5)
    s += S('M33,42 L38,78 M67,42 L62,78', 1, D)
    return s


@reg('act-42', 'Provar no quarto')
def _(p):
    s = RR(26, 18, 34, 66, 2.5)
    s += RR(30, 23, 26, 26, 1, D) + RR(31.5, 24.5, 23, 23, 1) + RR(30, 53, 26, 26, 1, D) + RR(31.5, 54.5, 23, 23, 1)
    s += RR(53, 42, 4, 16, 2, '#6b5d50')
    s += S('M55,56 L62,62', 1.2)
    s += swing_tag(60, 58, 22, 14, p.a, rot=30)
    return s


@reg('act-43', 'Desafios')
def _(p):
    s = f'<path d="M50,33 C38,33 34,24 38,17 C42,11 58,11 62,17 C66,24 62,33 50,33" fill="none" stroke="{p.a}" stroke-width="5"/>'
    s += tape_ticks('M50,31 C39,31 36,24 40,18 C44,13 56,13 60,18 C64,24 61,31 50,31', CR if not p.act else '#7a3a0a')
    s += RR(45, 31, 10, 6, 1.5)
    s += C(50, 58, 23) + C(50, 58, 18, CR)
    import math
    for a in range(0, 360, 30):
        r1 = 14.5
        s += C(50 + r1 * math.cos(math.radians(a)), 58 + r1 * math.sin(math.radians(a)), 0.9)
    s += S('M50,58 L50,46', 2) + S('M50,58 L58,62', 2) + C(50, 58, 2)
    s += G(RR(-3, -2, 6, 5, 1), 'translate(69 38) rotate(40)')
    return s


@reg('act-44', 'Modo Solo')
def _(p):
    return hanger(50, 42, 60, 24, K, 5.5, p.a, hr=6)


@reg('act-45', 'Modo Equipe')
def _(p):
    s = ''
    for i, x in enumerate((26, 50, 74)):
        c = p.a if i == 1 else K
        s += hanger(x, 50, 24, 14, c, 4, hr=4.5)
    s += S('M38,64 Q41,40 50,36', 0) 
    s += S('M31,43 Q38,36 45.5,42', 2.6) + S('M55,43 Q62,36 69.5,42', 2.6)
    return s


@reg('act-46', 'Modo Duelo')
def _(p):
    one = hanger(0, -20, 16, 42, K, 4, p.a, hr=4.5)
    return G(one, 'translate(50 52) rotate(-38)') + G(one, 'translate(50 52) rotate(38)')


if __name__ == '__main__':
    print(len(OBJ), sum(HAS_ACTIVE.values()))
