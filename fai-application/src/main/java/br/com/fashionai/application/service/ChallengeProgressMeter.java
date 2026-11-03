package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.application.service.ChallengeService.Progress;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ChallengeRules.dateOf;
import static br.com.fashionai.application.service.ChallengeRules.today;

/**
 * §4 — progresso verificável de cada participante, sempre a partir das evidências reais (CA10), e a sequência do Sem
 * Repetir com o Cabide de Reserva. Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeProgressMeter {
    private final ChallengeEventRepository evidence;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookRepository dailyLooks;

    ChallengeProgressMeter(ChallengeEventRepository evidence, SchemeRepository schemes, SchemeItemRepository schemeItems,
                           DailyLookRepository dailyLooks) {
        this.evidence = evidence;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
    }

    @SuppressWarnings("unchecked")
    Progress progress(ChallengeInstance i, ChallengeParticipant p, ChallengeTemplate t) {
        Map<String, Object> params = Json.map(i.getParamsJson());
        Map<String, Object> goal = Json.map(p.getPersonalGoalJson());
        List<ChallengeEvent> ev = evidence.findByInstanceIdAndUserId(i.getId(), p.getUserId());
        Instant survival = Instant.now().minus(24, ChronoUnit.HOURS);
        int duration = t.getDurationDays() == null ? 7 : t.getDurationDays();
        switch (t.getCode()) {
            case "TEN_X_TEN" -> {
                int ok = 0, pending = 0;
                for (ChallengeEvent e : ev) {
                    if (!"LOOK".equals(e.getEvidenceType())) {
                        continue;
                    }
                    Optional<Scheme> s = schemes.findById(e.getRefId()).filter(x -> x.getStatus() != SchemeStatus.ARCHIVED);
                    if (s.isEmpty()) {
                        continue; // esquema apagado não conta (§5 do score)
                    }
                    if (s.get().getCreatedAt() != null && s.get().getCreatedAt().isAfter(survival)) {
                        pending++;
                    } else {
                        ok++;
                    }
                }
                return new Progress(ok, 10, Math.min(1, ok / 10.0), Math.max(p.getBestRecord(), ok), Msg.t("challenge.looks_so_com_as_10"), pending);
            }
            case "CAPSULE_SEASON" -> {
                int target = params.get("target_days") instanceof Number n ? n.intValue() : 60;
                long days = ev.stream().filter(e -> "CAPSULE_DAY".equals(e.getEvidenceType())).count();
                return new Progress((int) days, target, Math.min(1, days / (double) target), (int) days, Msg.t("challenge.dias_vestindo_so_a_capsula"), 0);
            }
            case "SECOND_CHANCE" -> {
                int target = goal.get("target") instanceof Number n ? n.intValue() : 0;
                long rescued = ev.stream().filter(e -> "RESCUE".equals(e.getEvidenceType())).map(ChallengeEvent::getRefId).distinct().count();
                double f = target == 0 ? 1 : Math.min(1, rescued / (double) target);
                return new Progress((int) rescued, target, f, (int) rescued, target == 0 ? Msg.t("challenge.nenhuma_peca_esquecida_meta_ja")
                        : Msg.t("challenge.pecas_esquecidas_resgatadas"), 0);
            }
            case "NO_REPEAT" -> {
                int[] streak = noRepeatStreak(p.getUserId(), i.getStartsAt() == null ? today() : dateOf(i.getStartsAt()));
                int target = params.get("target_days") instanceof Number n ? n.intValue() : 7;
                return new Progress(streak[0], target, Math.min(1, streak[0] / (double) target), Math.max(p.getBestRecord(), streak[1]),
                        Msg.t("challenge.dias_seguidos_sem_repetir_o"), 0);
            }
            case "WEAR_WHAT_YOU_HAVE", "CHANEL_WEEK", "MY_SEASON", "REAL_MIRROR" -> {
                String type = switch (t.getCode()) {
                    case "WEAR_WHAT_YOU_HAVE" -> "WWYH_DAY";
                    case "CHANEL_WEEK" -> "TAKE_ONE_OFF";
                    case "MY_SEASON" -> "SEASON_DAY";
                    default -> "EQUIPE".equals(i.getMode()) ? "REAL_PHOTO_CONFIRMED" : "REAL_PHOTO";
                };
                Set<LocalDate> violations = ev.stream().filter(e -> "VIOLATION".equals(e.getEvidenceType())).map(e -> dateOf(e.getCreatedAt()))
                        .collect(Collectors.toSet());
                long days = ev.stream().filter(e -> type.equals(e.getEvidenceType())).map(e -> dateOf(e.getCreatedAt()))
                        .filter(d -> !violations.contains(d)).distinct().count();
                String label = switch (t.getCode()) {
                    case "WEAR_WHAT_YOU_HAVE" -> Msg.t("challenge.dias_vestindo_so_o_que");
                    case "CHANEL_WEEK" -> Msg.t("challenge.dias_com_tira_uma_coisa");
                    case "MY_SEASON" -> Msg.t("challenge.dias_com_looks_da_sua");
                    default -> Msg.t("challenge.dias_com_o_look_real");
                };
                return new Progress((int) days, duration, Math.min(1, days / (double) duration), (int) days, label, 0);
            }
            case "RUNWAY_BATTLE", "GRWM" -> {
                boolean entry = ev.stream().anyMatch(e -> "LOOK_ENTRY".equals(e.getEvidenceType()) || "GRWM_VIDEO".equals(e.getEvidenceType()));
                return new Progress(entry ? 1 : 0, 1, entry ? 1 : 0, entry ? 1 : 0, t.getCode().equals("GRWM") ? Msg.t("challenge.video_do_vista_me_publicado")
                        : Msg.t("challenge.look_inscrito_na_batalha"), 0);
            }
            case "DAILY_CHALLENGE" -> {
                boolean ok = ev.stream().anyMatch(e -> "DAILY_RULE_OK".equals(e.getEvidenceType()));
                return new Progress(ok ? 1 : 0, 1, ok ? 1 : 0, ok ? 1 : 0, Msg.t("challenge.look_dentro_da_regra_do"), 0);
            }
            default -> {
                long days = ev.stream().filter(e -> "RULE_LOOK".equals(e.getEvidenceType())).map(e -> dateOf(e.getCreatedAt())).distinct().count();
                return new Progress((int) days, duration, Math.min(1, days / (double) duration), (int) days, Msg.t("challenge.dias_com_look_dentro_da"), 0);
            }
        }
    }

    /** [atual, melhor] — sequência de Looks do Dia sem repetir composição, com o Cabide de Reserva (DET-G06). */
    int[] noRepeatStreak(UUID userId, LocalDate start) {
        Map<LocalDate, String> byDay = new TreeMap<>();
        for (DailyLook dl : dailyLooks.findTop60ByUserIdOrderByLookDateDesc(userId)) {
            if (!dl.getLookDate().isBefore(start)) {
                byDay.put(dl.getLookDate(), SchemeService.combinationKey(schemeItems.findBySchemeIdOrderBySortOrder(dl.getScheme().getId()).stream()
                        .map(si -> si.getWardrobeItem().getId()).toList()));
            }
        }
        int current = 0, best = 0;
        Set<String> seen = new HashSet<>();
        Set<Integer> reserveWeeks = new HashSet<>();
        LocalDate end = today();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            String k = byDay.get(d);
            int week = d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR) + d.getYear() * 100;
            if (k != null && seen.add(k)) {
                current++;
            } else if (k == null && (d.equals(end) || reserveWeeks.add(week))) {
                // hoje ainda não acabou; ou o cabide de reserva protege 1 dia perdido por semana
            } else {
                best = Math.max(best, current);
                current = 0;
                seen.clear();
                if (k != null) {
                    seen.add(k);
                    current = 1;
                }
            }
        }
        return new int[]{current, Math.max(best, current)};
    }
}
