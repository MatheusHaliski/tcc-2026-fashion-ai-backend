package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.application.imaging.ImageProviderPorts.StudioShotPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.UpscalePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * RF4 · Estúdio — depois do Flat Lay, leva a foto da peça a um acabamento de foto de produto de estúdio:
 * <ol>
 *   <li><b>NITIDEZ</b>: ampliação (Stability Upscale ou bicúbica progressiva) + contraste local ("clarity"), nitidez
 *       e vibração só na peça;</li>
 *   <li><b>VOLUME_LUZ</b>: campo de altura a partir da silhueta → normais → luz de estúdio vinda de cima à esquerda
 *       e luz de borda, para a peça ganhar volume;</li>
 *   <li><b>FUNDO_ESTUDIO</b>: gradiente radial numa cor que contrasta com a peça (peça clara → azul royal);</li>
 *   <li><b>SOMBRA</b>: sombra projetada suave + sombra de contato;</li>
 *   <li><b>COMPOSICAO</b>: 1600×1600, peça ocupando ~84% do quadro;</li>
 *   <li><b>VALIDACAO</b>: nitidez (variância do laplaciano), contraste e resolução, antes × depois.</li>
 * </ol>
 * Com Photoroom configurado, fundo + reiluminação + sombra (2–4) são gerados por IA; qualquer falha externa cai
 * para a etapa local sem interromper o cadastro (RNF8). A saída guarda duas imagens: a foto de estúdio (vitrine)
 * e o recorte realçado, ainda sem fundo, para o provador, os cards e o quarto.
 */
@Component
public class StudioPipeline {
    private static final Logger log = LoggerFactory.getLogger(StudioPipeline.class);
    public static final int SIZE = 1600;
    static final int WORK = 1800;

    public record Backdrop(String id, String label, int center, int edge, int shadow) {
        public String hex() {
            return String.format("#%06X", center);
        }
    }

    public static final List<Backdrop> BACKDROPS = List.of(
            new Backdrop("royal", Msg.k("studio.azul_royal"), 0x2D55C9, 0x0F1F63, 0x040A26),
            new Backdrop("grafite", "Grafite", 0x5E636D, 0x1C1E23, 0x000000),
            new Backdrop("areia", "Areia", 0xF1E8D8, 0xC9B99C, 0x4F3F24),
            new Backdrop("rosa", Msg.k("studio.rosa_po"), 0xF4CDD4, 0xD28C9B, 0x55202D),
            new Backdrop("oliva", "Oliva", 0x93A266, 0x45512A, 0x171D0B),
            new Backdrop("terracota", "Terracota", 0xDE9468, 0x97462A, 0x381407),
            new Backdrop("branco", Msg.k("studio.branco_infinito"), 0xFFFFFF, 0xE3E3E8, 0x35353F));

    public record Stage(String name, String provider, long ms, BigDecimal costUsd, boolean ok, boolean fallback, String note) {
    }

    /**
     * Dicas do cadastro para o estúdio.
     *
     * @param kind      TOP, OUTERWEAR, FULL_BODY, BOTTOM, SHOES, ACCESSORY ou null (manequim invisível só em peças com gola)
     * @param truncated lados que a foto original cortou (top/bottom/left/right); vazio = peça inteira (margem em volta);
     *                  null = deduzir do recorte (barra reta = corte)
     * @param logoBox   caixa do logo relativa à peça (x0, y0, x1, y1 em 0–1), vinda da IA de visão; null = detector local
     * @param feed      template de enquadramento do feed (categoria + subcategoria); null = deduzido de {@code kind}
     */
    /**
     * @param category    categoria do cadastro (upper_piece…): com ela a foto do feed segue a Regra de Enquadramento do
     *                    Produto do registro (catalog/semantic-regions.json), a mesma das fotos do acervo
     * @param subcategory subcategoria do cadastro (óculos, relógio, cinto… têm regra própria)
     */
    public record Hints(String kind, Set<String> truncated, double[] logoBox, String logoSource, FeedFraming.Template feed,
                        String category, String subcategory) {
        public static final Hints NONE = new Hints(null, null, null, null);

        public Hints(String kind, Set<String> truncated, double[] logoBox, String logoSource) {
            this(kind, truncated, logoBox, logoSource, null, null, null);
        }

        public Hints(String kind, Set<String> truncated, double[] logoBox, String logoSource, FeedFraming.Template feed) {
            this(kind, truncated, logoBox, logoSource, feed, null, null);
        }

        /** Peça com categoria conhecida: template de medição + regra de enquadramento da categoria. */
        public static Hints forPiece(String kind, Set<String> truncated, double[] logoBox, String logoSource, String category,
                                     String subcategory) {
            return new Hints(kind, truncated, logoBox, logoSource, FeedFraming.template(category, subcategory, kind), category,
                    subcategory);
        }

        public FeedFraming.Template feedTemplate() {
            return feed != null ? feed : FeedFraming.template(null, null, kind);
        }
    }

