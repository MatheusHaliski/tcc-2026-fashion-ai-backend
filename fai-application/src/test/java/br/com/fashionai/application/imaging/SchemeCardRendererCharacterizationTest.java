package br.com.fashionai.application.imaging;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.testkit.Portrait;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Caracterização do {@link SchemeCardRenderer}: SHA-256 dos pixels e do PNG de cards em todas as variações (fundo
 * liso, gradiente linear e radial, container, camadas AURA e material lidas do catálogo, arte com IA em passe-partout
 * ou não, peças em todos os slots com posição, escala, rotação, opacidade, filtros e fundo por peça, chips, preço e
 * chip do Hype na mesma linha ou acima) e das funções públicas, contra {@code imaging/scheme-card-portrait.txt}.
 */
class SchemeCardRendererCharacterizationTest {
    private static final String GOLDEN = "/imaging/scheme-card-portrait.txt";

    @TempDir
    Path dir;

    private static BufferedImage art(Color a, Color b, int w, int h, boolean transparentBorder) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setPaint(new GradientPaint(0, 0, a, w, h, b));
        int m = transparentBorder ? w / 6 : 0;
        g.fillRoundRect(m, m, w - 2 * m, h - 2 * m, 30, 30);
        g.setColor(Color.BLACK);
        g.drawLine(m, m, w - m, h - m);
        g.dispose();
        return img;
    }

    private SchemeCardRenderer renderer() throws Exception {
        AssetCatalogService assets = mock(AssetCatalogService.class);
        Path aura = dir.resolve("aura.png");
        Path material = dir.resolve("material.png");
        ImageIO.write(art(new Color(0x8844CC), new Color(0x22AA88), 120, 200, false), "png", aura.toFile());
        ImageIO.write(art(new Color(0xEEDDCC), new Color(0x664422), 90, 90, false), "png", material.toFile());
        when(assets.auraVariant("aura-card")).thenReturn(Optional.of(Map.of("static", Map.of("cardUrl", "/assets/aura.png"))));
        when(assets.auraVariant("aura-url")).thenReturn(Optional.of(Map.of("static", Map.of("url", "/assets/aura.png"))));
        when(assets.auraVariant("aura-vazia")).thenReturn(Optional.of(Map.of("outro", 1)));
        when(assets.material("linho")).thenReturn(Optional.of(Map.of("static", Map.of("cardUrl", "/assets/faltando.png", "url", "/assets/material.png"))));
        when(assets.publicFile(anyString())).thenReturn(Optional.empty());
        when(assets.publicFile("/assets/aura.png")).thenReturn(Optional.of(aura));
        when(assets.publicFile("/assets/material.png")).thenReturn(Optional.of(material));
        when(assets.publicFile("/assets/quebrado.png")).thenReturn(Optional.of(dir.resolve("nao-existe.png")));
        when(assets.auraVariant("aura-quebrada")).thenReturn(Optional.of(Map.of("static", Map.of("cardUrl", "/assets/quebrado.png"))));
        return new SchemeCardRenderer(assets);
    }

    private static List<SchemeCardRenderer.CardItem> items() {
        List<SchemeCardRenderer.CardItem> out = new ArrayList<>();
        ImageFilters.Filters warm = new ImageFilters.Filters(0, 1.3, 1.1, 1.2, 15);
        ImageFilters.Filters blur = new ImageFilters.Filters(2, 0.5, 0.9, 1, 0);
        out.add(new SchemeCardRenderer.CardItem(art(Color.RED, Color.ORANGE, 200, 240, true), SchemeSlot.TOP, null, null, 1, 0, 1, 2,
                ImageFilters.Filters.NEUTRAL, null));
        out.add(new SchemeCardRenderer.CardItem(art(Color.BLUE, Color.CYAN, 160, 260, true), SchemeSlot.BOTTOM, 0.3, 0.7, 1.4, -12, 0.8, 1,
                warm, "#FFEEAA"));
        out.add(new SchemeCardRenderer.CardItem(art(Color.DARK_GRAY, Color.WHITE, 220, 120, false), SchemeSlot.SHOES, null, null, 0, 30, 0.01, 5,
                blur, null));
        out.add(new SchemeCardRenderer.CardItem(art(Color.GREEN, Color.YELLOW, 90, 90, true), SchemeSlot.ACCESSORY, null, null, 1, 0, 1, 3,
                null, "#223344"));
        out.add(new SchemeCardRenderer.CardItem(art(Color.PINK, Color.MAGENTA, 90, 90, true), SchemeSlot.ACCESSORY, null, null, 0.7, 45, 2, 4,
                warm, null));
        out.add(new SchemeCardRenderer.CardItem(art(Color.GRAY, Color.BLACK, 150, 220, true), SchemeSlot.OUTERWEAR, 0.6, null, 1, 0, 1, 0,
                null, null));
        out.add(new SchemeCardRenderer.CardItem(null, SchemeSlot.TOP, 0.5, 0.5, 1, 0, 1, 9, null, null));
        return out;
    }

    private static SchemeCardRenderer.Background bg(String color, List<String> stops, double angle, boolean radial, String aura,
                                                    String material, BufferedImage ai, boolean passe, String container) {
        return new SchemeCardRenderer.Background(color, stops, angle, radial, aura, material, ai, passe, container, "atelier");
    }

    @Test
    void retratoDosCardsEDasFuncoesPublicas() throws Exception {
        SchemeCardRenderer r = renderer();
        Portrait p = new Portrait("-");
        BufferedImage ai = art(new Color(0x113355), new Color(0xDDAA33), 300, 500, false);
        Map<String, SchemeCardRenderer.Background> backgrounds = new java.util.LinkedHashMap<>();
        backgrounds.put("null", null);
        backgrounds.put("liso", bg("#F4F2EF", null, 0, false, null, null, null, false, null));
        backgrounds.put("semCor", bg(null, List.of("#123456"), 0, false, null, null, null, false, ""));
        backgrounds.put("escuro", bg("#101820", null, 0, false, null, null, null, false, null));
        backgrounds.put("linear", bg("#FFFFFF", List.of("#112233", "#AABBCC", "#FFEEDD"), 135, false, null, null, null, false, "#FAFAFA"));
        backgrounds.put("radial", bg("#FFFFFF", List.of("#000000", "#336699"), 0, true, null, null, null, false, "#202020"));
        backgrounds.put("aura", bg("#FFFFFF", null, 0, false, "aura-card", "linho", null, false, null));
        backgrounds.put("auraUrl", bg("#FFFFFF", null, 0, false, "aura-url", null, null, false, null));
        backgrounds.put("material", bg("#FFFFFF", null, 0, false, "aura-vazia", "linho", null, false, null));
        backgrounds.put("quebrado", bg("#FFFFFF", null, 0, false, "aura-quebrada", "desconhecido", null, false, null));
        backgrounds.put("ia", bg("#FFFFFF", null, 0, false, null, null, ai, false, null));
        backgrounds.put("passePartout", bg("#FFFFFF", null, 0, false, null, null, ai, true, "#F5F3EF"));
        for (Map.Entry<String, SchemeCardRenderer.Background> e : backgrounds.entrySet()) {
            for (SchemeCardRenderer.Size size : SchemeCardRenderer.Size.values()) {
                SchemeCardRenderer.Card card = new SchemeCardRenderer.Card("Look " + e.getKey(), "ana", List.of("casual", "streetwear"),
                        "R$ 360,00", "HypeScore 76 · Tendência", e.getValue(), items(), size);
                p.add("render." + e.getKey() + "." + size, Portrait.pixels(r.renderImage(card)));
            }
        }
        List<String> manyChips = List.of("casual", "trabalho", "streetwear", "classic", "minimalist", "festa", "praia", "inverno");
        String longTitle = "Um título de look muito, muito comprido que não cabe na largura do card de jeito nenhum";
        p.add("render.textos", Portrait.pixels(r.renderImage(new SchemeCardRenderer.Card(longTitle, null, manyChips, null, null, null,
                List.of(), SchemeCardRenderer.Size.COMPACT))));
        p.add("render.semChips", Portrait.pixels(r.renderImage(new SchemeCardRenderer.Card(null, "bia", null, "R$ 1.234.567,89",
                "HypeScore 100 · Viral · muito longo para caber ao lado", null, items(), SchemeCardRenderer.Size.EXPANDED))));
        p.add("render.hypeSemPreco", Portrait.pixels(r.renderImage(new SchemeCardRenderer.Card("Só Hype", "caio", List.of("§i18n:x§"), null,
                "HypeScore 41 · Relevante", null, items().subList(0, 2), SchemeCardRenderer.Size.COMPACT))));
        p.add("render.hypeVazio", Portrait.pixels(r.renderImage(new SchemeCardRenderer.Card("Hype vazio", "caio", List.of(), "R$ 10,00",
                "  ", null, items().subList(1, 3), SchemeCardRenderer.Size.COMPACT))));
        p.add("render.png", r.render(new SchemeCardRenderer.Card("PNG", "ana", List.of("casual"), "R$ 99,90", "HypeScore 63 · Em alta",
                backgrounds.get("linear"), items(), SchemeCardRenderer.Size.EXPANDED)));
        for (SchemeSlot slot : SchemeSlot.values()) {
            List<SchemeCardRenderer.CardItem> alone = new ArrayList<>();
            for (int n = 0; n < 5; n++) {
                alone.add(new SchemeCardRenderer.CardItem(art(Color.RED, Color.BLUE, 80, 120, true), slot, null, null, 1, 0, 1, n, null, null));
            }
            p.add("defaultPosition." + slot, Portrait.pixels(r.renderImage(new SchemeCardRenderer.Card("Slot", "ana", List.of(), null, null,
                    null, alone, SchemeCardRenderer.Size.COMPACT))));
        }
        for (int rgb : new int[]{0x000000, 0xFFFFFF, 0x808080, 0x1A1714, 0xF5F3EF, 0x3366AA, 0xFF0000}) {
            p.add("luminance." + Integer.toHexString(rgb), SchemeCardRenderer.luminance(rgb));
            p.add("contrast." + Integer.toHexString(rgb), SchemeCardRenderer.contrast(rgb, 0xF4EFE8));
        }
        for (Map.Entry<String, SchemeCardRenderer.Background> e : backgrounds.entrySet()) {
            p.add("containerColor." + e.getKey(), String.valueOf(r.containerColor(e.getValue())));
        }
        for (int[] c : new int[][]{{900, 50, 200, 180, 260}, {900, 50, 200, 260, 320}, {900, 50, 200, 0, 560}, {900, 50, 200, 0, 590}}) {
            p.add("hypeFitsBeside." + java.util.Arrays.toString(c), SchemeCardRenderer.hypeFitsBeside(c[0], c[1], c[2], c[3], c[4]));
        }
        p.verify(SchemeCardRendererCharacterizationTest.class, GOLDEN);
    }
}
