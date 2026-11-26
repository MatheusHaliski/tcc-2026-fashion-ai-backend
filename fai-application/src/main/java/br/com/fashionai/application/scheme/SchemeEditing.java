package br.com.fashionai.application.scheme;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;
import br.com.fashionai.application.service.CreationLookDefaults;

public final class SchemeEditing {
    private final Guard guard;
    private final UserRepository users;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final BackgroundStudioService studio;
    private final SealService seals;
    private final CounterStorePort counters;
    private final NotificationService notifications;
    private final ApplicationEventPublisher events;
    private final ProjectionService projections;
    private final DailyLookService dailyLooks;
    private final Audit audit;
    private final AiEngine ai;
    private final SchemeAccess access;
    private final SchemeQueries queries;
    private final SchemeFormWriter forms;
    private final SchemePhotos photos;
    private final SchemePublication publication;

    public SchemeEditing(Guard guard, UserRepository users, SchemeRepository schemes, SchemeItemRepository schemeItems,
                         BackgroundStudioService studio, SealService seals, CounterStorePort counters, NotificationService
                         notifications, ApplicationEventPublisher events, ProjectionService projections, DailyLookService
                         dailyLooks, Audit audit, AiEngine ai, SchemeAccess access, SchemeQueries queries, SchemeFormWriter
                         forms, SchemePhotos photos, SchemePublication publication) {
        this.guard = guard;
        this.users = users;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.studio = studio;
        this.seals = seals;
        this.counters = counters;
        this.notifications = notifications;
        this.events = events;
        this.projections = projections;
        this.dailyLooks = dailyLooks;
        this.audit = audit;
        this.ai = ai;
        this.access = access;
        this.queries = queries;
        this.forms = forms;
        this.photos = photos;
        this.publication = publication;
    }

