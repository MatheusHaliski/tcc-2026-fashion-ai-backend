# Dimensões de atributo (tudo o que NÃO é variação) e a estrutura nova de subcategorias.
# Fonte editável da taxonomia (docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md). Depois de editar, rode:
#   python3 scripts/taxonomy/build_taxonomy.py
UP, LO, FB, SH, AC = "upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece"

# subcategorias novas e as que viram LEGADO (continuam válidas no banco; o mapeamento diz o equivalente novo)
NEW_SUBCATEGORIES = {
    "top": (UP, "Top", "Top", "Tops de moda e esportivos que não são camiseta, regata nem blusa: corset, faixa, bralette, top fitness."),
    "boots": (SH, "Bota", "Boots", "Botas de qualquer altura de cano; o cano vira o atributo SHAFT_HEIGHT."),
}
# legado → (subcategoria nova, [(dimensão|VARIATION, código)], precisa_revisão, motivo)
LEGACY = {
    "crop_top": ("top", [("LENGTH", "CROPPED")], True,
                 "cropped é comprimento; camiseta/regata/blusa cropped vão para a própria subcategoria + LENGTH=CROPPED"),
    "bermuda_shorts": ("shorts", [("LENGTH", "KNEE")], False, "bermuda é o short no comprimento do joelho"),
    "denim_shorts": ("shorts", [("MATERIAL", "DENIM")], False, "short jeans é short + material denim"),
    "high_top_sneakers": ("casual_sneakers", [("SHAFT_HEIGHT", "HIGH_TOP")], False, "cano alto é altura do cano"),
    "ankle_boots": ("boots", [("SHAFT_HEIGHT", "ANKLE")], False, "bota curta é altura do cano"),
    "long_boots": ("boots", [("SHAFT_HEIGHT", "KNEE_HIGH")], True,
                   "cano longo pode ser médio, joelho ou acima do joelho: confirmar a altura"),
    "combat_boots": ("boots", [("VARIATION", "COMBAT")], False, "coturno é a variação COMBAT de bota"),
    "crossbody_bag": ("handbag", [("CARRY_MODE", "CROSSBODY")], False, "transversal é forma de carregar, não formato"),
}

# dimensão: (nome pt, nome en, multivalorada, máx. peça, máx. esquema, escopo, descrição)
# COLOR, MATERIAL e GENDER continuam nas colunas da peça/produto; as demais vão para *_attributes
COLUMN_DIMENSIONS = {"COLOR", "MATERIAL", "GENDER"}
# cores que não são cor (ficam aceitas nos dados antigos, fora do formulário e da IA): ver seção I.7
LEGACY_COLORS = {"print": "PATTERN=GRAPHIC", "multicolor": "PATTERN=COLOR_BLOCK", "denim": "blue + MATERIAL=DENIM",
                 "washed_black": "black + FINISH=FADED"}
