# Fonte editável da taxonomia (rode scripts/taxonomy/build_taxonomy.py depois de mudar).
# Catálogo global de variações (corte/silhueta/construção) e a ligação subcategoria → variação.
# Código único no sistema inteiro: o mesmo código em duas subcategorias tem o MESMO significado (ex.: WIDE_LEG
# em jeans, alfaiataria e macacão). Palavra genérica com sentido diferente ganha sufixo (BUCKET_HAT × BUCKET_BAG).

V = {}


def v(code, en, pt, desc, aliases_pt="", aliases_en=""):
    assert code not in V, code
    V[code] = {
        "en": en, "pt": pt, "desc": desc,
        "aliases_pt": [a.strip() for a in aliases_pt.split("|") if a.strip()],
        "aliases_en": [a.strip() for a in aliases_en.split("|") if a.strip()],
    }


# ───────────── caimento (blusas, malhas e calças) — mesmo sentido em todas as subcategorias
v("SLIM", "Slim", "Slim", "Justa sem apertar, com pouca folga; na calça, perna estreita que afina de leve até a barra.",
  "slim | slim fit | ajustada | ajustado | acinturado | acinturada", "slim | slim fit | fitted")
v("EXTRA_SLIM", "Extra slim", "Super slim", "Mais justa que a slim, rente ao tronco (camisa social).",
  "super slim | extra slim", "extra slim | super slim | skinny fit")
v("REGULAR", "Regular", "Regular", "Caimento tradicional, folga moderada: nem justo nem largo.",
  "regular | regular fit | tradicional | modelagem tradicional | comfort", "regular | regular fit | classic fit | standard fit")
v("RELAXED", "Relaxed", "Relaxed", "Mais folga no corpo (na calça, quadril e coxa folgados), sem chegar a oversized/baggy.",
  "relaxed | soltinha | soltinho | confortável | folgada", "relaxed | relaxed fit | easy fit | comfort fit")
v("OVERSIZED", "Oversized", "Oversized", "Propositalmente maior que o corpo: ombro caído, corpo e mangas amplos e mais compridos.",
  "oversized | oversize | over | modelagem ampla | boyfriend", "oversized | oversize | oversized fit | boyfriend")
v("BOXY", "Boxy", "Boxy", "Corte reto e quadrado: largo no corpo e mais curto, terminando na cintura, sem acinturar.",
  "boxy | quadrada | quadrado | corte quadrado", "boxy | boxy fit | square fit")
v("MUSCLE_FIT", "Muscle fit", "Muscle", "Bem justa no peito e nos braços, mangas curtas apertadas, para marcar o corpo.",
  "muscle | muscle fit | camiseta muscle", "muscle fit | muscle tee")
v("ATHLETIC_FIT", "Athletic fit", "Atlética", "Folga no peito e nos ombros, afinando na cintura.",
  "athletic | atlética | athletic fit", "athletic fit | athletic cut")
v("BABY_TEE", "Baby tee", "Baby look", "Camiseta feminina curta e justa, de mangas curtinhas.",
  "baby look | babylook | baby tee | camiseta baby look", "baby tee | shrunken tee | fitted tee")

# ───────────── camisa e blusa
v("OVERSHIRT", "Overshirt", "Camisa-jaqueta", "Camisa encorpada usada aberta como terceira peça (shacket).",
  "overshirt | shacket | camisa jaqueta | sobrecamisa", "overshirt | shacket | shirt jacket")
v("WESTERN_SHIRT", "Western shirt", "Camisa western", "Pala recortada na frente/costas, bolsos com aba e botões de pressão.",
  "camisa western | camisa country | camisa cowboy", "western shirt | cowboy shirt")
v("TUXEDO_SHIRT", "Tuxedo shirt", "Camisa de smoking", "Peitilho com pregas ou nervuras e punho duplo.",
  "camisa smoking | camisa de gala | peitilho", "tuxedo shirt | bib front shirt")
v("PEPLUM", "Peplum", "Peplum", "Babado/godê na cintura que se abre sobre o quadril.",
  "peplum | babado na cintura", "peplum")
v("WRAP", "Wrap", "Transpassado", "Frente cruzada (envelope) que fecha amarrando ou com faixa na lateral.",
  "transpassada | transpassado | envelope | wrap | cache coeur", "wrap | wrap front | crossover")
v("PEASANT", "Peasant", "Bata", "Ampla e leve, decote franzido e mangas soltas ou bufantes (camponesa).",
  "bata | camponesa | blusa camponesa", "peasant | peasant blouse | boho blouse")
v("BABYDOLL", "Babydoll", "Babydoll", "Justa no busto (recorte alto) e solta/rodada abaixo; curta.",
  "babydoll | baby doll", "babydoll | baby doll | smock")
v("SMOCKED", "Smocked", "Lastex", "Corpo franzido com elástico (smock/lastex), ajusta sem fechamento.",
  "lastex | franzida | franzido | smocking", "smocked | shirred")
v("TIE_FRONT", "Tie-front", "Amarração frontal", "Barra ou decote com nó/laço na frente.",
  "amarração | com amarração | amarrar na frente | nózinho", "tie front | knot front | tie up")
v("TUNIC", "Tunic", "Túnica", "Blusa longa e reta que cobre o quadril, vestida pela cabeça.",
  "túnica | tunica | batinha longa", "tunic")

# ───────────── regata, top e body
v("RACERBACK", "Racerback", "Nadador", "Alças que se encontram no meio das costas, deixando as escápulas livres.",
  "nadador | costas nadador | racerback", "racerback")
v("MUSCLE_TANK", "Muscle tank", "Machão", "Regata de cava funda e larga, corpo reto.",
  "machão | regata machão | muscle tank", "muscle tank | drop armhole tank")
v("DEEP_ARMHOLE", "Deep armhole", "Cavada", "Cava aberta quase até a cintura, laterais à mostra.",
  "cavada | regata cavada | cava americana", "deep armhole | side cut tank")
v("CAMISOLE", "Camisole", "Alcinha", "Alças finas (spaghetti), tecido leve.",
  "alcinha | alça fina | regata de alcinha", "camisole | cami | spaghetti strap")
v("STRAPPY", "Strappy", "Tiras", "Várias tiras cruzadas nas costas ou nos ombros (na sandália, várias tiras finas sobre o pé).",
  "tiras | alças cruzadas | costas de tiras | rasteira | rasteirinha | sandália de tiras", "strappy | cross back")
v("CORSET", "Corset", "Corset", "Corpo estruturado com barbatanas e recortes que modelam a cintura.",
  "corset | corselet | espartilho | corpete", "corset | corset top | bustier corset")
v("BUSTIER", "Bustier", "Bustiê", "Estruturado só no busto (bojo/barbatana), sem alça ou com alça fina.",
  "bustiê | bustie | bustier", "bustier")
v("BANDEAU", "Bandeau", "Faixa", "Faixa reta que envolve o busto, sem alças.",
  "faixa | top faixa | cropped faixa | tubinho | tomara que caia", "bandeau | tube top | boob tube")
v("BRALETTE", "Bralette", "Bralette", "Top de lingerie sem bojo nem aro, usado aparente.",
  "bralette | top de renda", "bralette")
v("SPORTS_BRA", "Sports bra", "Top esportivo", "Top de sustentação para atividade física.",
  "top fitness | top esportivo | top de academia | top de ginástica | top de corrida", "sports bra | sport top | training bra")
v("CUT_OUT", "Cut-out", "Vazado", "Recortes que mostram partes do corpo (cintura, ombro, costas).",
  "vazado | vazada | recorte vazado | cut out | recortes", "cut out | cutout")
v("DRAPED", "Draped", "Drapeado", "Tecido franzido/torcido em dobras soltas que modelam a peça.",
  "drapeado | drapeada | franzido lateral", "draped | ruched")
v("HIGH_CUT", "High-cut", "Cavado", "Body com cava alta na perna, quadril à mostra.",
  "cavado | body cavado | asa delta", "high cut | high leg")
v("SHAPING", "Shaping", "Modelador", "Body de compressão que modela cintura e abdômen.",
  "modelador | body modelador | cinta", "shaping | shapewear bodysuit")
v("RUGBY", "Rugby", "Rugby", "Polo de manga longa em malha encorpada e gola de tecido plano.",
  "rugby | camisa rugby | polo rugby", "rugby shirt")

# ───────────── malhas e casacos
v("BOLERO", "Bolero", "Bolero", "Casaquinho curtíssimo que cobre só ombros e braços, aberto na frente.",
  "bolero | casaquinho curto", "bolero | shrug")
v("UNSTRUCTURED", "Unstructured", "Desestruturado", "Sem ombreira nem entretela rígida, caimento macio.",
  "desestruturado | sem ombreira", "unstructured | unconstructed | soft tailoring")
v("TAILORED_VEST", "Tailored vest", "Colete de alfaiataria", "Colete de terno (waistcoat), com botões e decote em V.",
  "colete social | colete alfaiataria | colete de terno", "waistcoat | suit vest | tailored vest")
v("PUFFER", "Puffer", "Puffer", "Acolchoado em gomos com enchimento (pluma ou sintético).",
  "puffer | acolchoado | acolchoada | jaqueta de gomos | nylon acolchoado", "puffer | padded | down | quilted down")
v("QUILTED", "Quilted", "Matelassê", "Pespontos em losango ou linhas, achatado, com pouco enchimento.",
  "matelassê | matelasse | pespontado", "quilted | diamond quilted")
v("KNIT_VEST", "Sweater vest", "Colete de tricô", "Colete de malha/tricô, sem mangas e sem fechamento.",
  "colete de tricô | colete de lã | colete tricot", "sweater vest | knit vest")
v("UTILITY", "Utility", "Utilitário", "Muitos bolsos aplicados, estilo militar/workwear.",
  "utilitário | colete de bolsos | tático | colete cargo", "utility | cargo vest | tactical vest")
v("BOMBER", "Bomber", "Bomber", "Curta, com ribana na gola, punhos e barra.",
  "bomber | jaqueta bomber", "bomber | flight jacket | MA-1")
v("TRUCKER", "Trucker", "Trucker", "Jaqueta jeans clássica: bolsos de aba no peito, pences verticais e cós com botões.",
  "trucker | jaqueta trucker | jaqueta jeans clássica", "trucker | type III | denim trucker")
v("MOTO", "Moto", "Motoqueiro", "Zíper diagonal, lapelas largas e cinto (perfecto), em geral de couro.",
  "perfecto | motoqueiro | biker | jaqueta motociclista", "moto jacket | biker jacket | perfecto")
