package br.com.fashionai.application.common;

import org.springframework.context.i18n.LocaleContextHolder;

import java.text.MessageFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.MissingResourceException;
import java.util.ResourceBundle;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
    /** Marcador de texto adiado: {@code §i18n:chave\u001Farg1\u001Farg2§} — resolvido na serialização JSON (I18nJsonModule) no idioma de quem lê. */
    public static final String MARK = "§i18n:";
    private static final char SEP = '\u001F';
    private static final Pattern MARK_RE = Pattern.compile("§i18n:([A-Za-z0-9_.\\-]+)((?:\u001F[^§]*)*)§(?!i18n:)");   // o § final nunca é o início de um marcador-argumento: o mais interno resolve primeiro
    private static final ResourceBundle.Control NO_FALLBACK = ResourceBundle.Control.getNoFallbackControl(ResourceBundle.Control.FORMAT_PROPERTIES);

    private Msg() {
    }

    /** Idioma corrente da requisição; fora de um request (jobs, testes) é pt-BR, e não o locale da JVM. */
    public static Locale locale() {
        org.springframework.context.i18n.LocaleContext ctx = LocaleContextHolder.getLocaleContext();
        Locale l = ctx == null ? null : ctx.getLocale();
        return l == null ? PT_BR : supported(l);
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

    /**
     * Texto adiado: devolve um marcador que só vira texto quando a resposta é serializada (ou em {@link #resolve}),
     * no idioma de quem lê. Para dados estáticos (catálogos, enums) e para notificações guardadas no banco.
     */
    public static String k(String key, Object... args) {
        StringBuilder sb = new StringBuilder(MARK).append(key);
        if (args != null) for (Object a : args) sb.append(SEP).append(a == null ? "" : hasMark(String.valueOf(a)) ? String.valueOf(a) : String.valueOf(a).replace(SEP, ' '));   // um marcador pode ser argumento de outro
        return sb.append('§').toString();
    }

    public static boolean hasMark(String s) {
        return s != null && s.indexOf('§') >= 0 && s.contains(MARK);
    }

    /** Troca todos os marcadores de um texto pelo texto no idioma pedido (texto sem marcador volta igual). */
    public static String resolve(Locale locale, String s) {
        if (!hasMark(s)) return s;
        String cur = s;
        for (int pass = 0; pass < 4 && hasMark(cur); pass++) {   // marcadores aninhados (argumento de outro) resolvem de dentro para fora
            Matcher m = MARK_RE.matcher(cur);
            StringBuilder out = new StringBuilder();
            boolean any = false;
            while (m.find()) {
                any = true;
                String key = m.group(1);
                String rawArgs = m.group(2);
                Object[] args = rawArgs == null || rawArgs.isEmpty() ? new Object[0] : rawArgs.substring(1).split(String.valueOf(SEP), -1);
                m.appendReplacement(out, Matcher.quoteReplacement(t(locale, key, args)));
            }
            m.appendTail(out);
            if (!any) break;
            cur = out.toString();
        }
        return cur;
    }

    public static String resolve(String s) {
        return resolve(locale(), s);
    }

    /**
     * Resolve os marcadores em profundidade (Map, List e String) para dados que saem do sistema sem passar pelo
     * serializador JSON da API — exportação LGPD, arquivos, e-mails. Mapas e listas voltam em cópias; o resto é devolvido igual.
     */
    @SuppressWarnings("unchecked")
    public static Object resolveDeep(Locale locale, Object value) {
        if (value instanceof String s) return resolve(locale, s);
        if (value instanceof Map<?, ?> m) {
            Map<Object, Object> out = new java.util.LinkedHashMap<>();
            for (Map.Entry<?, ?> e : m.entrySet()) out.put(e.getKey(), resolveDeep(locale, e.getValue()));
            return out;
        }
        if (value instanceof List<?> l) {
            List<Object> out = new java.util.ArrayList<>(l.size());
            for (Object o : l) out.add(resolveDeep(locale, o));
            return out;
        }
        return value;
    }

    /** Código da preferência de idioma do usuário (enum UiLanguage) para um Locale: PT_BR, EN ou ES. */
    public static String preferenceCode(Locale locale) {
        Locale l = supported(locale);
        return "en".equals(l.getLanguage()) ? "EN" : "es".equals(l.getLanguage()) ? "ES" : "PT_BR";
    }

    /** O texto enviado pelo cliente corresponde a este texto (marcador ou literal) em algum dos idiomas suportados? */
    public static boolean matchesAnyLocale(String deferredOrLiteral, String value) {
        if (value == null || deferredOrLiteral == null) return false;
        if (deferredOrLiteral.equals(value)) return true;
        for (Locale l : SUPPORTED) if (resolve(l, deferredOrLiteral).equals(value)) return true;
        return false;
    }

    /** Nome do idioma corrente para instruções a modelos de IA ("responda em …"). */
    public static String languageName() {
        Locale l = locale();
        return "en".equals(l.getLanguage()) ? "English" : "es".equals(l.getLanguage()) ? "español" : Msg.t("msg.portugues_do_brasil");
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
