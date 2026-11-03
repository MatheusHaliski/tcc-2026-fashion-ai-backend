package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.ChallengeTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.temporal.IsoFields;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF36 — regras puras dos desafios: tabelas (dimensões, temas da Batalha na Passarela, regras do Desafio do Dia, blocos
 * de regra e origens), datas no fuso do FAI Points, referência diária determinística, nome e regra do modelo no idioma
 * de quem lê, equipe do convite, janela do Espelho de Verdade, URL autenticada da foto e descrição dos blocos.
 * Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeRules {
    static final Set<String> VOTED = Set.of("RUNWAY_BATTLE", "GRWM");
    static final Set<String> SINGLE_SHOT = Set.of("RUNWAY_BATTLE", "GRWM", "DAILY_CHALLENGE");
    static final Map<String, String> DIM_NAMES = Map.of("C", Msg.k("common.catalogacao"), "D", "Diversidade", "U", Msg.k("common.utilizacao"), "V", "Versatilidade",
            "O", Msg.k("common.organizacao"), "R", "Descoberta", "I", "Identidade");
    /** Tema semanal da Batalha na Passarela (rodízio pela semana ISO). */
    static final List<String> RUNWAY_THEMES = List.of(Msg.k("challenge.monocromatico_total"), Msg.k("challenge.anos_2000_com_o_que"), Msg.k("challenge.old_money_do_dia_a"),
            Msg.k("challenge.festival_de_verao"), Msg.k("challenge.escritorio_criativo"), Msg.k("challenge.noite_de_gala_sem_comprar"), Msg.k("challenge.gorpcore_urbano"), Msg.k("challenge.quiet_luxury"), Msg.k("challenge.uma_peca_herdada"));
    /** DET-C04 — regras do Desafio do Dia (rodízio pelo dia do ano). */
    static final List<Map<String, Object>> DAILY_RULES = List.of(
            Map.of("text", Msg.k("challenge.uma_peca_vermelha_uma_esquecida"), "blocks", List.of(Map.of("type", "color_family", "value", "Vermelho"),
                    Map.of("type", "state", "value", "forgotten"))),
            Map.of("text", Msg.k("challenge.look_monocromatico"), "blocks", List.of(Map.of("type", "monochrome", "value", true))),
            Map.of("text", Msg.k("challenge.uma_peca_garimpada_herdada_ou"), "blocks", List.of(Map.of("type", "origin", "value", "GARIMPADA|HERDADA|PRESENTE"))),
            Map.of("text", Msg.k("challenge.tres_familias_de_cor_diferentes"), "blocks", List.of(Map.of("type", "distinct_colors", "value", 3))),
            Map.of("text", Msg.k("challenge.uma_peca_que_voce_nao"), "blocks", List.of(Map.of("type", "unused_days", "value", 30),
                    Map.of("type", "category", "value", "accessory_piece"))),
            Map.of("text", Msg.k("challenge.so_pecas_neutras"), "blocks", List.of(Map.of("type", "neutral_only", "value", true))),
            Map.of("text", Msg.k("challenge.uma_camada_por_cima_uma"), "blocks", List.of(Map.of("type", "slot", "value", "outer_layer"),
                    Map.of("type", "color_family", "value", "Azul"))));
    /** §7 — blocos de regra pré-definidos (sem texto livre, sempre verificáveis). */
    static final Set<String> RULE_BLOCK_TYPES = Set.of("color_family", "category", "origin", "state", "piece_count", "monochrome",
            "neutral_only", "distinct_colors", "unused_days", "slot");
    static final Set<String> ORIGINS = Set.of("COMPRADA", "GARIMPADA", "HERDADA", "PRESENTE", "FEITA_A_MAO", "TROCADA");

    static LocalDate today() {
        return LocalDate.now(FaiPointsService.ZONE);
    }

    static LocalDate dateOf(Instant i) {
        return LocalDate.ofInstant(i, FaiPointsService.ZONE);
    }

    /** Referência determinística por dia (idempotência de evidências diárias — uq_ch_evt). */
    static UUID dayRef(UUID instanceId, LocalDate day) {
        return UUID.nameUUIDFromBytes((instanceId + ":" + day).getBytes(StandardCharsets.UTF_8));
    }

    static String dailyRuleText(LocalDate day) {
        return String.valueOf(DAILY_RULES.get(day.getDayOfYear() % DAILY_RULES.size()).get("text"));
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> dailyRuleBlocks(LocalDate day) {
        return (List<Map<String, Object>>) DAILY_RULES.get(day.getDayOfYear() % DAILY_RULES.size()).get("blocks");
    }

    static String runwayTheme(LocalDate day) {
        return RUNWAY_THEMES.get(day.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR) % RUNWAY_THEMES.size());
    }

    static String teamOf(Map<String, String> teams, UUID userId, String mode) {
        if (!"DUELO".equals(mode) && !"EQUIPE".equals(mode)) {
            return null;
        }
        String t = teams == null ? null : teams.get(userId.toString());
        if ("EQUIPE".equals(mode)) {
            return "A";
        }
        return t == null ? null : t.toUpperCase(Locale.ROOT).startsWith("B") ? "B" : "A";
    }

    /** Nome do modelo de desafio no idioma de quem lê (chave challengeTemplate.<código>.name; o texto semeado em pt-BR é o fallback). */
    static String tplName(ChallengeTemplate t) {
        String key = "challengeTemplate." + t.getCode() + ".name";
        return Msg.has(key) ? Msg.k(key) : t.getName();
    }

    static String tplRule(ChallengeTemplate t) {
        String key = "challengeTemplate." + t.getCode() + ".rule";
        return Msg.has(key) ? Msg.k(key) : t.getRuleText();
    }

    static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }

    /** Janela aleatória (determinística por desafio e dia) entre 9 h e 21 h, com 30 minutos. */
    static ZonedDateTime windowStart(UUID instanceId, LocalDate day) {
        int h = Math.abs((instanceId.toString() + day).hashCode());
        int minutes = 9 * 60 + h % (12 * 60);
        return day.atStartOfDay(FaiPointsService.ZONE).plusMinutes(minutes);
    }

    static String mirrorPhotoUrl(UUID instanceId, String photoId) {
        return "/api/challenges/" + instanceId + "/mirror-photos/" + photoId;
    }

    static String describe(List<Map<String, Object>> blocks) {
        return blocks.stream().map(b -> {
            String q = "all".equals(b.get("quantifier")) ? Msg.t("challenge.so_pecas") : Msg.t("challenge.uma_peca");
            Object v = b.get("value");
            return switch (String.valueOf(b.get("type"))) {
                case "color_family" -> q + "da cor " + v;
                case "category" -> q + "da categoria " + v;
                case "origin" -> q + "com origem " + String.valueOf(v).toLowerCase(Locale.ROOT).replace("|", " ou ");
                case "state" -> q + ("forgotten".equals(v) ? "esquecida" : "favorite".equals(v) ? "favorita" : Msg.t("challenge.disponivel"));
                case "unused_days" -> Msg.t("challenge.uma_peca_sem_uso_ha", v);
                case "slot" -> Msg.t("challenge.uma_peca_no_slot", v);
                case "monochrome" -> Msg.t("challenge.look_monocromatico_2");
                case "neutral_only" -> Msg.t("challenge.so_pecas_neutras_2");
                case "distinct_colors" -> Msg.t("challenge.familias_de_cor", (v));
                case "piece_count" -> Msg.t("challenge.ate_pecas", v);
                default -> String.valueOf(b.get("type"));
            };
        }).collect(Collectors.joining(" + "));
    }
}
