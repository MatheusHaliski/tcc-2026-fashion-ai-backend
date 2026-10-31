package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Caracterização (lote GoF 12) da validação do modelo e do corpo do Avatar 3D pela API estática de
 * {@link Avatar3dService}: ordem das chaves de saída, descarte silencioso de campos opcionais, recusa dos obrigatórios
 * e privacidade das medidas pessoais. Escrita antes da extração e mantida depois, sem mudanças.
 */
class Avatar3dModelValidationCharacterizationTest {

    private static String code(Runnable r) {
        return assertThrows(ApiException.class, r::run).code();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> hair(Map<String, Object> m) {
        return (Map<String, Object>) m.get("hair");
    }

    static Map<String, Object> body() {
        Map<String, Object> params = new LinkedHashMap<>(Map.of("stature", 1.7, "shoulderW", 0.19, "chestW", 0.175,
                "waistW", 0.15, "hipW", 0.205, "legLen", 0.53, "armLen", 0.333, "headH", 0.13, "build", 0));
        Map<String, Object> sources = new LinkedHashMap<>();
        params.keySet().forEach(k -> sources.put(k, "observed"));
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("v", 1);
        b.put("sex", "MASCULINO");
        b.put("params", params);
        b.put("sources", sources);
        return b;
    }

    @Test
    void ordemDasChavesDoModeloValidado() {
        Map<String, Object> m = new LinkedHashMap<>(Avatar3dServiceTest.model());
        m.put("warnings", List.of("X"));
        m.put("metrics", Map.of("a", 1));
        m.put("sex", "MASCULINO");
        m.put("bodySkin", "#aabbcc");
        m.put("body", body());
        List<String> keys = new ArrayList<>(Avatar3dService.validateModel(m).keySet());
        assertEquals("body", keys.get(0));
        assertEquals(List.of("sex", "bodySkin", "hair"), keys.subList(keys.size() - 3, keys.size()));
        assertTrue(keys.containsAll(List.of("v", "shape", "skin", "metrics", "warnings")));
    }

    @Test
    void sexoEPeleDoCorpoForaDaRegraSaoDescartados() {
        Map<String, Object> m = new LinkedHashMap<>(Avatar3dServiceTest.model());
        m.put("sex", "OUTRO");
        m.put("bodySkin", "rosa");
        Map<String, Object> out = Avatar3dService.validateModel(m);
        assertFalse(out.containsKey("sex"));
        assertFalse(out.containsKey("bodySkin"));
        assertFalse(out.containsKey("eyes"));
        assertFalse(out.containsKey("brows"));
    }

    @Test
    void cabeloObrigatorioEOpcionaisDescartados() {
        Map<String, Object> m = new LinkedHashMap<>(Avatar3dServiceTest.model());
        Map<String, Object> h = new LinkedHashMap<>(hair(m));
        h.put("volume", 3.0);
        h.put("volumeLevel", "huge");
        h.put("part", 1.5);
        h.put("variation", -0.1);
        h.put("outline", List.of(31));
        h.put("cover", "azul");
        h.put("segredo", "x");
        m.put("hair", h);
        Map<String, Object> out = hair(Avatar3dService.validateModel(m));
        for (String k : List.of("volume", "volumeLevel", "part", "variation", "outline", "cover", "segredo")) {
            assertFalse(out.containsKey(k), k);
        }
        h.put("volume", 2.5);
        h.put("volumeLevel", "big");
        h.put("part", -1);
        h.put("variation", 1);
        h.put("cover", null);
        out = hair(Avatar3dService.validateModel(m));
        assertEquals(2.5, out.get("volume"));
        assertEquals("big", out.get("volumeLevel"));
        assertTrue(out.containsKey("cover"));
        // obrigatórios: top/side/fringe numéricos e cor hex (ou ausente)
        Map<String, Object> semTopo = new LinkedHashMap<>(hair(Avatar3dServiceTest.model()));
        semTopo.remove("top");
        Map<String, Object> m2 = new LinkedHashMap<>(Avatar3dServiceTest.model());
        m2.put("hair", semTopo);
        assertEquals("MODELO_INVALIDO", code(() -> Avatar3dService.validateModel(m2)));
        Map<String, Object> m3 = new LinkedHashMap<>(Avatar3dServiceTest.model());
        m3.put("hair", "liso");
        assertEquals("MODELO_INVALIDO", code(() -> Avatar3dService.validateModel(m3)));
        assertEquals("MODELO_INVALIDO", code(() -> Avatar3dService.validateModel(null)));
    }

    private static Map<String, Object> eyes() {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("color", "#553311");
        e.put("secondary", "#221100");
        e.put("cls", "HAZEL");
        e.put("pattern", "RING");
        e.put("glasses", "NONE");
        e.put("source", "DEFAULT");
        e.put("confidence", 1);
        return e;
    }

    @Test
    void olhosHeterocromiaSoComOsDoisLados() {
        Map<String, Object> e = eyes();
        e.put("right", Map.of("color", "#112233", "secondary", "#000000"));
        Map<String, Object> m = new LinkedHashMap<>(Avatar3dServiceTest.model());
        m.put("eyes", e);
        @SuppressWarnings("unchecked") Map<String, Object> out = (Map<String, Object>) Avatar3dService.validateModel(m).get("eyes");
        assertEquals(List.of("color", "secondary", "cls", "pattern", "confidence", "source", "glasses"), new ArrayList<>(out.keySet()));
        assertEquals(1.0, out.get("confidence"));
        e.put("left", Map.of("color", "#445566", "secondary", "#000000"));
        e.put("frame", "#000000");
        @SuppressWarnings("unchecked") Map<String, Object> both = (Map<String, Object>) Avatar3dService.validateModel(m).get("eyes");
        assertEquals("#000000", both.get("frame"));
        assertEquals(Map.of("color", "#445566", "secondary", "#000000"), both.get("left"));
        e.put("source", "PALPITE");
        assertFalse(Avatar3dService.validateModel(m).containsKey("eyes"));
    }

    private static Map<String, Object> brows() {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("color", "#332211");
        b.put("thickness", 0.5);
        b.put("arch", 0.2);
        b.put("density", 0.7);
        b.put("confidence", 0.9);
        b.put("shape", "SOFT_ARCH");
        return b;
    }

    @Test
    void sobrancelhasZonasValidasOuDescartadas() {
        Map<String, Object> b = brows();
        b.put("zones", Map.of("thickness", List.of(0.1, 0.2, 0.3, 0.4, 0.5),
                "color", new ArrayList<>(java.util.Arrays.asList("#111111", null, "#222222", null, "#333333"))));
        Map<String, Object> m = new LinkedHashMap<>(Avatar3dServiceTest.model());
        m.put("brows", b);
        @SuppressWarnings("unchecked") Map<String, Object> out = (Map<String, Object>) Avatar3dService.validateModel(m).get("brows");
        assertEquals(List.of("color", "thickness", "arch", "density", "confidence", "shape", "zones").size(), out.size());
        assertEquals("SOFT_ARCH", out.get("shape"));
        @SuppressWarnings("unchecked") Map<String, Object> zones = (Map<String, Object>) out.get("zones");
        assertNull(((List<?>) zones.get("color")).get(1));
        // zona inválida: sobrancelha fica, zonas somem
        b.put("zones", Map.of("thickness", List.of(0.1, 0.2, 0.3, 0.4, 2), "color", List.of("#111111", "#111111", "#111111", "#111111", "#111111")));
        @SuppressWarnings("unchecked") Map<String, Object> noZones = (Map<String, Object>) Avatar3dService.validateModel(m).get("brows");
        assertFalse(noZones.containsKey("zones"));
        // arco acima de 0,5: a sobrancelha inteira é descartada
        b.put("arch", 0.6);
        assertFalse(Avatar3dService.validateModel(m).containsKey("brows"));
    }

    @Test
    void corpoSaidaNormalizadaEOrdemDasChaves() {
        Map<String, Object> b = body();
        b.put("measuresCm", Map.of("neck", 40));
        List<Object> warnings = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            warnings.add("W" + i + "!");
        }
        b.put("warnings", warnings);
        Map<String, Object> out = Avatar3dService.validateBody(b);
        assertEquals(List.of("v", "sex", "params", "sources", "heightCm", "weightKg", "photo", "warnings"), new ArrayList<>(out.keySet()));
        assertNull(out.get("heightCm"));
        assertEquals(false, out.get("photo"));
        assertEquals(20, ((List<?>) out.get("warnings")).size());
        assertEquals("W0", ((List<?>) out.get("warnings")).get(0));
        assertEquals(0.0, ((Map<?, ?>) out.get("params")).get("build"));
        b.put("measuresCm", Map.of("hip", 100));
        assertEquals(Map.of("hip", 100.0), Avatar3dService.validateBody(b).get("measuresCm"));
    }