LEGACY_MATERIALS = {"SYNTHETIC", "BLEND"}
DIMENSIONS = [
    ("COLOR", "Cor", "Color", False, 1, None, [UP, LO, FB, SH, AC], "Cor predominante (paleta de 59 códigos; variantes de cor no catálogo)."),
    ("MATERIAL", "Material", "Material", False, 1, None, [UP, LO, FB, SH, AC], "Material predominante (composição completa fica para depois)."),
    ("PATTERN", "Estampa", "Pattern", False, 1, None, [UP, LO, FB, SH, AC], "Estampa/padrão de superfície."),
    ("FINISH", "Acabamento", "Finish", True, 3, None, [UP, LO, FB, SH, AC], "Lavagem, desgaste, superfície, textura e aplicações."),
    ("LENGTH", "Comprimento", "Length", False, 1, None, [UP, LO, FB],
     "Onde a barra termina no corpo (blusa, casaco, short, calça, saia, vestido)."),
    ("SHAFT_HEIGHT", "Altura do cano", "Shaft height", False, 1, None, [SH, "socks"], "Cano do tênis, da bota e da meia."),
    ("RISE", "Cintura", "Rise", False, 1, None, [LO, "jumpsuit", "romper", "overalls"], "Altura do cós."),
    ("HEM", "Barra", "Hem", False, 1, None, [UP, LO, FB], "Formato da barra (assimétrica, mullet, fenda)."),
    ("SLEEVE_LENGTH", "Comprimento da manga", "Sleeve length", False, 1, None, [UP, FB], "Sem manga a manga longa."),
    ("SLEEVE_STYLE", "Tipo de manga", "Sleeve style", False, 1, None, [UP, FB], "Construção da manga."),
    ("NECKLINE", "Decote / gola", "Neckline / collar", False, 1, None, [UP, FB], "Decote, gola, lapela ou capuz."),
    ("CLOSURE", "Fechamento", "Closure", False, 1, None, [UP, LO, FB, SH, AC], "Fechamento principal."),
    ("HEEL_TYPE", "Tipo de salto", "Heel type", False, 1, None, [SH], "Forma do salto."),
    ("HEEL_HEIGHT", "Altura do salto", "Heel height", False, 1, None, [SH], "Faixa de altura (guardar também em cm)."),
    ("TOE_SHAPE", "Bico", "Toe shape", False, 1, None, [SH], "Formato do bico."),
    ("SOLE_TYPE", "Solado", "Sole", False, 1, None, [SH], "Plataforma, meia pata, tratorado."),
    ("SPORT_USE", "Uso / esporte", "Sport / use", False, 1, None, [UP, LO, FB, SH, AC],
     "Para que a peça foi feita tecnicamente (≠ ocasião, que é quando a pessoa usa)."),
    ("CARRY_MODE", "Forma de carregar", "Carry mode", False, 1, None, ["handbag", "tote_bag", "clutch", "backpack"],
     "Mão, ombro, transversal, cintura, costas."),
    ("FRAME_RIM", "Aro", "Rim", False, 1, None, ["sunglasses", "eyeglasses"], "Aro fechado, fio de nylon, sem aro."),
    ("STYLE", "Estilo", "Style", True, 2, 3, [UP, LO, FB, SH, AC], "Vocabulário atual (25). Peça ≤ 2, esquema ≤ 3."),
    ("OCCASION", "Ocasião", "Occasion", True, 2, 3, [UP, LO, FB, SH, AC], "Vocabulário atual (20). Peça ≤ 2, esquema ≤ 3."),
    ("GENDER", "Gênero", "Gender", False, 1, None, [UP, LO, FB, SH, AC], "Códigos atuais MASCULINO/FEMININO/UNISSEX."),
    ("AGE_GROUP", "Faixa etária", "Age group", False, 1, None, [UP, LO, FB, SH, AC], "Adulto, infantil, bebê."),
]


def vals(spec):
    """'CODE|pt|en|C1|grupo|aliases pt;…|aliases en;…|escopo,…' por linha."""
    out = []
    for line in spec.strip().splitlines():
        p = [x.strip() for x in line.split("|")]
        p += [""] * (8 - len(p))
        code, pt, en, tp, group, apt, aen, scope = p[:8]
        out.append({"code": code, "pt": pt, "en": en,
                    "tier": {"C": "CORE", "E": "EXTENDED", "N": "NICHE"}[tp[0]], "priority": int(tp[1]),
                    "group": group or None,
                    "aliases_pt": [a.strip() for a in apt.split(";") if a.strip()],
                    "aliases_en": [a.strip() for a in aen.split(";") if a.strip()],
                    "scope": [x.strip() for x in scope.split(",") if x.strip()]})
    return out