    /**
     * @param studioJpeg foto principal (quadrada, 1600×1600 — o padrão do card) · @param thumbJpeg miniatura 640×640 para grades
     * @param detailJpeg foto de detalhe do logo (null sem logo) · @param enhancedPng peça realçada, sem fundo
     * @param feedJpeg   foto do feed 4:5 enquadrada pelo template da categoria · @param feed template, pontos de
     *                   referência e regiões que faltam na foto
     */
    public record Result(byte[] studioJpeg, byte[] thumbJpeg, byte[] detailJpeg, byte[] enhancedPng, Backdrop backdrop,
                         List<Stage> stages, BigDecimal costUsd, boolean fallbackUsed, Map<String, Object> metrics,
                         Map<String, Object> framing, Map<String, Object> logo, List<String> ghost, byte[] feedJpeg,
                         Map<String, Object> feed) {
    }

    public static final int THUMB = 640;
    /** Confiança mínima de um logo achado pelo detector local para ganhar foco e foto de detalhe. */
    static final double LOGO_MIN_CONFIDENCE = 0.5;

    private final List<UpscalePort> upscalers;
    private final List<StudioShotPort> studios;

    /**
     * Manequim invisível (preencher decote e aberturas com um interior falso): desligado por padrão — peça sem corpo
     * não deve parecer vestida por um fantasma. A peça superior/de corpo inteiro ganha a "Foto com meu manequim",
     * vestindo o manequim da pessoa (rosto da foto de perfil) ou o padrão masculino/feminino.
     */
    private boolean ghostFill;

    public StudioPipeline(List<UpscalePort> upscalers, List<StudioShotPort> studios) {
        this.upscalers = upscalers;
        this.studios = studios;
    }

    @org.springframework.beans.factory.annotation.Value("${fashionai.studio.ghost-mannequin:false}")
    public void setGhostFill(boolean ghostFill) {
        this.ghostFill = ghostFill;
    }

    public boolean externalAvailable() {
        return upscalers.stream().anyMatch(UpscalePort::available) || studios.stream().anyMatch(StudioShotPort::available);
    }

    public static Optional<Backdrop> backdrop(String id) {
        return BACKDROPS.stream().filter(b -> b.id().equalsIgnoreCase(id == null ? "" : id)).findFirst();
    }

    public Result run(BufferedImage cutout, String backdropId, boolean allowExternal) {
        return run(cutout, backdropId, allowExternal, Hints.NONE);
    }

