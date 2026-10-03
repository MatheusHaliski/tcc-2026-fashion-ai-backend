package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF34 §4.3 — conquistas (idempotentes, CA10) e conquistas secretas (DET-G03). Cada concessão alimenta FAI Points
 * (RF35, regra ACHIEVEMENT com valor por conquista) e a animação do quarto (RF32 §1.2 via evento AchievementGranted).
 */
@Service
public class AchievementService {
    private SideEffectRunner sideEffects;
    public record Def(String code, String name, String emoji, String condition, int points, boolean secret) {
    }

    public static final List<Def> CATALOG = List.of(
            new Def("CURADOR", "Curador", "🏆", Msg.k("achievement.catalogacao_95"), 200, false),
            new Def("SEGUNDA_CHANCE", Msg.k("common.segunda_chance"), "♻️", Msg.k("achievement.n10_pecas_esquecidas_reutilizadas"), 300, false),
            new Def("CAMALEAO", Msg.k("achievement.camaleao"), "🎨", Msg.k("achievement.looks_em_10_estilos_diferentes"), 200, false),
            new Def("SIGNATURE_CLOSET", Msg.k("common.signature_closet"), "👑", Msg.k("achievement.inventory_score_900"), 500, false),
            new Def("STYLIST", "Stylist", "🧠", Msg.k("achievement.n50_combinacoes_unicas_do_proprio"), 300, false),
            new Def("HIDDEN_GEM", Msg.k("achievement.hidden_gem"), "💎", Msg.k("achievement.uma_peca_esquecida_entra_no"), 150, false),
            new Def("MONOCROMATICO", Msg.k("achievement.monocromatico"), "⬛", Msg.k("achievement.look_de_uma_cor_so"), 100, true),
            new Def("CHANEL", "Chanel", "🎀", Msg.k("achievement.usar_tira_uma_coisa"), 100, true),
            new Def("SEXTA_CASUAL", Msg.k("achievement.sexta_casual"), "🧢", Msg.k("achievement.look_do_dia_casual_numa"), 100, true),
            new Def("MADRUGADA", "Madrugada", "🌙", Msg.k("achievement.vista_me_entre_0_h"), 100, true));

    private final UserAchievementRepository achievements;
    private final FaiPointsService points;
    private final NotificationService notifications;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final ApplicationEventPublisher events;

    public AchievementService(UserAchievementRepository achievements, FaiPointsService points, NotificationService notifications,
                              SchemeRepository schemes, SchemeItemRepository schemeItems, ApplicationEventPublisher events,
            SideEffectRunner sideEffects) {
        this.sideEffects = sideEffects;
        this.achievements = achievements;
        this.points = points;
        this.notifications = notifications;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.events = events;
    }

    public static Def def(String code) {
        return CATALOG.stream().filter(d -> d.code().equals(code)).findFirst().orElse(null);
    }

    /** Concede uma única vez (idempotente) e dispara os efeitos: pontos, notificação e animação no quarto. */
    @Transactional
    public boolean grant(UUID userId, String code) {
        Def d = def(code);
        if (d == null || achievements.existsByUserIdAndAchievementCode(userId, code)) {
            return false;
        }
        UserAchievement a = new UserAchievement();
        a.setUserId(userId);
        a.setAchievementCode(code);
        a.setSecret(d.secret());
        a.setGrantedAt(Instant.now());
        achievements.save(a);
        points.award(userId, "ACHIEVEMENT", "ACHIEVEMENT", code, d.points());
        notifications.notify(userId, null, NotificationType.ACHIEVEMENT_UNLOCKED, "ACHIEVEMENT", null,
                d.emoji() + " " + Msg.k("achievement.conquista", d.name()), Msg.k("achievement.fai_pts", (d.condition()), d.points()), Map.of("code", code, "secret", d.secret()));
        events.publishEvent(new DomainEvents.AchievementGranted(userId, code, d.secret()));
        return true;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(CurrentUser user) {
        Map<String, UserAchievement> mine = achievements.findByUserIdOrderByGrantedAtDesc(user.id()).stream()
                .collect(Collectors.toMap(UserAchievement::getAchievementCode, a -> a, (a, b) -> a));
        List<Map<String, Object>> out = new ArrayList<>();
        for (Def d : CATALOG) {
            UserAchievement a = mine.get(d.code());
            if (d.secret() && a == null) {
                continue; // secretas só aparecem depois de obtidas (DET-G03)
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", d.code());
            m.put("name", d.name());
            m.put("emoji", d.emoji());
            m.put("condition", d.condition());
            m.put("points", d.points());
            m.put("secret", d.secret());
            m.put("granted", a != null);
            m.put("grantedAt", a == null ? null : a.getGrantedAt());
            out.add(m);
        }
        return out;
    }

    // ------------------------------------------------------------------ secretas por evento
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onMirror(DomainEvents.MirrorAction ev) {
        sideEffects.run("conquistas:MirrorAction", () -> {
            if ("TIRA_UMA_COISA".equals(ev.action())) {
                grant(ev.userId(), "CHANEL");
            } else if ("VISTA_ME_MADRUGADA".equals(ev.action())) {
                grant(ev.userId(), "MADRUGADA");
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSchemeSaved(DomainEvents.SchemeSaved ev) {
        if (ev.pieceIds().size() < 2) {
            return;
        }
        sideEffects.run("conquistas:SchemeSaved", () -> {
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(ev.schemeId());
            Set<String> families = items.stream().map(si -> Taxonomy.COLOR_FAMILY.get(si.getWardrobeItem().getColor())).filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            if (items.size() >= 2 && families.size() == 1) {
                grant(ev.userId(), "MONOCROMATICO");
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDailyLook(DomainEvents.DailyLookRegistered ev) {
        if (ev.date().getDayOfWeek() != DayOfWeek.FRIDAY) {
            return;
        }
        sideEffects.run("conquistas:DailyLook", () -> schemes.findById(ev.schemeId()).ifPresent(s -> {
            if (br.com.fashionai.application.common.Json.csv(s.getOccasion()).contains("casual")) {
                grant(ev.userId(), "SEXTA_CASUAL");
            }
        }));
    }
}