VALUES = {
    "FINISH": vals("""
RAW|Cru (sem lavagem)|Raw|C2|WASH|jeans cru;sem lavagem;dry|raw;dry denim|
RINSE|Amaciado escuro|Rinse|E3|WASH|amaciado;rinse|rinse;rinsed|
DARK_WASH|Lavagem escura|Dark wash|C1|WASH|lavagem escura;jeans escuro;denim escuro|dark wash|
MEDIUM_WASH|Lavagem média|Medium wash|C1|WASH|lavagem média;jeans médio;denim médio|medium wash;mid wash|
LIGHT_WASH|Lavagem clara|Light wash|C1|WASH|lavagem clara;jeans claro|light wash|
BLEACHED|Delavê|Bleached|E2|WASH|delavê;delave;clareado;jeans clarinho|bleached;bleach wash|
STONE_WASH|Stonado|Stone wash|E2|WASH|stonado;estonado;stone|stone wash;stonewashed|
ACID_WASH|Marmorizado|Acid wash|N4|WASH|marmorizado;acid|acid wash|
FADED|Desbotado|Faded|E2|WASH|desbotado;envelhecido;used;vintage wash|faded;vintage wash;washed|
GARMENT_DYED|Tingido na peça|Garment dyed|N4|WASH|tingimento de peça;tinturado|garment dyed;pigment dyed|
RIPPED|Destroyed|Ripped|C1|DISTRESS|destroyed;rasgado;rasgada;rasgos|ripped;destroyed|
DISTRESSED|Puído|Distressed|E2|DISTRESS|puído;puida;desgastado|distressed;worn|
FRAYED_HEM|Barra desfiada|Frayed hem|E2|DISTRESS|barra desfiada;desfiado;barra a fio|frayed hem;raw hem|
REPAIRED|Rasgo remendado|Repaired|N5|DISTRESS|remendado;rip and repair|rip and repair;repaired|
COATED|Resinado|Coated|E3|SURFACE|resinado;resinada;coated|coated;waxed denim|
WAXED|Encerado|Waxed|N4|SURFACE|encerado;encerada|waxed|
PATENT|Verniz|Patent|E2|SURFACE|verniz;envernizado|patent|SH,AC
METALLIC|Metalizado|Metallic|E3|SURFACE|metalizado;laminado;lamê|metallic;lame;foil|
SATIN_FINISH|Acetinado|Satin finish|E3|SURFACE|acetinado;brilho acetinado|satin finish;sateen|
BRUSHED|Peletizado|Brushed|N4|SURFACE|peletizado;escovado;peached|brushed;peached|
CABLE_KNIT|Tricô trançado|Cable knit|E2|TEXTURE|trançado;tranças;tricô trançado|cable knit;aran|UP,FB,AC
RIBBED|Canelado|Ribbed|C2|TEXTURE|canelado;canelada;ribana|ribbed;rib knit|
WAFFLE|Waffle|Waffle|E3|TEXTURE|waffle;favo de mel|waffle;waffle knit|
CHUNKY_KNIT|Tricô grosso|Chunky knit|E3|TEXTURE|tricô grosso;tricot grosso|chunky knit|UP,AC
POINTELLE|Pointelle|Pointelle|N4|TEXTURE|pointelle;furadinho|pointelle|
CROCHET|Crochê|Crochet|E3|TEXTURE|crochê;croche|crochet|
EMBROIDERED|Bordado|Embroidered|C2|EMBELLISHMENT|bordado;bordada;bordados|embroidered;embroidery|
SEQUINED|Paetê|Sequined|E2|EMBELLISHMENT|paetê;paete;lantejoula|sequined;sequin|
BEADED|Pedraria|Beaded|E3|EMBELLISHMENT|pedraria;miçangas;bordado de pedras|beaded;embellished|
STUDDED|Tachas|Studded|E3|EMBELLISHMENT|tachas;spikes;taxas|studded;spiked|
FRINGED|Franjas|Fringed|E3|EMBELLISHMENT|franja;franjas|fringe;fringed|
RUFFLED|Babados|Ruffled|E2|EMBELLISHMENT|babado;babados|ruffle;ruffled;frill|
"""),
    "LENGTH": vals("""
CROPPED|Cropped|Cropped|C1|TOP|cropped;curta;curtinha|cropped;crop|upper_piece
REGULAR_LENGTH|Comprimento regular|Regular length|C1|TOP|comprimento regular;no quadril|regular length;hip length|upper_piece
LONGLINE|Alongado|Longline|C2|TOP|alongado;alongada;longline;túnica|longline;tunic length|upper_piece
MICRO|Micro|Micro|E3|BOTTOM|micro;hot pants;curtíssimo|micro;hot pants|lower_piece,full_body_piece
MINI|Mini|Mini|C1|BOTTOM|mini;curto;curta|mini;short|lower_piece,full_body_piece
MID_THIGH|Meio da coxa|Mid-thigh|C2|BOTTOM|meio da coxa;médio|mid thigh|upper_piece,lower_piece,full_body_piece
KNEE|Joelho|Knee|C1|BOTTOM|joelho;bermuda;na altura do joelho|knee;knee length|upper_piece,lower_piece,full_body_piece
MIDI|Midi|Midi|C1|BOTTOM|midi;longuete;abaixo do joelho|midi;below the knee|upper_piece,lower_piece,full_body_piece
MAXI|Longo|Maxi|C1|BOTTOM|longo;maxi;vestido longo;saia longa|maxi;long;maxi length|upper_piece,lower_piece,full_body_piece
FLOOR_LENGTH|Até o chão|Floor length|E3|BOTTOM|até o chão;longuíssimo|floor length;gown length|full_body_piece,lower_piece
FULL_LENGTH|Comprimento total|Full length|C1|PANTS|calça longa;comprimento total|full length|lower_piece,full_body_piece
ANKLE_LENGTH|Tornozelo (7/8)|Ankle length|C2|PANTS|7/8;cropped;tornozelo;calça cropped|ankle length;cropped;7/8|lower_piece,full_body_piece
CAPRI|Capri|Capri|E2|PANTS|capri;meia canela;pantacourt|capri;mid calf|lower_piece,full_body_piece
PEDAL_PUSHER|Corsário|Pedal pusher|N4|PANTS|corsário;pescador|pedal pusher|lower_piece
"""),
    "SHAFT_HEIGHT": vals("""
LOW_TOP|Cano baixo|Low top|C1|SNEAKER|cano baixo|low top;low|shoes_piece
MID_TOP|Cano médio (tênis)|Mid top|C2|SNEAKER|tênis cano médio;mid|mid top;mid|shoes_piece
HIGH_TOP|Cano alto|High top|C1|SNEAKER|cano alto;tênis cano alto|high top;hi|shoes_piece
NO_SHOW|Invisível|No-show|C2|SOCK|invisível;sapatilha;meia sapatilha|no show;liner|socks
ANKLE|Tornozelo|Ankle|C1|BOOT_SOCK|cano curto;bota curta;botinha;soquete;ankle boot|ankle;ankle boot|shoes_piece,socks
QUARTER|Meia cano curto|Quarter|E3|SOCK|meia cano curto;quarter|quarter|socks
CREW|Meia cano médio|Crew|C1|SOCK|meia cano médio;crew|crew|socks
MID_CALF|Meia canela|Mid-calf|C2|BOOT_SOCK|bota cano médio;meia canela|mid calf|shoes_piece,socks
KNEE_HIGH|Joelho|Knee-high|C1|BOOT_SOCK|cano longo;bota cano longo;bota alta;meia 3/4|knee high;tall boot|shoes_piece,socks
OVER_THE_KNEE|Acima do joelho|Over-the-knee|E2|BOOT_SOCK|over the knee;acima do joelho;meia 7/8|over the knee;OTK|shoes_piece,socks
THIGH_HIGH|Coxa|Thigh-high|N4|BOOT_SOCK|bota coxa;meia de coxa|thigh high|shoes_piece,socks
"""),
    "RISE": vals("""
LOW_RISE|Cintura baixa|Low rise|C2||cintura baixa;cós baixo;saint tropez|low rise;low waist|
MID_RISE|Cintura média|Mid rise|C1||cintura média;cintura normal|mid rise;regular rise|
HIGH_RISE|Cintura alta|High rise|C1||cintura alta;cós alto|high rise;high waist|
SUPER_HIGH_RISE|Cintura altíssima|Super high rise|E3||cintura altíssima;super alta|super high rise;ultra high rise;ribcage|
"""),
    "HEM": vals("""
ASYMMETRIC|Assimétrica|Asymmetric|C1||assimétrica;assimétrico;barra assimétrica|asymmetric;asymmetrical|
HIGH_LOW|Mullet|High-low|C2||mullet;mais longo atrás|high low;mullet hem|
HANDKERCHIEF|Pontas|Handkerchief|E3||pontas;barra de pontas;lenço|handkerchief hem|
SLIT|Fenda|Slit|C1||fenda;com fenda|slit;split|
"""),
    "SLEEVE_LENGTH": vals("""
SLEEVELESS|Sem manga|Sleeveless|C1||sem manga;regata|sleeveless|
SHORT_SLEEVE|Manga curta|Short sleeve|C1||manga curta|short sleeve|
ELBOW_SLEEVE|Meia manga|Elbow sleeve|E3||meia manga;até o cotovelo|elbow sleeve|
THREE_QUARTER_SLEEVE|Manga 3/4|Three-quarter sleeve|C2||manga 3/4;três quartos|three quarter sleeve;3/4 sleeve|
LONG_SLEEVE|Manga longa|Long sleeve|C1||manga longa;manga comprida|long sleeve|
"""),
    "SLEEVE_STYLE": vals("""
SET_IN|Comum|Set-in|C1||manga comum;manga tradicional|set in|
RAGLAN|Raglan|Raglan|C2||raglan|raglan|
DROP_SHOULDER|Ombro caído|Drop shoulder|C2||ombro caído;ombro deslocado|drop shoulder;dropped shoulder|
DOLMAN|Morcego|Dolman|E2||morcego;manga morcego;dolman|dolman;batwing|
KIMONO_SLEEVE|Japonesa|Kimono sleeve|E3||manga japonesa;quimono|kimono sleeve|
PUFF|Bufante|Puff|C2||bufante;manga bufante;princesa|puff;puff sleeve|
BALLOON_SLEEVE|Balão|Balloon sleeve|E3||manga balão;bispo|balloon sleeve;bishop sleeve|
BELL|Sino|Bell|E3||manga sino|bell sleeve|
FLUTTER|Babado|Flutter|E3||manga de babado;manguinha babado|flutter sleeve|
CAP_SLEEVE|Cavada curtinha|Cap sleeve|E3||manguinha;cap|cap sleeve|
"""),
    "NECKLINE": vals("""
CREW|Careca|Crew|C1|NECK|careca;gola redonda;redonda|crew;crew neck;round neck|
V_NECK|Decote V|V-neck|C1|NECK|decote v;gola v|v neck;v-neck|
SCOOP|Decote U|Scoop|E2|NECK|decote u;canoa aberta|scoop;u neck|
BOAT|Canoa|Boat|E2|NECK|canoa;gola canoa|boat neck;bateau|
SQUARE_NECK|Quadrado|Square|E2|NECK|decote quadrado|square neck|
SWEETHEART|Coração|Sweetheart|E3|NECK|coração;decote coração|sweetheart|
PLUNGE|Profundo|Plunge|E3|NECK|decote profundo;decotão|plunge;deep v|
OFF_SHOULDER|Ombro a ombro|Off-shoulder|C2|NECK|ombro a ombro;ciganinha;ombros de fora|off shoulder;bardot|
ONE_SHOULDER|Um ombro só|One-shoulder|E2|NECK|um ombro só;ombro só;assimétrico|one shoulder|
HALTER|Frente única|Halter|C2|NECK|frente única;halter|halter;halterneck|
STRAPLESS|Tomara que caia|Strapless|C2|NECK|tomara que caia;sem alça|strapless|
COWL|Drapeado|Cowl|E3|NECK|decote drapeado;degagê|cowl neck|
KEYHOLE|Gota|Keyhole|N4|NECK|decote gota|keyhole|
TURTLENECK|Gola alta|Turtleneck|C1|COLLAR|gola alta;gola rolê;rolê|turtleneck;roll neck|
MOCK_NECK|Gola média|Mock neck|E2|COLLAR|gola média;meia gola alta|mock neck;funnel neck|
HENLEY|Portinhola|Henley|E2|COLLAR|portinhola;henley|henley|
POLO_COLLAR|Gola polo|Polo collar|C2|COLLAR|gola polo|polo collar|
SHIRT_COLLAR|Colarinho|Shirt collar|C1|COLLAR|colarinho;gola de camisa;gola italiana|shirt collar;point collar;spread collar|
BUTTON_DOWN_COLLAR|Button-down|Button-down|E2|COLLAR|button down;pontas abotoadas|button down collar|
MANDARIN|Gola padre|Mandarin|E2|COLLAR|gola padre;mandarim;gola de padre|mandarin;band collar|
CAMP_COLLAR|Gola cubana|Camp collar|E3|COLLAR|gola cubana;camisa cubana|camp collar;cuban collar|
PETER_PAN|Gola boneca|Peter Pan|E3|COLLAR|gola boneca|peter pan collar|
BOW_COLLAR|Gola laço|Bow|E3|COLLAR|gola laço;gola com laço|pussy bow;bow collar|
HOOD|Capuz|Hood|C1|COLLAR|capuz;com capuz|hood;hooded|
NOTCH_LAPEL|Lapela tradicional|Notch lapel|E2|LAPEL|lapela;lapela tradicional|notch lapel|
PEAK_LAPEL|Lapela pontiaguda|Peak lapel|E3|LAPEL|lapela pontiaguda;lapela bico|peak lapel|
SHAWL_LAPEL|Gola xale|Shawl lapel|E3|LAPEL|gola xale;lapela xale|shawl lapel;shawl collar|
"""),
    "CLOSURE": vals("""
PULLOVER|Sem fechamento (vestir pela cabeça)|Pullover|C1||sem fechamento;fechado;canguru;vestir pela cabeça|pullover|
BUTTON|Botões|Button|C1||botão;botões;abotoado|button;buttoned|
SNAP|Botão de pressão|Snap|E2||pressão;botão de pressão|snap;press stud|
ZIPPER|Zíper|Zipper|C1||zíper;ziper;com zíper;aberto|zip;zipper;full zip|
HALF_ZIP|Meio zíper|Half-zip|C2||meio zíper;1/4 zip;quarter zip|half zip;quarter zip|
SINGLE_BREASTED|Abotoamento simples|Single-breasted|C2||abotoamento simples;uma carreira|single breasted|
DOUBLE_BREASTED|Transpassado|Double-breasted|C2||transpassado;duas carreiras;jaquetão|double breasted|
HOOK_AND_EYE|Colchete|Hook and eye|E3||colchete|hook and eye|
TIE|Amarração|Tie|C2||amarração;amarrar;faixa|tie;tie fastening|
DRAWSTRING|Cordão|Drawstring|C2||cordão;cordinha|drawstring|
ELASTIC|Elástico|Elastic|C2||elástico;cós elástico|elastic|
LACE_UP|Cadarço|Lace-up|C1||cadarço;de amarrar|lace up;laces|SH
SLIP_ON|Calce fácil|Slip-on|C1||slip on;sem cadarço;calce fácil|slip on;laceless|SH
VELCRO|Velcro|Hook and loop|E2||velcro|velcro;hook and loop|
BUCKLE|Fivela|Buckle|C2||fivela|buckle|
MAGNETIC|Ímã|Magnetic|E3||ímã;imã;magnético|magnetic|
TOGGLE|Pino (toggle)|Toggle|N4||pino;alamar;toggle|toggle|
FLAP|Aba|Flap|C2||aba;com aba|flap|AC
OPEN_TOP|Aberta|Open top|E2||aberta;sem fecho|open top|AC
CLASP|Fecho de joia|Clasp|E2||fecho;fecho lagosta;fecho de joia|clasp;lobster clasp|AC
CLIP_ON|Pressão sem furo|Clip-on|E3||brinco de pressão;sem furo;clip|clip on|AC
"""),
    "HEEL_TYPE": vals("""
STILETTO|Agulha|Stiletto|C1||agulha;salto agulha;salto fino|stiletto|
BLOCK|Bloco|Block|C1||bloco;salto grosso;salto quadrado|block;chunky heel|
KITTEN|Gatinho|Kitten|C2||gatinho;salto baixinho fino|kitten heel|
WEDGE|Anabela|Wedge|C1||anabela;plataforma anabela|wedge|
CONE|Cone|Cone|E3||cone;salto cone|cone heel|
SPOOL|Carretel|Spool|N4||carretel|spool heel|
CUBAN|Cubano|Cuban|E3||cubano;salto cubano|cuban heel|
SCULPTURAL|Escultural|Sculptural|N4||geométrico;escultural|sculptural heel|
"""),
    "HEEL_HEIGHT": vals("""
FLAT|Rasteiro (0–1,2 cm)|Flat|C1||rasteiro;rasteira;sem salto;baixo|flat|
LOW|Baixo (2,5–6 cm)|Low|C1||salto baixo|low heel|
MID|Médio (6–8,5 cm)|Mid|C1||salto médio|mid heel|
HIGH|Alto (8,5–10 cm)|High|C1||salto alto|high heel|
VERY_HIGH|Altíssimo (> 10 cm)|Very high|E2||altíssimo;meia pata alta|very high heel|
"""),
    "TOE_SHAPE": vals("""
ROUND_TOE|Redondo|Round|C1||bico redondo|round toe|
ALMOND_TOE|Amendoado|Almond|E2||bico amendoado|almond toe|
POINTED_TOE|Bico fino|Pointed|C1||bico fino;bico pontudo|pointed toe|
SQUARE_TOE|Bico quadrado|Square|C2||bico quadrado|square toe|
PEEP_TOE|Peep toe|Peep toe|C2||peep toe;dedinho de fora|peep toe|
OPEN_TOE|Aberto|Open toe|C2||bico aberto;dedos de fora|open toe|
"""),
    "SOLE_TYPE": vals("""
PLATFORM|Plataforma|Platform|C1||plataforma|platform|
FRONT_PLATFORM|Meia pata|Front platform|C2||meia pata|front platform|
FLATFORM|Flatform|Flatform|E2||flatform;plataforma reta|flatform|
LUG|Tratorado|Lug|C1||tratorado;tratorada;sola tratorada|lug sole;track sole;chunky sole|
"""),
    "SPORT_USE": vals("""
LIFESTYLE|Casual / lifestyle|Lifestyle|C1||casual;lifestyle;dia a dia|lifestyle;casual|
RUNNING|Corrida|Running|C1||corrida;running|running|
TRAINING|Treino / academia|Training|C1||academia;treino;funcional;crossfit|training;gym|
BASKETBALL|Basquete|Basketball|C2||basquete|basketball|
SKATE|Skate|Skateboarding|C2||skate|skate;skateboarding|
FOOTBALL|Futebol|Football|C2||futebol;chuteira;society;futsal|football;soccer|
TENNIS|Tênis / padel|Tennis|E2||tênis;padel;beach tennis|tennis;padel|
VOLLEYBALL|Vôlei|Volleyball|E3||vôlei;volei|volleyball|
CYCLING|Ciclismo|Cycling|E3||ciclismo;bike|cycling|
SWIM_SURF|Natação / surf|Swim / surf|E3||natação;surf;praia|swim;surf|
HIKING|Trilha / outdoor|Hiking|C2||trilha;trekking;outdoor;montanha|hiking;outdoor;trail|
YOGA_PILATES|Yoga / pilates|Yoga / pilates|E2||yoga;ioga;pilates|yoga;pilates|
DANCE|Dança|Dance|N4||dança;balé|dance|
COMBAT_SPORTS|Lutas|Combat sports|N4||luta;lutas;boxe;jiu jitsu|combat sports;boxing|
GOLF|Golfe|Golf|N5||golfe|golf|
"""),
    "CARRY_MODE": vals("""
HAND|Mão|Hand|C1||de mão;na mão|hand;handheld|
SHOULDER|Ombro|Shoulder|C1||de ombro;no ombro|shoulder|
CROSSBODY|Transversal|Crossbody|C1||transversal;tiracolo;atravessada|crossbody|
WAIST|Cintura|Waist|C2||na cintura|waist;belt|
BACK|Costas|Back|C2||nas costas|back;backpack style|
WRIST|Pulso|Wrist|E3||de pulso|wrist|
"""),
    "FRAME_RIM": vals("""
FULL_RIM|Aro fechado|Full rim|C1||aro fechado;aro inteiro|full rim|
SEMI_RIMLESS|Fio de nylon|Semi-rimless|C2||fio de nylon;meio aro|semi rimless;half rim|
RIMLESS|Sem aro|Rimless|C2||sem aro;parafusada;três peças;balgriff|rimless|
"""),
    "AGE_GROUP": vals("""
ADULT|Adulto|Adult|C1||adulto|adult;men;women|
TEEN|Juvenil|Teen|E3||juvenil;teen|teen;big kids|
KIDS|Infantil|Kids|C1||infantil;criança;kids|kids;boys;girls;little kids|
BABY|Bebê|Baby|C2||bebê;baby|baby;infant;toddler|
"""),
}

