package br.com.fashionai.web.config;

import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.util.Locale;
import java.util.Map;

/**
 * Valores antigos que clientes já publicados ainda mandam. O Criar Look (RF5) enviava {@code creationMode: "AI"} e o
 * enum é {@code AI_ASSISTED}: o esquema no modo IA caía em 400. "AI"/"IA" continuam aceitos como apelido. O mesmo vale para o
 * clima ({@code mood}): a tela oferecia RELAXADO, CONFIANTE, ROMANTICO… que não existem no enum ({@link Mood}); cada um
 * é lido como o clima equivalente, para que o look salve em vez de responder "JSON inválido".
 */
@Configuration
public class JsonCompatConfig {

    @Bean
    public Module jsonCompatModule() {
        SimpleModule m = new SimpleModule("fai-json-compat");
        m.addDeserializer(CreationMode.class, new CreationModeDeserializer());
        m.addDeserializer(Mood.class, new MoodDeserializer());
        m.addDeserializer(Season.class, new BlankAsNullDeserializer<>(Season.class));
        m.addDeserializer(Visibility.class, new BlankAsNullDeserializer<>(Visibility.class));
        m.addDeserializer(SealTier.class, new SealTierDeserializer());
        return m;
    }

    /** Campo de seleção deixado vazio na tela ("") é o mesmo que não escolhido (null) — nunca um 400 "JSON inválido". */
    static final class BlankAsNullDeserializer<E extends Enum<E>> extends StdDeserializer<E> {
        private final Class<E> type;

        BlankAsNullDeserializer(Class<E> type) {
            super(type);
            this.type = type;
        }

        @Override
        public E deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
            String raw = p.getValueAsString();
            if (raw == null || raw.isBlank()) {
                return null;
            }
            try {
                return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                @SuppressWarnings("unchecked") E weird = (E) ctx.handleWeirdStringValue(type, raw, "valor fora do enum " + type.getSimpleName());
                return weird;
            }
        }
    }

    /**
     * O criador de selos (RF25) oferecia o nível "PERFIL", que não existe ({@link SealTier} é PECA ou LOOK): salvar dava
     * "JSON inválido". O selo de perfil vale para looks; "PIECE" é apelido de PECA.
     */
    static final class SealTierDeserializer extends StdDeserializer<SealTier> {
        SealTierDeserializer() {
            super(SealTier.class);
        }

        @Override
        public SealTier deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
            String raw = p.getValueAsString();
            if (raw == null || raw.isBlank()) {
                return null;
            }
            return switch (raw.trim().toUpperCase(Locale.ROOT)) {
                case "PECA", "PEÇA", "PIECE" -> SealTier.PECA;
                case "LOOK", "PERFIL", "PROFILE", "ESQUEMA", "SCHEME" -> SealTier.LOOK;
                default -> (SealTier) ctx.handleWeirdStringValue(SealTier.class, raw, "valores aceitos: PECA, LOOK");
            };
        }
    }

    static final class CreationModeDeserializer extends StdDeserializer<CreationMode> {
        CreationModeDeserializer() {
            super(CreationMode.class);
        }

        @Override
        public CreationMode deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
            String raw = p.getValueAsString();
            if (raw == null || raw.isBlank()) {
                return null;
            }
            String v = raw.trim().toUpperCase(Locale.ROOT);
            if (v.equals("AI") || v.equals("IA")) {
                return CreationMode.AI_ASSISTED;
            }
            try {
                return CreationMode.valueOf(v);
            } catch (IllegalArgumentException e) {
                return (CreationMode) ctx.handleWeirdStringValue(CreationMode.class, raw, "valores aceitos: MANUAL, AI_ASSISTED");
            }
        }
    }

    static final class MoodDeserializer extends StdDeserializer<Mood> {
        /** Valores que a tela antiga do Criar Look mandava, pelo clima que cada um descreve. */
        static final Map<String, Mood> ALIASES = Map.of(
                "RELAXADO", Mood.COMFORTABLE,
                "CONFORTAVEL", Mood.COMFORTABLE,
                "CONFIANTE", Mood.SOPHISTICATED,
                "SOFISTICADO", Mood.SOPHISTICATED,
                "ROMANTICO", Mood.ELEGANT,
                "ELEGANTE", Mood.ELEGANT,
                "OUSADO", Mood.ENERGETIC,
                "CRIATIVO", Mood.ENERGETIC,
                "ENERGICO", Mood.ENERGETIC);

        MoodDeserializer() {
            super(Mood.class);
        }

        @Override
        public Mood deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
            String raw = p.getValueAsString();
            if (raw == null || raw.isBlank()) {
                return null;
            }
            String v = java.text.Normalizer.normalize(raw.trim(), java.text.Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", "").toUpperCase(Locale.ROOT);
            Mood alias = ALIASES.get(v);
            if (alias != null) {
                return alias;
            }
            try {
                return Mood.valueOf(v);
            } catch (IllegalArgumentException e) {
                return (Mood) ctx.handleWeirdStringValue(Mood.class, raw, "valores aceitos: ENERGETIC, ELEGANT, COMFORTABLE, SOPHISTICATED");
            }
        }
    }
}
