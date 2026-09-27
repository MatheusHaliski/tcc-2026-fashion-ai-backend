package br.com.fashionai.application.imaging;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.GeneralPath;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/**
 * Look padrão do FashionAI no provador 2D (RF18): o manequim nunca sai sem roupa. A zona do corpo sem peça legível
 * (tronco, pernas, pés) recebe a peça padrão dos assets do FashionAI — camiseta de referência, jeans e tênis casual de
 * {@code /public/assets_pecas} —, a mesma regra do 3D ({@code lib/avatar3d/human/default-outfit.ts}). Jaqueta e casaco
 * não cobrem o tronco (vão por cima da camiseta); o casaco longo não substitui a calça. Sem o arquivo do asset, a peça é
 * desenhada (silhueta lisa na cor do tecido): a zona nunca fica descoberta. As peças padrão nunca vão ao FASHN.
 */
@Component
public class DefaultOutfit {
    private static final Logger log = LoggerFactory.getLogger(DefaultOutfit.class);

    public enum Zone { UPPER, LOWER, FEET }

    record Spec(String id, String file, SchemeSlot slot, String subcategory, String color, int rgb) {
    }

    private static final Map<Zone, Spec> SPECS = new EnumMap<>(Map.of(
            Zone.UPPER, new Spec("fai-padrao-camiseta", "/assets_pecas/01_Parte_superior/01_camiseta_referencia.png", SchemeSlot.TOP, "t_shirt", "blue", 0x1972C4),
            Zone.LOWER, new Spec("fai-padrao-jeans", "/assets_pecas/02_Parte_inferior/01_jeans.png", SchemeSlot.BOTTOM, "jeans", "blue", 0x255F9F),
            Zone.FEET, new Spec("fai-padrao-tenis", "/assets_pecas/03_Calcados/01_tenis_casual.png", SchemeSlot.SHOES, "sneakers", "beige", 0x6F5F3A)));
    private static final int MAX_SIDE = 900;

    private final Function<String, Optional<Path>> files;
    private final Map<Zone, TryOnCompositor.Garment> cache = new ConcurrentHashMap<>();

    @Autowired
    public DefaultOutfit(AssetCatalogService assets) {
        this(assets::publicFile);
    }

    /** {@code files} resolve o caminho público do asset para um arquivo (vazio = desenha a peça). */
    public DefaultOutfit(Function<String, Optional<Path>> files) {
        this.files = files;
    }

    public static UUID idOf(Zone z) {
        return UUID.nameUUIDFromBytes(SPECS.get(z).id().getBytes(StandardCharsets.UTF_8));
    }

    public static boolean isDefault(UUID itemId) {
        return itemId != null && SPECS.keySet().stream().anyMatch(z -> idOf(z).equals(itemId));
    }

    /** Zonas cobertas pelas peças com imagem legível. */
    public static Set<Zone> covered(List<TryOnCompositor.Garment> garments) {
        EnumSet<Zone> out = EnumSet.noneOf(Zone.class);
        for (TryOnCompositor.Garment g : garments) {
            if (g.cutout() == null) {
                continue;
            }
            switch (g.slot()) {
                case TOP -> out.add(Zone.UPPER);
                case BOTTOM -> out.add(Zone.LOWER);
                case FULL_BODY -> { out.add(Zone.UPPER); out.add(Zone.LOWER); }
                case SHOES -> out.add(Zone.FEET);
                default -> { }          // jaqueta/casaco e acessório não cobrem a zona sozinhos
            }
        }
        return out;
    }

    /** Peças padrão para as zonas que as peças dadas deixam descobertas. */
    public List<TryOnCompositor.Garment> complete(List<TryOnCompositor.Garment> garments) {
        Set<Zone> have = covered(garments);
        List<TryOnCompositor.Garment> out = new ArrayList<>();
        for (Zone z : Zone.values()) {
            if (!have.contains(z)) {
                out.add(garment(z));
            }
        }
        return out;
    }

    public TryOnCompositor.Garment garment(Zone z) {
        return cache.computeIfAbsent(z, k -> {
            Spec s = SPECS.get(k);
            BufferedImage cut = load(s).orElseGet(() -> drawn(k, new Color(s.rgb())));
            return new TryOnCompositor.Garment(idOf(k), s.slot(), s.subcategory(), cut, null, true, s.color());
        });
    }

    private Optional<BufferedImage> load(Spec s) {
        try {
            Optional<Path> p = files.apply(s.file());
            if (p.isEmpty()) {
                return Optional.empty();
            }
            BufferedImage img = ImageOps.toArgb(ImageOps.decode(Files.readAllBytes(p.get())));
            ImageOps.Box box = ImageOps.alphaBounds(img);
            if (box.empty()) {
                return Optional.empty();
            }
            BufferedImage cut = ImageOps.crop(img, box);
            double k = Math.min(1, MAX_SIDE / (double) Math.max(cut.getWidth(), cut.getHeight()));
            return Optional.of(k < 1 ? ImageOps.scale(cut, (int) Math.round(cut.getWidth() * k), (int) Math.round(cut.getHeight() * k)) : cut);
        } catch (Exception ex) {                    // asset ausente ou ilegível: a peça é desenhada
            log.warn("Peça padrão {} indisponível ({}): desenhada no lugar", s.id(), ex.getMessage());
            return Optional.empty();
        }
    }

    /** Silhueta lisa da peça (camiseta, calça, par de tênis) com fundo transparente. */
    static BufferedImage drawn(Zone z, Color c) {
        BufferedImage img = new BufferedImage(600, 600, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(c);
        GeneralPath p = new GeneralPath();
        switch (z) {
            case UPPER -> {            // camiseta: tronco + mangas curtas
                p.moveTo(210, 20); p.lineTo(390, 20); p.lineTo(590, 130); p.lineTo(540, 250); p.lineTo(460, 210);
                p.lineTo(460, 590); p.lineTo(140, 590); p.lineTo(140, 210); p.lineTo(60, 250); p.lineTo(10, 130);
                p.closePath();
                g.fill(p);
            }
            case LOWER -> {            // calça: cós + duas pernas
                p.moveTo(130, 10); p.lineTo(470, 10); p.lineTo(500, 590); p.lineTo(320, 590); p.lineTo(300, 160);
                p.lineTo(280, 590); p.lineTo(100, 590);
                p.closePath();
                g.fill(p);
            }
            case FEET -> {             // par de tênis
                g.fill(new RoundRectangle2D.Double(20, 330, 260, 150, 80, 80));
                g.fill(new RoundRectangle2D.Double(320, 330, 260, 150, 80, 80));
            }
        }
        g.dispose();
        return img;
    }
}
