package br.com.fashionai.application.service;

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
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DisplayMode;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF5 (Criar Look em 5 etapas: 1 modo · 2 prompt IA · 3 formulário · 4 arte · 5 preview/slots/salvar — etapas
 * 2 e 3 coexistem e só o salvar da etapa 5 persiste), RF9 (edição + "melhorar com IA" por diff), RF31 (toggles),
 * RF19.CA13 remixar e a renderização do card (preview e exportação). Fachada: guarda as transações e delega cada caso
 * de uso a um colaborador do pacote.
 */
@Service
public class SchemeService {
    private final SchemeReads reads;
    private final SchemeComposeSteps composer;
    private final SchemeLookPhoto photo;
    private final SchemeCreateFlow creation;
    private final SchemeEditFlow editing;
    private final SchemeAiEdit aiEdit;
    private final SchemeCards cards;
    private final SchemeLayout layout;

    public SchemeService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces,
                         UserRepository users, ReactionRepository reactions, SavedItemRepository saved,
                         WardrobeService wardrobe, BackgroundStudioService studio, SealService seals,
                         SchemeCardRenderer renderer, ProjectionService projections, NotificationService notifications,
                         CounterStorePort counters, MediaService media, AiEngine ai, Guard guard, Audit audit,
                         DailyLookService dailyLooks, ApplicationEventPublisher events, StyleDnaRepository dna,
                         HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        SchemeHype hype = new SchemeHype(hypeScores, hypeConfig);
        this.reads = new SchemeReads(schemes, schemeItems, reactions, saved, wardrobe, seals, counters, events, guard, hype, hypeConfig);
        this.composer = new SchemeComposeSteps(wardrobe, pieces, users, media, ai, dna, hype);
        this.photo = new SchemeLookPhoto(guard, users, media);
        SchemeFormWriter writer = new SchemeFormWriter(pieces, schemeItems, projections);
        this.creation = new SchemeCreateFlow(schemes, schemeItems, users, wardrobe, studio, seals, projections, notifications, dailyLooks,
                counters, guard, audit, events, reads, writer, photo);
        this.editing = new SchemeEditFlow(schemeItems, studio, seals, projections, media, guard, audit, events, reads, writer, photo);
        this.aiEdit = new SchemeAiEdit(schemeItems, ai, guard, audit, reads);
        this.cards = new SchemeCards(schemes, schemeItems, pieces, users, studio, renderer, media, guard, reads, hype);
        this.layout = new SchemeLayout(schemeItems, projections, renderer, audit, reads, cards);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> builder(CurrentUser user) {
        return composer.builder(user);
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

        public ComposeResult(List<LocalSchemeComposer.Composition> compositions, String message, AiOutcome.Explanation explanation,
                             UUID inferenceId, AiOutcome.Quota quota, boolean fallbackUsed, String provider, Map<String, Object> orientation) {
            this(compositions, message, explanation, inferenceId, quota, fallbackUsed, provider, orientation, null);
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
        return composer.compose(user, req, capability);
    }

    public static String combinationKey(List<UUID> ids) {
        return ids.stream().map(UUID::toString).sorted().collect(Collectors.joining("+"));
    }

    public record ItemForm(UUID wardrobeItemId, SchemeSlot slot, Integer sortOrder, Integer zIndex, BigDecimal positionX,
                           BigDecimal positionY, BigDecimal scale, BigDecimal rotation, BigDecimal opacity,
                           Map<String, Object> filters) {
    }

    public record SchemeForm(String title, String description, List<String> occasion, List<String> style, Season season,
                             Mood mood, Visibility visibility, DisplayMode displayMode, List<ItemForm> items,
                             CreationMode creationMode, SchemeOrigin origin, UUID remixedFromId, Map<String, Object> background,
                             Boolean applyRecommendedDirection, String cardSkin, String layoutAnatomy, List<String> tags,
                             List<String> seals, Boolean publish, Boolean lookDoDia) {
    }

    @Transactional
    public Map<String, Object> create(CurrentUser user, SchemeForm form) {
        return creation.create(user, form);
    }

    public Map<String, Object> suggestSealsAfterSave(CurrentUser user, UUID schemeId) {
        return creation.suggestSealsAfterSave(user, schemeId);
    }

    @Transactional
    public Map<String, Object> uploadLookPhoto(CurrentUser user, byte[] bytes) {
        return photo.uploadLookPhoto(user, bytes);
    }

    @Transactional
    public Map<String, Object> publish(CurrentUser user, UUID id, Visibility visibility) {
        return editing.publish(user, id, visibility);
    }

    @Transactional
    public Map<String, Object> get(CurrentUser viewer, UUID id) {
        return reads.get(viewer, id);
    }

    public void requireView(CurrentUser viewer, Scheme s) {
        reads.requireView(viewer, s);
    }

    public boolean canView(CurrentUser viewer, Scheme s) {
        return reads.canView(viewer, s);
    }

    public static Visibility moreRestrictive(Visibility a, Visibility b) {
        return SchemeReads.moreRestrictive(a, b);
    }

    public Views.SchemeView view(CurrentUser viewer, Scheme s, List<SchemeItem> items) {
        return reads.view(viewer, s, items);
    }

    @Transactional(readOnly = true)
    public Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, int page, int size) {
        return mine(user, occasion, state, null, null, null, page, size);
    }

    public Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, String kind, int page, int size) {
        return mine(user, occasion, state, kind, null, null, page, size);
    }

    @Transactional(readOnly = true)
    public Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, String kind, String sort, String hypeLevel,
                                             int page, int size) {
        return reads.mine(user, occasion, state, kind, sort, hypeLevel, page, size);
    }

    public static String kindOf(Scheme s) {
        return SchemeLookFilters.kindOf(s);
    }

    @Transactional
    public Map<String, Object> update(CurrentUser user, UUID id, SchemeForm form) {
        return editing.update(user, id, form);
    }

    public Map<String, Object> improve(CurrentUser user, UUID id, String instruction) {
        return aiEdit.improve(user, id, instruction);
    }

    @Transactional
    public Map<String, Object> applyDiff(CurrentUser user, UUID id, Map<String, Object> accepted) {
        return aiEdit.applyDiff(user, id, accepted);
    }

    @Transactional
    public Map<String, Object> toggles(CurrentUser user, UUID id, Boolean favorite, Boolean disponivel) {
        return editing.toggles(user, id, favorite, disponivel);
    }

    @Transactional
    public Map<String, Object> archive(CurrentUser user, UUID id) {
        return editing.archive(user, id);
    }

    @Transactional
    public Map<String, Object> remix(CurrentUser user, UUID sourceId) {
        return creation.remix(user, sourceId);
    }

    @Transactional(readOnly = true)
    public byte[] renderCard(CurrentUser viewer, UUID id, boolean expanded) {
        return cards.renderCard(viewer, id, expanded);
    }

    @Transactional(readOnly = true)
    public byte[] preview(CurrentUser user, SchemeForm form) {
        return cards.preview(user, form);
    }

    @Transactional
    public Views.SchemeView updateLayout(CurrentUser user, UUID id, List<ItemForm> layout) {
        return this.layout.updateLayout(user, id, layout);
    }

    @Transactional(readOnly = true)
    public byte[] layoutPreview(CurrentUser user, UUID id, List<ItemForm> layout) {
        return this.layout.layoutPreview(user, id, layout);
    }

    public Scheme owned(CurrentUser user, UUID id) {
        return reads.owned(user, id);
    }
}