# Material: proposta ampliada (os 7 códigos atuais continuam; BLEND e SYNTHETIC viram genéricos de legado)
VALUES["MATERIAL"] = vals("""
COTTON|Algodão|Cotton|C1|FIBER|algodão;algodao;piquet;jersey;sarja;twill|cotton;jersey;twill|
DENIM|Jeans (denim)|Denim|C1|FABRIC|jeans;denim;índigo|denim|
LINEN|Linho|Linen|C1|FIBER|linho|linen|
WOOL|Lã|Wool|C1|FIBER|lã;merino;lã batida|wool;merino|
CASHMERE|Cashmere|Cashmere|E3|FIBER|cashmere;caxemira|cashmere|
SILK|Seda|Silk|C2|FIBER|seda|silk|
SATIN|Cetim|Satin|C2|FABRIC|cetim|satin|
VISCOSE|Viscose|Viscose|C1|FIBER|viscose;rayon;modal;liocel|viscose;rayon;modal;lyocell|
POLYESTER|Poliéster|Polyester|C1|FIBER|poliéster;poliester;dri fit|polyester|
NYLON|Poliamida (nylon)|Nylon|C2|FIBER|nylon;poliamida;tactel|nylon;polyamide|
ACRYLIC|Acrílico|Acrylic|E3|FIBER|acrílico|acrylic|
FLEECE|Moletom / fleece|Fleece|C2|FABRIC|moletom;fleece;flanelado;soft|fleece;french terry|
KNIT|Malha / tricô|Knit|C2|FABRIC|malha;tricô;tricot|knit;knitwear|
CORDUROY|Veludo cotelê|Corduroy|E3|FABRIC|cotelê;veludo cotelê|corduroy|
VELVET|Veludo|Velvet|E3|FABRIC|veludo;plush|velvet|
CANVAS|Lona|Canvas|E2|FABRIC|lona|canvas|
MESH|Tela|Mesh|E2|FABRIC|tela;mesh;arrastão|mesh|
LEATHER|Couro|Leather|C1|LEATHER|couro;couro legítimo|leather|
SUEDE|Camurça|Suede|C2|LEATHER|camurça;nobuck;suede|suede;nubuck|
FAUX_LEATHER|Couro sintético|Faux leather|C2|LEATHER|couro sintético;couro ecológico;corino;pu|faux leather;vegan leather;pu|
SHEARLING|Pelo / shearling|Shearling|E3|LEATHER|pelo;pelúcia;teddy;shearling;pele sintética|shearling;faux fur;teddy|
RUBBER|Borracha|Rubber|E2|OTHER|borracha|rubber|SH
EVA|EVA|EVA|E2|OTHER|eva|eva|SH
CORK|Cortiça|Cork|N4|OTHER|cortiça|cork|SH,AC
STRAW|Palha|Straw|E2|OTHER|palha;ráfia;vime|straw;raffia;wicker|AC,SH
METAL|Metal|Metal|E2|JEWELRY|metal;aço;aço inox|metal;steel;stainless steel|AC
GOLD|Ouro|Gold|E2|JEWELRY|ouro;ouro 18k|gold|AC
SILVER|Prata|Silver|E2|JEWELRY|prata;prata 925|sterling silver;silver|AC
PLATED|Folheado (semijoia)|Plated|E2|JEWELRY|folheado;semijoia;banhado|plated;gold plated|AC
PEARL|Pérola|Pearl|N4|JEWELRY|pérola;pérolas|pearl|AC
ACETATE|Acetato|Acetate|E2|EYEWEAR|acetato|acetate|AC
SYNTHETIC|Sintético (legado)|Synthetic (legacy)|N5|LEGACY|sintético|synthetic|
BLEND|Misto (legado)|Blend (legacy)|N5|LEGACY|misto;mesclado|blend|
""")

