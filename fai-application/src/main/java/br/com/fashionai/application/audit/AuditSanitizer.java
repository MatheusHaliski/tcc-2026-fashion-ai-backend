package br.com.fashionai.application.audit;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class AuditSanitizer {
    private static final Set<String> FORBIDDEN_FRAGMENTS = Set.of(
            "password", "senha", "token", "secret", "private_key", "ciphertext", "refresh"
    );

    private AuditSanitizer() {
    }

    public static Map<String, Object> sanitize(Map<String, Object> metadata) {
        Map<String, Object> sanitized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : metadata.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey();
            String normalized = key.toLowerCase(Locale.ROOT);
            boolean forbidden = FORBIDDEN_FRAGMENTS.stream().anyMatch(normalized::contains);
            sanitized.put(key, forbidden ? "[REDACTED]" : entry.getValue());
        }
        return Map.copyOf(sanitized);
    }
}
