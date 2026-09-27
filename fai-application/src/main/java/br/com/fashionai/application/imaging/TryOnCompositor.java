package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageProviderPorts.ArtifactCleanupPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.application.imaging.ImageProviderPorts.TryOnProviderPort;
import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.TryOnLayer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.geom.Ellipse2D;
import java.awt.geom.GeneralPath;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Provador 2D híbrido (ANALISE_RF18_Provador_Virtual_2D.md / RFC RF18): RENDERING (FASHN.ai para
 * TOP/BOTTOM/OUTER/FULL_BODY, ou sobreposição aproximada por âncoras) → ENHANCING (Cleanup.ai ou
 * polimento local) → COMPOSITING (Category Fallback Compositor: calçados e acessórios rígidos por
 * landmark, nunca pelo FASHN) → validação de qualidade. As camadas seguem base → intermediária →
 * externa → acessório (RF18.CA02). Nunca sem roupa: a zona do corpo sem peça (tronco, pernas, pés) recebe a peça padrão
 * do FashionAI ({@link DefaultOutfit}), sobreposta localmente.
 */
@Component
public class TryOnCompositor {
    private static final Logger log = LoggerFactory.getLogger(TryOnCompositor.class);

    private final List<TryOnProviderPort> tryOnProviders;
    private final List<ArtifactCleanupPort> cleaners;
    private final DefaultOutfit defaults;

    @Autowired
    public TryOnCompositor(List<TryOnProviderPort> tryOnProviders, List<ArtifactCleanupPort> cleaners, DefaultOutfit defaults) {
        this.tryOnProviders = tryOnProviders;
        this.cleaners = cleaners;
        this.defaults = defaults;
    }

    /** Sem acesso aos assets (testes): as peças padrão são desenhadas. */
    public TryOnCompositor(List<TryOnProviderPort> tryOnProviders, List<ArtifactCleanupPort> cleaners) {
        this(tryOnProviders, cleaners, new DefaultOutfit(url -> Optional.empty()));
    }

    public record Garment(UUID itemId, SchemeSlot slot, String subcategory, BufferedImage cutout, byte[] imageBytes,
                          boolean backgroundRemoved, String color) {
    }

    public record Placement(UUID itemId, SchemeSlot slot, TryOnLayer layer, String anchor, String engine,
                            double x, double y, double w, double h) {
    }

    public record Result(byte[] png, List<FlatLayPipeline.Stage> stages, BigDecimal costUsd, long totalMs,
                         boolean fallbackUsed, Map<String, Object> quality, List<String> warnings,
                         List<Placement> placements, Map<String, BigDecimal> costByProvider) {
    }

    public boolean externalAvailable() {
        return tryOnProviders.stream().anyMatch(TryOnProviderPort::available);
    }

    public Result render(MannequinSex sex, BodyBuild build, String skinTone, List<Garment> garments, boolean allowExternal) {
        return render(MannequinGeometry.body(sex, build), MannequinGeometry.SKIN_TONES.getOrDefault(skinTone, MannequinGeometry.SKIN_TONES.get("media")),
                garments, allowExternal);
    }

