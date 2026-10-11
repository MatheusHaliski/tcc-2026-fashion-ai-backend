package br.com.fashionai.application.photoedit;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * RF15 · Lista branca por alvo (doc §4). A canônica é a verdade da peça: só operações fiéis e com limites. A versão de
 * apresentação aceita também filtros criativos, sempre rotulada. Operação generativa (inpainting, troca de cor,
 * reiluminação, super-resolução, ghost mannequin, espelhamento) não existe na receita: nenhum alvo a aceita aqui.
 */
public final class RecipePolicy {
    public static final double MAX_STRAIGHTEN_DEG = 15;
    public static final double MAX_PERSPECTIVE_SHIFT = 0.15;
    public static final double MAX_EXPOSURE_EV = 2;
    public static final double MAX_CANONICAL_SATURATION = 15;
    public static final double MAX_CANONICAL_CONTRAST = 50;
    public static final double MAX_CANONICAL_SHARPEN = 0.3;
    public static final double MAX_HEAL_AREA = 0.01;
    public static final double ASPECT_4_5 = 0.8;
    public static final double MAX_CANONICAL_BLACK = 0.1, MIN_CANONICAL_WHITE = 0.9, MIN_CANONICAL_GAMMA = 0.8, MAX_CANONICAL_GAMMA = 1.25;
    static final Set<String> CANONICAL_OPS = Set.of("rotate90", "straighten", "perspective", "flip", "crop", "background", "whiteBalance",
            "tone", "levels", "heal", "sharpen");

    private RecipePolicy() {
    }

    /**
     * @param heightOverWidth proporção da imagem no ponto do retoque (para converter o raio relativo à largura em área)
     * @return motivos de recusa (vazio = receita aceita)
     */
    public static List<String> violations(PhotoRecipe recipe, double heightOverWidth) {
        return violations(recipe, heightOverWidth, false);
    }