v("AVIATOR_JACKET", "Aviator", "Aviador", "Jaqueta de aviador com gola e forro de pelo (shearling).",
  "aviador | jaqueta aviador", "aviator jacket | shearling aviator | flight jacket shearling")
v("FIELD", "Field", "Militar", "Jaqueta militar (M-65) com quatro bolsos e cordão na cintura.",
  "militar | field jacket | jaqueta militar | m65", "field jacket | M-65 | military jacket")
v("CHORE", "Chore", "Workwear", "Reta, de sarja ou lona, com três bolsos aplicados.",
  "chore | jaqueta workwear | jaqueta de trabalho", "chore coat | work jacket")
v("VARSITY", "Varsity", "College", "Corpo de lã com mangas contrastantes, botões de pressão e ribanas listradas.",
  "college | jaqueta college | varsity | universitária", "varsity | letterman")
v("HARRINGTON", "Harrington", "Harrington", "Curta, gola de padre com botão e forro xadrez.",
  "harrington", "harrington | G9")
v("COACH", "Coach", "Coach", "Nylon leve, gola de camisa e botões de pressão.",
  "coach | jaqueta coach", "coach jacket")
v("TRACK", "Track", "Agasalho", "Jaqueta de treino em malha ou tactel, com zíper e gola alta.",
  "agasalho | jaqueta de treino | jaqueta esportiva | track top", "track jacket | track top")
v("SAFARI", "Safari", "Safári", "Cintura marcada por cinto, quatro bolsos e dragonas.",
  "safári | safari | sahariana", "safari jacket | bush jacket")
v("NAPOLEON", "Military/Napoleon", "Napoleônica", "Estilo militar de gala: abotoamento duplo, gola alta e alamares.",
  "napoleônica | jaqueta napoleão | militar de gala", "napoleon jacket | military dress jacket")
v("TRENCH", "Trench", "Trench coat", "Transpassado, com cinto, pala de tempestade e dragonas.",
  "trench | trench coat | sobretudo trench | gabardine", "trench | trench coat")
v("OVERCOAT", "Overcoat", "Sobretudo", "Reto, abaixo do quadril, de lã, com lapela (ex.: chesterfield).",
  "sobretudo | casacão | chesterfield | mantô", "overcoat | topcoat | chesterfield")
v("PEACOAT", "Peacoat", "Japona", "Curto, transpassado, de lã grossa e gola larga.",
  "japona | peacoat | casaco marinheiro", "peacoat | pea coat | reefer")
v("COCOON", "Cocoon", "Casulo", "Ombros arredondados e corpo oval que afina na barra.",
  "casulo | cocoon | casaco casulo", "cocoon coat")
v("DUFFLE", "Duffle", "Duffle", "Com capuz e fechamento de pinos de madeira (toggles).",
  "duffle | montgomery", "duffle coat | toggle coat")
v("CAR_COAT", "Car coat", "Car coat", "Reto e curto (meio da coxa), feito para dirigir.",
  "car coat", "car coat")
v("CAPE", "Cape", "Capa", "Sem mangas, cai dos ombros como capa ou poncho.",
  "capa | poncho | pelerine", "cape | poncho | cape coat")
v("SHELL", "Shell", "Shell", "Casca corta-vento/impermeável leve, sem enchimento.",
  "shell | corta vento leve | casca", "shell | shell jacket | hard shell")
v("FISHTAIL", "Fishtail", "Rabo de peixe", "Barra traseira mais longa em ponta, com capuz (M-51).",
  "rabo de peixe | m51 | parka militar", "fishtail | M-51")
v("SNORKEL", "Snorkel", "Snorkel", "Capuz que fecha em túnel sobre o rosto.",
  "snorkel", "snorkel parka")
v("ANORAK", "Anorak", "Anoraque", "Vestido pela cabeça: meio zíper, capuz e bolso canguru.",
  "anoraque | anorak | corta vento canguru", "anorak | pullover windbreaker")
v("PACKABLE", "Packable", "Dobrável", "Guarda-se no próprio bolso ou saquinho.",
  "dobrável | compactável | packable", "packable")
v("RAIN_JACKET", "Rain jacket", "Capa de chuva", "Impermeável com costuras seladas e capuz.",
  "capa de chuva | impermeável | jaqueta impermeável", "rain jacket | raincoat | waterproof jacket")
v("OPEN_FRONT", "Open-front", "Aberto", "Aberto na frente, sem fechamento, mangas largas tipo quimono.",
  "quimono aberto | kimono aberto", "open front | kimono jacket")
v("BELTED", "Belted", "Com faixa", "Fecha na cintura com faixa ou cinto do mesmo tecido.",
  "com faixa | com cinto | amarrado na cintura", "belted | robe style")

# ───────────── pernas (jeans e calças)
v("SKINNY", "Skinny", "Skinny", "Justa do quadril ao tornozelo, colada na perna (na legging, a forma tradicional).",
  "skinny | super skinny | justa | colada | jegging | legging tradicional", "skinny | super skinny | jegging")
v("STRAIGHT", "Straight", "Reta", "Mesma largura do joelho à barra, sem afunilar nem abrir (na saia, reta/secretária).",
  "reta | perna reta | straight | corte reto | secretária", "straight | straight leg | straight fit")
v("LOOSE", "Loose", "Loose", "Folgada do quadril à barra, reta e ampla — mais que relaxed, menos que baggy.",
  "loose | solta | larga", "loose | loose fit")
v("BAGGY", "Baggy", "Baggy", "Muito larga em toda a perna, gancho baixo, sobra de tecido na barra.",
  "baggy | bem larga | folgadona | jorts", "baggy | extra loose | jorts")
v("WIDE_LEG", "Wide leg", "Wide leg", "Cintura ajustada e perna larga e reta desde a coxa (pantalona).",
  "wide leg | pantalona | perna larga | wide", "wide leg | wide-leg | stride")
v("PALAZZO", "Palazzo", "Palazzo", "Extremamente larga e fluida desde o quadril, até o chão.",
  "palazzo | pantalona fluida | calça palazzo", "palazzo")
v("TAPERED", "Tapered", "Afunilada", "Folga no quadril e coxa, estreitando aos poucos até o tornozelo.",
  "afunilada | tapered | slim taper | slim afunilada", "tapered | tapered leg | slim taper")
v("BOOTCUT", "Bootcut", "Bootcut", "Justa até o joelho e levemente aberta na barra (cabe a bota).",
  "bootcut | boot cut | semi flare | flare suave", "bootcut | boot cut")
v("FLARE", "Flare", "Flare", "Justa até o joelho e bem aberta do joelho à barra.",
  "flare | calça flare | flarezinha", "flare | flared")
v("BELL_BOTTOM", "Bell-bottom", "Boca de sino", "Abertura dramática a partir do joelho, barra muito larga (anos 70).",
  "boca de sino | bell bottom", "bell bottom | bell-bottoms")
v("MOM", "Mom", "Mom", "Cintura alta, folga no quadril e afunilamento acentuado até o tornozelo (anos 80/90).",
  "mom | mom jeans | mom fit", "mom | mom jeans | mom fit")
v("DAD", "Dad", "Dad", "Cintura logo abaixo do umbigo, quadril e coxa folgados e perna reta e solta.",
  "dad | dad jeans", "dad | dad jeans | baggy dad | easy dad")
v("BOYFRIEND", "Boyfriend", "Boyfriend", "Feminina, cintura baixa/média e perna reta folgada 'emprestada do namorado'.",
  "boyfriend | boy", "boyfriend | boyfriend fit")
v("GIRLFRIEND", "Girlfriend", "Girlfriend", "Versão mais esculpida do boyfriend: folgada no quadril, afinando na barra.",
  "girlfriend", "girlfriend")
v("CARROT", "Carrot", "Cenoura", "Volume no quadril (com pregas) e afunilamento acentuado até o tornozelo.",
  "cenoura | carrot | calça cenoura", "carrot | carrot fit | pleated tapered")
v("BARREL", "Barrel", "Barrel", "Perna curva: mais larga no joelho, fechando no quadril e na barra (barril).",
  "barrel | barril | curva", "barrel | barrel leg | curved leg")
v("BALLOON", "Balloon", "Balonê", "Volume arredondado em toda a perna (ou na saia/vestido) que se fecha na barra.",
  "balonê | balone | balão | balloon", "balloon | balloon leg | bubble | puffball")
v("HORSESHOE", "Horseshoe", "Ferradura", "Curva mais exagerada que o barrel, costuras arqueadas para fora (ferradura).",
  "ferradura | horseshoe", "horseshoe | horseshoe jeans")
v("SKATER", "Skater", "Skater", "Gancho longo, perna larga e levemente afunilada, um pouco mais curta (C&A/Renner).",
  "skater | calça skater", "skater | skater jeans")
v("CIGARETTE", "Cigarette", "Cigarrete", "Reta e estreita, ajustada sem afunilar, barra no tornozelo.",
  "cigarrete | cigarette | calça cigarrete", "cigarette | cigarette pants")
v("PAPERBAG", "Paperbag", "Clochard", "Cintura alta franzida por cinto/amarração, formando babado acima do cós.",
  "clochard | paperbag | paper bag", "paperbag | paper bag waist")
v("SAILOR", "Sailor", "Marinheiro", "Cintura alta, perna larga e abotoamento frontal duplo.",
  "marinheiro | calça marinheiro", "sailor pants")
v("PARACHUTE", "Parachute", "Parachute", "Nylon leve, muito larga, com cordões/reguladores na barra.",
  "parachute | calça paraquedas", "parachute | parachute pants")
v("HAREM", "Harem", "Saruel", "Gancho bem baixo, volume no quadril e barra justa.",
  "saruel | harém | sarouel | gancho baixo", "harem | drop crotch")
v("CUFFED_HEM", "Cuffed hem", "Com punho", "Barra com punho ou elástico (estilo jogger), presa no tornozelo.",
  "com punho | barra com elástico | jogger | punho na barra", "cuffed | cuffed hem | jogger")
v("SEAMLESS", "Seamless", "Sem costura", "Malha tubular contínua, sem costuras laterais.",
  "sem costura | seamless", "seamless")
v("COMPRESSION", "Compression", "Compressão", "Malha de alta compressão para suporte muscular.",
  "compressão | compressiva | modeladora", "compression")
v("STIRRUP", "Stirrup", "Com pezinho", "Alça sob o pé que segura a barra.",
  "com pezinho | pezinho | estribo", "stirrup")
v("GAUCHO", "Gaucho", "Gaúcha", "Pantacourt um pouco mais estreita e curta, abrindo na barra.",
  "gaúcha | gaucha | bombacha", "gaucho")

