package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.Notification;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.HypeMilestoneRepository;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * RF53 · P1-10 — notificação de marco de Hype. Ouve {@link DomainEvents.HypeMilestone} (publicado pelo job de snapshots
 * só quando há SUBIDA) depois do commit, em transação própria ({@link SideEffectRunner}: uma falha aqui nunca derruba o
 * job). Regras:
 * <ul>
 *   <li><b>1ª vez</b>: dedupe por (entidade, marco) em {@code hype_milestones}; atingir Viral já cobre Em alta e
 *   Tendência, então oscilar na borda de uma faixa ou cair e voltar nunca avisa de novo;</li>
 *   <li><b>nunca queda</b>: o job só publica subida, e aqui nada rebaixa nem apaga marco (ETI-02);</li>
 *   <li><b>um resumo por dono por dia</b>: os marcos do mesmo dia (America/Sao_Paulo) atualizam a mesma notificação,
 *   que volta a ficar não lida, em vez de criar outra;</li>
 *   <li><b>privacidade</b>: o destinatário é sempre o dono da peça/look (conferido no banco); item privado ou só para
 *   seguidores é Hype pessoal e o texto diz isso. Ninguém mais é avisado;</li>
 *   <li><b>não é sinal de Hype</b>: este componente não publica eventos nem escreve em {@code hype_signal_daily}.</li>
 * </ul>
 * Categoria ACHIEVEMENT e desativável em Notificações › Preferências (o marco é gravado mesmo assim, para não reaparecer).
 */
@Component
public class HypeMilestoneNotifier {
    /** quantos itens o texto do resumo nomeia; o resto vira "e mais N" */
    static final int MAX_NAMED = 3;
    /** nome cortado no texto: o corpo da notificação tem 500 caracteres */
    static final int NAME_MAX = 60;
    /** resumo com vários itens: abre Histórico › Hype (subiram, emergentes, redescobertas) */
    static final String DIGEST_HREF = "/history?tab=hype";
    static final String DIGEST_RESOURCE = "HYPE";

    private final HypeMilestoneRepository milestones;
    private final NotificationService notifications;
    private final NotificationRepository notificationRows;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final HypeScoreConfig config;
    private final SideEffectRunner sideEffects;
    private final Clock clock;

    @Autowired
    public HypeMilestoneNotifier(HypeMilestoneRepository milestones, NotificationService notifications, NotificationRepository notificationRows,
                                 WardrobeItemRepository pieces, SchemeRepository schemes, HypeScoreConfig config, SideEffectRunner sideEffects) {
        this(milestones, notifications, notificationRows, pieces, schemes, config, sideEffects, Clock.systemUTC());
    }

    HypeMilestoneNotifier(HypeMilestoneRepository milestones, NotificationService notifications, NotificationRepository notificationRows,
                          WardrobeItemRepository pieces, SchemeRepository schemes, HypeScoreConfig config, SideEffectRunner sideEffects, Clock clock) {
        this.milestones = milestones;
        this.notifications = notifications;
        this.notificationRows = notificationRows;
        this.pieces = pieces;
        this.schemes = schemes;
        this.config = config;
        this.sideEffects = sideEffects;
        this.clock = clock;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onMilestone(DomainEvents.HypeMilestone ev) {
        sideEffects.run("HypeMilestone", () -> record(ev));
    }

    /** Grava o marco (se for a 1ª vez) e cria/atualiza o resumo do dia. Devolve se houve marco novo. */
    boolean record(DomainEvents.HypeMilestone ev) {
        if (ev == null || ev.ownerId() == null || ev.entityId() == null || ev.entityType() == null || ev.milestone() == null) {
            return false;
        }
        if (alreadyReached(milestones.findByEntityTypeAndEntityId(ev.entityType(), ev.entityId()), ev.milestone())) {
            return false;
        }
        // o aviso é sempre do dono: entidade que sumiu ou mudou de dono não avisa ninguém
        if (!ownedBy(ev.entityType(), ev.entityId(), ev.ownerId())) {
            return false;
        }
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, HypeSignalRecorder.ZONE);
        HypeMilestone m = new HypeMilestone();
        m.setEntityType(ev.entityType());
        m.setEntityId(ev.entityId());
        m.setOwnerId(ev.ownerId());
        m.setMilestone(ev.milestone());
        m.setLevel(ev.level());
        m.setMomentum(ev.momentum());
        m.setScore(ev.score() == null ? null : BigDecimal.valueOf(ev.score()).setScale(2, RoundingMode.HALF_UP));
        m.setPublicEligible(ev.publicEligible());
        m.setAlgorithmVersion(config.algorithmVersion());
        m.setAchievedAt(now);
        m.setDigestDate(today);

        List<HypeMilestone> day = new ArrayList<>(milestones.findByOwnerIdAndDigestDateOrderByAchievedAtAsc(ev.ownerId(), today));
        day.add(m);
        Notification n = digest(ev.ownerId(), day);
        UUID nid = n == null ? null : n.getId();
        m.setNotificationId(nid);
        milestones.save(m);
        List<HypeMilestone> relinked = day.stream().filter(x -> x != m && !Objects.equals(x.getNotificationId(), nid)).toList();
        relinked.forEach(x -> x.setNotificationId(nid));
        if (!relinked.isEmpty()) {
            milestones.saveAll(relinked);
        }
        return true;
    }

    /** Já houve este marco (ou uma faixa igual/acima)? Viral cobre Tendência e Em alta; EMERGING só a si mesmo. */
    static boolean alreadyReached(Collection<HypeMilestone> past, HypeMilestone.Kind kind) {
        for (HypeMilestone p : past) {
            HypeMilestone.Kind k = p.getMilestone();
            if (k == kind || (kind.isLevel() && k != null && k.isLevel() && k.level().ordinal() >= kind.level().ordinal())) {
                return true;
            }
        }
        return false;
    }