    /** @param cutout recorte ARGB sem fundo · @param backdropId id de {@link #BACKDROPS} ou "auto" */
    public Result run(BufferedImage cutout, String backdropId, boolean allowExternal, Hints hints) {
        Hints hint = hints == null ? Hints.NONE : hints;
        List<Stage> stages = new ArrayList<>();
        BigDecimal cost = BigDecimal.ZERO;
        boolean fallback = false;
        ImageOps.Box box = ImageOps.alphaBounds(cutout);
        if (box.empty()) {
            throw new IllegalArgumentException("recorte vazio");
        }
        BufferedImage piece = ImageOps.toArgb(ImageOps.crop(cutout, box));
        double sharpBefore = sharpness(piece);
        double contrastBefore = contrast(piece);
        int wBefore = piece.getWidth(), hBefore = piece.getHeight();
        final BufferedImage original = piece;
        Backdrop bd = backdrop(backdropId).orElseGet(() -> autoBackdrop(original));

        // 0) limpeza: cabide/manequim + ruído da câmera
        long t0 = System.nanoTime();
        List<String> cleanNotes0 = new ArrayList<>();
        GhostMannequin.Result clean = GhostMannequin.cleanup(piece, hint.kind());
        double[] logoBox = hint.logoBox() == null ? null : reframe(hint.logoBox(), piece, clean);
        piece = clean.image();
        // lados cortados: os que a foto cortou (metadado do Flat Lay); só sem esse dado (truncated null) os cortes retos
        // do próprio recorte contam como corte — a foto aceita pelos critérios (peça inteira) sai com margem em todos os
        // lados, sem barra "rente" à borda. Um corte inclinado (celular torto) nivela a peça antes da sangria.
        java.util.Map<String, Double> cuts = hint.truncated() == null ? StudioFraming.cuts(piece) : java.util.Map.of();
        double level = cuts.containsKey("bottom") ? cuts.get("bottom") : cuts.containsKey("top") ? cuts.get("top")
                : cuts.containsKey("left") ? cuts.get("left") : cuts.getOrDefault("right", 0.0);
        if (Math.abs(level) >= 0.3 && Math.abs(level) <= 6) {
            BufferedImage rotated = ImageOps.rotate(piece, -level);
            piece = ImageOps.crop(rotated, ImageOps.alphaBounds(rotated));
            cleanNotes0.add(String.format(java.util.Locale.ROOT, Msg.t("studio.peca_nivelada_pelo_corte_da"), level));
            cuts = StudioFraming.cuts(piece);
        }
        Set<String> bleed = new java.util.LinkedHashSet<>(hint.truncated() == null ? Set.of() : hint.truncated());
        bleed.addAll(cuts.keySet());
        if (clean.hanger()) {
            bleed.remove("top");                                    // o que encostava no topo era o gancho
        }
        double sigma = StudioQuality.noiseSigma(piece);
        piece = StudioQuality.denoise(piece, sigma);
        List<String> cleanNotes = new ArrayList<>(clean.notes());
        cleanNotes.addAll(cleanNotes0);
        cleanNotes.add(sigma < 1.6 ? String.format(java.util.Locale.ROOT, Msg.t("studio.ruido_baixo_1f_sem_filtro"), sigma)
                : String.format(java.util.Locale.ROOT, Msg.t("studio.ruido_1f_filtro_bilateral_preserva"), sigma));
        stages.add(new Stage("LIMPEZA", "local", ms(t0), BigDecimal.ZERO, true, false, String.join(" · ", cleanNotes)));

        // 1) ampliação + contorno + nitidez com limiar
        BufferedImage up = null;
        if (allowExternal) {
            for (UpscalePort port : upscalers) {
                if (!port.available()) {
                    continue;
                }
                long t1 = System.nanoTime();
                try {
                    Optional<ProviderImage> res = port.upscale(ImageOps.png(piece));
                    if (res.isPresent()) {
                        up = ImageOps.toArgb(ImageOps.decode(res.get().bytes()));
                        cost = cost.add(res.get().costUsd());
                        stages.add(new Stage("NITIDEZ", res.get().provider(), ms(t1), res.get().costUsd(), true, false, up.getWidth() + "×" + up.getHeight()));
                        break;
                    }
                } catch (RuntimeException e) {
                    log.debug("upscale externo falhou: {}", e.toString());
                }
                stages.add(new Stage("NITIDEZ", "externo", ms(t1), BigDecimal.ZERO, false, true, Msg.t("studio.falhou_seguindo_com_o_local")));
                fallback = true;
            }
        }
        long t2 = System.nanoTime();
        boolean localUp = up == null;
        up = localUp ? upscaleLocal(piece) : up;
        if (Math.max(up.getWidth(), up.getHeight()) > WORK) {
            int lw = (int) Math.round(up.getWidth() * WORK / (double) Math.max(up.getWidth(), up.getHeight()));
            int lh = (int) Math.round(up.getHeight() * WORK / (double) Math.max(up.getWidth(), up.getHeight()));
            up = StudioFraming.downscale(up, lw, lh);
        }
        double upFactor = up.getWidth() / (double) piece.getWidth();
        up = StudioQuality.refineEdges(up, upFactor);
        int fineRadius = (int) Math.max(1, Math.min(3, Math.round(upFactor * 0.6)));
        // sem "vibração": a cor e a estampa da peça ficam como na foto (só contraste local e nitidez de borda)
        BufferedImage enhanced = StudioQuality.sharpen(up, 0.25f, 0.9f, 0f, fineRadius);
        stages.add(new Stage("NITIDEZ", "local", ms(t2), BigDecimal.ZERO, true, false,
                Msg.t("studio.contorno_suavizado_sem_franja_nitidez", ((localUp ? String.format(java.util.Locale.ROOT, Msg.t("studio.ampliacao_bicubica_progressiva_1f"), upFactor) : "")), enhanced.getWidth(), enhanced.getHeight())));

        // 2) manequim invisível: decote e aberturas
        long tg = System.nanoTime();
        List<String> ghostNotes = new ArrayList<>(clean.notes());
        if (ghostFill) {
            GhostMannequin.Result ghost = GhostMannequin.fill(enhanced, hint.kind());
            enhanced = ghost.image();
            ghostNotes.addAll(ghost.notes());
        }
        stages.add(new Stage("MANEQUIM_INVISIVEL", "local", ms(tg), BigDecimal.ZERO, ghostFill, false,
                !ghostFill ? (GhostMannequin.neckGarment(hint.kind()) ? Msg.t("studio.sem_manequim_fantasma_a_peca", (clean.notes().isEmpty() ? "" : " · " + String.join(" · ", clean.notes()))) : Msg.t("studio.nao_se_aplica_a_este"))
                        : ghostNotes.isEmpty() ? (GhostMannequin.neckGarment(hint.kind()) ? Msg.t("studio.gola_e_mangas_sem_vazios") : Msg.t("studio.nao_se_aplica_a_este"))
                        : String.join(" · ", ghostNotes)));

        // 3) logo: da IA (quando veio) ou do detector local
        long tl = System.nanoTime();
        LogoFinder.Logo logo = logoBox != null ? new LogoFinder.Logo(logoBox, 0.85, hint.logoSource() == null ? "ia" : hint.logoSource())
                : LogoFinder.detect(enhanced);
        // estampa (frase, gráfico grande) não é logo: fica intacta, sem foco extra nem foto de detalhe
        LogoFinder.Logo printFound = logo != null && logo.print() ? logo : null;
        if (printFound != null) {
            logo = null;
        }
        // palpite fraco do detector local (textura, listra, costura) não vira "logo": sem foto de detalhe
        if (logo != null && "local".equals(logo.source()) && logo.confidence() < LOGO_MIN_CONFIDENCE) {
            logo = null;
        }
        stages.add(new Stage("LOGO", logo == null ? (printFound == null ? "local" : printFound.source()) : logo.source(), ms(tl), BigDecimal.ZERO, true, false,
                logo == null ? (printFound != null ? Msg.t("studio.estampa_nao_e_logo") : Msg.t("studio.nenhum_logo_identificado"))
                        : String.format(java.util.Locale.ROOT, Msg.t("studio.logo_em_0f_0f_confianca"),
                        (logo.box()[0] + logo.box()[2]) * 50, (logo.box()[1] + logo.box()[3]) * 50, logo.confidence())));

        // 4) volume e luz (+ nitidez extra no logo)
        long t4 = System.nanoTime();
        BufferedImage lit = relight(enhanced);
        if (logo != null) {
            lit = LogoFinder.focus(lit, logo.box());
        }
        stages.add(new Stage("VOLUME_LUZ", "local", ms(t4), BigDecimal.ZERO, true, false, Msg.t("studio.luz_chave_45_superior_esquerda")));

        // 5) enquadramento: a peça inteira ocupando o quadro; lados cortados pela foto sangram
        // corte confirmado pela borda da foto sangra; corte só deduzido pela forma (barra reta) fica rente, sem perder nada
        Set<String> flush = new java.util.LinkedHashSet<>(bleed);
        if (hint.truncated() != null) {
            flush.removeAll(hint.truncated());
        }
        // padrão da peça: quadro quadrado (1:1), o mesmo do card — com 9:16/2:3 o card cortava calça e vestido no "cover"
        StudioFraming.Frame frame = StudioFraming.frame(lit.getWidth(), lit.getHeight(), bleed, flush, SIZE, false);
        StudioFraming.Frame thumbFrame = StudioFraming.frame(lit.getWidth(), lit.getHeight(), bleed, flush, THUMB, false);
        // foto do feed: template da categoria por pontos de referência da peça (gola/peito, cós/joelhos…), sempre 4:5
        // (só os lados que a própria foto cortou contam como região faltando; barra ou cós retos não são corte)
        FeedFraming.Feed feed = FeedFraming.frame(lit, hint.feedTemplate(), hint.truncated() == null ? Set.of() : hint.truncated(),
                hint.category(), hint.subcategory());
        stages.add(new Stage("ENQUADRAMENTO", "local", 0, BigDecimal.ZERO, true, false,
                Msg.t("studio.peca_ocupa_do_quadro", frame.aspect(), String.valueOf(frame.width()), String.valueOf(frame.height()), String.format(java.util.Locale.ROOT, "%.0f", frame.fill() * 100))
                        + (bleed.isEmpty() ? Msg.t("studio.peca_inteira_com_margem_minima")
                        : flush.containsAll(bleed) ? Msg.t("studio.rente_a_borda_em_barra", String.join(", ", sides(bleed)))
                        : Msg.t("studio.sangra_em_corte_da_foto", String.join(", ", sides(bleed))))));

        // 6) fundo + luz + sombra: IA (Photoroom) no mesmo quadro, ou composição local
        BufferedImage finalShot = null;
        if (allowExternal) {
            for (StudioShotPort port : studios) {
                if (!port.available()) {
                    continue;
                }
                long t3 = System.nanoTime();
                try {
                    Optional<ProviderImage> res = port.studio(ImageOps.png(padForProvider(lit, bleed)), bd.hex(), frame.width(), frame.height(), StudioFraming.SIDE);
                    if (res.isPresent()) {
                        finalShot = ImageOps.decode(res.get().bytes());
                        cost = cost.add(res.get().costUsd());
                        stages.add(new Stage("ESTUDIO_IA", res.get().provider(), ms(t3), res.get().costUsd(), true, false,
                                Msg.t("studio.fundo_reiluminacao_sombra_suave", bd.label(), frame.aspect())));
                        break;
                    }
                } catch (RuntimeException e) {
                    log.debug("estúdio externo falhou: {}", e.toString());
                }
                stages.add(new Stage("ESTUDIO_IA", "externo", ms(t3), BigDecimal.ZERO, false, true, Msg.t("studio.falhou_estudio_local")));
                fallback = true;
            }
        }
        if (finalShot == null) {
            long t5 = System.nanoTime();
            finalShot = StudioFraming.compose(lit, bd, frame);
            stages.add(new Stage("FUNDO_ESTUDIO", "local", 0, BigDecimal.ZERO, true, !studios.isEmpty() && allowExternal,
                    Msg.t("studio.gradiente_radial_vinheta", (bd.label()), bd.hex())));
            stages.add(new Stage("SOMBRA", "local", 0, BigDecimal.ZERO, true, false, bleed.contains("bottom")
                    ? Msg.t("studio.sem_sombra_no_chao_a") : Msg.t("studio.projetada_desfoque_3_caixa_contato")));
            stages.add(new Stage("COMPOSICAO", "local", ms(t5), BigDecimal.ZERO, true, false, frame.width() + "×" + frame.height() + " + miniatura " + THUMB + "×" + THUMB));
        }
        BufferedImage thumb = StudioFraming.compose(lit, bd, thumbFrame);
        BufferedImage feedShot = StudioFraming.compose(lit, bd, feed.frame());
        stages.add(new Stage("FEED", "local", 0, BigDecimal.ZERO, feed.missing().isEmpty(), false,
                Msg.t("studio.feed_template", feed.template().name(), String.format(java.util.Locale.ROOT, "%.0f", feed.frame().fill() * 100))
                        + (feed.missing().isEmpty() ? "" : Msg.t("studio.feed_falta", String.join(", ", feed.missing())))));
        byte[] detail = null;
        if (logo != null) {
            long t7 = System.nanoTime();
            detail = ImageOps.jpeg(LogoFinder.detail(lit, logo.box(), bd), 0.92f);
            stages.add(new Stage("DETALHE", "local", ms(t7), BigDecimal.ZERO, true, false, Msg.t("studio.n1200_1500_no_logo_foco")));
        }

        // 7) validação antes × depois
        long t6 = System.nanoTime();
        // nitidez medida na mesma escala da entrada (a variância do laplaciano cai quando a imagem só é ampliada)
        double sharpAfter = sharpness(StudioFraming.downscale(lit, wBefore, hBefore));
        double contrastAfter = contrast(lit);
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("sharpnessBefore", round(sharpBefore));
        metrics.put("sharpnessAfter", round(sharpAfter));
        metrics.put("contrastBefore", round(contrastBefore));
        metrics.put("contrastAfter", round(contrastAfter));
        metrics.put("noiseSigma", round(sigma));
        metrics.put("resolutionBefore", wBefore + "×" + hBefore);
        metrics.put("resolutionAfter", finalShot.getWidth() + "×" + finalShot.getHeight());
        metrics.put("fillPercent", Math.round(frame.fill() * 100));
        metrics.put("backdrop", bd.id());
        stages.add(new Stage("VALIDACAO", "local", ms(t6), BigDecimal.ZERO, sharpAfter >= sharpBefore * 0.95, false,
                String.format(Msg.t("studio.nitidez_0f_0f_contraste_1f"), sharpBefore, sharpAfter, contrastBefore, contrastAfter)));
        Map<String, Object> framing = new LinkedHashMap<>();
        framing.put("aspect", frame.aspect());
        framing.put("width", finalShot.getWidth());
        framing.put("height", finalShot.getHeight());
        framing.put("fill", Math.round(frame.fill() * 100) / 100.0);
        framing.put("bleed", List.copyOf(bleed));
        framing.put("flush", List.copyOf(flush));
        Map<String, Object> logoInfo = null;
        LogoFinder.Logo mark = logo != null ? logo : printFound;
        if (mark != null) {
            logoInfo = new LinkedHashMap<>();
            logoInfo.put("kind", mark.print() ? "print" : "logo");
            logoInfo.put("box", java.util.Arrays.stream(mark.box()).map(v -> Math.round(v * 1000) / 1000.0).boxed().toList());
            logoInfo.put("confidence", Math.round(mark.confidence() * 100) / 100.0);
            logoInfo.put("source", mark.source());
        }
        return new Result(ImageOps.jpeg(finalShot, 0.93f), ImageOps.jpeg(thumb, 0.88f), detail, ImageOps.png(lit), bd, stages,
                cost, fallback, metrics, framing, logoInfo, ghostNotes, ImageOps.jpeg(feedShot, 0.9f), feed.toMap());
    }