# ───────────── shorts e saias
v("CARGO", "Cargo", "Cargo", "Bolsos laterais aplicados com aba na altura da coxa.",
  "cargo | bolso cargo", "cargo")
v("BIKER", "Bike short", "Ciclista", "Short justo de malha elástica, até o meio da coxa.",
  "ciclista | bermuda ciclista | short ciclista | biker", "bike shorts | biker shorts | cycling shorts")
v("A_LINE", "A-line", "Evasê", "Ajustada na cintura e abrindo aos poucos em forma de A.",
  "evasê | evase | linha a | godezinho", "a-line | a line | flared")
v("PENCIL", "Pencil", "Lápis", "Justa e reta, afinando levemente em direção à barra.",
  "lápis | saia lápis", "pencil | pencil skirt")
v("CIRCLE", "Circle", "Godê", "Cortada em círculo, com muito volume e movimento na barra.",
  "godê | gode | rodada | godê inteiro | meio godê | skater", "circle | skater | full skirt")
v("PLEATED", "Pleated", "Plissada", "Pregas prensadas ao longo de toda a peça.",
  "plissada | plissado | pregueada | de pregas | prega macho", "pleated | accordion pleat | knife pleat")
v("SLIP", "Slip", "Slip", "Cortado no viés, fluido e rente ao corpo (no vestido, de alças finas, como camisola).",
  "slip | enviesada | enviesado | viés | vestido camisola | slip dress", "slip | bias cut | slip dress")
v("TIERED", "Tiered", "Camadas", "Faixas horizontais franzidas sobrepostas (estilo prairie).",
  "camadas | em camadas | três marias | tres marias", "tiered | prairie")
v("GATHERED", "Gathered", "Franzida", "Franzida na cintura, volume suave sem pregas marcadas.",
  "franzida | franzido na cintura", "gathered | dirndl")
v("MERMAID", "Mermaid", "Sereia", "Justa até o joelho e abrindo em godê na barra (inclui trumpet).",
  "sereia | mermaid", "mermaid | trumpet")
v("TULIP", "Tulip", "Tulipa", "Transpassada na frente, volume no quadril e barra fechando em pétala.",
  "tulipa", "tulip")
v("TUTU", "Tutu", "Tutu", "Camadas de tule armado.",
  "tutu | saia de tule | bailarina", "tutu | tulle skirt")

# ───────────── vestidos e peça inteira
v("SHEATH", "Sheath", "Tubinho", "Justo e reto acompanhando o corpo (pences), sem recorte na cintura.",
  "tubinho | tubo | vestido tubinho | coluna", "sheath | column")
v("BODYCON", "Bodycon", "Bodycon", "Malha elástica colada ao corpo, do busto à barra.",
  "bodycon | colado | justinho | vestido colado", "bodycon | body con")
v("SHIFT", "Shift", "Reto", "Solto, sem marcar a cintura, caindo reto dos ombros.",
  "reto | vestido reto | soltinho | shift", "shift")
v("FIT_AND_FLARE", "Fit and flare", "Acinturado e rodado", "Corpo ajustado até a cintura e saia godê abaixo.",
  "acinturado | rodado | fit and flare | godê | skater", "fit and flare | skater dress")
v("SHIRT_DRESS", "Shirt dress", "Chemise", "Abotoamento frontal, gola e punhos de camisa.",
  "chemise | chemisier | vestido camisa | camisão", "shirt dress | shirtdress")
v("T_SHIRT_DRESS", "T-shirt dress", "Vestido camiseta", "Corpo de camiseta alongado, reto, em malha.",
  "vestido camiseta | camisetão | vestido de malha", "t-shirt dress | tee dress")
v("EMPIRE", "Empire", "Império", "Recorte logo abaixo do busto e saia fluida longa.",
  "império | recorte império | cintura império", "empire | empire waist")
v("BALL_GOWN", "Ball gown", "Princesa", "Corpete ajustado e saia muito volumosa (com anágua).",
  "princesa | vestido de baile | debutante", "ball gown | princess")
v("TRAPEZE", "Trapeze", "Trapézio", "Estreito nos ombros e abrindo muito até a barra, sem cintura.",
  "trapézio | trapezio", "trapeze | swing")
v("KAFTAN", "Kaftan", "Kaftan", "Amplo e reto, mangas largas, vestido pela cabeça.",
  "kaftan | cafetã | caftan", "kaftan | caftan")
v("BLAZER_DRESS", "Blazer dress", "Vestido blazer", "Modelagem de blazer alongada, com lapela e botões.",
  "vestido blazer", "blazer dress | tuxedo dress")
v("PINAFORE", "Pinafore", "Salopete", "Vestido com peitilho e alças, usado sobre blusa (jardineira-vestido).",
  "salopete | jardineira vestido | jardineira saia | vestido jardineira", "pinafore | jumper dress | overall dress")
v("BOILERSUIT", "Boilersuit", "Utilitário", "Macacão workwear com zíper/botões frontais e bolsos.",
  "utilitário | macacão utilitário | boilersuit | macacão de trabalho", "boilersuit | utility jumpsuit | coverall")
v("CARPENTER", "Carpenter", "Carpinteiro", "Alça de martelo e bolsos utilitários (workwear).",
  "carpinteiro | carpenter", "carpenter")
v("TOP_AND_SKIRT", "Skirt set", "Conjunto com saia", "Parte de cima e saia do mesmo tecido/estampa.",
  "conjunto saia | conjunto de saia | conjuntinho saia", "skirt set | two-piece skirt set")
v("TOP_AND_PANTS", "Pant set", "Conjunto com calça", "Parte de cima e calça do mesmo tecido/estampa.",
  "conjunto calça | conjunto de calça", "pant set | trouser set")
v("TOP_AND_SHORTS", "Shorts set", "Conjunto com short", "Parte de cima e short do mesmo tecido/estampa.",
  "conjunto short | conjuntinho short", "shorts set")
v("SUIT", "Suit", "Terno / tailleur", "Blazer com calça ou saia do mesmo tecido.",
  "terno | tailleur | costume | conjunto alfaiataria", "suit | pantsuit | skirt suit")
v("TRACKSUIT", "Tracksuit", "Agasalho completo", "Jaqueta + calça de treino ou conjunto de moletom.",
  "agasalho completo | conjunto moletom | conjunto de moletom | abrigo", "tracksuit | jogging suit | sweatsuit")
v("THREE_PIECE", "Three-piece suit", "Terno três peças", "Blazer, colete e calça.",
  "terno três peças | terno com colete", "three-piece suit")

# ───────────── calçados
v("COURT", "Court", "Estilo quadra", "Cabedal liso, sola de borracha e perfil limpo (ex.: Stan Smith, Air Force 1).",
  "quadra | court | tênis branco liso", "court | court sneaker | cupsole sneaker")
v("VULCANIZED", "Vulcanized", "Vulcanizado", "Sola fina vulcanizada e biqueira de borracha; flexível (lona: All Star, Vans).",
  "vulcanizado | lona | tênis de lona | plimsoll", "vulcanized | canvas sneaker | plimsoll")
v("RETRO_RUNNER", "Retro runner", "Retrô de corrida", "Silhueta de corrida dos anos 70–90 em camurça/nylon (ex.: NB 574).",
  "jogging | retrô | retro running", "retro runner | jogger sneaker")
v("TERRACE", "Terrace", "Terrace", "Perfil baixo e fino, biqueira em T e sola de goma (ex.: Samba, Gazelle).",
  "terrace | low profile | perfil baixo | baixinho", "terrace | low-profile | T-toe")
v("DAD_SNEAKER", "Dad sneaker", "Dad sneaker", "Volumoso, com camadas e sola grossa (chunky, anos 90).",
  "dad sneaker | dad shoes | chunky | tênis robusto | tênis grosso", "dad sneaker | chunky sneaker")
v("TECH_RUNNER", "Tech runner", "Tech runner", "Tela técnica e entressola de corrida em visual lifestyle Y2K.",
  "tech runner | y2k | estilo running", "tech runner | Y2K runner")
v("SOCK_SNEAKER", "Sock sneaker", "Tênis meia", "Cabedal de malha elástica que veste como meia.",
  "tênis meia | knit | tênis de malha", "sock sneaker | knit sneaker")
v("DRESS_SNEAKER", "Dress sneaker", "Sapatênis", "Cabedal de sapato em couro sobre solado de tênis.",
  "sapatênis | sapatenis", "dress sneaker | hybrid shoe")
v("SNEAKER_BOOT", "Sneaker boot", "Tênis botinha", "Tênis com cano de bota acima do tornozelo.",
  "tênis botinha | sneaker boot", "sneaker boot")
v("NEUTRAL", "Neutral", "Pisada neutra", "Amortecimento sem estrutura de controle de pisada.",
  "pisada neutra | neutro | corrida de rua | asfalto", "neutral | road running")
v("STABILITY", "Stability", "Estabilidade", "Suporte medial para pisada pronada.",
  "estabilidade | pronada | controle de pisada", "stability | support")
v("MAX_CUSHION", "Max cushion", "Máximo amortecimento", "Entressola alta e macia.",
  "máximo amortecimento | max cushion", "max cushion | maximalist")
v("RACING", "Racing", "Competição", "Leve, com placa (carbono) e drop baixo.",
  "competição | placa de carbono | racing", "racing | racer | carbon plate")
v("TRAIL", "Trail", "Trail", "Solado com cravos e proteção para terra/montanha.",
  "trail | trilha | corrida de trilha", "trail | trail running")
v("TRACK_SPIKE", "Track spike", "Sapatilha de atletismo", "Sola rígida com pregos para pista.",
  "sapatilha de atletismo | spike | sapatilha de prego", "track spike | spikes")
v("MINIMALIST", "Minimalist", "Minimalista", "Sola fina e flexível, drop zero (barefoot).",
  "minimalista | barefoot | drop zero", "minimalist | barefoot")
v("CROSS_TRAINING", "Cross training", "Treino funcional", "Base larga e estável para treino funcional/academia.",
  "cross training | funcional | crossfit | academia | treino", "cross training | cross trainer | gym shoe")
v("WEIGHTLIFTING", "Weightlifting", "LPO", "Salto rígido elevado e tira de ajuste para levantamento de peso.",
  "lpo | levantamento de peso | weightlifting", "weightlifting | lifter")
v("WALKING", "Walking", "Caminhada", "Amortecimento confortável e solado flexível para caminhar.",
  "caminhada | tênis de caminhada", "walking shoe")
v("PERFORMANCE", "Performance", "Performance", "Tecnologia atual de amortecimento e tração para jogo.",
  "performance | de jogo", "performance")
