package br.com.fashionai.application.common;

import org.springframework.context.i18n.LocaleContextHolder;

import java.text.MessageFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.MissingResourceException;
import java.util.ResourceBundle;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RF23 — textos do backend no idioma da requisição. Os catálogos ficam em {@code i18n/messages*.properties}
 * (base = pt-BR, {@code _en}, {@code _es}); o idioma vem do {@code Accept-Language} (LocaleContextHolder) ou é
 * passado explicitamente (e-mails usam a preferência do usuário). Padrões em {@link MessageFormat}: {0}, {1}…
 * Cadeia de fallback: idioma pedido → pt-BR → a própria chave.
 */
public final class Msg {
    public static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    public static final List<Locale> SUPPORTED = List.of(PT_BR, Locale.ENGLISH, Locale.forLanguageTag("es"));
    private static final String BASE = "i18n.messages";
    private static final Map<String, ResourceBundle> BUNDLES = new ConcurrentHashMap<>();
    private static final ResourceBundle.Control NO_FALLBACK = ResourceBundle.Control.getNoFallbackControl(ResourceBundle.Control.FORMAT_PROPERTIES);

    private Msg() {
    }

    /** Idioma corrente da requisição (pt-BR fora de um request). */
    public static Locale locale() {
        return supported(LocaleContextHolder.getLocale());
    }

    /** Reduz qualquer Locale a um dos suportados (en-US → en, es-MX → es, outros → pt-BR). */
    public static Locale supported(Locale l) {
        if (l == null) return PT_BR;
        String lang = l.getLanguage();
        if ("en".equals(lang)) return Locale.ENGLISH;
        if ("es".equals(lang)) return Locale.forLanguageTag("es");
        return PT_BR;
    }

    /** Locale a partir do enum de preferência do usuário (PT_BR, EN, ES). */
    public static Locale fromPreference(String language) {
        if (language == null) return PT_BR;
        return switch (language) {
            case "EN" -> Locale.ENGLISH;
            case "ES" -> Locale.forLanguageTag("es");
            default -> PT_BR;
        };
    }

    public static String t(String key, Object... args) {
        return t(locale(), key, args);
    }

    public static String t(Locale locale, String key, Object... args) {
        String pattern = raw(supported(locale), key);
        if (pattern == null) pattern = raw(PT_BR, key);
        if (pattern == null) return key;
        if (args == null || args.length == 0) return pattern.replace("''", "'").replace("'{'", "{").replace("'}'", "}");
        Object[] safe = new Object[args.length];
        for (int i = 0; i < args.length; i++) safe[i] = args[i] == null ? "" : String.valueOf(args[i]);
        try {
            return new MessageFormat(pattern, supported(locale)).format(safe);
        } catch (IllegalArgumentException e) {
            return pattern;
        }
    }

    /** Existe texto para a chave em algum catálogo? */
    public static boolean has(String key) {
        return raw(PT_BR, key) != null;
    }

    private static String raw(Locale locale, String key) {
        ResourceBundle b = BUNDLES.computeIfAbsent(locale.toLanguageTag(), tag -> {
            try {
                return ResourceBundle.getBundle(BASE, locale, NO_FALLBACK);
            } catch (MissingResourceException e) {
                return null;
            }
        });
        if (b == null) return null;
        try {
            // o bundle de en/es herda do base (pt-BR): só vale a chave se ela estiver definida no próprio idioma
            if (!locale.equals(PT_BR) && !b.containsKey(key)) return null;
            return b.getString(key);
        } catch (MissingResourceException e) {
            return null;
        }
    }
}