    /** Caixa do logo (relativa à peça original) levada para a peça depois da limpeza (que pode ter cortado o gancho). */
    private static double[] reframe(double[] box, BufferedImage before, GhostMannequin.Result clean) {
        if (box.length != 4) {
            return null;
        }
        ImageOps.Box c = clean.crop();
        if (c == null) {
            return box.clone();
        }
        double bw = before.getWidth(), bh = before.getHeight();
        double[] out = {(box[0] * bw - c.x()) / c.w(), (box[1] * bh - c.y()) / c.h(), (box[2] * bw - c.x()) / c.w(), (box[3] * bh - c.y()) / c.h()};
        for (int i = 0; i < 4; i++) {
            out[i] = Math.max(0, Math.min(1, out[i]));
        }
        return out[2] - out[0] < 0.01 || out[3] - out[1] < 0.01 ? null : out;
    }

    /** Para o provedor: margem transparente só nos lados inteiros (os cortados continuam encostando na borda). */
    static BufferedImage padForProvider(BufferedImage lit, Set<String> bleed) {
        int w = lit.getWidth(), h = lit.getHeight(), m = (int) Math.round(Math.max(w, h) * 0.06);
        int l = bleed.contains("left") ? 0 : m, r = bleed.contains("right") ? 0 : m, t = bleed.contains("top") ? 0 : m, b = bleed.contains("bottom") ? 0 : m;
        BufferedImage out = new BufferedImage(w + l + r, h + t + b, BufferedImage.TYPE_INT_ARGB);
        java.awt.Graphics2D g = out.createGraphics();
        g.drawImage(lit, l, t, null);
        g.dispose();
        return out;
    }

