package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.testkit.Portrait;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Caracterização do {@link LocalSchemeComposer} com um acervo fixo (ids {@code UUID(0x10CA1, n)}): composições para
 * vários pedidos (ocasião, estilo, estação, texto livre, quantidade), acervos só com peça inteira, sem calçado, com
 * sexos misturados e com peças indisponíveis/reprovadas, além de {@code toComposition}, {@code onePerType},
 * {@code slotOf} e {@code synthesize}, contra {@code ai/local-scheme-composer-portrait.txt}.
 */
class LocalSchemeComposerCharacterizationTest {
    private static final String GOLDEN = "/ai/local-scheme-composer-portrait.txt";
    /** categoria, subcategoria, cor, estilos, ocasiões, material, preço, sexo, nome */
    private static final String[][] WARDROBE = {
            {"upper_piece", "t_shirt", "white", "basic,streetwear", "casual", "COTTON", "80.00", "UNISSEX", "Camiseta branca"},
            {"upper_piece", "hoodie", "black", "streetwear,y2k", "casual,sport", "COTTON", "150.00", "UNISSEX", "Moletom preto"},
            {"upper_piece", "blazer", "navy", "classic,tailored", "trabalho,formal", "WOOL", "420.00", "M", "Blazer marinho"},
            {"upper_piece", "crop_top", "yellow", "glam", "party", "SILK", "90.00", "F", "Cropped amarelo"},
            {"upper_piece", "coat", "beige", "minimalist,chic", "trabalho", "WOOL", "700.00", "UNISSEX", "Casaco bege"},
            {"lower_piece", "jeans", "blue", "basic,streetwear", "casual", "DENIM", "200.00", "UNISSEX", "Calça jeans"},
            {"lower_piece", "tailored_pants", "black", "classic", "trabalho", "WOOL", "310.00", "M", "Calça de alfaiataria"},
            {"lower_piece", "shorts", "green", "sporty", "sport,praia", "COTTON", "70.00", "UNISSEX", "Bermuda verde"},
            {"lower_piece", "skirt", "pink", "romantic", "party", "SILK", "180.00", "F", "Saia rosa"},
            {"shoes_piece", "casual_sneakers", "white", "streetwear", "casual,sport", "LEATHER", "350.00", "UNISSEX", "Tênis branco"},
            {"shoes_piece", "oxford_shoes", "brown", "classic", "trabalho,formal", "LEATHER", "500.00", "M", "Oxford marrom"},
            {"shoes_piece", "sandals", "beige", "boho", "praia", "LEATHER", "120.00", "F", "Sandália bege"},
            {"shoes_piece", "ankle_boots", "black", "edgy", "festa", "LEATHER", null, "UNISSEX", "Bota curta"},
            {"accessory_piece", "cap", "red", "streetwear", "casual", "COTTON", "60.00", "UNISSEX", "Boné vermelho"},
            {"accessory_piece", "belt", "brown", "classic", "trabalho", "LEATHER", null, "UNISSEX", "Cinto marrom"},
            {"accessory_piece", "scarf", "purple", "boho", "casual", "WOOL", "50.00", "UNISSEX", "Cachecol roxo"},
            {"full_body_piece", "dress", "red", "glam,romantic", "party,wedding", "SILK", "640.00", "F", "Vestido vermelho"},
            {"full_body_piece", "jumpsuit", "olive", "utility", "casual", "COTTON", "260.00", "F", "Macacão oliva"},
            {null, null, "gray", "", "", "POLYESTER", "10.00", "UNISSEX", null},
    };

    private static List<WardrobeItem> wardrobe() {
        User owner = new User();
        owner.assignId(new UUID(0x10CA1L, 0));
        List<WardrobeItem> out = new ArrayList<>();
        for (int i = 0; i < WARDROBE.length; i++) {
            String[] p = WARDROBE[i];
            WardrobeItem w = new WardrobeItem();
            w.assignId(new UUID(0x10CA1L, i + 1));
            w.setUser(owner);
            w.setCategory(p[0]);
            w.setSubcategory(p[1]);
            w.setColor(p[2]);
            w.setStyleTags(p[3]);
            w.setOccasionTags(p[4]);
            w.setMaterial(p[5]);
            w.setPrice(p[6] == null ? null : new BigDecimal(p[6]));
            w.setSex(p[7]);
            w.setName(p[8]);
            w.setFavorite(i % 5 == 0);
            out.add(w);
        }
        return out;
    }

