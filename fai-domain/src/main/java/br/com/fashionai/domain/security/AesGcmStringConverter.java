package br.com.fashionai.domain.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

@Converter
public class AesGcmStringConverter implements AttributeConverter<String, String> {
    private static final String PREFIX = "enc:v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.isBlank()) {
            return attribute;
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            SECURE_RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(ciphertext);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Unable to encrypt sensitive attribute", ex);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank() || !dbData.startsWith(PREFIX)) {
            return dbData;
        }
        try {
            String payload = dbData.substring(PREFIX.length());
            String[] parts = payload.split(":", 2);
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] ciphertext = Base64.getDecoder().decode(parts[1]);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (RuntimeException | GeneralSecurityException ex) {
            throw new IllegalStateException("Unable to decrypt sensitive attribute", ex);
        }
    }

    private static volatile SecretKeySpec cachedKey;

    /** Chave configurada por ambiente (RNF3). Aceita também propriedade de sistema para testes locais. */
    private SecretKeySpec key() {
        SecretKeySpec cached = cachedKey;
        if (cached != null) {
            return cached;
        }
        String configured = System.getProperty("DATA_ENCRYPTION_KEY", System.getenv("DATA_ENCRYPTION_KEY"));
        if (configured == null || configured.isBlank() || configured.contains("placeholder")) {
            throw new IllegalStateException("DATA_ENCRYPTION_KEY must be a base64 encoded 32-byte AES key");
        }
        byte[] raw = Base64.getDecoder().decode(configured);
        if (raw.length != 32) {
            throw new IllegalStateException("DATA_ENCRYPTION_KEY must decode to 32 bytes");
        }
        cached = new SecretKeySpec(raw, "AES");
        cachedKey = cached;
        return cached;
    }
}
