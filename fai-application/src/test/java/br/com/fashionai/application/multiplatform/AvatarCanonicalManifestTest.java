package br.com.fashionai.application.multiplatform;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * MP-2 — Manifesto canônico: o mesmo modelo gera o mesmo hash em qualquer ordem de chaves (dois aparelhos, a mesma
 * pessoa); o que veio da foto, o que foi deduzido e o que a pessoa corrigiu ficam separados; faltando informação, o
 * manifesto pede outra vista ou confirmação manual em vez de prometer fidelidade.
 */
class AvatarCanonicalManifestTest {
    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000042");

    private static List<Double> face() {
        List<Double> s = new ArrayList<>();
        for (int i = 0; i < 468 * 3; i++) {
            s.add(0.0);
        }
        // pontos usados nas medidas nomeadas (cm canônicos)
        put(s, 234, -7, 0, 0);
        put(s, 454, 7, 0, 0);
        put(s, 172, -5, -6, 0);
        put(s, 397, 5, -6, 0);
        put(s, 10, 0, 10, 0);
        put(s, 152, 0, -10, 0);
        put(s, 17, 0, -7, 0);
        return s;
    }

    private static void put(List<Double> s, int i, double x, double y, double z) {
        s.set(i * 3, x);
        s.set(i * 3 + 1, y);
        s.set(i * 3 + 2, z);
    }

