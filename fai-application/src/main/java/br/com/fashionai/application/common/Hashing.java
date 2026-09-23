package br.com.fashionai.application.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.Locale;

/** Hash determinístico (e-mail, tokens, códigos) e geração de segredos aleatórios. */
public final class Hashing {
    private static final SecureRandom RANDOM = new SecureRandom();

    private Hashing() {
    }

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    public static String sha256(byte[] value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    public static String emailHash(String email) {
        return sha256(email.trim().toLowerCase(Locale.ROOT));
    }

    public static String randomToken(int bytes) {
        byte[] buffer = new byte[bytes];
        RANDOM.nextBytes(buffer);
        return HexFormat.of().formatHex(buffer);
    }

    public static String numericCode(int digits) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < digits; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    public static String promoCode(String prefix) {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder(prefix == null ? "FAI" : prefix.toUpperCase(Locale.ROOT));
        sb.append('-');
        for (int i = 0; i < 8; i++) {
            sb.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        }
        return sb.toString();
    }

    public static String slug(String text) {
        String normalized = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        String slug = normalized.replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.isBlank() ? "item" : slug;
    }
}
