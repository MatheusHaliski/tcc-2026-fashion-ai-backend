package br.com.fashionai.application.imaging;

import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Provador 2D: o manequim nunca sai sem roupa — tronco, pernas e pés vazios recebem a peça padrão do FashionAI. */
class TryOnDefaultOutfitTest {
    private static final Path PUBLIC = Path.of("..", "public");
    private final DefaultOutfit assets = new DefaultOutfit(url -> {
        Path p = PUBLIC.resolve(url.substring(1));
        return Files.isRegularFile(p) ? Optional.of(p) : Optional.empty();
    });

    @Test
    void completaSoAsZonasDescobertas() {
        assertEquals(3, assets.complete(List.of()).size());
        assertEquals(Set.of(SchemeSlot.BOTTOM, SchemeSlot.SHOES), slots(assets.complete(List.of(piece(SchemeSlot.TOP)))));
        assertEquals(Set.of(SchemeSlot.SHOES), slots(assets.complete(List.of(piece(SchemeSlot.FULL_BODY)))));
        // jaqueta não cobre o tronco sozinha; acessório não é roupa
        assertEquals(Set.of(SchemeSlot.TOP, SchemeSlot.BOTTOM, SchemeSlot.SHOES), slots(assets.complete(List.of(piece(SchemeSlot.OUTERWEAR), piece(SchemeSlot.ACCESSORY)))));
        assertTrue(assets.complete(List.of(piece(SchemeSlot.TOP), piece(SchemeSlot.BOTTOM), piece(SchemeSlot.SHOES))).isEmpty());
        // peça com imagem ilegível conta como vazia
        assertEquals(Set.of(SchemeSlot.TOP, SchemeSlot.BOTTOM, SchemeSlot.SHOES), slots(assets.complete(List.of(new TryOnCompositor.Garment(UUID.randomUUID(), SchemeSlot.TOP, "t_shirt", null, null, true, "blue")))));
    }

    @Test
    void usaOsAssetsDoFashionAiOuDesenhaAPeca() {
        for (DefaultOutfit.Zone z : DefaultOutfit.Zone.values()) {
            TryOnCompositor.Garment g = assets.garment(z);
            assertNotNull(g.cutout());
            assertTrue(DefaultOutfit.isDefault(g.itemId()));
            assertFalse(ImageOps.alphaBounds(g.cutout()).empty());
        }
        // sem os arquivos (asset ausente no servidor): a peça é desenhada, nunca fica de fora
        DefaultOutfit none = new DefaultOutfit(url -> Optional.empty());
        for (DefaultOutfit.Zone z : DefaultOutfit.Zone.values()) assertFalse(ImageOps.alphaBounds(none.garment(z).cutout()).empty());
    }

    @Test
    void manequimSemPecasSaiVestidoNosDoisSexos() throws IOException {
        TryOnCompositor c = new TryOnCompositor(List.of(), List.of(), assets);
        File dir = new File("target/nunca-sem-roupa");
        dir.mkdirs();
        for (MannequinSex sex : MannequinSex.values()) {
            MannequinGeometry.Body body = MannequinGeometry.body(sex, BodyBuild.MEDIUM);
            Color skin = new Color(0xC99A6E);
            TryOnCompositor.Result r = c.render(body, "#C99A6E", List.of(), false);
            BufferedImage img = ImageOps.decode(r.png());
            ImageIO.write(img, "png", new File(dir, "sem-pecas-" + sex.name().toLowerCase() + ".png"));
            assertEquals(EnumSet.of(SchemeSlot.TOP, SchemeSlot.BOTTOM, SchemeSlot.SHOES),
                    EnumSet.copyOf(r.placements().stream().filter(p -> "padrao-fashionai".equals(p.engine())).map(TryOnCompositor.Placement::slot).toList()));
            // no miolo do tronco e das coxas, a cor não é mais a da pele: há roupa por cima
            for (String anchor : List.of("TOP", "BOTTOM")) {
                MannequinGeometry.Box b = body.anchors().get(anchor);
                double skinShare = skinShare(img, b, skin);
                assertTrue(skinShare < 0.15, anchor + ": " + Math.round(skinShare * 100) + "% da caixa ainda é pele");
            }
        }
    }

