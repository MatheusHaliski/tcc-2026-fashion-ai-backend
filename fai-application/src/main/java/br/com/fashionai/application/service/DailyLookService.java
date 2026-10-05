package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF6 / RF33 §2.3 — o Look do Dia é sempre um Esquema: um registro por usuário e dia (UNIQUE user_id+look_date),
 * com a origem (manual, autopiloto, copilot, vista_me, smart_mirror). Reutilizado pelo Lookbook, pelo Smart
 * Mirror e pelo Autopiloto (HU17/HU18).
 */
@Service
public class DailyLookService {
    private final DailyLookRepository dailyLooks;
    private final SchemeItemRepository schemeItems;
    private final UserRepository users;
    private final Guard guard;
    private final ApplicationEventPublisher events;

    public DailyLookService(DailyLookRepository dailyLooks, SchemeItemRepository schemeItems, UserRepository users, Guard guard,
                            ApplicationEventPublisher events) {
        this.dailyLooks = dailyLooks;
        this.schemeItems = schemeItems;
        this.users = users;
        this.guard = guard;
        this.events = events;
    }

    /** Registra (ou substitui) o Look do Dia da data. Peças indisponíveis não viram Look do Dia (RF33.CA05). */
    @Transactional(noRollbackFor = ApiException.class)   // chamada em try/catch pelo SchemeService: recusa vira aviso, não erro 500
    public DailyLook register(CurrentUser user, Scheme scheme, DailyLookSource source, LocalDate date) {
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + scheme.getId());
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(scheme.getId());
        List<WardrobeItem> unavailable = items.stream().map(SchemeItem::getWardrobeItem)
                .filter(w -> !w.isDisponivel() || w.getAvailabilityStatus() != AvailabilityStatus.AVAILABLE).toList();
        if (!unavailable.isEmpty()) {
            throw new ApiException(409, "PECA_INDISPONIVEL", Msg.t("dailyLook.este_look_tem_peca_s", unavailable.stream().map(WardrobeItem::getName).toList()));
        }
        LocalDate day = date == null ? LocalDate.now(FaiPointsService.ZONE) : date;
        User owner = users.findById(user.id()).orElseThrow();
        DailyLook dl = dailyLooks.findByUserIdAndLookDate(user.id(), day).orElseGet(() -> new DailyLook(owner, scheme, day, source));
        boolean replaced = dl.getScheme() != null && !dl.getScheme().getId().equals(scheme.getId());
        dl.setScheme(scheme);
        dl.setSource(source);
        dailyLooks.save(dl);
        scheme.setLookDoDia(true);
        if (!replaced || dl.getId() == null) {
            scheme.setLookDoDiaCount(scheme.getLookDoDiaCount() + 1);
        }
        List<UUID> pieceIds = items.stream().map(si -> si.getWardrobeItem().getId()).toList();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            w.setLookDoDiaCount(w.getLookDoDiaCount() + 1);
            if (w.getLastWornDate() == null || day.isAfter(w.getLastWornDate())) {
                w.setLastWornDate(day);
            }
        }
        events.publishEvent(new DomainEvents.DailyLookRegistered(user.id(), scheme.getId(), day, source.name(), pieceIds));
        return dl;
    }

    /** RF6 §1 — continuidade na virada do dia: sem registro de hoje, materializa copiando o mais recente anterior. */
    @Transactional
    public Optional<DailyLook> today(UUID userId) {
        LocalDate day = LocalDate.now(FaiPointsService.ZONE);
        Optional<DailyLook> existing = dailyLooks.findByUserIdAndLookDate(userId, day);
        if (existing.isPresent()) {
            return existing;
        }
        Optional<DailyLook> previous = dailyLooks.findFirstByUserIdAndLookDateBeforeOrderByLookDateDesc(userId, day);
        if (previous.isEmpty() || previous.get().getScheme().getStatus() == SchemeStatus.ARCHIVED) {
            return Optional.empty();
        }
        DailyLook src = previous.get();
        DailyLook copy = new DailyLook(src.getUser(), src.getScheme(), day, src.getSource());
        copy.setMaterializedFrom(src);
        dailyLooks.save(copy);
        return Optional.of(copy);
    }

    /** HU19 — avaliação do Look do Dia (adorei / não usei / não gostei); sem look → orienta o Autopiloto (C3). */
    @Transactional
    public Map<String, Object> feedback(CurrentUser user, LocalDate date, DailyLookFeedback feedback) {
        LocalDate day = date == null ? LocalDate.now(FaiPointsService.ZONE) : date;
        DailyLook dl = (day.equals(LocalDate.now(FaiPointsService.ZONE)) ? today(user.id()) : dailyLooks.findByUserIdAndLookDate(user.id(), day))
                .orElseThrow(() -> new ApiException(404, "SEM_LOOK_DO_DIA", Msg.t("dailyLook.nao_ha_look_do_dia", day), Map.of("href", "/autopilot")));
        dl.setFeedback(feedback);
        dl.setFeedbackAt(Instant.now());
        dailyLooks.save(dl);
        return view(dl);
    }

    /** HU19 C4 — histórico de looks passados com avaliação e data. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> history(CurrentUser user) {
        return dailyLooks.findTop60ByUserIdOrderByLookDateDesc(user.id()).stream().map(this::view).toList();
    }

    /** HU19 C5 — lembrete à noite quando o look do dia (Autopiloto/Copilot/Vista-me) ainda não foi avaliado. */
    @Transactional(readOnly = true)
    public Map<String, Object> pendingFeedback(CurrentUser user) {
        Optional<DailyLook> dl = dailyLooks.findByUserIdAndLookDate(user.id(), LocalDate.now(FaiPointsService.ZONE));
        int hour = java.time.LocalDateTime.now(FaiPointsService.ZONE).getHour();
        boolean pending = dl.isPresent() && dl.get().getFeedback() == null;
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("pending", pending);
        out.put("evening", hour >= 18);
        out.put("show", pending && hour >= 18);
        out.put("message", pending ? Msg.t("dailyLook.como_foi_o_look_de") : "");
        out.put("dailyLook", dl.map(this::view).orElse(null));
        return out;
    }

    /**
     * Linha do Look do Dia (aba, histórico, Autopiloto). P1-06: {@code schemeId} é a chave do Hype v2 de cada linha — o
     * frontend pede os resumos em lote (/api/hype/summaries, Hype pessoal do dono) e mostra o HypeBadge; nada é
     * recalculado aqui. {@code hypeScore} é o v1 legado (deprecado; sai na limpeza do v1, P3-16).
     */
    public Map<String, Object> view(DailyLook dl) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", dl.getId());
        m.put("date", dl.getLookDate());
        m.put("source", dl.getSource().name());
        m.put("schemeId", dl.getScheme().getId());
        m.put("title", dl.getScheme().getTitle());
        m.put("coverImageUrl", dl.getScheme().getCoverImageUrl());
        m.put("hypeScore", dl.getScheme().getHypeScore());   // @deprecated v1 — use o Hype v2 pelo schemeId
        m.put("feedback", dl.getFeedback() == null ? null : dl.getFeedback().name());
        m.put("feedbackAt", dl.getFeedbackAt());
        m.put("materialized", dl.getMaterializedFrom() != null);
        m.put("weekPlanDayId", dl.getWeekPlanDayId());
        return m;
    }
}
