package br.com.fashionai.application.flair3d.bancada;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * As cartas de exemplo da bancada de tela ({@link Flair3dBancadaDeTela}): um guarda-roupa fictício com as quatro vagas,
 * as seis famílias de cor, ocasiões e materiais variados, para que qualquer rodada dos jogos de cartas possa ser ganha
 * ou perdida de propósito. Nada aqui vem do banco nem de uma pessoa real.
 */
final class Flair3dBancadaGuardaRoupa {
    private Flair3dBancadaGuardaRoupa() {
    }

    /** posição; nome; etiquetas (as de {@link Flair3dFixtures}) */
    private static final String[][] PECAS = {
            {"SUP", "Camisa azul", "sub:shirt", "color:blue", "occasion:work", "material:cotton", "style:classic"},
            {"SUP", "Camiseta branca", "sub:t_shirt", "color:white", "occasion:casual", "material:linen", "style:basic"},
            {"SUP", "Blusa vermelha", "sub:blouse", "color:red", "occasion:party", "material:silk", "style:glam", "tier:PRATA", "ovr:72"},
            {"SUP", "Blazer preto", "sub:blazer", "color:black", "occasion:formal", "material:wool", "style:classic", "tier:OURO", "ovr:84"},
            {"SUP", "Suéter verde", "sub:sweater", "color:green", "occasion:casual", "material:wool", "style:cozy"},
            {"SUP", "Jaqueta impermeável", "sub:jacket", "color:blue", "occasion:outdoor", "material:nylon", "style:sport"},
            {"INF", "Jeans azul", "sub:jeans", "color:blue", "occasion:casual", "material:denim", "style:basic"},
            {"INF", "Calça de alfaiataria", "sub:tailored_pants", "color:black", "occasion:business", "material:wool", "style:classic", "tier:PRATA", "ovr:70"},
            {"INF", "Saia rosa", "sub:skirt", "color:pink", "occasion:date", "material:satin", "style:romantic"},
            {"INF", "Short branco", "sub:shorts", "color:white", "occasion:vacation", "material:linen", "style:basic"},
            {"INF", "Calça cargo verde", "sub:cargo_pants", "color:green", "occasion:outdoor", "material:nylon", "style:street"},
            {"CAL", "Tênis branco", "sub:sneakers", "color:white", "occasion:sport", "material:mesh", "style:sport"},
            {"CAL", "Bota preta", "sub:boots", "color:black", "occasion:formal", "material:leather", "style:classic", "tier:PRATA", "ovr:74"},
            {"CAL", "Salto vermelho", "sub:heels", "color:red", "occasion:party", "material:leather", "style:glam"},
            {"CAL", "Mocassim azul", "sub:loafers", "color:blue", "occasion:work", "material:leather", "style:classic"},
            {"CAL", "Galocha azul", "sub:boots", "color:blue", "occasion:outdoor", "material:rubber", "style:street"},
            {"ACE", "Bolsa preta", "sub:handbag", "color:black", "occasion:formal", "material:leather", "style:classic"},
            {"ACE", "Boné azul", "sub:cap", "color:blue", "occasion:sport", "material:polyester", "style:sport"},
            {"ACE", "Cachecol verde", "sub:scarf", "color:green", "occasion:casual", "material:wool", "style:cozy"},
            {"ACE", "Colar branco", "sub:necklace", "color:white", "occasion:wedding", "material:metal", "style:glam", "tier:ESPECIAL", "ovr:90"},
    };

    /** O Hype público (HYP) de algumas cartas, para a faixa de Hype aparecer na tela; as outras ficam sem sinal. */
    private static final Map<String, Integer> HYPE = Map.of("Blazer preto", 78, "Jeans azul", 45, "Bota preta", 63, "Bolsa preta", 92,
            "Colar branco", 24, "Camisa azul", 38, "Tênis branco", 66, "Salto vermelho", 81);

    /** A família de Aura da arte de algumas cartas (rodada 8g); o Colar branco é a carta Especial com Metamorfose. */
    private static final Map<String, String> AURA = Map.of("Blazer preto", "SPLASH", "Tênis branco", "ELECTRO", "Mocassim azul", "ELECTRO",
            "Jeans azul", "COMMON", "Colar branco", "METAMORPHOSE", "Bolsa preta", "HYPE");

    /** A peça fictícia com a arte da Aura da carta, quando ela tem uma (a carta passa a ser de origem PIECE). */
    static Optional<WardrobeItem> comAura(FlairCardInstance c, User dona) {
        String familia = AURA.get(c.getName());
        if (familia == null) {
            return Optional.empty();
        }
        WardrobeItem w = Kit.piece(dona, c.getName(), c.getCategory(), c.getSubcategory(), "black");
        w.setBackgroundConfigJson("{\"compositionPreset\":{\"id\":\"bancada\",\"family\":\"" + familia + "\"}}");
        c.setOriginType("PIECE");
        c.setOriginId(w.getId());
        return Optional.of(w);
    }

    /** As cartas da pessoa, na ordem da tabela. */
    static List<FlairCardInstance> cartas(UUID dono) {
        List<FlairCardInstance> out = new ArrayList<>();
        for (String[] p : PECAS) {
            String[] etiquetas = new String[p.length - 2];
            System.arraycopy(p, 2, etiquetas, 0, etiquetas.length);
            FlairCardInstance c = Flair3dFixtures.instance(dono, p[0], etiquetas);
            c.setName(p[1]);
            c.setOriginId(UUID.nameUUIDFromBytes(("bancada:" + p[1]).getBytes(StandardCharsets.UTF_8)));
            if (HYPE.containsKey(p[1])) {
                c.setHypeJson("{\"HYP\":" + HYPE.get(p[1]) + "}");
            }
            out.add(c);
        }
        return out;
    }

    /** A carta como GET /api/me/flair/cards a devolve (só o que a tela do FLAIR 3D lê). */
    static Map<String, Object> naColecao(FlairCardInstance c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("originType", "PIECE");
        m.put("originId", c.getOriginId());
        m.put("season", c.getSeason());
        m.put("tier", c.getTier());
        m.put("ovr", c.getOvr());
        m.put("rare", false);
        m.put("position", c.getPosition());
        m.put("name", c.getName());
        m.put("brandName", c.getBrandName());
        m.put("category", c.getCategory());
        m.put("subcategory", c.getSubcategory());
        m.put("hype", HYPE.containsKey(c.getName()) ? Map.of("HYP", HYPE.get(c.getName())) : null);
        m.put("priceVerified", false);
        m.put("state", "AVAILABLE");
        m.put("tradeable", true);
        m.put("acquiredVia", "GENERATED");
        m.put("tags", Json.MAPPER.readValue(c.getTagsJson(), Map.class));
        return m;
    }
}