    /** Renderiza sobre um corpo já resolvido (o do Avatar 3D, quando existe) com a cor de pele dele. */
    public Result render(MannequinGeometry.Body body, String skinHex, List<Garment> garments, boolean allowExternal) {
        long started = System.nanoTime();
        List<FlatLayPipeline.Stage> stages = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<Placement> placements = new ArrayList<>();
        Map<String, BigDecimal> costs = new LinkedHashMap<>();
        BufferedImage canvas = drawMannequin(body, new Color(ColorMath.parseHex(skinHex)));
        List<Garment> ordered = new ArrayList<>();
        for (Garment g : garments) {
            if (g.cutout() == null) {            // imagem ilegível ou ausente: não derruba a prova, avisa
                warnings.add(Msg.t("tryOnCompositor.a_peca_ficou_de_fora", g.slot()));
                continue;
            }
            ordered.add(g);
        }
        // nunca sem roupa: tronco, pernas e pés sem peça legível recebem a peça padrão do FashionAI
        for (Garment d : defaults.complete(ordered)) {
            ordered.add(d);
            warnings.add(Msg.t("tryOnCompositor.lugar_vazio_peca_padrao", d.slot()));
        }
        ordered.sort(Comparator.comparingInt(g -> MannequinGeometry.layerOf(g.slot()).ordinal()));

        // RENDERING — peças de tecido
        long t = System.nanoTime();
        boolean fallback = false;
        for (Garment g : ordered) {
            if (MannequinGeometry.layerOf(g.slot()) == TryOnLayer.ACCESSORY) {
                continue;
            }
            boolean done = false;
            boolean standard = DefaultOutfit.isDefault(g.itemId());
            if (allowExternal && !standard) {                // a peça padrão é sobreposta aqui, nunca enviada ao FASHN
                for (TryOnProviderPort port : tryOnProviders) {
                    if (!port.available()) {
                        continue;
                    }
                    try {
                        Optional<ProviderImage> res = port.tryOn(ImageOps.png(canvas), g.imageBytes(), fashnCategory(g.slot()));
                        if (res.isPresent()) {
                            canvas = ImageOps.scale(ImageOps.decode(res.get().bytes()), MannequinGeometry.WIDTH, MannequinGeometry.HEIGHT);
                            costs.merge(res.get().provider(), res.get().costUsd(), BigDecimal::add);
                            placements.add(new Placement(g.itemId(), g.slot(), MannequinGeometry.layerOf(g.slot()), g.slot().name(),
                                    res.get().provider(), 0, 0, 1, 1));
                            done = true;
                            break;
                        }
                    } catch (RuntimeException ex) {
                        log.warn("Try-on externo falhou: {}", ex.getMessage());
                        fallback = true;
                    }
                }
            }
            if (!done) {
                if (!g.backgroundRemoved()) {
                    warnings.add(Msg.t("tryOnCompositor.a_peca_nao_teve_o", g.slot()));
                }
                placements.add(overlay(canvas, body, g, standard ? "padrao-fashionai" : "local-ancora"));
                fallback |= allowExternal && externalAvailable() && !standard;
            }
        }
        stages.add(new FlatLayPipeline.Stage("RENDERING", costs.isEmpty() ? "local-ancora" : String.join("+", costs.keySet()),
                ms(t), sum(costs), true, fallback, Msg.t("tryOnCompositor.pecas_de_tecido", (placements.size()))));

        // ENHANCING — polimento
        t = System.nanoTime();
        boolean polished = false;
        if (allowExternal && !costs.isEmpty()) {
            for (ArtifactCleanupPort port : cleaners) {
                if (!port.available()) {
                    continue;
                }
                try {
                    Optional<ProviderImage> res = port.cleanup(ImageOps.png(canvas));
                    if (res.isPresent()) {
                        canvas = ImageOps.scale(ImageOps.decode(res.get().bytes()), MannequinGeometry.WIDTH, MannequinGeometry.HEIGHT);
                        costs.merge(res.get().provider(), res.get().costUsd(), BigDecimal::add);
                        stages.add(new FlatLayPipeline.Stage("ENHANCING", res.get().provider(), ms(t), res.get().costUsd(), true, false, "polimento"));
                        polished = true;
                        break;
                    }
                } catch (RuntimeException ex) {
                    log.warn("Polimento externo falhou (mantém saída bruta): {}", ex.getMessage());
                }
            }
        }
        if (!polished) {
            stages.add(new FlatLayPipeline.Stage("ENHANCING", "local-feather", ms(t), BigDecimal.ZERO, true, !costs.isEmpty(),
                    Msg.t("tryOnCompositor.bordas_suavizadas_no_recorte")));
        }

        // COMPOSITING — Category Fallback Compositor (#18)
        t = System.nanoTime();
        int rigid = 0;
        for (Garment g : ordered) {
            if (MannequinGeometry.layerOf(g.slot()) != TryOnLayer.ACCESSORY) {
                continue;
            }
            placements.add(overlay(canvas, body, g, DefaultOutfit.isDefault(g.itemId()) ? "padrao-fashionai" : "compositor-landmark"));
            rigid++;
        }
        stages.add(new FlatLayPipeline.Stage("COMPOSITING", "local-landmarks", ms(t), BigDecimal.ZERO, true, false,
                Msg.t("tryOnCompositor.calcados_acessorios", (rigid))));

        // Qualidade
        Map<String, Object> quality = new LinkedHashMap<>();
        double composition = placements.isEmpty() ? 0 : 0.78 + (polished ? 0.1 : 0) + (costs.isEmpty() ? 0 : 0.07);
        long approx = garments.stream().filter(g -> !g.backgroundRemoved()).count();
        composition -= approx * 0.08;
        quality.put("overall_score", round(Math.max(0, Math.min(1, composition))));
        quality.put("dimensions", MannequinGeometry.WIDTH + "x" + MannequinGeometry.HEIGHT);
        quality.put("colors_matched", garments.stream().map(Garment::color).filter(c -> c != null).distinct().toList());
        quality.put("fabric_realism", costs.isEmpty() ? 0.55 : 0.85);
        quality.put("composition_score", round(Math.max(0, composition)));
        return new Result(ImageOps.png(canvas), stages, sum(costs), ms(started), fallback, quality, warnings, placements, costs);
    }

