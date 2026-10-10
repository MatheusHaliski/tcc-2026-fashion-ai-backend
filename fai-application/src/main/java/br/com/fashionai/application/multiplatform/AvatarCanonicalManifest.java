package br.com.fashionai.application.multiplatform;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/**
 * MP-2 — Manifesto canônico da identidade do avatar: o que todos os clientes (web, iOS, Android, Windows, macOS,
 * consoles) usam para desenhar a MESMA pessoa. Lê o {@code model_json}/{@code adjust_json} de uma versão
 * (AVATAR-ID I1) e devolve:
 * <ul>
 *   <li>{@code identityHash}: SHA-256 do conteúdo canônico; dois aparelhos com o mesmo hash desenham a mesma pessoa;</li>
 *   <li>{@code traits}: cada característica com a origem — OBSERVED (medida na foto), ESTIMATED (deduzida),
 *       USER (corrigida pela pessoa), DEFAULT (padrão, sem informação) ou NOT_CAPTURED (não existe no modelo);</li>
 *   <li>{@code requests}: o que pedir à pessoa quando falta informação (outra vista, confirmação manual) — o avatar
 *       nunca promete reconstrução perfeita a partir de uma foto;</li>
 *   <li>{@code renditions}: o que muda por perfil de qualidade (geometria, cabelo) — e a garantia de que os parâmetros
 *       de identidade não mudam.</li>
 * </ul>
 * Função pura (sem banco), para ser testada e reproduzida pelos clientes.
 */
public final class AvatarCanonicalManifest {
    public static final int SCHEMA = 1;

    // índices da malha de 468 pontos do MediaPipe Face Landmarker usados nas medidas nomeadas
    private static final int FOREHEAD_TOP = 10;
    private static final int CHIN = 152;
    private static final int LOWER_LIP = 17;
    private static final int CHEEK_RIGHT = 234;
    private static final int CHEEK_LEFT = 454;
    private static final int JAW_RIGHT = 172;
    private static final int JAW_LEFT = 397;

