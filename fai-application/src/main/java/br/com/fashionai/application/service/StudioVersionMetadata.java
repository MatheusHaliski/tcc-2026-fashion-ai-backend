package br.com.fashionai.application.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/** Pure studio-version metadata policy; ownership, persistence and media I/O stay in WardrobeService. */
final class StudioVersionMetadata {
    private StudioVersionMetadata() {}

    private static final List<String> STUDIO_KEYS = List.of("url", "thumbUrl", "feedUrl", "detailUrl", "enhancedUrl", "backdrop",
            "stages", "metrics", "framing", "feed", "logo", "provider");

    @SuppressWarnings("unchecked")
    static Map<String, Object> copyFrom(Map<String, Object> meta) {
        return meta.get("studio") instanceof Map<?, ?> m ? new LinkedHashMap<>((Map<String, Object>) m) : null;
    }

    static int version(Map<String, Object> cur, Supplier<String> imageUrl) {
        if (cur != null && cur.get("version") instanceof Number n) {
            return n.intValue();
        }
        return imageUrl.get() != null ? 1 : 0;
    }

    /** Aprovada: marcada como tal ou legada (sem o campo). */
    static boolean approved(Map<String, Object> cur, String imageUrl) {
        return imageUrl != null && (cur == null || !Boolean.FALSE.equals(cur.get("approved")));
    }

    static Map<String, Object> summary(Map<String, Object> info, int version, boolean approved) {
        Map<String, Object> s = new LinkedHashMap<>();
        for (String k : STUDIO_KEYS) {
            if (info.get(k) != null) {
                s.put(k, "provider".equals(k) ? String.valueOf(info.get(k)) : info.get(k));
            }
        }
        String now = java.time.Instant.now().toString();
        s.put("version", version);
        s.put("approved", approved);
        s.put("createdAt", now);
        if (approved) {
            s.put("approvedAt", now);
        }
        return s;
    }

    /** O que fica da versão anterior (histórico curto): versão e as URLs, sem a versão anterior dela. */
    static Map<String, Object> reference(Map<String, Object> cur) {
        Map<String, Object> ref = new LinkedHashMap<>();
        for (String k : List.of("version", "url", "feedUrl", "backdrop", "approvedAt")) {
            if (cur.get(k) != null) {
                ref.put(k, cur.get(k));
            }
        }
        return ref;
    }

    static int pendingVersion(Map<String, Object> cur) {
        return cur.get("pending") instanceof Map<?, ?> p && p.get("version") instanceof Number n ? n.intValue() : 0;
    }

}
