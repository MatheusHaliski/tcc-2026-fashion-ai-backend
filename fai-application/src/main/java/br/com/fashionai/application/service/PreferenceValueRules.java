package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.MannequinGeometry;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * RF23 — regras puras de valor das preferências e da vitrine do perfil, extraídas de {@link PreferencesService}: cada
 * função normaliza um valor livre enviado pelo cliente ou recusa com o código estável de sempre (400). Sem repositório,
 * catálogo de assets, storage, relógio ou transação: o que depende disso (fundo do chrome, skin de card, permissões AURA,
 * persistência, auditoria, cache do Hype) continua no serviço, na mesma ordem de avaliação.
 *
 * <p>Convenção herdada: para os campos "zeráveis", vazio (ou {@code AUTO} na moeda) devolve {@code null} = volta ao padrão.
 */
final class PreferenceValueRules {
    private PreferenceValueRules() {
    }

    /** DET-C06 — microestéticas "-core" do quiz "Qual é o seu core?" (vocabulário do arquétipo do DNA). */
    static final List<String> CORES = List.of("OLD_MONEY", "QUIET_LUXURY", "GORPCORE", "COQUETTE", "Y2K", "STREETWEAR", "DARK_ACADEMIA", "COTTAGECORE");

    static final Pattern NAV_GROUP = Pattern.compile("^nav\\.group\\.[a-z]{2,20}$");
    static final Pattern NAV_HREF = Pattern.compile("^/[a-z0-9][a-z0-9/-]{0,40}$");
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");
    private static final Pattern ISO_COUNTRY = Pattern.compile("[A-Z]{2}");
    private static final Pattern HTTP_URL = Pattern.compile("(?i)https?://[^\\s<>\"]{3,300}");

    /**
     * RF23.CA02 — sincronização entre aparelhos: a alteração estritamente anterior à já gravada é ignorada (a mais recente
     * vence). Mesmo instante ou sem um dos lados: aplica.
     */
    static boolean isStale(Instant incoming, Instant stored) {
        return incoming != null && stored != null && incoming.isBefore(stored);
    }

    /** Moeda dos preços: "" ou AUTO volta à moeda do idioma ({@code null}); senão uma das suportadas, em maiúsculas. */
    static String currency(String raw) {
        String c = raw.trim().toUpperCase(Locale.ROOT);
        if (!c.isEmpty() && !"AUTO".equals(c) && !ExchangeRateService.supported(c)) {
            throw ApiException.badRequest("MOEDA_INVALIDA", Msg.t("preferences.moeda_invalida"));
        }
        return c.isEmpty() || "AUTO".equals(c) ? null : c;
    }

    /** Tamanho da fonte em %: 80 a 160 inclusive. */
    static int fontScale(int value) {
        if (value < 80 || value > 160) {
            throw ApiException.badRequest("FONTE_INVALIDA", Msg.t("preferences.tamanho_de_fonte_entre_80"));
        }
        return value;
    }

    /** Core do quiz: vazio limpa; senão um de {@link #CORES} (sem diferenciar maiúsculas). */
    static String coreAesthetic(String raw) {
        String core = raw.trim().toUpperCase(Locale.ROOT);
        if (!core.isEmpty() && !CORES.contains(core)) {
            throw ApiException.badRequest("CORE_INVALIDO", Msg.t("preferences.core_desconhecido"));
        }
        return core.isEmpty() ? null : core;
    }

    /** Cor dos containers: "" volta ao padrão (branco); qualquer outro valor precisa ser #RRGGBB (gravado em maiúsculas). */
    static String containerColor(String raw) {
        String c = raw.trim();
        if (!c.isEmpty() && !HEX_COLOR.matcher(c).matches()) {
            throw ApiException.badRequest("COR_INVALIDA", Msg.t("preferences.cor_dos_containers_em_hexadecimal"));
        }
        return c.isEmpty() ? null : c.toUpperCase(Locale.ROOT);
    }

