package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * RF10 — Copilot contextual (01-especificacao-meu-quarto.md §3). Um motor, três portas (Copilot, Vista-me,
 * Autopiloto). Contexto por ferramentas executadas no servidor com a sessão do usuário (buscar_pecas,
 * localizar_peca, historico_uso, listar_looks, ler_dna_estilo, ler_inventory_score, montar_no_espelho,
 * abrir_criar_look), resumo compacto no prompt, toda peça citada validada no servidor e convertida em chip
 * (CA10/CA15), Camada 2 do DNA só com consentimento (CA16) e salvaguarda contra publicidade disfarçada (CA14).
 * <p>
 * Facade: o serviço é o único bean e mantém construtor, records, transações e o roteamento do {@code ask}; cada caso
 * de uso fica num colaborador do pacote (painel, intenções, respostas sobre o acervo, Hype, looks, Momentos,
 * diagnóstico, conversa livre, prompt de look e de fundo), criado a cada chamada sobre o {@link CopilotContext}.
 */
@Service
public class CopilotService {
    private SealService sealPolicyService;

    @org.springframework.beans.factory.annotation.Autowired
    public void setSealPolicyService(SealService service) { this.sealPolicyService = service; }
    public static final int MIN_PIECES = 3;
    // vocabulário de peça da ferramenta buscar_pecas (definido em CopilotPieceVocabulary)
    static final Map<String, Set<String>> COLOR_WORDS = CopilotPieceVocabulary.COLOR_WORDS;
    static final Map<String, Set<String>> TYPE_WORDS = CopilotPieceVocabulary.TYPE_WORDS;
    static final Map<String, Set<String>> MATERIAL_WORDS = CopilotPieceVocabulary.MATERIAL_WORDS;

    /**
     * {@code mode}: SAFE (prioriza o DNA de estilo), DISCOVERY (familiar + novidades) ou EXPERIMENTAL (mais distância do
     * histórico) — reordena os looks sugeridos pela pontuação multidimensional ({@link RecommendationScoring}).
     */
    public record AskRequest(String message, String view, List<UUID> selection, List<String> occasion, String mood, String city,
                             Double latitude, Double longitude, List<String> excludeKeys, String mode,
                             br.com.fashionai.domain.model.enums.SealTier tier, Map<String, Object> previousPolicy,
                             List<SealPolicyCopilot.Message> conversation) {
        public AskRequest(String message, String view, List<UUID> selection, List<String> occasion, String mood, String city,
                          Double latitude, Double longitude, List<String> excludeKeys, String mode) {
            this(message, view, selection, occasion, mood, city, latitude, longitude, excludeKeys, mode, null, null, null);
        }
    }

    /** Momentos §17 — o Copilot conhece os Momentos ativos (injeção opcional: o construtor dos testes não muda). */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setMoments(br.com.fashionai.application.moments.MomentService moments) {
        this.ctx.moments = moments;
    }

    /** Dependências lidas pelos colaboradores. */
    final CopilotContext ctx;
    /** Background Studio também direto no serviço: a orientação livre do Criar Look só precisa dele. */
    private final BackgroundStudioService backgroundStudio;

    public CopilotService(WardrobeService wardrobe, WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                          DailyLookRepository dailyLooks, StyleDnaRepository dnas, UserPreferencesRepository preferences, RoomService room,
                          MirrorService mirror, InventoryScoreService inventory, ChallengeService challenges, AutopilotService autopilot,
                          DailyLookService dailyLookService, WeatherService weather, AiEngine ai, Audit audit, SchemeService schemeService,
                          BackgroundStudioService backgroundStudio, HypeQueryService hype, InsightService insights) {
        this.backgroundStudio = backgroundStudio;
        this.ctx = new CopilotContext(wardrobe, pieces, schemes, schemeItems, dailyLooks, dnas, preferences, room, mirror, inventory,
                challenges, autopilot, dailyLookService, weather, ai, audit, schemeService, backgroundStudio, hype, insights);
    }

    // ================================================================== tipos do Copilot (usados pelos colaboradores)
    enum Intent { WHERE_IS, HYPE, FORGOTTEN, DIFFERENT, IMPROVE_INVENTORY, DIAGNOSIS, LOOKS, GENERAL }

    /** weather: faixa de clima pedida no texto (VERAO_LEVE, MEIA_ESTACAO, CAMADAS, INVERNO_PESADO) ou null */
    record LookPrompt(List<String> occasions, List<String> styles, String mood, String season, String weather) {}

    record BackgroundPrompt(Map<String, Object> configuration, Map<String, String> unresolved) {}

    /** Texto da resposta do Copilot e as refs de peça (p1..pn) que vieram fora do texto. */
    record Answer(String text, List<String> refs) {
    }

    // ================================================================== painel (CA01/CA08 e sugestões visuais)
    @Transactional(readOnly = true)
    public Map<String, Object> context(CurrentUser user, String view, List<UUID> selection, String city, Double lat, Double lon) {
        return new CopilotPanel(ctx).context(user, view, selection, city, lat, lon);
    }

    /** Painel antes de qualquer pergunta: looks prontos, combinações novas, esquecidas, clima e em alta (RF7 no modal). */
    @Transactional(readOnly = true)
    public Map<String, Object> suggestions(CurrentUser user, String city, Double lat, Double lon) {
        return new CopilotPanel(ctx).suggestions(user, city, lat, lon);
    }