    private static String fashnCategory(SchemeSlot slot) {
        return switch (slot) {
            case BOTTOM -> "bottoms";
            case FULL_BODY -> "one-pieces";
            default -> "tops";
        };
    }

    private Placement overlay(BufferedImage canvas, MannequinGeometry.Body body, Garment g, String engine) {
        String anchorKey = MannequinGeometry.anchorOf(g.slot(), g.subcategory());
        MannequinGeometry.Box anchor = body.anchors().getOrDefault(anchorKey, body.anchors().get("hand"));
        BufferedImage cut = ImageOps.crop(g.cutout(), ImageOps.alphaBounds(g.cutout()));
        double bw = anchor.w() * canvas.getWidth();
        double bh = anchor.h() * canvas.getHeight();
        double s = Math.min(bw / cut.getWidth(), bh / cut.getHeight());
        int w = Math.max(1, (int) Math.round(cut.getWidth() * s));
        int h = Math.max(1, (int) Math.round(cut.getHeight() * s));
        int x = (int) Math.round(anchor.x() * canvas.getWidth() + (bw - w) / 2);
        boolean topAligned = g.slot() != SchemeSlot.ACCESSORY && g.slot() != SchemeSlot.SHOES;
        int y = (int) Math.round(anchor.y() * canvas.getHeight() + (topAligned ? 0 : (bh - h) / 2));
        BufferedImage scaled = ImageOps.scale(cut, w, h);
        Graphics2D gr = canvas.createGraphics();
        ImageOps.quality(gr);
        gr.drawImage(ImageFilters.shadowOf(scaled, 0.25f, 6), x + 3, y + 5, null);
        gr.drawImage(scaled, x, y, null);
        gr.dispose();
        return new Placement(g.itemId(), g.slot(), MannequinGeometry.layerOf(g.slot()), anchorKey, engine,
                round(x / (double) canvas.getWidth()), round(y / (double) canvas.getHeight()),
                round(w / (double) canvas.getWidth()), round(h / (double) canvas.getHeight()));
    }

