package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService.SchemeForm;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Etapa 5 — salvar o look (RF5.CA03/CA05/CA06), com remix na origem (RF19.CA13), Look do Dia e eventos de gamificação;
 * a sugestão de vínculo depois do commit (RF20.CA01) e o pré-preenchimento do remix com as peças de quem remixa.
 */
final class SchemeCreateFlow {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final UserRepository users;
    private final WardrobeService wardrobe;
    private final BackgroundStudioService studio;
    private final SealService seals;
    private final ProjectionService projections;
    private final NotificationService notifications;
    private final DailyLookService dailyLooks;
    private final CounterStorePort counters;
    private final Guard guard;
    private final Audit audit;
    private final ApplicationEventPublisher events;
    private final SchemeReads reads;
    private final SchemeFormWriter writer;
    private final SchemeLookPhoto photo;

    SchemeCreateFlow(SchemeRepository schemes, SchemeItemRepository schemeItems, UserRepository users, WardrobeService wardrobe,
                     BackgroundStudioService studio, SealService seals, ProjectionService projections, NotificationService notifications,
                     DailyLookService dailyLooks, CounterStorePort counters, Guard guard, Audit audit, ApplicationEventPublisher events,
                     SchemeReads reads, SchemeFormWriter writer, SchemeLookPhoto photo) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.users = users;
        this.wardrobe = wardrobe;
        this.studio = studio;
        this.seals = seals;
        this.projections = projections;
        this.notifications = notifications;
        this.dailyLooks = dailyLooks;
        this.counters = counters;
        this.guard = guard;
        this.audit = audit;
        this.events = events;
        this.reads = reads;
        this.writer = writer;
        this.photo = photo;
    }

    Map<String, Object> create(CurrentUser user, SchemeForm form) {
        guard.requireCanCreate(user);
        User owner = users.findById(user.id()).orElseThrow();
        if (form.items() == null || form.items().isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.adicione_ao_menos_1_peca"));
        }
        Scheme s = new Scheme();
        s.setUser(owner);
        s.setCreationMode(form.creationMode() == null ? CreationMode.MANUAL : form.creationMode());
        s.setOrigin(form.origin() == null ? SchemeOrigin.CRIAR_LOOK : form.origin());
        s.setVisibility(form.visibility() != null ? form.visibility() : AccountService.defaultVisibility(owner));
        writer.applyForm(s, form);
        if (form.remixedFromId() != null) {
            Scheme src = schemes.findById(form.remixedFromId()).orElseThrow(() -> ApiException.notFound(Msg.t("scheme.esquema_de_origem")));
            // mesma regra do remix pela interação: visibilidade efetiva (look × perfil do autor), bloqueio e arquivamento
            reads.requireView(user, src);
            if (!src.isDisponivel() && !src.getUser().getId().equals(user.id())) {
                throw ApiException.conflict("INDISPONIVEL", Msg.t("scheme.o_autor_marcou_este_look"));
            }
            s.setOriginalScheme(src);
            s.setOrigin(SchemeOrigin.REMIX);
        }
        schemes.save(s);
        List<SchemeItem> items = writer.replaceItems(user, s, form.items());
        studio.requireAuraAccess(user, form.background());
        studio.applyToScheme(s, form.background(), Boolean.TRUE.equals(form.applyRecommendedDirection()));
        photo.applyLookPhoto(user, s, form.background(), items);
        if (Boolean.TRUE.equals(form.publish())) {
            writer.publishInternal(s, items);
        }
        if (s.getOriginalScheme() != null) {
            Scheme src = s.getOriginalScheme();
            src.setRemixCount(src.getRemixCount() + 1);
            counters.increment("scheme", src.getId(), "remixes", 1);
            notifications.notify(src.getUser().getId(), owner.getId(), NotificationType.NEW_REMIX, "SCHEME", s.getId(),
                    Msg.k("scheme.seu_look_foi_remixado"), Msg.k("scheme.criou_um_look_a_partir", owner.getUsername(), src.getTitle()), null);
            events.publishEvent(new DomainEvents.InteractionReceived(src.getUser().getId(), owner.getId(), "REMIX", src.getId()));
            events.publishEvent(new DomainEvents.HypeSignal(HypeSignalType.LOOK_REMIXED, HypeEntityType.SCHEME, src.getId(), owner.getId(), src.getUser().getId()));
        }
        projections.scheme(s, items);
        List<UUID> pieceIds = items.stream().map(si -> si.getWardrobeItem().getId()).toList();
        // RF32–RF36: diário de uso, FAI Points, conquistas secretas, progresso de desafios
        events.publishEvent(new DomainEvents.SchemeSaved(owner.getId(), s.getId(), pieceIds, s.getOrigin().name(), true));
        String dailyLookWarning = null;
        if (Boolean.TRUE.equals(form.lookDoDia())) {
            try {
                dailyLooks.register(user, s, DailyLookSource.MANUAL, LocalDate.now(FaiPointsService.ZONE));
            } catch (ApiException ex) {
                s.setLookDoDia(false);
                dailyLookWarning = ex.getMessage();
            }
        }
        notifications.notify(owner.getId(), null, NotificationType.SCHEME_CREATED, "SCHEME", s.getId(),
                Msg.k("scheme.esquema_criado_com_sucesso"), Msg.k("scheme.foi_adicionado_aos_seus_looks", s.getTitle()), null);
        audit.log(user, AuditActions.CRIACAO_ESQUEMA, "scheme:" + s.getId(), Map.of("items", items.size(),
                "creationMode", s.getCreationMode().name(), "origin", s.getOrigin().name()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheme", reads.view(user, s, items));
        if (dailyLookWarning != null) {
            out.put("dailyLookWarning", dailyLookWarning);
        }
        // RF20.CA01 — a sugestão de vínculo roda depois do commit (SchemeController → suggestSealsAfterSave): uma falha
        // na sugestão não pode marcar esta transação como rollback-only e derrubar o salvamento do esquema.
        return out;
    }

    /**
     * RF20.CA01 — sugestão de vínculo não bloqueante, chamada fora da transação do salvamento (o esquema já está
     * gravado). {@code seals.suggest} abre a própria transação; se falhar, devolve a mensagem sem afetar o esquema.
     */
    Map<String, Object> suggestSealsAfterSave(CurrentUser user, UUID schemeId) {
        try {
            return seals.suggest(user, schemeId);
        } catch (RuntimeException ex) {
            return Map.of("suggestions", List.of(), "message", Msg.t("scheme.sugestao_de_vinculo_indisponivel_agora"));
        }
    }

    Map<String, Object> remix(CurrentUser user, UUID sourceId) {
        guard.requireCanCreate(user);
        Scheme src = schemes.findById(sourceId).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        reads.requireView(user, src);
        if (!src.isDisponivel()) {
            throw ApiException.conflict("INDISPONIVEL", Msg.t("scheme.o_autor_marcou_este_look"));
        }
        List<SchemeItem> srcItems = schemeItems.findBySchemeIdOrderBySortOrder(sourceId);
        List<WardrobeItem> mine = wardrobe.eligible(user.id());
        SchemeRemixPrototype.PieceMapping mapping = SchemeRemixPrototype.mapPieces(srcItems, mine, src.getUser().getId().equals(user.id()));
        Map<String, Object> prefill = SchemeRemixPrototype.prefill(src, mapping.items());
        List<Map<String, Object>> missing = mapping.missing();
        return Map.of("prefill", prefill, "missingPieces", missing, "source", Map.of("id", src.getId(), "title", src.getTitle(),
                "owner", Views.user(src.getUser())), "next", "/create-look?remix=" + src.getId());
    }
}