    private static final List<String> BODY_CORE = List.of("stature", "shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "headH", "build");
    private static final List<String> BODY_DEPTH = List.of("chestD", "waistD", "hipD");

    private AvatarCanonicalManifest() {
    }

    public record Input(UUID identityId, int version, String status, Integer approvedVersion,
                        Map<String, Object> model, Map<String, Object> adjust) {
    }

    public static Map<String, Object> build(Input in) {
        Map<String, Object> model = in.model() == null ? Map.of() : in.model();
        Map<String, Object> adjust = in.adjust() == null ? Map.of() : in.adjust();
        List<Map<String, Object>> requests = new ArrayList<>();
        Map<String, Object> traits = new LinkedHashMap<>();

        List<String> roles = roles(model);
        List<String> warnings = strings(model.get("warnings"));
        boolean front = roles.contains("front");
        boolean profile = roles.contains("left") || roles.contains("right");
        boolean depthObserved = profile && !warnings.contains("DEPTH_ESTIMATED");

        // rosto: largura/altura vêm da vista de frente; a profundidade só é medida com uma vista de perfil
        Map<String, Object> face = new LinkedHashMap<>();
        face.put("shape", trait(front ? "OBSERVED" : "ESTIMATED", front ? "vista de frente" : "sem vista de frente"));
        face.put("depth", trait(depthObserved ? "OBSERVED" : "ESTIMATED", depthObserved ? "vista de perfil" : "deduzida da vista de frente"));
        Map<String, Object> measures = faceMeasures(model.get("shape"));
        face.put("jaw", withValues(trait(front ? "OBSERVED" : "ESTIMATED", "contorno da mandíbula"), measures, "jawWidthCm", "jawToFaceRatio"));
        face.put("chin", withValues(trait(front ? "OBSERVED" : "ESTIMATED", "queixo"), measures, "chinHeightCm"));
        face.put("proportions", withValues(trait(front ? "OBSERVED" : "ESTIMATED", "proporções gerais"), measures, "faceWidthCm", "faceHeightCm"));
        face.put("headScale", trait(num(adjust.get("headScale"), 1) != 1 ? "USER" : "OBSERVED", "escala da cabeça"));
        traits.put("face", face);
        if (!front) {
            requests.add(request("ADD_VIEW_FRONT", "Envie uma foto do rosto de frente, com luz uniforme."));
        }
        if (!depthObserved) {
            requests.add(request("ADD_VIEW_PROFILE", "Uma foto de perfil (esquerdo ou direito) mede o nariz, o queixo e a mandíbula em profundidade."));
        }

        // pele: amostrada nas bochechas e na testa; o ajuste fino da pessoa é correção manual
        traits.put("skin", withValue(trait(num(adjust.get("skinLight"), 0) != 0 ? "USER" : "OBSERVED", "amostrada nas bochechas e na testa"),
                "hex", model.get("skin")));

        // cabelo: frente e laterais vêm da segmentação; nuca e parte de trás são sempre deduzidas
        Map<String, Object> hair = model.get("hair") instanceof Map<?, ?> h ? cast(h) : Map.of();
        Map<String, Object> hairTrait = new LinkedHashMap<>();
        boolean hairKnown = hair.containsKey("present");
        hairTrait.put("presence", trait(hairKnown ? "OBSERVED" : "DEFAULT", "segmentação de cabelo"));
        hairTrait.put("color", withValue(trait(num(adjust.get("hairTone"), 0) > 0 ? "USER" : hairKnown ? "OBSERVED" : "DEFAULT", "tom do cabelo"),
                "hex", hair.get("color")));
        hairTrait.put("cut", trait(num(adjust.get("hairCut"), 0) > 0 ? "USER" : hairKnown ? "OBSERVED" : "DEFAULT", "corte e comprimento"));
        hairTrait.put("volume", trait(num(adjust.get("hairVolume"), 1) != 1 ? "USER" : hairKnown ? "OBSERVED" : "DEFAULT", "volume pela silhueta"));
        hairTrait.put("back", trait("ESTIMATED", "a parte de trás não aparece nas fotos"));
        traits.put("hair", hairTrait);

        // barba e bigode: hoje existem só na textura do rosto; o groom 3D (Unreal) precisa de parâmetros confirmados
        // (quando o app gravar "facialHair" confirmado pela pessoa, ele passa a valer como USER e o pedido some)
        Map<String, Object> facial = model.get("facialHair") instanceof Map<?, ?> f ? cast(f) : Map.of();
        if (facial.containsKey("beard") && facial.containsKey("mustache")) {
            traits.put("beard", withValue(trait("USER", "confirmada pela pessoa"), "value", facial.get("beard")));
            traits.put("mustache", withValue(trait("USER", "confirmado pela pessoa"), "value", facial.get("mustache")));
        } else {
            traits.put("beard", trait("NOT_CAPTURED", "visível só na textura do rosto; sem parâmetros de volume e comprimento"));
            traits.put("mustache", trait("NOT_CAPTURED", "visível só na textura do rosto; sem parâmetros de formato"));
            requests.add(request("CONFIRM_FACIAL_HAIR", "Confirme barba e bigode (nenhum, rala, curta, cheia; formato do bigode) para o cabelo 3D do rosto."));
        }
        traits.put("visibleFeatures", trait("NOT_CAPTURED", "óculos, sardas, pintas, cicatrizes, tatuagens e piercings não são medidos"));
        requests.add(request("DECLARE_VISIBLE_FEATURES", "Opcional: indique características visíveis que devem aparecer no avatar."));

        // corpo: cada medida com a origem gravada pelo app (observed/user/estimated/default)
        Map<String, Object> body = model.get("body") instanceof Map<?, ?> b ? cast(b) : null;
        Map<String, Object> bodyTrait = new LinkedHashMap<>();
        Map<String, Object> sources = body != null && body.get("sources") instanceof Map<?, ?> s ? cast(s) : Map.of();
        boolean anyDefault = false;
        boolean depthMissing = false;
        for (String k : BODY_CORE) {
            String src = source(sources.get(k));
            anyDefault |= "DEFAULT".equals(src);
            bodyTrait.put(k, trait(src, null));
        }
        for (String k : BODY_DEPTH) {
            String src = sources.containsKey(k) ? source(sources.get(k)) : "ESTIMATED";
            depthMissing |= !"OBSERVED".equals(src) && !"USER".equals(src);
            bodyTrait.put(k, trait(src, null));
        }
        traits.put("body", bodyTrait);
        traits.put("sex", trait(model.get("sex") == null ? "DEFAULT" : "USER", "corpo base escolhido ou confirmado ao salvar"));
        if (body == null) {
            requests.add(request("ADD_BODY_PHOTO", "Uma foto de corpo inteiro, de frente e em pé, mede as proporções do corpo."));
        } else if (anyDefault) {
            requests.add(request("CONFIRM_MEASUREMENTS", "Informe altura e peso ou corrija as medidas que ficaram no padrão."));
        }
        if (depthMissing) {
            requests.add(request("ADD_VIEW_BODY_SIDE", "Uma foto de corpo de lado mede a profundidade de peito, cintura e quadril."));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schema", SCHEMA);
        out.put("identityId", in.identityId());
        out.put("version", in.version());
        out.put("status", in.status());
        out.put("approvedVersion", in.approvedVersion());
        out.put("identityHash", hash(in.identityId(), in.version(), model, adjust));
        out.put("modelVersion", model.get("v"));
        out.put("traits", traits);
        out.put("requests", requests);
        out.put("renditions", renditions());
        return out;
    }

    /** O que cada perfil muda — só representação. {@code identityParams} é o mesmo conjunto em todos. */
    static List<Map<String, Object>> renditions() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (QualityProfile p : QualityProfile.values()) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("profile", p.name());
            r.put("avatarLod", p.avatarLod());
            r.put("hair", p.hair());
            r.put("identityParams", "SAME");
            out.add(r);
        }
        return out;
    }