    /** Manequim estilizado (sem rosto nem traços identificáveis) — base do provador e da imagem enviada ao FASHN. */
    public BufferedImage drawMannequin(MannequinGeometry.Body body, Color skin) {
        int W = MannequinGeometry.WIDTH;
        int H = MannequinGeometry.HEIGHT;
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        ImageOps.quality(g);
        g.setPaint(new GradientPaint(0, 0, new Color(0xF4F2EF), 0, H, new Color(0xE2DDD6)));
        g.fillRect(0, 0, W, H);
        Color shade = skin.darker();
        boolean male = body.sex() == MannequinSex.MASCULINO;
        double cx = W / 2.0;
        double shoulder = body.shoulderW() * W;
        double waist = body.waistW() * W;
        double hip = body.hipW() * W;
        Map<String, Double> lv = body.levels();
        double yShoulder = lv.get("shoulder") * H;
        double yWaist = lv.get("waist") * H;
        double yHip = (body.params() != null ? lv.get("crotch") : lv.get("hip")) * H;   // base do tronco: virilha
        double yAnkle = lv.get("ankle") * H;
        double yHeadTop = lv.get("headTop") * H;
        // pernas
        for (int side : new int[]{-1, 1}) {
            GeneralPath leg = new GeneralPath();
            double outer = cx + side * hip / 2;
            double inner = cx + side * hip * 0.04;
            double ankle = cx + side * hip * 0.2;
            leg.moveTo(outer, yHip - 10);
            leg.curveTo(outer + side * 6, 0.62 * H, ankle + side * 26, 0.78 * H, ankle + side * 16, yAnkle);
            leg.lineTo(ankle - side * 14, yAnkle);
            leg.curveTo(ankle - side * 20, 0.78 * H, inner, 0.64 * H, inner, yHip + 20);
            leg.closePath();
            g.setPaint(new GradientPaint((float) (cx + side * hip), 0, shade, (float) cx, 0, skin));
            g.fill(leg);
            g.setColor(shade);
            g.fill(new Ellipse2D.Double(ankle - 26 + side * 6, yAnkle - 6, 52, 30));
        }
        // braços
        for (int side : new int[]{-1, 1}) {
            GeneralPath arm = new GeneralPath();
            double sx = cx + side * shoulder / 2;
            double wx = cx + side * (shoulder / 2 + 0.045 * W);
            arm.moveTo(sx - side * 6, yShoulder + 6);
            arm.curveTo(sx + side * 30, yShoulder + 40, wx + side * 20, 0.4 * H, wx + side * 12, 0.505 * H);
            arm.lineTo(wx - side * 14, 0.505 * H);
            arm.curveTo(wx - side * 8, 0.4 * H, sx - side * 6, yShoulder + 90, sx - side * 22, yShoulder + 40);
            arm.closePath();
            g.setPaint(new GradientPaint((float) (sx + side * 40), 0, shade, (float) sx, 0, skin));
            g.fill(arm);
            g.setColor(skin);
            g.fill(new Ellipse2D.Double(wx - 16 + side * 2, 0.505 * H - 4, 30, 48));
        }
        // tronco
        GeneralPath torso = new GeneralPath();
        torso.moveTo(cx - shoulder / 2, yShoulder);
        torso.curveTo(cx - shoulder / 2 - 4, yShoulder + 80, cx - waist / 2, yWaist - 60, cx - waist / 2, yWaist);
        torso.curveTo(cx - waist / 2, yWaist + 30, cx - hip / 2, yHip - 30, cx - hip / 2, yHip);
        torso.lineTo(cx + hip / 2, yHip);
        torso.curveTo(cx + hip / 2, yHip - 30, cx + waist / 2, yWaist + 30, cx + waist / 2, yWaist);
        torso.curveTo(cx + waist / 2, yWaist - 60, cx + shoulder / 2 + 4, yShoulder + 80, cx + shoulder / 2, yShoulder);
        torso.curveTo(cx + shoulder / 4, yShoulder - 22, cx - shoulder / 4, yShoulder - 22, cx - shoulder / 2, yShoulder);
        torso.closePath();
        g.setPaint(new GradientPaint((float) (cx - shoulder / 2), 0, shade, (float) cx, 0, skin, true));
        g.fill(torso);
        // roupa íntima neutra (decoro do manequim)
        Color under = new Color(0xB9B4AD);
        g.setColor(under);
        GeneralPath brief = new GeneralPath();
        brief.moveTo(cx - hip / 2 + 2, yHip - 34);
        brief.lineTo(cx + hip / 2 - 2, yHip - 34);
        brief.lineTo(cx + hip * 0.12, yHip + 38);
        brief.lineTo(cx - hip * 0.12, yHip + 38);
        brief.closePath();
        g.fill(brief);
        if (!male) {
            g.fill(new RoundRectangle2D.Double(cx - shoulder * 0.36, yShoulder + 58, shoulder * 0.72, 62, 30, 30));
        }
        // pescoço e cabeça (sem traços faciais)
        double headR = body.headR() * W;
        g.setColor(skin);
        g.fill(new RoundRectangle2D.Double(cx - headR * 0.45, yHeadTop + headR * 2.1, headR * 0.9, Math.max(8, yShoulder - (yHeadTop + headR * 2.1)), 18, 18));
        g.setPaint(new GradientPaint((float) (cx - headR), 0, shade, (float) (cx + headR * 0.3), 0, skin));
        g.fill(new Ellipse2D.Double(cx - headR, yHeadTop, headR * 2, headR * 2.45));
        g.setStroke(new BasicStroke(1.2f));
        g.setColor(new Color(0, 0, 0, 30));
        g.draw(torso);
        g.dispose();
        return img;
    }

    private static BigDecimal sum(Map<String, BigDecimal> costs) {
        return costs.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static long ms(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