    /**
     * @param textOrLogo o servidor achou texto ou logo na peça: espelhar inverteria a marca — recusado na canônica (a
     *                   apresentação aceita com aviso)
     */
    public static List<String> violations(PhotoRecipe recipe, double heightOverWidth, boolean textOrLogo) {
        List<String> v = new ArrayList<>();
        boolean canonical = recipe.target() == PhotoRecipe.Target.CANONICAL;
        boolean cropped = false;
        double healed = 0;
        for (PhotoRecipe.Op op : recipe.ops()) {
            if (canonical && !CANONICAL_OPS.contains(op.name())) {
                v.add("OPERACAO_SO_NA_APRESENTACAO:" + op.name());
            }
            switch (op) {
                case PhotoRecipe.Rotate90 r -> {
                    if (r.turns() < 1 || r.turns() > 3) {
                        v.add("GIRO_INVALIDO");
                    }
                }
                case PhotoRecipe.Straighten s -> {
                    if (Math.abs(s.deg()) > MAX_STRAIGHTEN_DEG) {
                        v.add("ENDIREITAR_ALEM_DE_15_GRAUS");
                    }
                }
                case PhotoRecipe.Flip f -> {
                    if (canonical && textOrLogo) {
                        v.add("ESPELHAR_INVERTE_TEXTO_OU_LOGO");
                    }
                }
                case PhotoRecipe.Levels l -> {
                    if (l.black() < 0 || l.white() > 1 || l.black() >= l.white() - 0.05 || l.gamma() < 0.3 || l.gamma() > 3) {
                        v.add("NIVEIS_INVALIDOS");
                    } else if (canonical && (l.black() > MAX_CANONICAL_BLACK || l.white() < MIN_CANONICAL_WHITE
                            || l.gamma() < MIN_CANONICAL_GAMMA || l.gamma() > MAX_CANONICAL_GAMMA)) {
                        v.add("NIVEIS_FORTE_DEMAIS");
                    }
                }
                case PhotoRecipe.Perspective p -> {
                    double[][] corners = {{0, 0}, {1, 0}, {1, 1}, {0, 1}};
                    for (int i = 0; i < 4; i++) {
                        double[] q = p.quad()[i];
                        if (q[0] < -0.01 || q[0] > 1.01 || q[1] < -0.01 || q[1] > 1.01
                                || Math.hypot(q[0] - corners[i][0], q[1] - corners[i][1]) > MAX_PERSPECTIVE_SHIFT * Math.sqrt(2) + 1e-9) {
                            v.add("PERSPECTIVA_FORTE_DEMAIS");
                            break;
                        }
                    }
                }
                case PhotoRecipe.Crop c -> {
                    cropped = true;
                    if (c.w() <= 0.02 || c.h() <= 0.02 || c.x() < -1e-6 || c.y() < -1e-6 || c.x() + c.w() > 1 + 1e-6 || c.y() + c.h() > 1 + 1e-6) {
                        v.add("RECORTE_FORA_DA_FOTO");
                    }
                    // canônica: quadro 4:5 (Enquadramento) ou a janela livre que a pessoa marcou (Recorte, aspect "FREE");
                    // sem aspect declarado continua recusada — o recorte da canônica é sempre uma escolha explícita
                    if (canonical && !"4:5".equals(c.aspect()) && !"FREE".equals(c.aspect())) {
                        v.add("CANONICA_EXIGE_QUADRO_4_5");
                    }
                }
                case PhotoRecipe.Background b -> {
                    if (b.feather() < 0 || b.feather() > PhotoRecipe.MAX_FEATHER) {
                        v.add("BORDA_INVALIDA");
                    }
                    for (PhotoRecipe.Stroke s : b.strokes()) {
                        if (!"ADD".equals(s.mode()) && !"REMOVE".equals(s.mode()) || s.r() <= 0 || s.r() > 0.2) {
                            v.add("PINCELADA_INVALIDA");
                            break;
                        }
                    }
                }
                case PhotoRecipe.WhiteBalance w -> {
                    if (w.x() < 0 || w.x() > 1 || w.y() < 0 || w.y() > 1) {
                        v.add("AMOSTRA_FORA_DA_FOTO");
                    }
                }
                case PhotoRecipe.Tone t -> {
                    if (Math.abs(t.exposureEv()) > MAX_EXPOSURE_EV) {
                        v.add("EXPOSICAO_ALEM_DE_2_EV");
                    }
                    for (double x : new double[]{t.highlights(), t.shadows(), t.contrast(), t.saturation()}) {
                        if (Math.abs(x) > 100) {
                            v.add("AJUSTE_FORA_DE_-100_100");
                            break;
                        }
                    }
                    if (canonical && Math.abs(t.saturation()) > MAX_CANONICAL_SATURATION) {
                        v.add("SATURACAO_ALTERA_A_COR_DA_PECA");
                    }
                    if (canonical && Math.abs(t.contrast()) > MAX_CANONICAL_CONTRAST) {
                        v.add("CONTRASTE_FORTE_DEMAIS");
                    }
                }
                case PhotoRecipe.Heal h -> healed += h.area(heightOverWidth);
                case PhotoRecipe.Sharpen s -> {
                    if (s.amount() < 0 || s.amount() > 1 || canonical && s.amount() > MAX_CANONICAL_SHARPEN) {
                        v.add("NITIDEZ_FORTE_DEMAIS");
                    }
                }
                case PhotoRecipe.Filter f -> {
                    if (!Set.of("WARM", "COOL", "MONO", "VINTAGE").contains(f.style()) || f.strength() < 0 || f.strength() > 1) {
                        v.add("FILTRO_INVALIDO");
                    }
                }
            }
        }
        if (canonical && healed > MAX_HEAL_AREA) {
            v.add("RETOQUE_ALEM_DE_1_PORCENTO");
        }
        if (canonical && !cropped) {
            v.add("CANONICA_EXIGE_QUADRO_4_5");
        }
        return v.stream().distinct().toList();
    }
}
