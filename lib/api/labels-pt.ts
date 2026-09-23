/**
 * Rótulos em português das chaves da taxonomia (ocasiões, estilos, cores, materiais, subcategorias, estado, estação,
 * humor, visibilidade, selos). A API guarda as chaves em inglês; a interface em pt-BR mostra estes rótulos.
 */
export const PT_LABELS: Record<string, string> = {
  // categorias
  upper_piece: "Parte superior", lower_piece: "Parte inferior", shoes_piece: "Calçados", accessory_piece: "Acessórios", full_body_piece: "Peça única",
  // ocasiões
  casual: "Casual", work: "Trabalho", business: "Negócios", formal: "Formal", party: "Festa", night_out: "Noite", date: "Encontro", wedding: "Casamento",
  ceremony: "Cerimônia", sport: "Esporte", gym: "Academia", travel: "Viagem", beach: "Praia", vacation: "Férias", school: "Escola", university: "Faculdade",
  social: "Social", home: "Casa", outdoor: "Ao ar livre", festival: "Festival", livre: "Livre",
  // estilos
  classic: "Clássico", minimalist: "Minimalista", modern: "Moderno", chic: "Chique", streetwear: "Streetwear", sporty: "Esportivo", athleisure: "Athleisure",
  preppy: "Preppy", romantic: "Romântico", boho: "Boho", vintage: "Vintage", grunge: "Grunge", edgy: "Ousado", glam: "Glam", luxury: "Luxo",
  avant_garde: "Vanguarda", y2k: "Y2K", utility: "Utilitário", techwear: "Techwear", tailored: "Alfaiataria", urban: "Urbano", resort: "Resort", basic: "Básico",
  statement: "Marcante", futuristic: "Futurista",
  // cores
  black: "Preto", charcoal: "Grafite", washed_black: "Preto lavado", white: "Branco", off_white: "Off-white", ivory: "Marfim", cream: "Creme",
  light_gray: "Cinza-claro", gray: "Cinza", dark_gray: "Cinza-escuro", silver: "Prata", blue: "Azul", navy: "Azul-marinho", light_blue: "Azul-claro",
  sky_blue: "Azul-céu", cobalt: "Cobalto", denim: "Jeans", teal: "Azul-petróleo", red: "Vermelho", crimson: "Carmim", burgundy: "Bordô", maroon: "Vinho",
  rust: "Ferrugem", pink: "Rosa", hot_pink: "Pink", rose: "Rosé", coral: "Coral", salmon: "Salmão", orange: "Laranja", terracotta: "Terracota",
  amber: "Âmbar", apricot: "Damasco", yellow: "Amarelo", mustard: "Mostarda", gold: "Dourado", butter: "Amarelo-manteiga", green: "Verde", olive: "Oliva",
  military_green: "Verde-militar", forest_green: "Verde-floresta", mint: "Menta", sage: "Sálvia", emerald: "Esmeralda", purple: "Roxo", violet: "Violeta",
  lilac: "Lilás", lavender: "Lavanda", plum: "Ameixa", brown: "Marrom", chocolate: "Chocolate", camel: "Caramelo", tan: "Castanho", beige: "Bege",
  taupe: "Fendi", metallic_gold: "Dourado metálico", metallic_silver: "Prata metálico", bronze: "Bronze", multicolor: "Multicolorido", print: "Estampado",
  // materiais
  cotton: "Algodão", polyester: "Poliéster", wool: "Lã", silk: "Seda", leather: "Couro", synthetic: "Sintético", blend: "Misto", linen: "Linho",
  // subcategorias
  ankle_boots: "Bota curta", backpack: "Mochila", basketball_shoes: "Tênis de basquete", beanie: "Gorro", belt: "Cinto", bermuda_shorts: "Bermuda",
  blazer: "Blazer", blouse: "Blusa", bodysuit: "Body", bow_tie: "Gravata-borboleta", bracelet: "Pulseira", cap: "Boné", cardigan: "Cardigã",
  cargo_pants: "Calça cargo", casual_pants: "Calça casual", casual_sneakers: "Tênis casual", chino_pants: "Calça chino", clutch: "Clutch", coat: "Casaco",
  combat_boots: "Coturno", crop_top: "Cropped", crossbody_bag: "Bolsa transversal", culottes: "Pantacourt", denim_shorts: "Short jeans", derby_shoes: "Sapato derby",
  dress: "Vestido", earrings: "Brincos", espadrilles: "Alpargata", eyeglasses: "Óculos de grau", flats: "Sapatilha", flip_flops: "Chinelo", gloves: "Luvas",
  hair_accessory: "Acessório de cabelo", handbag: "Bolsa de mão", hat: "Chapéu", heels: "Salto", high_top_sneakers: "Tênis cano alto", hoodie: "Moletom com capuz",
  jacket: "Jaqueta", jeans: "Calça jeans", jogger_pants: "Calça jogger", jumpsuit: "Macacão", kimono: "Quimono", leggings: "Legging", loafers: "Mocassim loafer",
  long_boots: "Bota cano longo", matching_set: "Conjunto", moccasins: "Mocassim", necklace: "Colar", overalls: "Jardineira", oxford_shoes: "Sapato oxford",
  parka: "Parka", polo_shirt: "Camisa polo", ring: "Anel", romper: "Macaquinho", running_shoes: "Tênis de corrida", sandals: "Sandália", scarf: "Cachecol",
  shirt: "Camisa", shorts: "Short", skate_shoes: "Tênis de skate", skirt: "Saia", skort: "Short-saia", socks: "Meias", sunglasses: "Óculos de sol",
  sweater: "Suéter", sweatpants: "Calça de moletom", sweatshirt: "Moletom", t_shirt: "Camiseta", tailored_pants: "Calça de alfaiataria", tank_top: "Regata",
  tie: "Gravata", tote_bag: "Bolsa tote", training_shoes: "Tênis de treino", vest: "Colete", watch: "Relógio", windbreaker: "Corta-vento",
  // estado, sexo, estação, humor, visibilidade
  new: "Novo", like_new: "Seminovo", good: "Bom", fair: "Regular", worn: "Desgastado", poor: "Desgastado",
  masculino: "Masculino", feminino: "Feminino", unissex: "Unissex", male: "Masculino", female: "Feminino", unisex: "Unissex",
  spring: "Primavera", summer: "Verão", autumn: "Outono", winter: "Inverno",
  relaxado: "Relaxado", confiante: "Confiante", romantico: "Romântico", ousado: "Ousado", elegante: "Elegante", criativo: "Criativo", energico: "Enérgico",
  energetic: "Enérgico", elegant: "Elegante", comfortable: "Confortável", sophisticated: "Sofisticado",
  public: "Público", private: "Privado", followers: "Seguidores",
  // selos
  premium: "Premium", "eco-friendly": "Sustentável", trending: "Em alta", "limited-edition": "Edição limitada", exclusive: "Exclusivo", "budget-friendly": "Bom preço",
  "casual-chic": "Casual chique", "affordable-chic": "Chique acessível", "premium-look": "Visual premium", "eco-conscious": "Consciente", "trendy-combo": "Combinação em alta",
  "casual-elegance": "Elegância casual",
};