    /** Orientação livre do Criar Look ("Gerar com IA"): fundo, ocasião, estilo, estação e humor citados no texto. */
    public Map<String, Object> orientation(String text, List<String> styles, List<String> occasions) {
        return new CopilotBackgroundPrompt(backgroundStudio).orientation(text, styles, occasions);
    }

    // ================================================================== resposta principal
    @Transactional
    public Map<String, Object> ask(CurrentUser user, AskRequest req) {
        if (SealPolicyCopilot.active(req.message(), req.conversation())) {
            if (sealPolicyService == null) throw new ApiException(503, "IA_INDISPONIVEL", Msg.t("sealCopilot.ia_indisponivel"));
            return sealPolicyService.draft(user, req.tier(), req.message(), req.previousPolicy(), req.conversation());
        }
        String message = InputSanitizer.clean(req.message() == null ? "" : req.message(), 600);
        if (message.isBlank()) {
            throw ApiException.badRequest("MENSAGEM_VAZIA", Msg.t("copilot.escreva_o_que_voce_precisa"));
        }
        Intent intent = intent(message);
        Map<String, Object> out = switch (intent) {
            case WHERE_IS -> new CopilotClosetAnswers(ctx).whereIs(user, message, req.view());
            case HYPE -> new CopilotHypeAnswer(ctx).hypeAnswer(user, message);
            case FORGOTTEN -> new CopilotClosetAnswers(ctx).forgotten(user);
            case IMPROVE_INVENTORY -> new CopilotClosetAnswers(ctx).improveInventory(user);
            case DIFFERENT -> new CopilotLooks(ctx).different(user, req);
            case DIAGNOSIS -> new CopilotDiagnosis(ctx).diagnosis(user);
            case LOOKS -> new CopilotLooks(ctx).looks(user, req, message);
            case GENERAL -> new CopilotConversation(ctx).general(user, message, req.view());
        };
        out.put("intent", intent.name());
        out.put("view", req.view());
        out.put("suggestedPrompts", promptsFor(req.view()));
        restrictionNotice(user).ifPresent(n -> out.put("challengeNotice", n));
        return out;
    }

    Optional<String> restrictionNotice(CurrentUser user) {
        return ctx.challenges.restriction(user.id()).map(r -> Msg.t("copilot.estou_respeitando_o_desafio_so", r.challengeName(), r.allowedPieceIds().size()));
    }

    /** CA06 — aceitar sugestão: esquema com origem Copilot + Look do Dia. */
    @Transactional
    public Map<String, Object> accept(CurrentUser user, List<UUID> pieceIds, String title, List<String> occasion, List<String> style,
                                      String mood, String season, String description, Map<String, Object> background) {
        Scheme s = ctx.autopilot.createScheme(user, pieceIds, title == null ? Msg.t("copilot.look_do_dia_copilot") : title,
                occasion, SchemeOrigin.COPILOT, style, mood, season, description, background);
        DailyLook dl = ctx.dailyLookService.register(user, s, DailyLookSource.COPILOT, LocalDate.now(FaiPointsService.ZONE));
        return Map.of("schemeId", s.getId(), "origin", "COPILOT", "dailyLook", ctx.dailyLookService.view(dl));
    }

    /** Sugestões de compra genéricas que somam combinações ao acervo (ver {@link CopilotDiagnosis#purchaseSuggestions}). */
    public static List<Map<String, Object>> purchaseSuggestions(List<WardrobeItem> a) {
        return CopilotDiagnosis.purchaseSuggestions(a);
    }

    // ================================================================== regras puras (nomes de antes, donos nos colaboradores)
    static List<String> promptsFor(String view) {
        return CopilotPanel.promptsFor(view);
    }

    static Intent intent(String m) {
        return CopilotIntents.intent(m);
    }

    static boolean hasPieceConstraints(String message) {
        return CopilotIntents.hasPieceConstraints(message);
    }

    static LookPrompt lookPrompt(String message, List<String> requestedOccasions, String requestedMood) {
        return CopilotLookPrompt.lookPrompt(message, requestedOccasions, requestedMood);
    }

    static String normalized(String value) {
        return CopilotText.normalized(value);
    }

    static boolean mentions(String text, String phrase) {
        return CopilotText.mentions(text, phrase);
    }

    static boolean startsWithWord(String text, String prefix) {
        return CopilotText.startsWithWord(text, prefix);
    }

    static Answer plainAnswer(String text) {
        return CopilotConversation.plainAnswer(text);
    }

    static String lookSummary(int count, List<String> occasions) {
        return CopilotLooks.lookSummary(count, occasions);
    }

    static Map<String, Object> draft(List<WardrobeItem> look, String origin, String prompt) {
        return CopilotLooks.draft(look, origin, prompt);
    }

    /** Ferramenta buscar_pecas(filtros) — só o próprio acervo; indisponíveis marcadas. */
    List<WardrobeItem> searchPieces(UUID userId, String text) {
        return new CopilotTools(ctx).searchPieces(userId, text);
    }

    BackgroundPrompt backgroundPrompt(String message, List<String> styles, List<String> occasions) {
        return new CopilotBackgroundPrompt(backgroundStudio).backgroundPrompt(message, styles, occasions, true);
    }
}