# Estampa: 10 atuais + ampliação
VALUES["PATTERN"] = vals("""
PLAIN|Lisa|Plain|C1|BASE|lisa;liso;sem estampa|plain;solid|
STRIPES|Listrada|Stripes|C1|GEOMETRIC|listrada;listras;risca de giz|stripes;striped;pinstripe|
PLAID|Xadrez|Plaid|C1|GEOMETRIC|xadrez;quadriculado;tartan|plaid;tartan;check|
GINGHAM|Vichy|Gingham|E2|GEOMETRIC|vichy;xadrez vichy|gingham|
HOUNDSTOOTH|Pied-de-poule|Houndstooth|E3|GEOMETRIC|pied de poule;pied-de-poule|houndstooth|
POLKA_DOT|Poá|Polka dot|C2|GEOMETRIC|poá;bolinhas|polka dot;dots|
GEOMETRIC|Geométrica|Geometric|E2|GEOMETRIC|geométrica;geométrico|geometric|
ARGYLE|Argyle|Argyle|N4|GEOMETRIC|argyle;losangos|argyle|
FLORAL|Floral|Floral|C1|ORGANIC|floral;florida;flores|floral|
TROPICAL|Tropical|Tropical|E2|ORGANIC|tropical;folhagem;folhas|tropical;palm|
PAISLEY|Paisley|Paisley|E3|ORGANIC|paisley;cashmere estampa|paisley|
ANIMAL_PRINT|Animal print|Animal print|C2|ORGANIC|animal print;oncinha;zebra;cobra;leopardo|animal print;leopard;zebra;snake|
CAMO|Camuflada|Camo|E2|ORGANIC|camuflada;camuflagem|camo;camouflage|
TIE_DYE|Tie-dye|Tie-dye|E2|ORGANIC|tie dye|tie dye|
ABSTRACT|Abstrata|Abstract|E3|ORGANIC|abstrata;abstrato|abstract|
COLOR_BLOCK|Color block|Color block|E2|GRAPHIC|color block;blocos de cor;bicolor|color block|
GRAPHIC|Com estampa/arte|Graphic|C1|GRAPHIC|estampa;estampada;desenho;arte|graphic;print;artwork|
ALLOVER_LOGO|Logo em toda a peça|All-over logo|C2|LOGO|monograma;logo em toda|monogram;allover logo|
SINGLE_LOGO|Um logo|Single logo|C1|LOGO|logo;logo central;logo no peito|logo;chest logo|
""")