    @Test
    void retratoDasComposicoesEDasRegrasPublicas() throws Exception {
        Portrait p = new Portrait("00000000-0001-0ca1-");
        List<WardrobeItem> all = wardrobe();
        Object[][] requests = {
                {List.of("casual"), List.of("streetwear"), "SUMMER", "algo leve com tênis branco", 3},
                {List.of("trabalho"), List.of("classic", "tailored"), "WINTER", "reunião importante com blazer", 5},
                {List.of("party"), List.of("glam"), "SPRING", "festa à noite, vestido vermelho", 4},
                {null, null, null, null, 12},
                {List.of("praia", "sport"), List.of("sporty", "boho"), "summer", "bermuda e sandália", 6},
                {List.of(), List.of(), "AUTUMN", "jaqueta e bota", 2},
                {List.of("casual"), List.of("minimalist"), "MONSOON", "ÁÉÍ çã!! peça", 20},
                {List.of("casual"), List.of("streetwear"), "SUMMER", null, 0},
        };
        for (int i = 0; i < requests.length; i++) {
            Object[] r = requests[i];
            @SuppressWarnings("unchecked")
            List<String> occ = (List<String>) r[0];
            @SuppressWarnings("unchecked")
            List<String> sty = (List<String>) r[1];
            p.add("compose." + i, LocalSchemeComposer.compose(all, occ, sty, (String) r[2], (String) r[3], (int) r[4]));
        }
        p.add("compose.fullOnly", LocalSchemeComposer.compose(List.of(all.get(16), all.get(17), all.get(9), all.get(13)), List.of("party"),
                List.of("glam"), "SUMMER", null, 5));
        p.add("compose.fullNoShoes", LocalSchemeComposer.compose(List.of(all.get(16), all.get(14)), null, null, null, null, 5));
        p.add("compose.accessoriesOnly", LocalSchemeComposer.compose(List.of(all.get(13), all.get(14), all.get(15), all.get(18)), null, null, null,
                null, 5));
        p.add("compose.topAndShoes", LocalSchemeComposer.compose(List.of(all.get(0), all.get(9), all.get(13)), List.of("casual"), null, null,
                "boné vermelho", 5));
        p.add("compose.single", LocalSchemeComposer.compose(List.of(all.get(0)), null, null, null, null, 5));
        p.add("compose.empty", LocalSchemeComposer.compose(List.of(), null, null, null, null, 5));
        List<WardrobeItem> filtered = wardrobe();
        filtered.get(0).setDisponivel(false);
        filtered.get(5).setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        filtered.get(9).setModerationStatus(ModerationStatus.REJECTED_POLICY);
        filtered.get(10).setModerationStatus(ModerationStatus.REJECTED_NOT_CLOTHING);
        p.add("compose.filtered", LocalSchemeComposer.compose(filtered, List.of("casual"), List.of("streetwear"), "WINTER", "jeans", 6));
        List<WardrobeItem> reversed = new ArrayList<>(all);
        Collections.reverse(reversed);
        p.add("compose.reversed", LocalSchemeComposer.compose(reversed, List.of("casual"), List.of("streetwear"), "SUMMER", null, 6));
        for (int[] picks : new int[][]{{0, 5, 9}, {2, 6, 10, 14}, {16, 11}, {3, 8, 11, 15}, {4, 6, 10}, {1, 7, 9, 13}, {18}, {12, 17}}) {
            List<WardrobeItem> pieces = new ArrayList<>();
            for (int i : picks) {
                pieces.add(all.get(i));
            }
            String key = java.util.Arrays.toString(picks);
            p.add("toComposition." + key, LocalSchemeComposer.toComposition(pieces, List.of("casual"), List.of("classic"), "WINTER", 1.5));
            p.add("toComposition.blank." + key, LocalSchemeComposer.toComposition(pieces, null, null, null, 0));
        }
        p.add("onePerType.all", LocalSchemeComposer.onePerType(all).stream().map(WardrobeItem::getId).toList());
        p.add("onePerType.reversed", LocalSchemeComposer.onePerType(reversed).stream().map(WardrobeItem::getId).toList());
        p.add("onePerType.fullFirst", LocalSchemeComposer.onePerType(List.of(all.get(16), all.get(0), all.get(5), all.get(9), all.get(18)))
                .stream().map(WardrobeItem::getId).toList());
        for (WardrobeItem w : all) {
            p.add("slotOf." + w.getSubcategory(), LocalSchemeComposer.slotOf(w));
        }
        WardrobeItem jacket = wardrobe().get(0);
        for (String sub : List.of("jacket", "parka", "windbreaker", "cardigan", "kimono")) {
            jacket.setSubcategory(sub);
            p.add("slotOf.upper." + sub, LocalSchemeComposer.slotOf(jacket));
        }
        p.add("synthesize", LocalSchemeComposer.synthesize(List.of("casual", "sport", "casual", "trabalho", "festa"), List.of("festa"), 3));
        p.add("synthesize.null", LocalSchemeComposer.synthesize(List.of("b", "a", "b"), null, 1));
        p.add("synthesize.empty", LocalSchemeComposer.synthesize(List.of(), List.of("x", "y", "x"), 5));
        p.verify(LocalSchemeComposerCharacterizationTest.class, GOLDEN);
    }
}