    private static List<String> sides(Set<String> bleed) {
        List<String> out = new ArrayList<>();
        for (String s : bleed) {
            out.add(switch (s) {
                case "top" -> "cima";
                case "bottom" -> "baixo";
                case "left" -> "esquerda";
                default -> "direita";
            });
        }
        return out;
    }

    // ================================================================== escolhas

    /**
     * "Automático": o azul royal é a assinatura do estúdio (foto de referência). Só muda para areia quando a peça
     * sumiria nele — mais da metade dela escura (some na borda escura do degradê) ou azul saturado (mesmo tom do fundo).
     */
    static Backdrop autoBackdrop(BufferedImage piece) {
        int n = 0, clash = 0;
        float[] hsb = new float[3];
        for (int y = 0; y < piece.getHeight(); y += 3) {
            for (int x = 0; x < piece.getWidth(); x += 3) {
                int p = piece.getRGB(x, y);
                if ((p >>> 24) < 128) {
                    continue;
                }
                int r = (p >> 16) & 255, g = (p >> 8) & 255, b = p & 255;
                double lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                java.awt.Color.RGBtoHSB(r, g, b, hsb);
                double hue = hsb[0] * 360;
                boolean dark = lum < 0.2;
                boolean blue = hue >= 195 && hue <= 255 && hsb[1] > 0.3 && lum < 0.7;
                n++;
                if (dark || blue) {
                    clash++;
                }
            }
        }
        if (n == 0) {
            return BACKDROPS.get(0);
        }
        return backdrop(clash / (double) n > 0.5 ? "areia" : "royal").orElse(BACKDROPS.get(0));
    }