    @Test
    void pecaPadraoNuncaVaiAoProvedorExterno() {
        int[] calls = {0};
        ImageProviderPorts.TryOnProviderPort port = new ImageProviderPorts.TryOnProviderPort() {
            @Override public boolean available() { return true; }
            @Override public Optional<ImageProviderPorts.ProviderImage> tryOn(byte[] model, byte[] garment, String category) { calls[0]++; return Optional.empty(); }
        };
        TryOnCompositor c = new TryOnCompositor(List.of(port), List.of(), assets);
        c.render(MannequinGeometry.body(MannequinSex.FEMININO, BodyBuild.MEDIUM), "#C99A6E", List.of(), true);
        assertEquals(0, calls[0]);
    }

    @Test
    void provedorExternoSempreRecebeOManequimVestido() {
        MannequinGeometry.Body body = MannequinGeometry.body(MannequinSex.FEMININO, BodyBuild.MEDIUM);
        Color skin = new Color(0xC99A6E);
        for (SchemeSlot slot : List.of(SchemeSlot.TOP, SchemeSlot.BOTTOM, SchemeSlot.FULL_BODY)) {
            List<BufferedImage> sent = new java.util.ArrayList<>();
            ImageProviderPorts.TryOnProviderPort port = new ImageProviderPorts.TryOnProviderPort() {
                @Override public boolean available() { return true; }
                @Override public Optional<ImageProviderPorts.ProviderImage> tryOn(byte[] model, byte[] garment, String category) { sent.add(ImageOps.decode(model)); return Optional.empty(); }
            };
            TryOnCompositor c = new TryOnCompositor(List.of(port), List.of(), assets);
            c.render(body, "#C99A6E", List.of(piece(slot)), true);
            assertEquals(1, sent.size(), slot + ": uma chamada ao provedor");
            // tronco e coxas da imagem enviada: cobertos (peça padrão já vestida ou como marcador da zona trocada)
            for (String anchor : List.of("TOP", "BOTTOM")) {
                double share = skinShare(sent.get(0), body.anchors().get(anchor), skin);
                assertTrue(share < 0.15, slot + "/" + anchor + ": " + Math.round(share * 100) + "% de pele na imagem enviada ao provedor");
            }
        }
    }

    private static double skinShare(BufferedImage img, MannequinGeometry.Box b, Color skin) {
        // miolo da caixa (a metade central), onde fica o corpo
        int x0 = (int) ((b.x() + b.w() * 0.35) * img.getWidth()), x1 = (int) ((b.x() + b.w() * 0.65) * img.getWidth());
        int y0 = (int) ((b.y() + b.h() * 0.3) * img.getHeight()), y1 = (int) ((b.y() + b.h() * 0.6) * img.getHeight());
        int n = 0, bare = 0;
        for (int y = y0; y < y1; y += 2) for (int x = x0; x < x1; x += 2) {
            Color p = new Color(img.getRGB(x, y)); n++;
            if (Math.abs(p.getRed() - skin.getRed()) + Math.abs(p.getGreen() - skin.getGreen()) + Math.abs(p.getBlue() - skin.getBlue()) < 60) bare++;
        }
        return n == 0 ? 1 : bare / (double) n;
    }

    private static Set<SchemeSlot> slots(List<TryOnCompositor.Garment> gs) {
        return gs.stream().map(TryOnCompositor.Garment::slot).collect(java.util.stream.Collectors.toSet());
    }

    private static TryOnCompositor.Garment piece(SchemeSlot slot) {
        BufferedImage img = new BufferedImage(40, 40, BufferedImage.TYPE_INT_ARGB);
        for (int y = 5; y < 35; y++) for (int x = 5; x < 35; x++) img.setRGB(x, y, 0xFF336699);
        return new TryOnCompositor.Garment(UUID.randomUUID(), slot, "x", img, ImageOps.png(img), true, "blue");
    }
}