v("HERITAGE", "Heritage", "Retrô", "Relançamento de modelo clássico de basquete usado como lifestyle (ex.: Jordan 1, Dunk).",
  "retrô | heritage | clássico de basquete", "retro | heritage")
v("CUPSOLE", "Cupsole", "Sola copo", "Sola de borracha em peça única costurada, mais amortecida.",
  "cupsole | sola copo | sola costurada", "cupsole")
v("PENNY", "Penny", "Penny", "Tira sobre o peito do pé com recorte em losango.",
  "penny | penny loafer | mocassim social", "penny loafer")
v("TASSEL", "Tassel", "Tassel", "Borlas (pingentes de franja) no peito do pé.",
  "tassel | com franja | borla", "tassel loafer")
v("HORSEBIT", "Horsebit", "Horsebit", "Ferragem metálica (freio) sobre o peito do pé.",
  "horsebit | com ferragem | com freio", "horsebit | bit loafer")
v("VENETIAN", "Venetian", "Veneziano", "Liso, sem tira nem ornamento.",
  "veneziano | loafer liso", "venetian | plain loafer")
v("BELGIAN", "Belgian", "Belga", "Cabedal macio com pequeno laço e sola fina.",
  "belga", "belgian loafer")
v("SLIPPER", "Slipper", "Slipper", "Sapato baixo de calce fácil, cabedal macio (veludo/couro) sem cadarço.",
  "slipper | slipper shoe", "slipper | smoking slipper")
v("DRIVER", "Driver", "Drive", "Mocassim macio com sola de pinos de borracha que sobe no calcanhar.",
  "drive | driver | mocassim drive", "driving moccasin | driver")
v("BOAT_SHOE", "Boat shoe", "Dockside", "Cadarço de couro ao redor do colarinho e sola antiderrapante.",
  "dockside | docksider | sapato náutico | sapato de vela", "boat shoe | deck shoe")
v("TRUE_MOC", "True moccasin", "Mocassim tradicional", "Peça única de couro envolvendo o pé, costura em U, sem salto.",
  "mocassim tradicional | costura avental | mocassim de verdade", "true moccasin | camp moc | apron moc")
v("PLAIN_TOE", "Plain toe", "Bico liso", "Biqueira sem costura nem ornamento.",
  "bico liso | liso | plain toe", "plain toe")
v("CAP_TOE", "Cap toe", "Biqueira", "Costura reta atravessando a ponta do pé.",
  "biqueira | cap toe | ponteira costurada", "cap toe | captoe")
v("WINGTIP", "Wingtip", "Brogue", "Biqueira em forma de asa (W) com perfurações (full brogue).",
  "brogue | full brogue | wingtip | asa", "wingtip | full brogue")
v("SEMI_BROGUE", "Semi-brogue", "Semi brogue", "Biqueira reta com perfurações e medalhão na ponta.",
  "semi brogue | meio brogue", "semi brogue")
v("WHOLECUT", "Wholecut", "Peça única", "Cabedal de uma única peça de couro, sem costuras aparentes.",
  "wholecut | peça única", "wholecut")
v("SADDLE_SHOE", "Saddle shoe", "Saddle", "Faixa de couro contrastante sobre o peito do pé.",
  "saddle | sapato saddle", "saddle shoe")
v("APRON_TOE", "Apron toe", "Avental", "Costura em U ao redor da frente do pé (norwegian/split toe).",
  "avental | bico avental | norueguês", "apron toe | split toe | norwegian")
v("MONK_STRAP", "Monk strap", "Monk", "Sem cadarço: fecha com tira e fivela (simples ou dupla).",
  "monk | monk strap | sapato de fivela | double monk", "monk strap | double monk")
v("CHELSEA", "Chelsea", "Chelsea", "Cano com elástico lateral, sem cadarço.",
  "chelsea | bota chelsea | botina chelsea | elástico lateral", "chelsea boot")
v("COMBAT", "Combat", "Coturno", "Militar, de amarrar com muitos ilhoses e sola tratorada.",
  "coturno | combat | bota militar | coturno tratorado", "combat boot | military boot")
v("WESTERN", "Western", "Texana", "Bico fino, salto cubano e cano com pesponto decorativo.",
  "texana | country | western | bota de cowboy | bota de peão", "western boot | cowboy boot")
v("CHUKKA", "Chukka", "Desert", "Cano no tornozelo, dois ou três pares de ilhoses, camurça.",
  "chukka | desert | desert boot", "chukka | desert boot")
v("HIKING", "Hiking", "Trekking", "Cano médio acolchoado, solado com cravos e cabedal resistente.",
  "trekking | bota de trilha | bota de caminhada | adventure", "hiking boot | trekking boot")
v("WORK_BOOT", "Work boot", "Botina", "Robusta, de amarrar, com biqueira reforçada e sola grossa.",
  "botina | bota de trabalho | workwear", "work boot")
v("ENGINEER", "Engineer", "Motociclista", "Cano alto sem cadarço, com fivelas no topo e no peito do pé.",
  "motociclista | bota de motoqueiro | engineer | biker boot", "engineer boot | biker boot | moto boot")
v("RIDING", "Riding", "Montaria", "Cano alto liso e justo, bico redondo e salto baixo.",
  "montaria | bota de montaria | equestre", "riding boot | equestrian boot")
v("SOCK_BOOT", "Sock boot", "Bota meia", "Cano de malha elástica justo na perna, sem fechamento.",
  "bota meia | sock boot", "sock boot | stretch boot")
v("SLOUCH", "Slouch", "Slouch", "Cano largo e mole que forma dobras (sanfonado).",
  "slouch | sanfonada | cano enrugado", "slouch boot")
v("RAIN_BOOT", "Rain boot", "Galocha", "Borracha moldada impermeável.",
  "galocha | bota de chuva | bota de borracha", "rain boot | wellington | wellies")
v("SNOW_BOOT", "Snow boot", "Bota de neve", "Cano forrado de pelo ou lã e sola de inverno.",
  "bota de neve | bota de pelo | bota forrada", "snow boot | winter boot | shearling boot")
v("ANKLE_STRAP", "Ankle strap", "Tira no tornozelo", "Tira que circunda o tornozelo, com fivela.",
  "tira no tornozelo | pulseira no tornozelo", "ankle strap")
v("SPORT_SANDAL", "Sport sandal", "Papete", "Tiras largas de velcro/nylon e solado esportivo.",
  "papete | sandália esportiva", "sport sandal | trekking sandal")
v("FOOTBED", "Footbed", "Anatômica", "Palmilha de cortiça/látex moldada e tiras largas com fivela (estilo Birken).",
  "birken | anatômica | palmilha anatômica", "footbed sandal | cork footbed")
v("GLADIATOR", "Gladiator", "Gladiadora", "Muitas tiras subindo pelo tornozelo/perna.",
  "gladiadora | gladiador", "gladiator")
v("T_STRAP", "T-strap", "Tira em T", "Tira central no peito do pé ligada à tira do tornozelo.",
  "tira em t | t bar", "t-strap | t-bar")
v("FISHERMAN", "Fisherman", "Fisherman", "Cabedal de tiras trançadas fechado na frente.",
  "fisherman | sandália fisherman | franciscana", "fisherman sandal")
v("MULE", "Mule", "Mule", "Sem a parte de trás: calcanhar livre.",
  "mule | tamanco | mule de salto", "mule | backless")
v("CLOG", "Clog", "Babuche", "Frente fechada, calcanhar aberto e sola grossa moldada (ex.: Crocs, Boston).",
  "babuche | clog | crocs", "clog")
v("THONG", "Thong", "De dedo", "Tira em V presa entre os dedos.",
  "de dedo | chinelo de dedo", "thong | flip flop")
v("SLIDE", "Slide", "Slide", "Uma tira larga sobre o peito do pé.",
  "slide | chinelo slide | chinelo nuvem | slide nuvem", "slide | slides | pool slide | cloud slide")
v("PUMP", "Pump", "Scarpin", "Fechado, decotado no peito do pé, sem tiras.",
  "scarpin | escarpim | pump", "pump | court shoe")
v("SLINGBACK", "Slingback", "Slingback", "Frente fechada e calcanhar aberto com tira.",
  "chanel | slingback | sapato chanel", "slingback")
v("D_ORSAY", "D'Orsay", "D'Orsay", "Laterais recortadas deixando o arco do pé à mostra.",
  "d'orsay | dorsay", "d'orsay")
v("MARY_JANE", "Mary Jane", "Boneca", "Tira sobre o peito do pé com fivela ou botão.",
  "boneca | sapato boneca | mary jane", "mary jane")
v("BALLET", "Ballet flat", "Sapatilha", "Baixa, fechada e decotada, inspirada na sapatilha de balé.",
  "sapatilha | bailarina | ballet flat", "ballet flat | ballerina")
v("CLASSIC_ESPADRILLE", "Espadrille", "Alpargata", "Fechada, de lona, com sola de juta trançada.",
  "alpargata | espadrille", "espadrille")
v("LACE_UP_ESPADRILLE", "Lace-up espadrille", "Espadrille de amarrar", "Fitas que sobem amarrando no tornozelo.",
  "espadrille de amarrar | alpargata de amarrar", "lace-up espadrille | tie espadrille")

# ───────────── bolsas e pequenos acessórios de couro
v("TOP_HANDLE", "Top handle", "Alça de mão", "Estruturada, com alça curta superior para a mão ou o antebraço.",
  "alça de mão | top handle", "top handle | top-handle")
v("SATCHEL", "Satchel", "Satchel", "Estruturada, base larga, alça de mão e alça transversal removível.",
  "satchel | bolsa estruturada", "satchel")
v("HOBO", "Hobo", "Hobo", "Macia, em meia-lua caída, alça de ombro.",
  "hobo", "hobo")
v("BUCKET_BAG", "Bucket bag", "Saco", "Formato de balde, fechamento de cordão.",
  "saco | bucket | bolsa saco | balde", "bucket bag")
v("BAGUETTE", "Baguette", "Baguete", "Pequena, alongada e estreita, usada sob o braço.",
  "baguete | baguette", "baguette")
v("SADDLE_BAG", "Saddle bag", "Saddle", "Formato de sela, com aba arredondada.",
  "saddle | sela", "saddle bag")
v("BOX_BAG", "Box bag", "Bolsa caixa", "Rígida em formato de caixa.",
  "bolsa caixa | box", "box bag")
v("HALF_MOON_BAG", "Half-moon bag", "Meia-lua", "Formato de meia-lua (croissant).",
  "meia lua | croissant", "half moon | crescent | croissant bag")