    // ================================================================== 1) nitidez

    static BufferedImage upscaleLocal(BufferedImage img) {
        int longest = Math.max(img.getWidth(), img.getHeight());
        if (longest >= WORK) {
            return img;
        }
        BufferedImage cur = img;
        while (Math.max(cur.getWidth(), cur.getHeight()) < WORK) {        // bicúbica progressiva (≤ 1,5× por passo)
            double f = Math.min(1.5, WORK / (double) Math.max(cur.getWidth(), cur.getHeight()));
            cur = ImageOps.scale(cur, (int) Math.round(cur.getWidth() * f), (int) Math.round(cur.getHeight() * f));
        }
        return cur;
    }

    // ================================================================== 2) volume e luz

    static BufferedImage relight(BufferedImage src) {
        int w = src.getWidth(), h = src.getHeight();
        int s = 4;                                                        // campo de altura em 1/4 da resolução
        int sw = Math.max(2, w / s), sh = Math.max(2, h / s);
        boolean[][] in = new boolean[sh][sw];
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                in[y][x] = (src.getRGB(Math.min(w - 1, x * s + s / 2), Math.min(h - 1, y * s + s / 2)) >>> 24) > 100;
            }
        }
        double[][] d = ReliefModelGenerator.distance(in, sw, sh);
        double max = 1;
        for (double[] row : d) {
            for (double v : row) {
                max = Math.max(max, v);
            }
        }
        double plateau = Math.max(2, max * 0.45);
        float[] height = new float[sw * sh];
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                double t = Math.min(1, d[y][x] / plateau);
                height[y * sw + x] = (float) Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
            }
        }
        height = boxBlur(height, sw, sh, 2, 2);
        // luz-chave de cima à esquerda, na direção de quem olha (y da imagem cresce para baixo)
        double lx = -0.45, ly = -0.55, lz = 0.70, ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
        lx /= ll;
        ly /= ll;
        lz /= ll;
        float[] shade = new float[sw * sh], rim = new float[sw * sh];
        double k = 3.2;                                                   // exagero do relevo nas normais
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                int i = y * sw + x;
                if (!in[y][x]) {
                    continue;
                }
                double dx = (height[y * sw + Math.min(sw - 1, x + 1)] - height[y * sw + Math.max(0, x - 1)]) * 0.5;
                double dy = (height[Math.min(sh - 1, y + 1) * sw + x] - height[Math.max(0, y - 1) * sw + x]) * 0.5;
                double nx = -dx * k, ny = -dy * k, nz = 1, nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
                double lambert = Math.max(0, (nx * lx + ny * ly + nz * lz) / nl);
                double edge = Math.min(1, d[y][x] / Math.max(1.5, plateau * 0.22));
                double occlusion = 0.90 + 0.10 * edge;                   // bordas recuam (oclusão ambiente)
                double topLight = 1.03 - 0.07 * ((double) y / sh);        // luz de cima: base um pouco mais escura
                shade[i] = (float) ((0.74 + 0.34 * lambert) * occlusion * topLight);
                rim[i] = (float) (lambert > 0.62 ? 0.07 * (1 - edge) : 0);
            }
        }
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        int[] out = new int[px.length];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                int p = px[i], a = p >>> 24;
                if (a == 0) {
                    continue;
                }
                float sv = bilinear(shade, sw, sh, (x + 0.5f) / s - 0.5f, (y + 0.5f) / s - 0.5f);
                float rv = bilinear(rim, sw, sh, (x + 0.5f) / s - 0.5f, (y + 0.5f) / s - 0.5f);
                if (sv <= 0) {
                    sv = 1;
                }
                float r = soft(((p >> 16) & 255) * sv), g = soft(((p >> 8) & 255) * sv), b = soft((p & 255) * sv);
                r += (255 - r) * rv;
                g += (255 - g) * rv;
                b += (255 - b) * rv;
                out[i] = (a << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
            }
        }
        BufferedImage res = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        res.setRGB(0, 0, w, h, out, 0, w);
        return res;
    }

    // ================================================================== métricas e utilidades

    /** Variância do laplaciano da luminância na área da peça (medida clássica de foco/nitidez). */
    static double sharpness(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight(), step = Math.max(1, Math.max(w, h) / 700);
        double sum = 0, sum2 = 0;
        int n = 0;
        for (int y = step; y < h - step; y += step) {
            for (int x = step; x < w - step; x += step) {
                if ((img.getRGB(x, y) >>> 24) < 250) {
                    continue;
                }
                double lap = 4 * lum(img.getRGB(x, y)) - lum(img.getRGB(x - step, y)) - lum(img.getRGB(x + step, y))
                        - lum(img.getRGB(x, y - step)) - lum(img.getRGB(x, y + step));
                sum += lap;
                sum2 += lap * lap;
                n++;
            }
        }
        return n == 0 ? 0 : sum2 / n - (sum / n) * (sum / n);
    }

    static double contrast(BufferedImage img) {
        double sum = 0, sum2 = 0;
        int n = 0;
        for (int y = 0; y < img.getHeight(); y += 2) {
            for (int x = 0; x < img.getWidth(); x += 2) {
                int p = img.getRGB(x, y);
                if ((p >>> 24) < 250) {
                    continue;
                }
                double l = lum(p);
                sum += l;
                sum2 += l * l;
                n++;
            }
        }
        return n == 0 ? 0 : Math.sqrt(Math.max(0, sum2 / n - (sum / n) * (sum / n)));
    }

    private static double lum(int p) {
        return 0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255);
    }

    /** Desfoque de caixa separável repetido (3 passes ≈ gaussiano). */
    static float[] boxBlur(float[] src, int w, int h, int r, int passes) {
        float[] a = src.clone(), b = new float[src.length];
        for (int pass = 0; pass < passes; pass++) {
            for (int y = 0; y < h; y++) {
                float acc = 0;
                int row = y * w;
                for (int x = -r; x <= r; x++) {
                    acc += a[row + Math.min(w - 1, Math.max(0, x))];
                }
                for (int x = 0; x < w; x++) {
                    b[row + x] = acc / (2 * r + 1);
                    acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
                }
            }
            for (int x = 0; x < w; x++) {
                float acc = 0;
                for (int y = -r; y <= r; y++) {
                    acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
                }
                for (int y = 0; y < h; y++) {
                    a[y * w + x] = acc / (2 * r + 1);
                    acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
                }
            }
        }
        return a;
    }

    static float bilinear(float[] f, int w, int h, float x, float y) {
        int x0 = (int) Math.floor(x), y0 = (int) Math.floor(y);
        float fx = x - x0, fy = y - y0;
        int x1 = Math.min(w - 1, Math.max(0, x0 + 1)), y1 = Math.min(h - 1, Math.max(0, y0 + 1));
        x0 = Math.min(w - 1, Math.max(0, x0));
        y0 = Math.min(h - 1, Math.max(0, y0));
        return (f[y0 * w + x0] * (1 - fx) + f[y0 * w + x1] * fx) * (1 - fy) + (f[y1 * w + x0] * (1 - fx) + f[y1 * w + x1] * fx) * fy;
    }

    /** Compressão suave dos realces (evita estourar tons claros como o creme da referência). */
    static float soft(float v) {
        if (v <= 225) {
            return v;
        }
        float over = v - 225;
        return 225 + 30 * (1 - (float) Math.exp(-over / 30));
    }

    private static int clamp(float v) {
        return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }

    private static int lerp(int a, int b, double t) {
        return (int) Math.round(a + (b - a) * t);
    }

    private static double round(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static long ms(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
