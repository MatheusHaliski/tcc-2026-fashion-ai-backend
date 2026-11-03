package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.moments.MomentInput.enumOf;
import static br.com.fashionai.application.moments.MomentService.UPCOMING_DAYS;

/** Consultas de descoberta (§7–§9, §19): home da aba, banner "Agora", calendário e lista pública. */
final class MomentQueries extends MomentSupport {
    MomentQueries(MomentContext ctx) {
        super(ctx);
    }

    /** Home da aba Momentos: AGORA, PRÓXIMOS, destaque, resumo pessoal e os Momentos dos grupos FLAIR. */
    Map<String, Object> home(CurrentUser viewer) {
        Instant now = now();
        String country = countryOf(viewer);
        List<Moment> live = visibleLive(viewer, country);
        List<Map<String, Object>> active = new ArrayList<>();
        List<Map<String, Object>> upcoming = new ArrayList<>();
        Map<UUID, MomentParticipation> mine = viewer == null ? Map.of() : participations.findByMomentIdInAndUserId(live.stream().map(Moment::getId).toList(), viewer.id())
                .stream().collect(Collectors.toMap(MomentParticipation::getMomentId, p -> p, (a, b) -> a));
        for (Moment m : live) {
            MomentStatus eff = MomentTime.effective(m, now);
            Map<String, Object> card = MomentViews.card(m, now);
            card.put("regional", m.getScope() == MomentScope.COUNTRY && country == null);
            card.put("me", participationView(mine.get(m.getId())));
            if (eff == MomentStatus.ACTIVE) {
                active.add(card);
            } else if (eff == MomentStatus.SCHEDULED && MomentTime.startsInSeconds(m, now) <= UPCOMING_DAYS * 86400L) {
                upcoming.add(card);
            }
        }
        active.sort(Comparator.comparing((Map<String, Object> c) -> !Boolean.TRUE.equals(c.get("featured"))).thenComparing(c -> (Long) ((Map<?, ?>) c.get("time")).get("endsInSeconds")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("now", now.toString());
        out.put("country", country);
        out.put("active", active);
        out.put("upcoming", upcoming);
        out.put("featured", active.stream().filter(c -> Boolean.TRUE.equals(c.get("featured"))).findFirst().orElse(active.isEmpty() ? null : active.get(0)));
        if (viewer != null) {
            out.put("mine", new MomentHistory(ctx).mineSummary(viewer.id()));
            out.put("group", members.findByUserId(viewer.id()).map(mm -> new MomentGroups(ctx).groupSummary(mm.getTeam(), now)).orElse(null));
        }
        out.put("principle", Msg.t("moment.principio"));
        return out;
    }

    /** "Agora no FashionAI" (§43): só quando há Momento relevante; nunca um banner permanente. */
    Map<String, Object> nowBanner(CurrentUser viewer) {
        Instant now = now();
        String country = countryOf(viewer);
        Optional<Moment> pick = visibleLive(viewer, country).stream().filter(m -> MomentTime.active(m, now))
                .filter(m -> m.getVisibility().discoverable())
                .sorted(Comparator.comparing((Moment m) -> !m.isFeatured()).thenComparing(Moment::getEndAt)).findFirst();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("now", now.toString());
        out.put("moment", pick.map(m -> {
            Map<String, Object> c = MomentViews.card(m, now);
            if (viewer != null) {
                c.put("me", participationView(participations.findByMomentIdAndUserId(m.getId(), viewer.id()).orElse(null)));
            }
            return c;
        }).orElse(null));
        return out;
    }

    /** Calendário anual/mensal (§3, §19): cada Momento visível que toca o mês, com dias locais no fuso do Momento. */
    Map<String, Object> calendar(CurrentUser viewer, int year, Integer month, String tz) {
        Instant now = now();
        ZoneId zone = MomentTime.zone(tz);
        String country = countryOf(viewer);
        Instant from = MomentTime.yearStart(year, zone).minus(31, ChronoUnit.DAYS);
        Instant to = MomentTime.yearEnd(year, zone).plus(31, ChronoUnit.DAYS);
        List<Moment> all = moments.findByStatusInAndStartAtLessThanAndEndAtGreaterThan(VISIBLE, to, from).stream()
                .filter(m -> canSee(viewer, m)).filter(m -> inScope(m, country)).sorted(Comparator.comparing(Moment::getStartAt)).toList();
        List<Map<String, Object>> monthsOut = new ArrayList<>();
        int first = month == null ? 1 : month, last = month == null ? 12 : month;
        for (int mo = first; mo <= last; mo++) {
            YearMonth ym = YearMonth.of(year, mo);
            List<Map<String, Object>> items = new ArrayList<>();
            for (Moment m : all) {
                if (MomentTime.touches(m, ym)) {
                    Map<String, Object> c = MomentViews.card(m, now);
                    c.put("regional", m.getScope() == MomentScope.COUNTRY && country == null);
                    items.add(c);
                }
            }
            Map<String, Object> mv = new LinkedHashMap<>();
            mv.put("year", year);
            mv.put("month", mo);
            mv.put("days", ym.lengthOfMonth());
            mv.put("items", items);
            monthsOut.add(mv);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("now", now.toString());
        out.put("timezone", zone.getId());
        out.put("year", year);
        out.put("months", monthsOut);
        return out;
    }

    /** Lista pública simples (descoberta): vivos e terminados recentes, no escopo da pessoa. */
    Map<String, Object> list(CurrentUser viewer, String status, Integer year) {
        Instant now = now();
        String country = countryOf(viewer);
        List<MomentStatus> wanted = status == null ? VISIBLE : List.of(enumOf(MomentStatus.class, status, "status"));
        List<Map<String, Object>> items = moments.findByStatusIn(wanted).stream().filter(m -> canSee(viewer, m)).filter(m -> inScope(m, country))
                .filter(m -> year == null || MomentTime.localStart(m).getYear() == year || MomentTime.localEnd(m).getYear() == year)
                .sorted(Comparator.comparing(Moment::getStartAt).reversed()).map(m -> MomentViews.card(m, now)).toList();
        return Map.of("now", now.toString(), "items", items);
    }
}
