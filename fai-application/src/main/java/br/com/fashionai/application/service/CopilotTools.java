package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CopilotService.BackgroundPrompt;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.CopilotPieceVocabulary.COLOR_WORDS;
import static br.com.fashionai.application.service.CopilotPieceVocabulary.MATERIAL_WORDS;
import static br.com.fashionai.application.service.CopilotPieceVocabulary.TYPE_WORDS;
import static br.com.fashionai.application.service.CopilotText.mentions;
import static br.com.fashionai.application.service.CopilotText.normalized;
import static br.com.fashionai.application.service.CopilotText.startsWithWord;

/**
 * Ferramentas que o Copilot executa no servidor com a sessão do usuário (buscar_pecas, localizar_peca como chip,
 * Momentos ativos, pontuação dos looks, fundo pedido) e base dos colaboradores por caso de uso: expõe as dependências
 * do {@link CopilotContext} com os mesmos nomes de campo do serviço.
 */
class CopilotTools {
    protected final CopilotContext ctx;
    protected final WardrobeService wardrobe;
    protected final WardrobeItemRepository pieces;
    protected final SchemeRepository schemes;
    protected final SchemeItemRepository schemeItems;
    protected final DailyLookRepository dailyLooks;
    protected final StyleDnaRepository dnas;
    protected final UserPreferencesRepository preferences;
    protected final RoomService room;
    protected final MirrorService mirror;
    protected final InventoryScoreService inventory;
    protected final ChallengeService challenges;
    protected final AutopilotService autopilot;
    protected final DailyLookService dailyLookService;
    protected final WeatherService weather;
    protected final AiEngine ai;
    protected final Audit audit;
    protected final SchemeService schemeService;
    protected final BackgroundStudioService backgroundStudio;
    protected final HypeQueryService hype;
    protected final LookScorer scorer;
    protected final InsightService insights;
    protected final Map<UUID, Deque<String>> shown;
    protected final MomentService moments;

    CopilotTools(CopilotContext ctx) {
        this.ctx = ctx;
        this.wardrobe = ctx.wardrobe;
        this.pieces = ctx.pieces;
        this.schemes = ctx.schemes;
        this.schemeItems = ctx.schemeItems;
        this.dailyLooks = ctx.dailyLooks;
        this.dnas = ctx.dnas;
        this.preferences = ctx.preferences;
        this.room = ctx.room;
        this.mirror = ctx.mirror;
        this.inventory = ctx.inventory;
        this.challenges = ctx.challenges;
        this.autopilot = ctx.autopilot;
        this.dailyLookService = ctx.dailyLookService;
        this.weather = ctx.weather;
        this.ai = ctx.ai;
        this.audit = ctx.audit;
        this.schemeService = ctx.schemeService;
        this.backgroundStudio = ctx.backgroundStudio;
        this.hype = ctx.hype;
        this.scorer = ctx.scorer;
        this.insights = ctx.insights;
        this.shown = ctx.shown;
        this.moments = ctx.moments;
    }

    /** Ferramenta buscar_pecas(filtros) — só o próprio acervo; indisponíveis marcadas. */
    List<WardrobeItem> searchPieces(UUID userId, String text) {
        return searchPieces(userId, text, false);
    }

    List<WardrobeItem> searchPieces(UUID userId, String text, boolean availableOnly) {
        String original = text == null ? "" : text.toLowerCase(Locale.ROOT);
        String t = normalized(text);
        Set<String> colors = new HashSet<>();
        COLOR_WORDS.forEach((k, v) -> {
            if (startsWithWord(t, k)) {
                colors.addAll(v);
            }
        });
        Set<String> subs = new HashSet<>();
        TYPE_WORDS.forEach((k, v) -> {
            if (startsWithWord(t, k)) {
                subs.addAll(v);
            }
        });
        Set<String> materials = new HashSet<>();
        MATERIAL_WORDS.forEach((k, v) -> {
            if (mentions(text, k)) materials.addAll(v);
        });
        if (original.contains("lã")) materials.add("WOOL");
        if (subs.contains("jeans") && subs.size() > 1) {
            colors.remove("denim");
        }
        return pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> !availableOnly || (w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE))
                .filter(w -> colors.isEmpty() || colors.contains(w.getColor()))
                .filter(w -> subs.isEmpty() || subs.contains(Taxonomy.activeSubcategory(w.getSubcategory())) || subs.contains(w.getSubcategory()))
                .filter(w -> materials.isEmpty() || materials.contains(w.getMaterial()))
                .filter(w -> !(colors.isEmpty() && subs.isEmpty() && materials.isEmpty()) || nameMatch(w, t))
                .limit(8).toList();
    }

    static boolean nameMatch(WardrobeItem w, String t) {
        if (w.getName() == null) {
            return false;
        }
        for (String tok : normalized(w.getName()).split("\\s+")) {
            if (tok.length() > 3 && t.contains(tok)) {
                return true;
            }
        }
        return false;
    }

    Map<String, Object> chip(WardrobeItem w, Map<UUID, RoomService.Location> where) {
        RoomService.Location loc = where.get(w.getId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pieceId", w.getId());
        m.put("name", w.getName());
        m.put("imageUrl", w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
        m.put("available", w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE);
        m.put("address", loc == null ? null : loc.address().toString());
        m.put("addressLabel", loc == null ? null : loc.label());
        m.put("actions", List.of("VER_PECA", "MONTAR_NO_ESPELHO", "CRIAR_LOOK"));
        return m;
    }

    List<Map<String, Object>> activeMoments(UUID userId) {
        try {
            return moments == null ? List.of() : moments.activeSummary(userId);
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    /**
     * Pontua cada look sugerido nas seis dimensões independentes de {@link RecommendationScoring} (a mesma régua do
     * Autopiloto, em {@link LookScorer}) e, com um modo escolhido, reordena pelo peso do modo. Sem modo, mantém a ordem
     * do motor e só mostra os números.
     */
    List<Map<String, Object>> scoreLooks(CurrentUser user, List<Map<String, Object>> cards, RecommendationScoring.Mode mode) {
        return scorer.scoreCards(user, cards, mode);
    }

    /** Fundo pedido na mensagem dos looks (exige a palavra "fundo", "aura", "material"…). */
    BackgroundPrompt backgroundPrompt(String message, List<String> styles, List<String> occasions) {
        return new CopilotBackgroundPrompt(backgroundStudio).backgroundPrompt(message, styles, occasions, true);
    }
}