    @Test
    void corpoObrigatoriosRecusados() {
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(null)));
        Map<String, Object> semSexo = body();
        semSexo.put("sex", "X");
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(semSexo)));
        Map<String, Object> versao = body();
        versao.put("v", 2);
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(versao)));
        Map<String, Object> peso = body();
        peso.put("weightKg", "70");
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(peso)));
        Map<String, Object> semFontes = body();
        semFontes.remove("sources");
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateBody(semFontes)));
        // corpo inválido dentro do modelo: CORPO_INVALIDO, não MODELO_INVALIDO
        Map<String, Object> m = new LinkedHashMap<>(Avatar3dServiceTest.model());
        m.put("body", semSexo);
        assertEquals("CORPO_INVALIDO", code(() -> Avatar3dService.validateModel(m)));
    }

    @Test
    void modeloPublicoSemCorpoEOMesmoObjeto() {
        Map<String, Object> m = Map.of("skin", "#000000");
        assertSame(m, Avatar3dService.publicModel(m));
        Map<String, Object> b = new LinkedHashMap<>(body());
        b.put("heightCm", 170.0);
        Map<String, Object> pub = Avatar3dService.publicModel(Map.of("body", b));
        assertEquals(List.of("v", "sex", "params", "sources"), new ArrayList<>(((Map<?, ?>) pub.get("body")).keySet()));
    }
}
