package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dependências do Copilot, montadas uma vez no construtor do {@link CopilotService} e lidas pelos colaboradores
 * (criados a cada chamada); o histórico de looks mostrados e os Momentos (setter) são o único estado mutável.
 */
final class CopilotContext {
    final WardrobeService wardrobe;
    final WardrobeItemRepository pieces;
    final SchemeRepository schemes;
    final SchemeItemRepository schemeItems;
    final DailyLookRepository dailyLooks;
    final StyleDnaRepository dnas;
    final UserPreferencesRepository preferences;
    final RoomService room;
    final MirrorService mirror;
    final InventoryScoreService inventory;
    final ChallengeService challenges;
    final AutopilotService autopilot;
    final DailyLookService dailyLookService;
    final WeatherService weather;
    final AiEngine ai;
    final Audit audit;
    final SchemeService schemeService;
    final BackgroundStudioService backgroundStudio;
    /** HypeScore v2 — contexto de recomendação (nunca critério único) */
    final HypeQueryService hype;
    /** Seis dimensões por look — a mesma régua do Autopiloto. */
    final LookScorer scorer;
    /** Insights dinâmicos do contexto COPILOT (Hype ao lado do DNA e do uso, redescoberta antes de compra). */
    final InsightService insights;
    final Map<UUID, Deque<String>> shown = new ConcurrentHashMap<>();
    /** Momentos §17 — injeção opcional por setter no serviço (nulo quando o módulo não existe). */
    MomentService moments;

    CopilotContext(WardrobeService wardrobe, WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                   DailyLookRepository dailyLooks, StyleDnaRepository dnas, UserPreferencesRepository preferences, RoomService room,
                   MirrorService mirror, InventoryScoreService inventory, ChallengeService challenges, AutopilotService autopilot,
                   DailyLookService dailyLookService, WeatherService weather, AiEngine ai, Audit audit, SchemeService schemeService,
                   BackgroundStudioService backgroundStudio, HypeQueryService hype, InsightService insights) {
        this.hype = hype;
        this.insights = insights;
        this.scorer = new LookScorer(pieces, schemes, schemeItems, dnas, hype);
        this.schemeService = schemeService;
        this.backgroundStudio = backgroundStudio;
        this.wardrobe = wardrobe;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.dnas = dnas;
        this.preferences = preferences;
        this.room = room;
        this.mirror = mirror;
        this.inventory = inventory;
        this.challenges = challenges;
        this.autopilot = autopilot;
        this.dailyLookService = dailyLookService;
        this.weather = weather;
        this.ai = ai;
        this.audit = audit;
    }
}
