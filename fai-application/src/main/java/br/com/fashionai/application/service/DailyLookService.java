package br.com.fashionai.application.service;

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

import java.time.LocalDate;
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
    @Transactional
    public DailyLook register(CurrentUser user, Scheme scheme, DailyLookSource source, LocalDate date) {
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + scheme.getId());
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(scheme.getId());
        List<WardrobeItem> unavailable = items.stream().map(SchemeItem::getWardrobeItem)
                .filter(w -> !w.isDisponivel() || w.getAvailabilityStatus() != AvailabilityStatus.AVAILABLE).toList();
        if (!unavailable.isEmpty()) {
            throw new ApiException(409, "PECA_INDISPONIVEL", "Este look tem peça(s) no cesto: "
                    + unavailable.stream().map(WardrobeItem::getName).toList() + ". Marque como disponível antes (RF33.CA05).");
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

    public Map<String, Object> view(DailyLook dl) {
        return Map.of("id", dl.getId(), "date", dl.getLookDate(), "source", dl.getSource().name(), "schemeId", dl.getScheme().getId(),
                "title", String.valueOf(dl.getScheme().getTitle()), "coverImageUrl", String.valueOf(dl.getScheme().getCoverImageUrl()),
                "feedback", dl.getFeedback() == null ? "" : dl.getFeedback().name());
    }
}
