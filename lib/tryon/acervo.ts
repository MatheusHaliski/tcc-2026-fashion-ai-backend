/*
 * Acervo FashionAI usado nas provas do provador 3D (PROVADOR-3D): peças reais de public/assets_pecas, identificadas pela
 * chave estável do asset (o nome em public/_derived/pecas_thumb, sem o tamanho). Dados puros — o laboratório e os testes
 * usam a mesma lista.
 */
import type { Look3dPiece } from "@/components/three/common";

/** Peça do acervo FashionAI (id = nome do asset em public/_derived/pecas_thumb, sem tamanho). */
export interface AcervoPiece { id: string; category: string; subcategory: string; family: string }
const A = (id: string, category: string, subcategory: string, family: string): AcervoPiece => ({ id, category, subcategory, family });

/** Todas as peças vestíveis do acervo (acessórios ficam de fora: sem molde 3D — ver ACERVO_SEM_3D). */
export const ACERVO: AcervoPiece[] = [
  A("01_parte_superior_01_camiseta_referencia", "upper_piece", "t_shirt", "superior"),
  A("01_parte_superior_02_shirt_camisa", "upper_piece", "shirt", "superior"),
  A("01_parte_superior_03_blouse_blusa", "upper_piece", "blouse", "superior"),
  A("01_parte_superior_04_tank_top_regata", "upper_piece", "tank_top", "superior"),
  A("01_parte_superior_05_crop_top_cropped", "upper_piece", "crop_top", "superior"),
  A("01_parte_superior_06_polo_shirt_camisa_polo", "upper_piece", "polo_shirt", "superior"),
  A("01_parte_superior_07_bodysuit_body", "upper_piece", "bodysuit", "superior"),
  A("01_parte_superior_08_sweater_sueter", "upper_piece", "sweater", "superior"),
  A("01_parte_superior_09_sweatshirt_moletom_sem_capuz", "upper_piece", "sweatshirt", "superior"),
  A("01_parte_superior_10_hoodie_moletom_com_capuz", "upper_piece", "hoodie", "superior"),
  A("01_parte_superior_11_cardigan", "upper_piece", "cardigan", "sobreposicao"),
  A("01_parte_superior_12_vest_colete", "upper_piece", "vest", "sobreposicao"),
  A("01_parte_superior_13_blazer", "upper_piece", "blazer", "sobreposicao"),
  A("01_parte_superior_14_jacket_jaqueta", "upper_piece", "jacket", "sobreposicao"),
  A("01_parte_superior_15_coat_casaco", "upper_piece", "coat", "sobreposicao"),
  A("01_parte_superior_16_parka", "upper_piece", "parka", "sobreposicao"),
  A("01_parte_superior_17_windbreaker_corta_vento", "upper_piece", "windbreaker", "sobreposicao"),
  A("01_parte_superior_18_kimono_quimono", "upper_piece", "kimono", "sobreposicao"),
  A("02_parte_inferior_01_jeans", "lower_piece", "jeans", "inferior"),
  A("02_parte_inferior_02_calca_casual", "lower_piece", "casual_pants", "inferior"),
  A("02_parte_inferior_03_calca_alfaiataria", "lower_piece", "tailored_pants", "inferior"),
  A("02_parte_inferior_04_calca_cargo", "lower_piece", "cargo_pants", "inferior"),
  A("02_parte_inferior_05_calca_chino", "lower_piece", "chino_pants", "inferior"),
  A("02_parte_inferior_06_calca_moletom", "lower_piece", "sweatpants", "inferior"),
  A("02_parte_inferior_07_calca_jogger", "lower_piece", "jogger_pants", "inferior"),
  A("02_parte_inferior_08_legging", "lower_piece", "leggings", "inferior"),
  A("02_parte_inferior_09_pantacourt", "lower_piece", "culottes", "inferior"),
  A("02_parte_inferior_10_bermuda", "lower_piece", "bermuda_shorts", "inferior"),
  A("02_parte_inferior_11_shorts_jeans", "lower_piece", "denim_shorts", "inferior"),
  A("02_parte_inferior_12_saia", "lower_piece", "skirt", "inferior"),
  A("02_parte_inferior_13_shorts", "lower_piece", "shorts", "inferior"),
  A("02_parte_inferior_14_short_saia", "lower_piece", "skort", "inferior"),
  A("05_corpo_inteiro_01_vestido", "full_body_piece", "dress", "peca-inteira"),
  A("05_corpo_inteiro_02_macacao", "full_body_piece", "jumpsuit", "peca-inteira"),
  A("05_corpo_inteiro_03_macaquinho", "full_body_piece", "romper", "peca-inteira"),
  A("05_corpo_inteiro_04_conjunto_coordenado", "full_body_piece", "matching_set", "peca-inteira"),
  A("05_corpo_inteiro_05_jardineira", "full_body_piece", "overalls", "peca-inteira"),
  A("03_calcados_01_tenis_casual", "shoes_piece", "casual_sneakers", "calcado"),
  A("03_calcados_02_tenis_corrida", "shoes_piece", "running_shoes", "calcado"),
  A("03_calcados_05_loafer", "shoes_piece", "loafers", "calcado"),
  A("03_calcados_09_oxford", "shoes_piece", "oxford_shoes", "calcado"),
  A("03_calcados_11_bota_cano_curto", "shoes_piece", "ankle_boots", "calcado"),
  A("03_calcados_12_bota_cano_longo", "shoes_piece", "long_boots", "calcado"),
  A("03_calcados_14_coturno", "shoes_piece", "combat_boots", "calcado"),
  A("03_calcados_13_sandalia", "shoes_piece", "sandals", "calcado"),
  A("03_calcados_16_salto_alto", "shoes_piece", "heels", "calcado"),
];

/** Acessórios do acervo: sem molde 3D no corpo humano (prévia 2D) — lacuna registrada, não "coberta". */
export const ACERVO_SEM_3D: AcervoPiece[] = [
  "04_acessorios_01_bolsa_transversal:crossbody_bag", "04_acessorios_02_bolsa_mao:handbag", "04_acessorios_03_clutch:clutch", "04_acessorios_04_tote:tote_bag",
  "04_acessorios_05_mochila:backpack", "04_acessorios_06_cinto:belt", "04_acessorios_07_bone:cap", "04_acessorios_08_chapeu:hat", "04_acessorios_09_gorro:beanie",
  "04_acessorios_10_cachecol:scarf", "04_acessorios_11_gravata:tie", "04_acessorios_12_gravata_borboleta:bow_tie", "04_acessorios_13_oculos_sol:sunglasses",
  "04_acessorios_14_oculos_grau:eyeglasses", "04_acessorios_15_colar:necklace", "04_acessorios_16_pulseira:bracelet", "04_acessorios_17_brincos:earrings",
  "04_acessorios_18_anel:ring", "04_acessorios_19_relogio:watch", "04_acessorios_20_luvas:gloves", "04_acessorios_21_meias:socks", "04_acessorios_22_acessorio_cabelo:hair_accessory",
].map((s) => { const [id, sub] = s.split(":"); return A(id, "accessory_piece", sub, "acessorio"); });


/** A peça do acervo como peça vestível no 3D (foto WebP de 640 px com fundo transparente). */
export function acervoLook(p: AcervoPiece): Look3dPiece {
  return { id: p.id, name: p.id, slot: p.category, category: p.category, subcategory: p.subcategory, imageUrl: `/_derived/pecas_thumb/${p.id}-640.webp` };
}