    boolean ownedBy(HypeEntityType type, UUID id, UUID owner) {
        if (type == HypeEntityType.PIECE) {
            return pieces.findById(id).map(w -> w.getUser() != null && owner.equals(w.getUser().getId())).orElse(false);
        }
        return schemes.findById(id).map(s -> s.getUser() != null && owner.equals(s.getUser().getId())).orElse(false);
    }

    /** Resumo do dia: atualiza a notificação já criada hoje (do próprio dono) ou cria a primeira. */
    Notification digest(UUID ownerId, List<HypeMilestone> day) {
        Content c = content(day, names(day));
        UUID existingId = day.stream().map(HypeMilestone::getNotificationId).filter(Objects::nonNull).findFirst().orElse(null);
        Notification n = existingId == null ? null : notificationRows.findById(existingId)
                .filter(x -> x.getRecipient() != null && ownerId.equals(x.getRecipient().getId()) && x.getType() == NotificationType.HYPE_MILESTONE)
                .orElse(null);
        if (n == null) {
            return notifications.notify(ownerId, null, NotificationType.HYPE_MILESTONE, c.resourceType(), c.resourceId(), c.title(), c.body(), c.payload());
        }
        n.setResourceType(c.resourceType());
        n.setResourceId(c.resourceId());
        n.setTitle(c.title());
        n.setBody(c.body());
        n.setPayloadJson(Json.write(c.payload()));
        n.setRead(false);   // novidade no mesmo resumo: volta a aparecer como não lida
        n.setReadAt(null);
        return notificationRows.save(n);
    }

    /** Nome atual de cada peça/look do resumo (cortado e sem os caracteres reservados do marcador de i18n). */
    Map<UUID, String> names(List<HypeMilestone> day) {
        Map<UUID, String> out = new HashMap<>();
        List<UUID> pieceIds = day.stream().filter(x -> x.getEntityType() == HypeEntityType.PIECE).map(HypeMilestone::getEntityId).distinct().toList();
        List<UUID> schemeIds = day.stream().filter(x -> x.getEntityType() == HypeEntityType.SCHEME).map(HypeMilestone::getEntityId).distinct().toList();
        if (!pieceIds.isEmpty()) {
            for (WardrobeItem w : pieces.findByIdIn(pieceIds)) {
                out.put(w.getId(), shortName(w.getName()));
            }
        }
        if (!schemeIds.isEmpty()) {
            for (Scheme s : schemes.findByIdIn(schemeIds)) {
                out.put(s.getId(), shortName(s.getTitle()));
            }
        }
        return out;
    }

    static String shortName(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String clean = raw.replace('§', ' ').replace('\u001F', ' ').strip();
        return clean.length() > NAME_MAX ? clean.substring(0, NAME_MAX - 1).strip() + "…" : clean;
    }

    record Content(String title, String body, String resourceType, UUID resourceId, Map<String, Object> payload) {
    }

    /**
     * Texto do resumo (marcadores de i18n: resolvidos no idioma de quem lê). Um item por peça/look — o marco mais alto
     * do dia (Viral › Tendência › Em alta › Emergente). Com um item, o link abre o detalhe; com vários, Histórico › Hype.
     */
    static Content content(List<HypeMilestone> day, Map<UUID, String> names) {
        Map<UUID, HypeMilestone> best = new LinkedHashMap<>();
        for (HypeMilestone m : day) {
            best.merge(m.getEntityId(), m, (a, b) -> rank(b.getMilestone()) > rank(a.getMilestone()) ? b : a);
        }
        List<HypeMilestone> items = new ArrayList<>(best.values());
        StringBuilder body = new StringBuilder();
        int named = 0;
        for (HypeMilestone m : items) {
            String name = names.get(m.getEntityId());
            if (name == null || named >= MAX_NAMED) {
                continue;
            }
            append(body, Msg.k("notification.hype.body." + m.getMilestone().name(), name));
            named++;
        }
        if (items.size() > named) {
            append(body, Msg.k("notification.hype.more", items.size() - named));
        }
        if (items.stream().anyMatch(m -> !m.isPublicEligible())) {
            append(body, Msg.k("notification.hype.personal"));
        }
        List<Map<String, Object>> list = new ArrayList<>();
        for (HypeMilestone m : items) {
            Map<String, Object> it = new LinkedHashMap<>();
            it.put("type", m.getEntityType().name());
            it.put("id", m.getEntityId().toString());
            it.put("milestone", m.getMilestone().name());
            it.put("level", m.getLevel() == null ? null : m.getLevel().name());
            it.put("personal", !m.isPublicEligible());
            list.add(it);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("count", items.size());
        payload.put("items", list);
        if (items.size() == 1) {
            HypeMilestone only = items.get(0);
            String href = (only.getEntityType() == HypeEntityType.PIECE ? "/pieces/" : "/schemes/") + only.getEntityId();
            payload.put("href", href);
            return new Content(Msg.k("notification.hype.title_one"), body.toString(), only.getEntityType().name(), only.getEntityId(), payload);
        }
        payload.put("href", DIGEST_HREF);
        return new Content(Msg.k("notification.hype.title_many", items.size()), body.toString(), DIGEST_RESOURCE, null, payload);
    }

    /** Ordem do "marco mais alto" no resumo. */
    static int rank(HypeMilestone.Kind k) {
        return k == null ? -1 : k.isLevel() ? 1 + k.level().ordinal() : 0;
    }

    private static void append(StringBuilder sb, String part) {
        if (!sb.isEmpty()) {
            sb.append(' ');
        }
        sb.append(part);
    }
}