# Ordem das subcategorias por categoria (as 78 originais, com as novas no lugar delas). Os códigos LEGACY continuam
# aqui porque continuam válidos nos dados; a lista "ativa" exclui os que estão em LEGACY.
SUBCATEGORY_ORDER = {
    UP: ["t_shirt", "shirt", "blouse", "tank_top", "top", "crop_top", "polo_shirt", "bodysuit", "sweater", "sweatshirt",
         "hoodie", "cardigan", "vest", "blazer", "jacket", "coat", "parka", "windbreaker", "kimono"],
    LO: ["jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants", "leggings",
         "culottes", "shorts", "bermuda_shorts", "denim_shorts", "skirt", "skort"],
    SH: ["casual_sneakers", "running_shoes", "training_shoes", "basketball_shoes", "skate_shoes", "high_top_sneakers",
         "loafers", "moccasins", "oxford_shoes", "derby_shoes", "boots", "ankle_boots", "long_boots", "combat_boots",
         "sandals", "flip_flops", "heels", "flats", "espadrilles"],
    AC: ["handbag", "crossbody_bag", "tote_bag", "clutch", "backpack", "belt", "cap", "hat", "beanie", "scarf", "tie",
         "bow_tie", "sunglasses", "eyeglasses", "necklace", "bracelet", "earrings", "ring", "watch", "wallet", "gloves",
         "socks", "hair_accessory"],
    FB: ["dress", "jumpsuit", "romper", "matching_set", "overalls"],
}
NEW_SUBCATEGORY_LABELS_ES = {"top": "Top", "boots": "Botas"}
NEW_SUBCATEGORY_SYNONYMS = {
    "top": ["top", "corset", "corselet", "corpete", "top faixa", "bralette", "top fitness", "top esportivo",
            "top de academia", "bustie", "bustiê", "bustier", "sports bra"],
    "boots": ["bota", "botas", "boot", "boots", "chelsea", "galocha", "bota de montaria", "bota texana", "botina"],
}