    /** Medidas nomeadas em cm canônicos (468×3); vazio quando a forma não tem os pontos. */
    static Map<String, Object> faceMeasures(Object shape) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (!(shape instanceof List<?> s) || s.size() < 468 * 3) {
            return m;
        }
        double faceW = dist(s, CHEEK_RIGHT, CHEEK_LEFT);
        double jawW = dist(s, JAW_RIGHT, JAW_LEFT);
        m.put("faceWidthCm", round(faceW));
        m.put("faceHeightCm", round(dist(s, FOREHEAD_TOP, CHIN)));
        m.put("jawWidthCm", round(jawW));
        m.put("jawToFaceRatio", faceW == 0 ? null : round(jawW / faceW));
        m.put("chinHeightCm", round(dist(s, LOWER_LIP, CHIN)));
        return m;
    }

    /** SHA-256 de {identityId, version, model, adjust} com chaves ordenadas e números com 4 casas. */
    static String hash(UUID identityId, int version, Map<String, Object> model, Map<String, Object> adjust) {
        Map<String, Object> root = new TreeMap<>();
        root.put("identityId", identityId == null ? null : identityId.toString());
        root.put("version", version);
        root.put("model", model);
        root.put("adjust", adjust);
        StringBuilder sb = new StringBuilder();
        canonical(root, sb);
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void canonical(Object v, StringBuilder sb) {
        if (v instanceof Map<?, ?> m) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<String, Object> e : new TreeMap<>(cast(m)).entrySet()) {
                if (!first) {
                    sb.append(',');
                }
                first = false;
                sb.append('"').append(e.getKey()).append("\":");
                canonical(e.getValue(), sb);
            }
            sb.append('}');
        } else if (v instanceof List<?> l) {
            sb.append('[');
            for (int i = 0; i < l.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                canonical(l.get(i), sb);
            }
            sb.append(']');
        } else if (v instanceof Number n) {
            sb.append(String.format(java.util.Locale.ROOT, "%.4f", n.doubleValue()));
        } else if (v == null) {
            sb.append("null");
        } else if (v instanceof Boolean b) {
            sb.append(b);
        } else {
            sb.append('"').append(v.toString().replace("\\", "\\\\").replace("\"", "\\\"")).append('"');
        }
    }

    private static double dist(List<?> s, int a, int b) {
        double dx = d(s.get(a * 3)) - d(s.get(b * 3));
        double dy = d(s.get(a * 3 + 1)) - d(s.get(b * 3 + 1));
        double dz = d(s.get(a * 3 + 2)) - d(s.get(b * 3 + 2));
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private static double d(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0;
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double num(Object o, double fallback) {
        return o instanceof Number n ? n.doubleValue() : fallback;
    }

    private static String source(Object o) {
        if (o == null) {
            return "DEFAULT";
        }
        return switch (o.toString()) {
            case "observed" -> "OBSERVED";
            case "user" -> "USER";
            case "estimated" -> "ESTIMATED";
            default -> "DEFAULT";
        };
    }

    private static List<String> roles(Map<String, Object> model) {
        List<String> out = new ArrayList<>();
        if (model.get("views") instanceof List<?> views) {
            for (Object v : views) {
                if (v instanceof Map<?, ?> m && m.get("role") != null) {
                    out.add(m.get("role").toString());
                }
            }
        }
        return out;
    }

    private static List<String> strings(Object o) {
        List<String> out = new ArrayList<>();
        if (o instanceof List<?> l) {
            l.forEach(x -> out.add(String.valueOf(x)));
        }
        return out;
    }

    private static Map<String, Object> trait(String source, String note) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("source", source);
        if (note != null) {
            t.put("note", note);
        }
        return t;
    }

    private static Map<String, Object> withValue(Map<String, Object> t, String key, Object value) {
        if (value != null) {
            t.put(key, value);
        }
        return t;
    }

    private static Map<String, Object> withValues(Map<String, Object> t, Map<String, Object> measures, String... keys) {
        for (String k : keys) {
            if (measures.get(k) != null) {
                t.put(k, measures.get(k));
            }
        }
        return t;
    }

    private static Map<String, Object> request(String kind, String reason) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("kind", kind);
        r.put("reason", reason);
        return r;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> cast(Map<?, ?> m) {
        return (Map<String, Object>) m;
    }
}