v("CAMERA_BAG", "Camera bag", "Câmera", "Pequena, retangular, com zíper e alça transversal.",
  "câmera | bolsa câmera", "camera bag")
v("MESSENGER_BAG", "Messenger bag", "Carteiro", "Retangular, com aba frontal e alça transversal longa.",
  "carteiro | mensageiro | messenger", "messenger bag")
v("PHONE_BAG", "Phone bag", "Porta-celular", "Mini bolsa do tamanho do celular.",
  "porta celular | bolsa celular | bolsa para celular", "phone bag | phone pouch")
v("SLING_BAG", "Sling bag", "Sling", "Alça única cruzando o peito ou as costas.",
  "sling | bolsa de peito", "sling bag | chest bag")
v("BELT_BAG", "Belt bag", "Pochete", "Pequena com zíper, presa na cintura ou cruzada no peito.",
  "pochete | doleira | belt bag", "belt bag | fanny pack | bum bag")
v("DOCTOR_BAG", "Doctor bag", "Maleta", "Abertura em armação com alças de mão.",
  "maleta | bolsa médico", "doctor bag")
v("FRAME_BAG", "Frame bag", "Fecho beijinho", "Boca rígida de metal com fecho de beijinho (kiss-lock).",
  "fecho beijinho | armação", "frame bag | kiss lock")
v("BOWLER_BAG", "Bowler bag", "Baú", "Arredondada, alças de mão e zíper superior.",
  "baú | bau | bowling | bowler", "bowler bag | bowling bag")
v("BASKET_BAG", "Basket bag", "Cesta", "Formato de cesto, geralmente de palha ou vime.",
  "cesta | cestinha | bolsa cesta", "basket bag")
v("DUFFLE_BAG", "Duffle bag", "Bolsa de viagem", "Cilíndrica e grande, para viagem ou academia.",
  "bolsa de viagem | bolsa de academia | mala de mão", "duffle | duffel | gym bag | weekender")
v("SHOPPER", "Shopper", "Shopper", "Aberta, grande, com alças longas de ombro.",
  "shopper | shopping | sacola", "shopper")
v("STRUCTURED_TOTE", "Structured tote", "Tote estruturada", "Tote rígida, com base firme e laterais retas.",
  "tote estruturada | tote rígida", "structured tote")
v("SLOUCHY_TOTE", "Slouchy tote", "Tote molenga", "Tote macia que cede quando cheia.",
  "tote macia | tote molenga", "slouchy tote | soft tote")
v("EAST_WEST_TOTE", "East-west tote", "Tote horizontal", "Mais larga que alta, formato horizontal.",
  "tote horizontal | east west", "east west tote")
v("ENVELOPE_CLUTCH", "Envelope clutch", "Envelope", "Retangular com aba triangular.",
  "envelope | carteira envelope", "envelope clutch")
v("POUCH", "Pouch", "Pouch", "Macia, franzida ou lisa, sem estrutura.",
  "pouch | carteira de mão | bolsa saquinho", "pouch | soft clutch")
v("MINAUDIERE", "Minaudière", "Minaudière", "Clutch rígida de festa, metálica ou bordada.",
  "minaudière | minaudiere | clutch de festa | clutch rígida", "minaudiere | box clutch")
v("WRISTLET", "Wristlet", "Clutch de pulso", "Pequena, com alça de pulso.",
  "clutch de pulso | wristlet", "wristlet")
v("FOLDOVER", "Fold-over", "Dobrável", "Corpo que se dobra sobre si mesmo.",
  "dobrável | fold over", "foldover clutch")
v("DAYPACK", "Daypack", "Tradicional", "Compartimento principal com zíper e bolso frontal.",
  "mochila tradicional | escolar | mochila básica", "daypack | school backpack")
v("ROLLTOP", "Rolltop", "Rolltop", "Abertura que enrola e fecha com fivela.",
  "rolltop | roll top", "rolltop")
v("GYMSACK", "Gymsack", "Mochila saco", "Mochila de tecido com cordões que viram alças.",
  "mochila saco | saco", "gymsack | drawstring bag")
v("LAPTOP_BACKPACK", "Laptop backpack", "Executiva", "Compartimento acolchoado para notebook.",
  "executiva | notebook | mochila de notebook", "laptop backpack")
v("HIKING_PACK", "Hiking pack", "Cargueira", "Estrutura com barrigueira e regulagens para carga.",
  "cargueira | mochila de trilha | camping", "hiking backpack | trekking pack")
v("RUCKSACK", "Rucksack", "Mochila com aba", "Abertura com cordão sob aba com fivelas.",
  "mochila com aba | rucksack", "rucksack | flap backpack")
v("CONVERTIBLE_BACKPACK", "Convertible", "Mochila bolsa", "Vira bolsa de ombro ou de mão.",
  "mochila bolsa | conversível", "convertible backpack")
v("BIFOLD", "Bifold", "Dobra dupla", "Carteira de duas dobras.",
  "carteira tradicional | bifold | dobra dupla", "bifold")
v("TRIFOLD", "Trifold", "Três dobras", "Carteira de três dobras.",
  "trifold | três dobras", "trifold")
v("CARD_HOLDER", "Card holder", "Porta-cartão", "Fina, só para cartões.",
  "porta cartão | porta cartões | carteira slim", "card holder | card case | slim wallet")
v("LONG_WALLET", "Long wallet", "Carteira longa", "Comprida, com zíper ou aba (continental).",
  "carteira longa | carteira feminina | continental", "long wallet | continental | zip around")
v("COIN_PURSE", "Coin purse", "Porta-moedas", "Porta-moedas.",
  "porta moedas | moedeira", "coin purse")
v("MONEY_CLIP", "Money clip", "Prendedor de notas", "Prendedor de dinheiro.",
  "prendedor de dinheiro | clipe de dinheiro", "money clip")

# ───────────── cintos, chapéus e cabeça
v("PIN_BUCKLE", "Pin buckle", "Fivela de pino", "Fivela tradicional com pino nos furos.",
  "fivela tradicional | cinto clássico | cinto social", "pin buckle | classic belt")
v("PLATE_BUCKLE", "Plate buckle", "Fivela placa", "Fivela em placa ou monograma, sem pino aparente.",
  "fivela placa | fivela logo | fivela de logo | monograma", "plate buckle | logo buckle")
v("D_RING", "D-ring", "Argola", "Fecha passando a ponta por duas argolas.",
  "argola | argola dupla", "d-ring | double ring")
v("BRAIDED_BELT", "Braided", "Trançado", "Tira trançada (couro ou elástico) que aceita a fivela em qualquer ponto.",
  "trançado | cinto trançado", "braided belt | woven belt")
v("CHAIN_BELT", "Chain", "Corrente", "Cinto de elos metálicos.",
  "cinto corrente | corrente", "chain belt")
v("WESTERN_BELT", "Western", "Country", "Couro trabalhado com fivela grande ornamentada.",
  "cinto country | cinto western | cinto cowboy", "western belt")
v("WIDE_BELT", "Wide/waist", "Faixa", "Largo, marcando a cintura sobre vestidos e casacos (obi/corset).",
  "cinto faixa | faixa | cinto largo | cinto corset | obi", "wide belt | waist belt | corset belt | obi")
v("WEB_BELT", "Web", "Lona", "Tira de lona/nylon com fivela de pressão ou de trava.",
  "cinto de lona | cinto militar | tático", "web belt | canvas belt | military belt")
v("REVERSIBLE_BELT", "Reversible", "Dupla face", "Duas faces de cor/acabamento com fivela giratória.",
  "dupla face | reversível | 2 em 1", "reversible belt")
v("BASEBALL_CAP", "Baseball", "Aba curva", "Copa firme de 6 gomos e aba curva.",
  "aba curva | boné de beisebol | boné estruturado", "baseball cap")
v("DAD_CAP", "Dad hat", "Dad hat", "Copa baixa e desestruturada, aba curva, ajuste de fivela/tira.",
  "dad hat | boné desestruturado", "dad hat | unstructured cap")
v("TRUCKER_CAP", "Trucker", "Trucker", "Frente de espuma e traseira de tela.",
  "trucker | boné de tela | boné caminhoneiro", "trucker hat | mesh cap")
v("FLAT_BRIM_CAP", "Flat brim", "Aba reta", "Copa alta e aba plana (snapback/fitted).",
  "aba reta | snapback | boné aba reta", "flat brim | snapback | fitted cap")
v("FIVE_PANEL", "Five-panel", "Five panel", "Copa baixa de 5 gomos, aba curta reta (camper).",
  "five panel | camper", "five panel | camp cap")
v("VISOR", "Visor", "Viseira", "Só a aba e a faixa, sem copa.",
  "viseira", "visor | sun visor")
v("MILITARY_CAP", "Military cap", "Quepe", "Copa reta achatada no topo e aba curta.",
  "boné militar | quepe", "military cap | cadet cap")
v("BUCKET_HAT", "Bucket hat", "Bucket", "Aba curta inclinada para baixo em toda a volta.",
  "bucket | chapéu bucket | pescador", "bucket hat | fisherman hat")
v("FEDORA", "Fedora", "Fedora", "Aba média, copa com vinco central e pinças na frente (de palha = panamá).",
  "fedora | panamá | panama | chapéu social", "fedora | panama")
v("BERET", "Beret", "Boina", "Redonda, macia e achatada, sem aba.",
  "boina | boina francesa", "beret")
v("FLAT_CAP", "Flat cap", "Boina inglesa", "Achatada com pequena aba frontal (inclui newsboy de gomos).",
  "boina inglesa | gatsby | newsboy | boina de aba", "flat cap | newsboy | ivy cap")
v("BOATER", "Boater", "Palheta", "Copa baixa e plana, aba reta, de palha rígida.",
  "palheta | boater", "boater | skimmer")
v("COWBOY_HAT", "Cowboy hat", "Chapéu country", "Aba larga curvada nas laterais e copa alta.",
  "chapéu country | chapéu de cowboy | chapéu de peão", "cowboy hat | western hat")
v("FLOPPY_HAT", "Floppy hat", "Aba larga", "Aba muito larga e mole.",
  "chapéu de praia | aba larga | floppy", "floppy hat | sun hat | wide brim")
v("TRILBY", "Trilby", "Trilby", "Como o fedora, mas com aba curta virada para baixo atrás.",
  "trilby", "trilby")
v("CLOCHE", "Cloche", "Cloche", "Em forma de sino, justo na cabeça (anos 20).",
  "cloche", "cloche")
v("BOWLER_HAT", "Bowler", "Chapéu coco", "Copa arredondada e rígida.",
  "chapéu coco | coco", "bowler | derby hat")
