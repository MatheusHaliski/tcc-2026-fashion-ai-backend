package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentTime;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Look do Dia Vivido F3 (§4.4) — fase pessoal ("primeiro mês no novo emprego", "gestação · 2.º trimestre") como Momento
 * PERSONAL, privado por padrão, da própria pessoa. Cada Look do Dia dentro do período entra na fase; ao fim, a Memória
 * ({@link DailyLookPhaseMemory}). Publicar a Memória no perfil é ato explícito, por fase. Sem pontos, sem ranking.
 */
@Service
public class DailyLookPhaseService {
    static final int MAX_DAYS = 366;

    private final MomentRepository moments;
    private final DailyLookRepository dailyLooks;
    private final UserRepository users;
    private final DailyLookPhaseMemory memory;
    private final Guard guard;

    public DailyLookPhaseService(MomentRepository moments, DailyLookRepository dailyLooks, UserRepository users, DailyLookPhaseMemory memory, Guard guard) {
        this.moments = moments;
        this.dailyLooks = dailyLooks;
        this.users = users;
        this.memory = memory;
        this.guard = guard;
    }

    /** POST /api/me/daily-looks/phases — cria a fase e liga a ela os Looks do Dia já registrados no período. */
    @Transactional
    public Map<String, Object> create(CurrentUser user, String name, LocalDate start, LocalDate end) {
        if (name == null || name.isBlank()) {
            throw ApiException.badRequest("VALOR_INVALIDO", Msg.t("dailyLook.fase_precisa_de_nome"));
        }
        if (start == null || end == null || end.isBefore(start) || start.plusDays(MAX_DAYS).isBefore(end)) {
            throw ApiException.badRequest("VALOR_INVALIDO", Msg.t("dailyLook.fase_periodo_invalido"));
        }
        User u = users.findById(user.id()).orElseThrow();
        ZoneId zone = MomentTime.zone(u.getTimezone());
        LocalDate today = LocalDate.now(zone);
        Moment m = new Moment();
        m.setSlug("fase-" + user.id().toString().substring(0, 8) + "-" + UUID.randomUUID().toString().substring(0, 8));
        m.setName(name.strip());
        m.setType(MomentType.PERSONAL);
        m.setNature(MomentNature.PRIVATE);
        m.setScope(MomentScope.PERSONAL);
        m.setVisibility(MomentVisibility.PRIVATE);
        m.setTimezone(zone.getId());
        m.setStartAt(start.atStartOfDay(zone).toInstant());
        m.setEndAt(end.atTime(LocalTime.MAX).atZone(zone).toInstant());
        m.setStatus(today.isBefore(start) ? MomentStatus.SCHEDULED : today.isAfter(end) ? MomentStatus.ENDED : MomentStatus.ACTIVE);
        m.setCreatedByUserId(user.id());
        m.setOfficial(false);
        m.setPointsEnabled(false);
        m.setBasePoints(0);
        moments.save(m);
        for (DailyLook dl : dailyLooks.findByUserIdAndLookDateBetweenOrderByLookDate(user.id(), start, end)) {
            if (dl.getPersonalMomentId() == null) {
                dl.setPersonalMomentId(m.getId());
                dailyLooks.save(dl);
            }
        }
        return view(m, Instant.now());
    }

    /** GET /api/me/daily-looks/phases — minhas fases, da mais recente à mais antiga, com o resumo de cada uma. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(CurrentUser user) {
        Instant now = Instant.now();
        return moments.findByCreatedByUserIdAndTypeOrderByStartAtDesc(user.id(), MomentType.PERSONAL).stream()
                .map(m -> memory.ownerSummary(m, dailyLooks.findByPersonalMomentIdOrderByLookDate(m.getId()), view(m, now))).toList();
    }

    /** GET /api/me/daily-looks/phases/{id}/memory — a Memória completa (só a dona). */
    @Transactional(readOnly = true)
    public Map<String, Object> memory(CurrentUser user, UUID id) {
        Moment m = owned(user, id);
        return memory.full(m, dailyLooks.findByPersonalMomentIdOrderByLookDate(id), view(m, Instant.now()));
    }

    /** PUT /api/me/daily-looks/phases/{id}/visibility — publicar (ou recolher) a Memória no perfil. */
    @Transactional
    public Map<String, Object> setPublicOnProfile(CurrentUser user, UUID id, boolean publicOnProfile) {
        Moment m = owned(user, id);
        m.setPhasePublicOnProfile(publicOnProfile);
        moments.save(m);
        return view(m, Instant.now());
    }

    /** GET /api/users/{id}/daily-looks/phases — Memórias publicadas de alguém (resumo público, só peças públicas). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> published(CurrentUser viewer, UUID userId) {
        if (!guard.canView(viewer, userId, Visibility.PUBLIC)) {
            return List.of();
        }
        Instant now = Instant.now();
        return moments.findByCreatedByUserIdAndTypeOrderByStartAtDesc(userId, MomentType.PERSONAL).stream().filter(Moment::isPhasePublicOnProfile)
                .map(m -> memory.publicSummary(m, dailyLooks.findByPersonalMomentIdOrderByLookDate(m.getId()), view(m, now))).toList();
    }

    /** A fase da pessoa que cobre a data (para ligar um Look do Dia novo), se houver. */
    public Optional<Moment> phaseOn(UUID userId, LocalDate day) {
        return moments.findByCreatedByUserIdAndTypeOrderByStartAtDesc(userId, MomentType.PERSONAL).stream()
                .filter(m -> !day.isBefore(MomentTime.localStart(m)) && !day.isAfter(MomentTime.localEnd(m))).findFirst();
    }

    private Moment owned(CurrentUser user, UUID id) {
        Moment m = moments.findById(id).filter(x -> x.getType() == MomentType.PERSONAL).orElseThrow(() -> ApiException.notFound(Msg.t("dailyLook.fase")));
        guard.requireOwner(user, m.getCreatedByUserId(), "phase:" + id);
        return m;
    }

    static Map<String, Object> view(Moment m, Instant now) {
        Map<String, Object> v = new java.util.LinkedHashMap<>();
        v.put("id", m.getId());
        v.put("name", m.getName());
        v.put("startDate", MomentTime.localStart(m));
        v.put("endDate", MomentTime.localEnd(m));
        v.put("status", MomentTime.effective(m, now).name());
        v.put("daysLeft", MomentTime.view(m, now).get("daysLeft"));
        v.put("publicOnProfile", m.isPhasePublicOnProfile());
        return v;
    }
}