    public Map<String, Object> create(CurrentUser user, SchemeForm form, ClassificationService classification, SchemeThermalWriter thermal, LookTypePreferencesService lookTypePreferences) {
        guard.requireCanCreate(user);
        User owner = users.findById(user.id()).orElseThrow();
        if (form.items() == null || form.items().isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.adicione_ao_menos_1_peca"));
        }
        Scheme s = CreationLookDefaults.scheme(owner, form, lookTypePreferences);
        forms.applyForm(s, form, classification, thermal);
        if (form.remixedFromId() != null) {
            Scheme src = schemes.findById(form.remixedFromId()).orElseThrow(() -> ApiException.notFound(Msg.t("scheme.esquema_de_origem")));
            // mesma regra do remix pela interação: visibilidade efetiva (look × perfil do autor), bloqueio e arquivamento
            access.requireView(user, src);
            if (!src.isDisponivel() && !src.getUser().getId().equals(user.id())) {
                throw ApiException.conflict("INDISPONIVEL", Msg.t("scheme.o_autor_marcou_este_look"));
            }
            s.setOriginalScheme(src);
            s.setOrigin(SchemeOrigin.REMIX);
        }
        schemes.save(s);
        List<SchemeItem> items = forms.replaceItems(user, s, form.items());
        studio.requireAuraAccess(user, form.background());
        studio.applyToScheme(s, form.background(), Boolean.TRUE.equals(form.applyRecommendedDirection()));
        photos.applyLookPhoto(user, s, form.background(), items);
        if (Boolean.TRUE.equals(form.publish())) {
            publication.publishInternal(s, items);
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
        out.put("scheme", queries.view(user, s, items));
        if (dailyLookWarning != null) {
            out.put("dailyLookWarning", dailyLookWarning);
        }
        // RF20.CA01 — a sugestão de vínculo roda depois do commit (SchemeController → suggestSealsAfterSave): uma falha
        // na sugestão não pode marcar esta transação como rollback-only e derrubar o salvamento do esquema.
        return out;
    }

    public Map<String, Object> update(CurrentUser user, UUID id, SchemeForm form, ClassificationService classification, SchemeThermalWriter thermal) {
        guard.requireCanCreate(user);
        Scheme s = access.owned(user, id);
        Set<UUID> before = schemeItems.findBySchemeIdOrderBySortOrder(id).stream().map(si -> si.getWardrobeItem().getId())
                .collect(Collectors.toSet());
        forms.applyForm(s, form, classification, thermal);
        Visibility oldVisibility = s.getVisibility();
        if (form.visibility() != null) {
            s.setVisibility(form.visibility());
        }
        List<SchemeItem> items = form.items() == null ? schemeItems.findBySchemeIdOrderBySortOrder(id) : forms.replaceItems(user, s, form.items());
        if (items.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.o_esquema_precisa_de_ao"));
        }
        Set<UUID> after = items.stream().map(si -> si.getWardrobeItem().getId()).collect(Collectors.toSet());
        if (form.background() != null || Boolean.TRUE.equals(form.applyRecommendedDirection())) {
            studio.requireAuraAccess(user, form.background());
            studio.applyToScheme(s, form.background(), Boolean.TRUE.equals(form.applyRecommendedDirection()));
            photos.applyLookPhoto(user, s, form.background(), items);
        }
        if (!before.equals(after) && s.getStatus() == SchemeStatus.PUBLISHED) {
            seals.flagRevalidation(s);
            for (SchemeItem si : items) {
                if (si.getSnapshotJson() == null) {
                    si.setSnapshotJson(Json.write(Views.snapshot(si.getWardrobeItem())));
                }
            }
        }
        if (s.getVisibility() == Visibility.PRIVATE && oldVisibility != Visibility.PRIVATE) {
            // RF20.CA14 — esquema tornado privado revoga os selos.
            seals.revokeForScheme(s.getId(), Msg.t("scheme.esquema_tornado_privado"));
        }
        if (Boolean.TRUE.equals(form.publish()) && s.getStatus() != SchemeStatus.PUBLISHED) {
            publication.publishInternal(s, items);
        }
        projections.scheme(s, items);
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("itemsChanged", !before.equals(after)));
        if (!before.equals(after)) {
            events.publishEvent(new DomainEvents.SchemeSaved(user.id(), id, new ArrayList<>(after), s.getOrigin().name(), false));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheme", queries.view(user, s, items));
        out.put("revalidationPending", s.isRevalidationPending());
        return out;
    }

    /** RF9 / RF24.CA10 — "melhorar com IA": diff estruturado, aceito ou recusado item a item. */
    public Map<String, Object> improve(CurrentUser user, UUID id, String instruction) {
        guard.requireCanCreate(user);
        Scheme s = access.owned(user, id);
        Map<String, Object> current = SchemeEditDiff.current(s);
        AiOutcome<List<LocalAdvisors.FieldChange>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.EDIT_ASSISTANT,
                SchemeEditDiff.system(), Msg.t("scheme.esquema_atual_instrucao", Json.write(current), InputSanitizer.clean(instruction, 500)),
                List.of(), 900, List.of(Msg.t("scheme.campos_atuais_do_esquema"), "instrução em linguagem natural"),
                text -> SchemeEditDiff.parse(text, current), () -> LocalAdvisors.proposeEdit(current, instruction == null ? "" : instruction), null));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("changes", outcome.value());
        out.put("explanation", outcome.explanation());
        out.put("inferenceId", outcome.inferenceId());
        out.put("message", outcome.userMessage());
        return out;
    }

    /** Aplica só os campos do diff que o usuário aceitou. */
    public Map<String, Object> applyDiff(CurrentUser user, UUID id, Map<String, Object> accepted) {
        guard.requireCanCreate(user);
        Scheme s = access.owned(user, id);
        for (Map.Entry<String, Object> e : accepted.entrySet()) {
            if (!SchemeEditDiff.validChange(e.getKey(), e.getValue())) {
                throw ApiException.badRequest("DIFF_INVALIDO", Msg.t("scheme.alteracao_invalida_para_o_campo", e.getKey()));
            }
            SchemeEditDiff.apply(s, e.getKey(), e.getValue());
        }
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("aiDiffFields", accepted.keySet()));
        return Map.of("scheme", queries.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(id)));
    }
}