v("CUFFED_BEANIE", "Cuffed beanie", "Gorro com dobra", "Gorro com barra dobrada.",
  "gorro com dobra | gorro dobrado", "cuffed beanie | watch cap")
v("SLOUCHY_BEANIE", "Slouchy beanie", "Gorro caído", "Comprido, com sobra caída atrás.",
  "gorro caído | slouchy", "slouchy beanie")
v("FISHERMAN_BEANIE", "Fisherman beanie", "Gorro curto", "Curto, acima das orelhas.",
  "gorro curto | gorro pescador", "fisherman beanie | docker")
v("BALACLAVA", "Balaclava", "Balaclava", "Cobre cabeça e pescoço, com abertura no rosto.",
  "balaclava | touca ninja", "balaclava | ski mask")
v("LONG_SCARF", "Long scarf", "Cachecol", "Longo e retangular, enrolado no pescoço.",
  "cachecol | cachecol longo", "long scarf | oblong scarf")
v("SQUARE_SCARF", "Square scarf", "Lenço", "Lenço quadrado (seda, carré).",
  "lenço | lenço de seda | carré | foulard", "square scarf | silk scarf | foulard")
v("INFINITY_SCARF", "Infinity scarf", "Gola", "Tubo fechado, sem pontas (snood).",
  "gola | gola infinita | cachecol gola | snood", "infinity scarf | snood | loop scarf")
v("BANDANA", "Bandana", "Bandana", "Pequeno lenço quadrado de algodão, dobrado em triângulo.",
  "bandana", "bandana | kerchief")
v("BLANKET_SCARF", "Blanket scarf", "Xale", "Grande e largo, usado sobre os ombros (echarpe, estola).",
  "xale | manta | echarpe | estola | pashmina", "blanket scarf | shawl | wrap | stole")
v("SKINNY_SCARF", "Skinny scarf", "Twilly", "Tira estreita amarrada no pescoço ou na alça da bolsa.",
  "twilly | lenço fino | lencinho", "skinny scarf | twilly")
v("CLASSIC_TIE", "Classic tie", "Gravata tradicional", "Largura de 7–9 cm, ponta em V.",
  "gravata tradicional | gravata clássica", "classic tie | standard tie")
v("SLIM_TIE", "Slim tie", "Gravata slim", "Largura em torno de 6 cm.",
  "gravata slim", "slim tie")
v("SKINNY_TIE", "Skinny tie", "Gravata fina", "Largura em torno de 4–5 cm.",
  "gravata fina | gravata skinny", "skinny tie")
v("KNIT_TIE", "Knit tie", "Gravata de tricô", "Malha de tricô com ponta reta.",
  "gravata de tricô | gravata tricot", "knit tie")
v("ASCOT_TIE", "Ascot", "Plastrom", "Larga, presa sob a gola em trajes de gala.",
  "plastrom | plastron | ascot", "ascot | cravat")
v("BOLO_TIE", "Bolo tie", "Gravata country", "Cordão com ponteiras e ornamento deslizante.",
  "gravata country | bolo", "bolo tie")
v("SELF_TIE_BOW", "Self-tie", "Para dar nó", "Gravata-borboleta que se amarra à mão.",
  "para dar nó | de amarrar", "self tie | freestyle")
v("PRE_TIED_BOW", "Pre-tied", "Nó pronto", "Gravata-borboleta já atada, com regulador.",
  "nó pronto | pré atada", "pre tied")

# ───────────── óculos, joias e relógio
v("AVIATOR", "Aviator", "Aviador", "Lentes em gota, ponte dupla e armação de metal fina.",
  "aviador | piloto", "aviator | pilot")
v("WAYFARER", "Wayfarer", "Wayfarer", "Acetato com topo mais largo que a base (trapezoidal).",
  "wayfarer | trapezoidal", "wayfarer | d-frame")
v("ROUND_FRAME", "Round", "Redondo", "Lentes circulares.",
  "redondo | redonda", "round")
v("SQUARE_FRAME", "Square", "Quadrado", "Altura e largura parecidas, cantos retos.",
  "quadrado | quadrada", "square")
v("RECTANGLE_FRAME", "Rectangle", "Retangular", "Mais largo que alto, perfil estreito.",
  "retangular | estreito", "rectangle | rectangular | narrow")
v("CAT_EYE", "Cat eye", "Gatinho", "Cantos superiores externos levantados.",
  "gatinho | cat eye | olho de gato", "cat eye | cat-eye")
v("OVAL_FRAME", "Oval", "Oval", "Lentes ovais.",
  "oval", "oval")
v("BROWLINE", "Browline", "Clubmaster", "Parte superior grossa (sobrancelha) e inferior fina ou de metal.",
  "clubmaster | browline", "browline | clubmaster")
v("SHIELD", "Shield", "Máscara", "Lente única contínua cobrindo os dois olhos.",
  "máscara | lente única | shield", "shield | visor glasses")
v("WRAPAROUND", "Wraparound", "Envolvente", "Armação curva que envolve a lateral do rosto (esportivo).",
  "envolvente | curvado | esportivo", "wraparound | sport")
v("OVERSIZED_FRAME", "Oversized", "Lentes grandes", "Armação e lentes bem maiores que o rosto.",
  "lentes grandes | maxi óculos | oversized", "oversized | big lens")
v("GEOMETRIC_FRAME", "Geometric", "Geométrico", "Lentes poligonais (hexagonal, octogonal).",
  "hexagonal | octogonal | geométrico", "geometric | hexagonal | octagonal")
v("BUTTERFLY_FRAME", "Butterfly", "Borboleta", "Lentes grandes que se alargam na parte inferior externa.",
  "borboleta", "butterfly")
v("CHOKER", "Choker", "Choker", "Justo ao pescoço (gargantilha, 30–36 cm).",
  "choker | gargantilha", "choker | collar necklace")
v("PENDANT_NECKLACE", "Pendant", "Pingente", "Corrente com um pingente ou medalha.",
  "pingente | colar com pingente | medalha", "pendant necklace")
v("CHAIN_NECKLACE", "Chain", "Corrente", "Só a corrente (cartier, grumet, veneziana…).",
  "corrente | cordão", "chain necklace")
v("LAYERED_NECKLACE", "Layered", "Camadas", "Vários fios de comprimentos diferentes num só colar.",
  "colar de camadas | mix de correntes", "layered necklace | multi strand")
v("LARIAT", "Lariat", "Gravatinha", "Fio que forma um Y, com ponta pendente.",
  "gravatinha | colar y | lariat", "lariat | y necklace")
v("STATEMENT_NECKLACE", "Statement", "Maxi colar", "Grande e chamativo.",
  "maxi colar | maxicolar | colarão", "statement necklace | bib necklace")
v("TENNIS_NECKLACE", "Tennis", "Riviera", "Fileira contínua de pedras.",
  "riviera | colar riviera", "tennis necklace | riviera")
v("STRAND_NECKLACE", "Strand", "Fio de contas", "Contas ou pérolas enfiadas num fio.",
  "fio de pérolas | colar de contas | colar de pérolas", "strand | beaded necklace | pearl strand")
v("SCAPULAR", "Scapular", "Escapulário", "Dois pingentes ligados, um na frente e outro nas costas.",
  "escapulário", "scapular")
v("LOCKET", "Locket", "Relicário", "Pingente que abre para guardar foto.",
  "relicário", "locket")
v("BANGLE", "Bangle", "Bracelete", "Bracelete rígido fechado (argola).",
  "bracelete | pulseira rígida | argola", "bangle")
v("CUFF_BRACELET", "Cuff", "Bracelete aberto", "Bracelete rígido aberto.",
  "bracelete aberto | cuff", "cuff | cuff bracelet")
v("CHAIN_BRACELET", "Chain", "Elos", "Pulseira de corrente ou elos.",
  "pulseira de elos | corrente | grumet", "chain bracelet | link bracelet")
v("CHARM_BRACELET", "Charm", "Berloques", "Corrente com pingentes (charms).",
  "berloque | berloques | pulseira de berloques", "charm bracelet")
v("TENNIS_BRACELET", "Tennis", "Riviera", "Fileira contínua de pedras.",
  "riviera | pulseira riviera", "tennis bracelet")
v("BEADED_BRACELET", "Beaded", "Contas", "Contas ou miçangas.",
  "miçanga | miçangas | contas | pulseira de pedras", "beaded bracelet")
v("CORD_BRACELET", "Cord", "Fio", "Fio, couro ou macramê com nó corrediço.",
  "pulseira de fio | macramê | fitinha", "cord bracelet | friendship bracelet")
v("STUD", "Stud", "Ponto de luz", "Fixo no lóbulo, sem pendente.",
  "ponto de luz | botão | pino | brinco pequeno", "stud | solitaire stud")
v("HOOP", "Hoop", "Argola", "Argola.",
  "argola", "hoop")
v("HUGGIE", "Huggie", "Argolinha", "Argolinha justa ao lóbulo.",
  "argolinha | huggie", "huggie")
v("DROP", "Drop", "Pendente", "Pende abaixo do lóbulo (gota).",
  "pendente | gota | brinco pendurado | pêndulo", "drop | dangle")
v("CHANDELIER", "Chandelier", "Cascata", "Pendente grande, em camadas.",
  "cascata | lustre", "chandelier | cascade")
v("FRINGE_EARRING", "Fringe", "Franja", "Fios ou correntes finas pendentes.",
  "franja | brinco de franja", "fringe earring | tassel earring")
v("STATEMENT_EARRING", "Statement", "Maxi brinco", "Grande e chamativo, peça principal do look.",
  "maxi brinco | maxibrinco", "statement earring")
v("EAR_CUFF", "Ear cuff", "Ear cuff", "Abraça a cartilagem sem furo.",
  "ear cuff | piercing fake", "ear cuff")
v("CLIMBER", "Ear climber", "Ear climber", "Sobe pela borda da orelha a partir do furo.",
  "ear climber | brinco escalador | trepador", "climber | crawler")
v("THREADER", "Threader", "Brinco de fio", "Corrente fina que atravessa o furo e pende.",
  "brinco de fio", "threader")
v("SOLITAIRE", "Solitaire", "Solitário", "Uma pedra central em destaque.",
  "solitário", "solitaire")
v("BAND_RING", "Band", "Aliança", "Aro liso ou trabalhado, sem pedra central.",
  "aliança | aro | anel liso | anel fino", "band | stackable ring")
v("ENHANCER_RING", "Enhancer", "Aparador", "Usado junto da aliança ou do solitário.",
  "aparador", "enhancer | ring guard")