    private static Map<String, Object> model(List<String> roles, List<String> warnings, Map<String, Object> body) {
        Map<String, Object> m = new HashMap<>();
        m.put("v", 1);
        m.put("shape", face());
        m.put("skin", "#a57b5c");
        m.put("hair", Map.of("present", true, "color", "#2b1d14"));
        m.put("views", roles.stream().map(r -> Map.of("role", r, "yaw", 0, "pitch", 0, "roll", 0)).toList());
        m.put("warnings", warnings);
        if (body != null) {
            m.put("body", body);
        }
        return m;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> traits(Map<String, Object> manifest) {
        return (Map<String, Object>) manifest.get("traits");
    }

    @SuppressWarnings("unchecked")
    private static List<String> requestKinds(Map<String, Object> manifest) {
        return ((List<Map<String, Object>>) manifest.get("requests")).stream().map(r -> (String) r.get("kind")).toList();
    }

    @Test
    void umaFotoDeFrenteMedeLarguraMasPedePerfilParaProfundidade() {
        Map<String, Object> m = AvatarCanonicalManifest.build(new AvatarCanonicalManifest.Input(ID, 3, "APPROVED", 3,
                model(List.of("front"), List.of("DEPTH_ESTIMATED"), null), Map.of()));
        Map<?, ?> face = (Map<?, ?>) traits(m).get("face");
        assertThat(((Map<?, ?>) face.get("shape")).get("source")).isEqualTo("OBSERVED");
        assertThat(((Map<?, ?>) face.get("depth")).get("source")).isEqualTo("ESTIMATED");
        Map<?, ?> jaw = (Map<?, ?>) face.get("jaw");
        assertThat(jaw.get("jawWidthCm")).isEqualTo(10.0);
        assertThat(jaw.get("jawToFaceRatio")).isEqualTo(0.71);
        assertThat(((Map<?, ?>) face.get("chin")).get("chinHeightCm")).isEqualTo(3.0);
        assertThat(requestKinds(m)).contains("ADD_VIEW_PROFILE", "ADD_BODY_PHOTO", "CONFIRM_FACIAL_HAIR");
        assertThat(((Map<?, ?>) traits(m).get("beard")).get("source")).isEqualTo("NOT_CAPTURED");
        assertThat(((Map<?, ?>) ((Map<?, ?>) traits(m).get("hair")).get("back")).get("source")).isEqualTo("ESTIMATED");
    }

    @Test
    void perfilObservadoNaoPedeOutraVista() {
        Map<String, Object> m = AvatarCanonicalManifest.build(new AvatarCanonicalManifest.Input(ID, 1, "APPROVED", 1,
                model(List.of("front", "left"), List.of(), null), Map.of()));
        assertThat(((Map<?, ?>) ((Map<?, ?>) traits(m).get("face")).get("depth")).get("source")).isEqualTo("OBSERVED");
        assertThat(requestKinds(m)).doesNotContain("ADD_VIEW_PROFILE", "ADD_VIEW_FRONT");
    }

    @Test
    void corpoComOrigemPorMedidaEPedidosDeCorrecao() {
        Map<String, Object> sources = new HashMap<>();
        for (String k : List.of("stature", "shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "headH")) {
            sources.put(k, "observed");
        }
        sources.put("build", "default");
        Map<String, Object> m = AvatarCanonicalManifest.build(new AvatarCanonicalManifest.Input(ID, 1, "APPROVED", 1,
                model(List.of("front"), List.of(), Map.of("sources", sources)), Map.of()));
        Map<?, ?> body = (Map<?, ?>) traits(m).get("body");
        assertThat(((Map<?, ?>) body.get("waistW")).get("source")).isEqualTo("OBSERVED");
        assertThat(((Map<?, ?>) body.get("build")).get("source")).isEqualTo("DEFAULT");
        assertThat(((Map<?, ?>) body.get("waistD")).get("source")).isEqualTo("ESTIMATED");
        assertThat(requestKinds(m)).contains("CONFIRM_MEASUREMENTS", "ADD_VIEW_BODY_SIDE");
    }

    @Test
    void ajusteDaPessoaViraUserENaoObservado() {
        Map<String, Object> m = AvatarCanonicalManifest.build(new AvatarCanonicalManifest.Input(ID, 1, "APPROVED", 1,
                model(List.of("front"), List.of(), null), Map.of("skinLight", 0.03, "hairTone", 4)));
        assertThat(((Map<?, ?>) traits(m).get("skin")).get("source")).isEqualTo("USER");
        assertThat(((Map<?, ?>) ((Map<?, ?>) traits(m).get("hair")).get("color")).get("source")).isEqualTo("USER");
    }

    @Test
    void barbaEBigodeConfirmadosNaoGeramPedido() {
        Map<String, Object> model = model(List.of("front"), List.of(), null);
        model.put("facialHair", Map.of("beard", "SHORT", "mustache", "CHEVRON"));
        Map<String, Object> m = AvatarCanonicalManifest.build(new AvatarCanonicalManifest.Input(ID, 1, "APPROVED", 1, model, Map.of()));
        assertThat(((Map<?, ?>) traits(m).get("beard")).get("value")).isEqualTo("SHORT");
        assertThat(requestKinds(m)).doesNotContain("CONFIRM_FACIAL_HAIR");
    }

    @Test
    void hashIgualParaOMesmoConteudoEDiferenteParaOutraVersao() {
        Map<String, Object> a = model(List.of("front"), List.of(), null);
        Map<String, Object> b = new java.util.TreeMap<>(a);                         // outra ordem de chaves
        String h1 = AvatarCanonicalManifest.hash(ID, 2, a, Map.of("headScale", 1.0));
        String h2 = AvatarCanonicalManifest.hash(ID, 2, b, Map.of("headScale", 1));  // 1 e 1.0 são o mesmo número
        assertThat(h1).isEqualTo(h2).hasSize(64);
        assertThat(AvatarCanonicalManifest.hash(ID, 3, a, Map.of("headScale", 1.0))).isNotEqualTo(h1);
    }

    @Test
    void perfisMudamSoARepresentacao() {
        Map<String, Object> m = AvatarCanonicalManifest.build(new AvatarCanonicalManifest.Input(ID, 1, "APPROVED", 1,
                model(List.of("front"), List.of(), null), Map.of()));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> r = (List<Map<String, Object>>) m.get("renditions");
        assertThat(r).hasSize(QualityProfile.values().length).allSatisfy(x -> assertThat(x.get("identityParams")).isEqualTo("SAME"));
    }
}
