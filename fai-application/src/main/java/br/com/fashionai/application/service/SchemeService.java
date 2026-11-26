package br.com.fashionai.application.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.scheme.*;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;

/**
 * RF5 (Criar Look em 5 etapas: 1 modo · 2 prompt IA · 3 formulário · 4 arte · 5 preview/slots/salvar — etapas
 * 2 e 3 coexistem e só o salvar da etapa 5 persiste), RF9 (edição + "melhorar com IA" por diff), RF31 (toggles),
 * RF19.CA13 remixar e a renderização do card (preview e exportação).
 */
@Service
public class SchemeService {
    @org.springframework.beans.factory.annotation.Autowired
    private LookTypePreferencesService lookTypePreferences;
    private final SchemeAccess access;
    private final SchemeComposition composition;
    private final SchemeQueries queries;
    private final SchemePhotos photos;
    private final SchemePublication publication;
    private final SchemeEditing editing;
    private final SchemeLifecycle lifecycle;
    private final SchemeCards cardFlow;
    private final SchemeHype hype;
    /** Coleção e intensidade térmica do look (FKs em schemes). Opcional nos testes que montam o serviço sem Spring. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private ClassificationService classification;
    /** Nível térmico do look (FK em schemes). Opcional nos testes que montam o serviço sem Spring. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SchemeThermalWriter thermal;

    public SchemeService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces,
                         UserRepository users, ReactionRepository reactions, SavedItemRepository saved,
                         WardrobeService wardrobe, BackgroundStudioService studio, SealService seals,
                         SchemeCardRenderer renderer, ProjectionService projections, NotificationService notifications,
                         CounterStorePort counters, MediaService media, AiEngine ai, Guard guard, Audit audit,
                         DailyLookService dailyLooks, ApplicationEventPublisher events, StyleDnaRepository dna,
                         HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.access = new SchemeAccess(schemes, guard);
        this.hype = new SchemeHype(hypeScores, hypeConfig);
        this.composition = new SchemeComposition(wardrobe, media, users, dna, ai, hype);
        this.queries = new SchemeQueries(wardrobe, pieces, users, schemes, schemeItems, counters, events,
                reactions, saved, seals, access, hype, hypeConfig);
        SchemeFormWriter forms = new SchemeFormWriter(pieces, schemeItems);
        this.photos = new SchemePhotos(guard, users, media);
        this.publication = new SchemePublication(guard, schemeItems, projections, audit, access, queries);
        this.editing = new SchemeEditing(guard, users, schemes, schemeItems, studio, seals, counters,
                notifications, events, projections, dailyLooks, audit, ai, access, queries, forms, photos, publication);
        this.lifecycle = new SchemeLifecycle(guard, seals, projections, media, audit, schemes, schemeItems, wardrobe, access);
        this.cardFlow = new SchemeCards(users, pieces, guard, studio, schemeItems, renderer, projections, audit,
                access, queries, hype, media);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> builder(CurrentUser user) {
        return queries.builder(user);
    }

    public record ComposeRequest(List<String> occasion, List<String> style, String mood, String season, String prompt,
                                 List<String> excludeCombinations) {
    }

    public record ComposeResult(List<LocalSchemeComposer.Composition> compositions, String message,
                                AiOutcome.Explanation explanation, UUID inferenceId, AiOutcome.Quota quota,
                                boolean fallbackUsed, String provider,
                                /** o que a orientação livre pediu (CopilotService.orientation): background, ocasiões, estilos, estação, humor */
                                Map<String, Object> orientation,
                                /**
                                 * RF53 (P2-14) — os seis números de cada composição (RecommendationScoring, mesma ordem de
                                 * {@code compositions}), calculados pelo LookPreviewService; nulo quando não deu para calcular
                                 */
                                List<Map<String, Object>> scores) {
        public ComposeResult(List<LocalSchemeComposer.Composition> compositions, String message, AiOutcome.Explanation explanation,
                             UUID inferenceId, AiOutcome.Quota quota, boolean fallbackUsed, String provider) {
            this(compositions, message, explanation, inferenceId, quota, fallbackUsed, provider, null, null);
        }

        public ComposeResult withOrientation(Map<String, Object> orientation) {
            return new ComposeResult(compositions, message, explanation, inferenceId, quota, fallbackUsed, provider,
                    orientation == null || orientation.isEmpty() ? null : orientation, scores);
        }

        public ComposeResult withScores(List<Map<String, Object>> scores) {
            return new ComposeResult(compositions, message, explanation, inferenceId, quota, fallbackUsed, provider, orientation,
                    scores == null || scores.size() != (compositions == null ? 0 : compositions.size()) ? null : scores);
        }
    }

    public ComposeResult compose(CurrentUser user, ComposeRequest req, AiCapability capability) {
        return composition.compose(user, req, capability);
    }

    public static String combinationKey(List<UUID> ids) {
        return SchemeComposition.combinationKey(ids);
    }

    public record ItemForm(UUID wardrobeItemId, SchemeSlot slot, Integer sortOrder, Integer zIndex, BigDecimal positionX,
                           BigDecimal positionY, BigDecimal scale, BigDecimal rotation, BigDecimal opacity,
                           Map<String, Object> filters) {
    }

    public record SchemeForm(String title, String description, List<String> occasion, List<String> style, Season season,
                             Mood mood, Visibility visibility, DisplayMode displayMode, List<ItemForm> items,
                             CreationMode creationMode, SchemeOrigin origin, UUID remixedFromId, Map<String, Object> background,
                             Boolean applyRecommendedDirection, String cardSkin, String layoutAnatomy, List<String> tags,
                             List<String> seals, Boolean publish, Boolean lookDoDia, UUID colecaoId,
                             UUID intensidadeTermicaId, UUID nivelTermicoId, Boolean clearNivelTermico) {
        /** Compatibilidade: quem monta o look por código (provador, espelho, autopiloto) não escolhe coleção, intensidade nem nível térmico. */
        public SchemeForm(String title, String description, List<String> occasion, List<String> style, Season season,
                          Mood mood, Visibility visibility, DisplayMode displayMode, List<ItemForm> items,
                          CreationMode creationMode, SchemeOrigin origin, UUID remixedFromId, Map<String, Object> background,
                          Boolean applyRecommendedDirection, String cardSkin, String layoutAnatomy, List<String> tags,
                          List<String> seals, Boolean publish, Boolean lookDoDia) {
            this(title, description, occasion, style, season, mood, visibility, displayMode, items, creationMode, origin,
                    remixedFromId, background, applyRecommendedDirection, cardSkin, layoutAnatomy, tags, seals, publish,
                    lookDoDia, null, null, null, null);
        }
    }

    @Transactional
    public Map<String, Object> create(CurrentUser user, SchemeForm form) {
        return editing.create(user, form, classification, thermal, lookTypePreferences);
    }

    public Map<String, Object> suggestSealsAfterSave(CurrentUser user, UUID schemeId) {
        return queries.suggestSealsAfterSave(user, schemeId);
    }

    @Transactional
    public Map<String, Object> uploadLookPhoto(CurrentUser user, byte[] bytes) {
        return photos.uploadLookPhoto(user, bytes);
    }

    @Transactional
    public Map<String, Object> publish(CurrentUser user, UUID id, Visibility visibility) {
        return publication.publish(user, id, visibility);
    }

    @Transactional
    public Map<String, Object> get(CurrentUser viewer, UUID id) {
        return queries.get(viewer, id);
    }

    public void requireView(CurrentUser viewer, Scheme s) {
        access.requireView(viewer, s);
    }

    public boolean canView(CurrentUser viewer, Scheme s) {
        return access.canView(viewer, s);
    }

    public static Visibility moreRestrictive(Visibility a, Visibility b) {
        return SchemeAccess.moreRestrictive(a, b);
    }

    public Views.SchemeView view(CurrentUser viewer, Scheme s, List<SchemeItem> items) {
        return queries.view(viewer, s, items);
    }

    @Transactional(readOnly = true)
    public Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, String kind, String sort, String hypeLevel,
                                             int page, int size) {
        return queries.mine(user, occasion, state, kind, sort, hypeLevel, page, size);
    }

    @Transactional
    public Map<String, Object> update(CurrentUser user, UUID id, SchemeForm form) {
        return editing.update(user, id, form, classification, thermal);
    }

    public Map<String, Object> improve(CurrentUser user, UUID id, String instruction) {
        return editing.improve(user, id, instruction);
    }

    @Transactional
    public Map<String, Object> applyDiff(CurrentUser user, UUID id, Map<String, Object> accepted) {
        return editing.applyDiff(user, id, accepted);
    }

    @Transactional
    public Map<String, Object> toggles(CurrentUser user, UUID id, Boolean favorite, Boolean disponivel) {
        return lifecycle.toggles(user, id, favorite, disponivel);
    }

    @Transactional
    public Map<String, Object> archive(CurrentUser user, UUID id) {
        return lifecycle.archive(user, id);
    }

    @Transactional
    public Map<String, Object> remix(CurrentUser user, UUID sourceId) {
        return lifecycle.remix(user, sourceId);
    }

    @Transactional(readOnly = true)
    public byte[] renderCard(CurrentUser viewer, UUID id, boolean expanded) {
        return cardFlow.renderCard(viewer, id, expanded);
    }

    String cardHypeLabel(HypeScoreCurrent h, boolean owner) {
        return hype.cardHypeLabel(h, owner);
    }

    @Transactional(readOnly = true)
    public byte[] preview(CurrentUser user, SchemeForm form) {
        return cardFlow.preview(user, form);
    }

    @Transactional
    public Views.SchemeView updateLayout(CurrentUser user, UUID id, List<ItemForm> layout) {
        return cardFlow.updateLayout(user, id, layout);
    }

    @Transactional(readOnly = true)
    public byte[] layoutPreview(CurrentUser user, UUID id, List<ItemForm> layout) {
        return cardFlow.layoutPreview(user, id, layout);
    }

    public Scheme owned(CurrentUser user, UUID id) {
        return access.owned(user, id);
    }
}