v("MIDI_RING", "Midi ring", "Anel de falange", "Usado acima da articulação do dedo.",
  "anel de falange | falange", "midi ring | knuckle ring")
v("SIGNET", "Signet", "Chevalier", "Face plana gravável (brasão, iniciais).",
  "chevalier | anel de selo | sinete", "signet ring")
v("COCKTAIL_RING", "Cocktail", "Maxi anel", "Grande, com pedra ou ornamento chamativo.",
  "maxi anel | anel coquetel", "cocktail ring | statement ring")
v("ETERNITY_RING", "Eternity", "Meia-aliança", "Fileira de pedras ao redor do aro.",
  "meia aliança | aliança cravejada | eternidade", "eternity ring | half eternity")
v("CLUSTER_RING", "Cluster", "Cluster", "Várias pedras pequenas agrupadas.",
  "cluster", "cluster ring")
v("OPEN_RING", "Open", "Ajustável", "Aro aberto com pontas que não se encontram.",
  "anel aberto | ajustável", "open ring | adjustable ring")
v("ANALOG_WATCH", "Analog", "Analógico", "Mostrador com ponteiros.",
  "analógico | de ponteiro", "analog")
v("DIGITAL_WATCH", "Digital", "Digital", "Visor numérico.",
  "digital", "digital")
v("ANADIGI_WATCH", "Ana-digi", "Anadigi", "Ponteiros e visor digital juntos.",
  "anadigi | analógico digital | híbrido", "ana-digi | hybrid")
v("SMARTWATCH", "Smartwatch", "Smartwatch", "Tela conectada ao celular.",
  "smartwatch | relógio inteligente", "smartwatch")
v("FIVE_FINGER", "Full-finger", "Cinco dedos", "Luva tradicional, com os cinco dedos.",
  "luva tradicional | luva de dedos", "full finger gloves")
v("FINGERLESS", "Fingerless", "Sem dedos", "Meio dedo, pontas dos dedos livres (mitene, no Brasil).",
  "sem dedos | meio dedo | mitene", "fingerless")
v("MITTEN", "Mitten", "Sem divisão", "Dedos juntos num só compartimento, polegar separado.",
  "luva sem divisão | luva inteiriça | mitten", "mitten | mittens")
v("CUSHIONED_SOCK", "Cushioned", "Atoalhada", "Sola felpuda acolchoada (esportiva).",
  "atoalhada | meia esportiva | felpuda", "cushioned | athletic sock | terry sock")
v("COMPRESSION_SOCK", "Compression", "Compressão", "Meia de compressão graduada.",
  "meia de compressão | compressiva", "compression sock")
v("TOE_SOCK", "Toe socks", "Dedinhos", "Cada dedo separado.",
  "meia de dedinho | meia dedos", "toe socks")
v("TIGHTS", "Tights", "Meia-calça", "Meia-calça da cintura aos pés.",
  "meia calça | meia-calça", "tights | pantyhose")
v("FISHNET", "Fishnet", "Arrastão", "Malha de rede aberta.",
  "arrastão | meia arrastão", "fishnet")
v("LEG_WARMER", "Leg warmer", "Polaina", "Tubo de malha da canela ao tornozelo, sem pé.",
  "polaina", "leg warmer")
v("SCRUNCHIE", "Scrunchie", "Xuxinha", "Elástico revestido de tecido franzido.",
  "xuxinha | chuchinha | scrunchie", "scrunchie")
v("CLAW_CLIP", "Claw clip", "Piranha", "Prendedor de garras com mola.",
  "piranha | presilha piranha", "claw clip | hair claw")
v("HEADBAND", "Headband", "Tiara", "Arco sobre a cabeça (no Brasil, 'tiara').",
  "tiara | arco", "headband | alice band")
v("BARRETTE", "Barrette", "Presilha", "Prendedor achatado com trava.",
  "presilha | fivela de cabelo", "barrette | hair clip")
v("DUCKBILL_CLIP", "Duckbill clip", "Bico de pato", "Presilha longa e fina de pressão.",
  "bico de pato | tic tac", "duckbill clip | snap clip")
v("HAIR_BOW", "Bow", "Laço", "Laço de cabelo.",
  "laço | laço de cabelo", "hair bow")
v("HAIR_TIE", "Hair tie", "Elástico", "Elástico simples.",
  "elástico de cabelo | liga", "hair tie | elastic")
v("HEAD_WRAP", "Head wrap", "Faixa/turbante", "Tecido amarrado na cabeça.",
  "faixa de cabelo | turbante | lenço de cabelo", "head wrap | turban | headscarf")
v("BOBBY_PIN", "Bobby pin", "Grampo", "Grampo.",
  "grampo", "bobby pin | hair pin")
v("FASCINATOR", "Fascinator", "Arranjo", "Adorno de festa preso no cabelo.",
  "arranjo | casquete | fascinator", "fascinator | headpiece")


# ───────────── subcategoria → variações (tier C/E/N + prioridade 1–5; 1 = aparece primeiro)
S = {}


def s(sub, spec):
    rows = []
    for tok in spec.split():
        code, tp = tok.split(":")
        rows.append((code, {"C": "CORE", "E": "EXTENDED", "N": "NICHE"}[tp[0]], int(tp[1])))
    assert sub not in S, sub
    S[sub] = rows


# upper_piece
s("t_shirt", "REGULAR:C1 SLIM:C1 OVERSIZED:C1 BOXY:C2 RELAXED:C2 BABY_TEE:C2 MUSCLE_FIT:E3 ATHLETIC_FIT:N4")
s("shirt", "REGULAR:C1 SLIM:C1 OVERSIZED:C2 RELAXED:C2 BOXY:E3 EXTRA_SLIM:E3 OVERSHIRT:E2 WESTERN_SHIRT:N4 TUXEDO_SHIRT:N4")
s("blouse", "SLIM:C2 RELAXED:C1 OVERSIZED:E3 WRAP:C2 PEPLUM:C3 PEASANT:C2 TUNIC:E3 BABYDOLL:E3 SMOCKED:E3 TIE_FRONT:E4 CORSET:N4")
s("tank_top", "REGULAR:C1 SLIM:C2 BOXY:E3 RACERBACK:C2 MUSCLE_TANK:C2 CAMISOLE:C1 DEEP_ARMHOLE:E3 STRAPPY:N4")
s("top", "CORSET:C1 BANDEAU:C1 SPORTS_BRA:C1 BRALETTE:C2 BUSTIER:E2 CUT_OUT:E3 TIE_FRONT:E3 DRAPED:N4")
s("polo_shirt", "REGULAR:C1 SLIM:C1 RELAXED:E3 OVERSIZED:E2 BOXY:N4 RUGBY:N4")
s("bodysuit", "SLIM:C1 CORSET:C2 CUT_OUT:E2 WRAP:E3 HIGH_CUT:E3 DRAPED:N4 SHAPING:E3")
s("sweater", "REGULAR:C1 SLIM:C1 OVERSIZED:C1 BOXY:C2 RELAXED:E2")
s("sweatshirt", "REGULAR:C1 OVERSIZED:C1 BOXY:C2 RELAXED:E2 SLIM:E3")
s("hoodie", "REGULAR:C1 OVERSIZED:C1 BOXY:C2 RELAXED:E2 SLIM:E3")
s("cardigan", "REGULAR:C1 SLIM:C2 OVERSIZED:C1 BOXY:E2 WRAP:E3 BOLERO:N4")
s("vest", "TAILORED_VEST:C1 PUFFER:C1 KNIT_VEST:C2 UTILITY:E2 QUILTED:E3")
s("blazer", "REGULAR:C1 SLIM:C1 OVERSIZED:C1 BOXY:E2 RELAXED:E3 UNSTRUCTURED:E3")
s("jacket", "BOMBER:C1 TRUCKER:C1 MOTO:C1 PUFFER:C1 VARSITY:C2 FIELD:C2 TRACK:C2 QUILTED:E2 CHORE:E3 "
            "AVIATOR_JACKET:E3 COACH:E3 HARRINGTON:N4 SAFARI:N4 NAPOLEON:N5")
s("coat", "TRENCH:C1 OVERCOAT:C1 PEACOAT:C2 PUFFER:C2 WRAP:E2 COCOON:E3 CAPE:E3 DUFFLE:N4 CAR_COAT:N4")
s("parka", "PUFFER:C1 SHELL:C1 FISHTAIL:E2 SNORKEL:N4")
s("windbreaker", "SHELL:C1 ANORAK:C1 RAIN_JACKET:C2 PACKABLE:E3")
s("kimono", "OPEN_FRONT:C1 BELTED:E2")
# lower_piece
s("jeans", "SKINNY:C1 SLIM:C1 STRAIGHT:C1 MOM:C1 WIDE_LEG:C1 FLARE:C2 BAGGY:C2 RELAXED:C2 BOOTCUT:E1 REGULAR:E2 "
           "TAPERED:E2 BOYFRIEND:E2 LOOSE:E3 DAD:E3 BARREL:E3 CARROT:E3 SKATER:E3 BALLOON:E4 BELL_BOTTOM:N4 "
           "GIRLFRIEND:N5 HORSESHOE:N5")
s("tailored_pants", "STRAIGHT:C1 SLIM:C1 WIDE_LEG:C1 PALAZZO:C2 CIGARETTE:C2 FLARE:C2 TAPERED:E2 CARROT:E2 "
                    "PAPERBAG:E3 BOOTCUT:E3 SKINNY:N4 BARREL:N4 SAILOR:N5")
s("casual_pants", "STRAIGHT:C1 SLIM:C1 WIDE_LEG:C1 RELAXED:C2 SKINNY:E2 FLARE:E2 PALAZZO:E2 BAGGY:E2 TAPERED:E3 "
                  "PARACHUTE:E3 PAPERBAG:E3 HAREM:N4")
s("chino_pants", "SLIM:C1 STRAIGHT:C1 REGULAR:C2 TAPERED:E2 RELAXED:E3 SKINNY:N4 WIDE_LEG:N4")
s("cargo_pants", "STRAIGHT:C1 RELAXED:C1 BAGGY:C1 WIDE_LEG:E2 CUFFED_HEM:E2 SLIM:E3 TAPERED:E3 PARACHUTE:E3")
s("jogger_pants", "REGULAR:C1 SLIM:C1 RELAXED:E2 HAREM:N4")
s("sweatpants", "CUFFED_HEM:C1 STRAIGHT:C1 WIDE_LEG:C2 BAGGY:E2 FLARE:E3 PALAZZO:N4")
s("leggings", "SKINNY:C1 FLARE:C1 STRAIGHT:E3 SEAMLESS:E2 COMPRESSION:E2 STIRRUP:N4")
s("culottes", "STRAIGHT:C1 A_LINE:C1 PAPERBAG:E2 GAUCHO:N4 WRAP:N4")
s("shorts", "STRAIGHT:C1 MOM:C1 RELAXED:C2 BIKER:C2 SLIM:E3 BAGGY:E2 BOYFRIEND:E3 CARGO:E2 PAPERBAG:E3 A_LINE:E3")
s("skirt", "A_LINE:C1 PENCIL:C1 STRAIGHT:C2 CIRCLE:C1 PLEATED:C1 WRAP:C2 SLIP:E2 TIERED:E2 MERMAID:E3 "
           "GATHERED:E3 BALLOON:N4 TULIP:N4 CARGO:N4 TUTU:N5")
