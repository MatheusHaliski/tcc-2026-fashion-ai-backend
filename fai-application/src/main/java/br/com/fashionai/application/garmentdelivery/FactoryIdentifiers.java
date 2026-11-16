package br.com.fashionai.application.garmentdelivery;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.temporal.IsoFields;
import java.util.HexFormat;

/**
 * Identificadores da Fábrica FashionAI (fictícia): número de série {@code FAI-AAAA-XXXXXX} (alfabeto sem 0/O/1/I),
 * lote {@code LAAAA-SS-LINHA} (ano e semana ISO da encomenda + linha de produção) e rastreio {@code FAI-TRK-XXXX-XXXX}
 * derivado da série, que não se parece com código de nenhuma transportadora real.
 */
final class FactoryIdentifiers {
    private FactoryIdentifiers() {
    }

    static final String FACTORY_CODE = "FAI-FAB-01";
    private static final String ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final SecureRandom RANDOM = new SecureRandom();

    static String serial(Instant placedAt) {
        StringBuilder out = new StringBuilder("FAI-").append(placedAt.atZone(FactoryPlanRules.FACTORY_ZONE).getYear()).append('-');
        for (int i = 0; i < 6; i++) {
            out.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return out.toString();
    }

    static String lot(Instant placedAt, String line) {
        ZonedDateTime at = placedAt.atZone(FactoryPlanRules.FACTORY_ZONE);
        return "L%d-%02d-%s".formatted(at.get(IsoFields.WEEK_BASED_YEAR), at.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR), line);
    }

    static String tracking(String serial) {
        byte[] hash = sha256(("tracking|" + serial).getBytes(StandardCharsets.UTF_8));
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            code.append(ALPHABET.charAt((hash[i] & 0xFF) % ALPHABET.length()));
        }
        return "FAI-TRK-" + code.substring(0, 4) + "-" + code.substring(4);
    }

    static String digest(String value) {
        return HexFormat.of().formatHex(sha256(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static byte[] sha256(byte[] value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