    /** RF18.CA06 — tom de pele do manequim: só os da paleta de {@link MannequinGeometry#SKIN_TONES}. */
    static String skinTone(String raw) {
        if (!MannequinGeometry.SKIN_TONES.containsKey(raw)) {
            throw ApiException.badRequest("TOM_INVALIDO", Msg.t("preferences.tom_de_pele_fora_da"));
        }
        return raw;
    }

    /** País do perfil: vazio limpa; senão código ISO de 2 letras (em maiúsculas). */
    static String country(String raw) {
        String c = raw.trim().toUpperCase(Locale.ROOT);
        if (!c.isEmpty() && !ISO_COUNTRY.matcher(c).matches()) {
            throw ApiException.badRequest("PAIS_INVALIDO", Msg.t("preferences.use_o_codigo_iso_do"));
        }
        return c.isEmpty() ? null : c;
    }

    /**
     * RF23 — ordem do menu lateral: só chaves de grupo ({@code nav.group.x}) e caminhos internos ({@code /closet}), sem
     * repetição e com limite de tamanho. O frontend ignora o que não conhece e acrescenta itens novos no fim, então a lista
     * guardada não precisa conter todos os itens.
     */
    static Map<String, Object> navOrder(Map<String, Object> raw) {
        List<String> groups = navList(raw.get("groups"), NAV_GROUP, 12);
        Map<String, List<String>> items = new LinkedHashMap<>();
        if (raw.get("items") instanceof Map<?, ?> m) {
            if (m.size() > 12) throw invalidNav();
            m.forEach((k, v) -> {
                String key = String.valueOf(k);
                if (!NAV_GROUP.matcher(key).matches()) throw invalidNav();
                items.put(key, navList(v, NAV_HREF, 20));
            });
        } else if (raw.get("items") != null) {
            throw invalidNav();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("groups", groups);
        out.put("items", items);
        return out;
    }

    private static List<String> navList(Object value, Pattern format, int max) {
        if (value == null) return List.of();
        if (!(value instanceof List<?> list) || list.size() > max) throw invalidNav();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (Object o : list) {
            if (!(o instanceof String s) || !format.matcher(s).matches() || !out.add(s)) throw invalidNav();
        }
        return List.copyOf(out);
    }

    private static ApiException invalidNav() {
        return ApiException.badRequest("ORDEM_DO_MENU_INVALIDA", Msg.t("preferences.ordem_do_menu_invalida"));
    }

    /** Links do perfil (Editar perfil, formato do Instagram): até 5, só http(s), título curto. */
    static List<Map<String, String>> links(List<Map<String, String>> links) {
        if (links.size() > 5) {
            throw ApiException.badRequest("LINKS_DEMAIS", Msg.t("preferences.use_ate_5_links"));
        }
        List<Map<String, String>> out = new ArrayList<>();
        for (Map<String, String> l : links) {
            String url = l.get("url") == null ? "" : l.get("url").trim();
            if (url.isEmpty()) {
                continue;
            }
            if (!HTTP_URL.matcher(url).matches()) {
                throw ApiException.badRequest("LINK_INVALIDO", Msg.t("preferences.link_invalido_use_um_endereco"));
            }
            String title = l.get("title") == null || l.get("title").isBlank() ? url.replaceFirst("(?i)^https?://", "") : l.get("title").trim();
            out.add(Map.of("title", InputSanitizer.clean(title.length() > 40 ? title.substring(0, 40) : title, 40), "url", url));
        }
        return out;
    }

    /** Ajuste do rosto no manequim: deslocamentos em ±0,3 e escala 0,6–1,8; valor ausente ou não numérico usa o padrão. */
    static Map<String, Object> mannequinFace(Map<String, Object> raw) {
        Map<String, Object> face = new LinkedHashMap<>();
        face.put("offsetX", clampNum(raw.get("offsetX"), -0.3, 0.3, 0));
        face.put("offsetY", clampNum(raw.get("offsetY"), -0.3, 0.3, 0));
        face.put("scale", clampNum(raw.get("scale"), 0.6, 1.8, 1));
        return face;
    }

    private static double clampNum(Object v, double min, double max, double def) {
        double d = v instanceof Number n ? n.doubleValue() : def;
        return Math.max(min, Math.min(max, d));
    }
}