s("skort", "A_LINE:C1 PLEATED:C1 WRAP:E2 STRAIGHT:E3")
# full_body_piece
s("dress", "SHEATH:C1 A_LINE:C1 FIT_AND_FLARE:C1 SLIP:C1 WRAP:C2 SHIRT_DRESS:C2 BODYCON:C2 SHIFT:C2 T_SHIRT_DRESS:E2 "
           "TIERED:E2 BABYDOLL:E2 SMOCKED:E3 EMPIRE:E3 MERMAID:E3 CORSET:E3 KAFTAN:E3 TRAPEZE:N4 BLAZER_DRESS:N4 "
           "PINAFORE:N4 BALL_GOWN:N4 CUT_OUT:N4 PEPLUM:N5 BALLOON:N5")
s("jumpsuit", "WIDE_LEG:C1 STRAIGHT:C1 BOILERSUIT:C2 PALAZZO:E2 FLARE:E2 WRAP:E3 CUFFED_HEM:E3 SLIM:E3 CUT_OUT:N4")
s("romper", "RELAXED:C1 WRAP:C1 SMOCKED:E2 SLIM:E2 A_LINE:E3 BOILERSUIT:N4")
s("matching_set", "TOP_AND_PANTS:C1 TOP_AND_SKIRT:C1 TOP_AND_SHORTS:C1 SUIT:C1 TRACKSUIT:C2 THREE_PIECE:N4")
s("overalls", "STRAIGHT:C1 RELAXED:C1 WIDE_LEG:E2 BAGGY:E2 SLIM:E3 CARPENTER:E3")
# shoes_piece
s("casual_sneakers", "COURT:C1 VULCANIZED:C1 RETRO_RUNNER:C1 DAD_SNEAKER:C2 TERRACE:C2 DRESS_SNEAKER:E2 TECH_RUNNER:E3 "
                     "SOCK_SNEAKER:E3 SNEAKER_BOOT:N4")
s("running_shoes", "NEUTRAL:C1 STABILITY:C1 TRAIL:C1 MAX_CUSHION:E2 RACING:E2 TRACK_SPIKE:N4 MINIMALIST:N4")
s("training_shoes", "CROSS_TRAINING:C1 WALKING:E2 WEIGHTLIFTING:E3")
s("basketball_shoes", "PERFORMANCE:C1 HERITAGE:C1")
s("skate_shoes", "VULCANIZED:C1 CUPSOLE:C1")
s("loafers", "PENNY:C1 HORSEBIT:C1 TASSEL:E2 VENETIAN:E2 SLIPPER:E3 BELGIAN:N4")
s("moccasins", "TRUE_MOC:C1 DRIVER:C1 BOAT_SHOE:C1")
s("oxford_shoes", "PLAIN_TOE:C1 CAP_TOE:C1 WINGTIP:C1 SEMI_BROGUE:E2 WHOLECUT:E3 SADDLE_SHOE:N4")
s("derby_shoes", "PLAIN_TOE:C1 CAP_TOE:E2 WINGTIP:E2 APRON_TOE:E3 MONK_STRAP:E3")
s("boots", "CHELSEA:C1 COMBAT:C1 WESTERN:C1 WORK_BOOT:C2 RIDING:C2 CHUKKA:E2 HIKING:E2 SOCK_BOOT:E3 ENGINEER:E3 "
           "SLOUCH:E3 RAIN_BOOT:E3 SNOW_BOOT:N4")
s("sandals", "STRAPPY:C1 ANKLE_STRAP:C1 SPORT_SANDAL:C1 FOOTBED:C2 MULE:C2 GLADIATOR:E2 FISHERMAN:E3 T_STRAP:E3 CLOG:E3")
s("flip_flops", "THONG:C1 SLIDE:C1")
s("heels", "PUMP:C1 SLINGBACK:C1 MULE:C1 MARY_JANE:C2 ANKLE_STRAP:E2 D_ORSAY:E3")
s("flats", "BALLET:C1 MARY_JANE:C1 MULE:C2 SLINGBACK:E2 SLIPPER:E3 D_ORSAY:N4")
s("espadrilles", "CLASSIC_ESPADRILLE:C1 LACE_UP_ESPADRILLE:E2 MULE:E2")
# accessory_piece
s("handbag", "TOP_HANDLE:C1 SHOPPER:C1 HOBO:C1 BUCKET_BAG:C1 BAGUETTE:C2 SATCHEL:C2 CAMERA_BAG:C2 BELT_BAG:C2 "
             "SADDLE_BAG:E2 HALF_MOON_BAG:E2 BOX_BAG:E3 MESSENGER_BAG:E3 PHONE_BAG:E3 SLING_BAG:E3 BOWLER_BAG:E3 "
             "BASKET_BAG:E3 DUFFLE_BAG:E3 DOCTOR_BAG:N4 FRAME_BAG:N4")
s("tote_bag", "SHOPPER:C1 STRUCTURED_TOTE:C1 SLOUCHY_TOTE:E2 EAST_WEST_TOTE:N4")
s("clutch", "ENVELOPE_CLUTCH:C1 POUCH:C1 MINAUDIERE:E2 WRISTLET:E3 FOLDOVER:E3")
s("backpack", "DAYPACK:C1 LAPTOP_BACKPACK:C1 GYMSACK:C2 ROLLTOP:E2 RUCKSACK:E3 CONVERTIBLE_BACKPACK:E3 HIKING_PACK:E3")
s("belt", "PIN_BUCKLE:C1 PLATE_BUCKLE:C1 BRAIDED_BELT:C2 WIDE_BELT:C2 D_RING:E2 WEB_BELT:E2 WESTERN_BELT:E3 "
          "CHAIN_BELT:E3 REVERSIBLE_BELT:E3")
s("cap", "BASEBALL_CAP:C1 DAD_CAP:C1 FLAT_BRIM_CAP:C1 TRUCKER_CAP:C2 FIVE_PANEL:E3 VISOR:E3 MILITARY_CAP:N4")
s("hat", "BUCKET_HAT:C1 FEDORA:C1 BERET:C2 FLOPPY_HAT:C2 FLAT_CAP:E2 COWBOY_HAT:E2 BOATER:E3 TRILBY:E3 CLOCHE:N4 "
         "BOWLER_HAT:N5")
s("beanie", "CUFFED_BEANIE:C1 SLOUCHY_BEANIE:C1 FISHERMAN_BEANIE:E2 BALACLAVA:E3")
s("scarf", "LONG_SCARF:C1 SQUARE_SCARF:C1 BLANKET_SCARF:C2 INFINITY_SCARF:E2 BANDANA:E2 SKINNY_SCARF:E3")
s("tie", "CLASSIC_TIE:C1 SLIM_TIE:C1 SKINNY_TIE:E2 KNIT_TIE:E3 ASCOT_TIE:N4 BOLO_TIE:N5")
s("bow_tie", "PRE_TIED_BOW:C1 SELF_TIE_BOW:C1")
s("sunglasses", "AVIATOR:C1 WAYFARER:C1 SQUARE_FRAME:C1 ROUND_FRAME:C1 CAT_EYE:C1 RECTANGLE_FRAME:C2 "
                "OVERSIZED_FRAME:C2 SHIELD:E2 BROWLINE:E2 OVAL_FRAME:E3 WRAPAROUND:E3 GEOMETRIC_FRAME:E3 "
                "BUTTERFLY_FRAME:N4")
s("eyeglasses", "RECTANGLE_FRAME:C1 ROUND_FRAME:C1 SQUARE_FRAME:C1 WAYFARER:C2 CAT_EYE:C2 OVAL_FRAME:C2 "
                "BROWLINE:E2 AVIATOR:E3 GEOMETRIC_FRAME:E3 OVERSIZED_FRAME:E3")
s("necklace", "CHAIN_NECKLACE:C1 PENDANT_NECKLACE:C1 CHOKER:C1 LAYERED_NECKLACE:C2 STRAND_NECKLACE:E2 "
              "TENNIS_NECKLACE:E2 LARIAT:E3 STATEMENT_NECKLACE:E3 SCAPULAR:E3 LOCKET:N4")
s("bracelet", "CHAIN_BRACELET:C1 BANGLE:C1 CUFF_BRACELET:C2 BEADED_BRACELET:C2 CHARM_BRACELET:E2 "
              "TENNIS_BRACELET:E2 CORD_BRACELET:E3")
s("earrings", "STUD:C1 HOOP:C1 DROP:C1 HUGGIE:C2 CHANDELIER:E2 EAR_CUFF:E2 STATEMENT_EARRING:E3 FRINGE_EARRING:E3 "
              "CLIMBER:N4 THREADER:N4")
s("ring", "BAND_RING:C1 SOLITAIRE:C1 SIGNET:E2 COCKTAIL_RING:E2 OPEN_RING:E2 ETERNITY_RING:E3 MIDI_RING:E3 "
          "ENHANCER_RING:N4 CLUSTER_RING:N4")
s("watch", "ANALOG_WATCH:C1 DIGITAL_WATCH:C1 SMARTWATCH:C1 ANADIGI_WATCH:E3")
s("wallet", "BIFOLD:C1 CARD_HOLDER:C1 LONG_WALLET:C1 TRIFOLD:E2 COIN_PURSE:E3 MONEY_CLIP:N4")
s("gloves", "FIVE_FINGER:C1 FINGERLESS:E2 MITTEN:E3")
s("socks", "CUSHIONED_SOCK:C2 TIGHTS:C1 COMPRESSION_SOCK:E2 FISHNET:E3 TOE_SOCK:N4 LEG_WARMER:N4")
s("hair_accessory", "SCRUNCHIE:C1 CLAW_CLIP:C1 HEADBAND:C1 BARRETTE:C1 HAIR_BOW:C2 DUCKBILL_CLIP:E2 HAIR_TIE:E2 "
                    "HEAD_WRAP:E2 BOBBY_PIN:N4 FASCINATOR:N4")
