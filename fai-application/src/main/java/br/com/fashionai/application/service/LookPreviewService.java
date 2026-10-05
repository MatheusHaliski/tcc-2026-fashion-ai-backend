package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * RF53 — prévia do look no editor (P1-08) e números das composições da IA (P2-14): os seis números de
 * {@link RecommendationScoring} (compatibilidade com o DNA · Hype · novidade · reutilização · uso · sustentabilidade) de
 * um RASCUNHO, a partir das peças escolhidas e da ocasião/estilo declarados. Usa o {@link LookScorer} — a mesma régua do
 * Copilot e do Autopiloto — sem alterá-lo.
 * <p>
 * Nada é gravado e nenhum sinal de Hype é emitido (o serviço nem publica eventos): a prévia não é interação. O Hype do
 * look nasce dos sinais do próprio look depois de salvo; aqui o número de Hype é a média do v2 das peças (Hype pessoal do
 * dono — só peças do próprio guarda-roupa entram, então o Hype privado de outra pessoa nunca vaza por esta rota) e
 * nunca passa de uma das seis dimensões.
 * <p>
 * Serviço separado do {@code SchemeService} porque o {@code LookScorer} precisa do {@code HypeQueryService}, que já
 * injeta o {@code SchemeService} (a injeção inversa fecharia um ciclo).
 */
@Service
public class LookPreviewService {
    /** Peças por prévia: um de cada tipo mais acessórios cabe com folga; acima disso não é um look. */
    static final int MAX_PIECES = 12;

    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final StyleDnaRepository dnas;
    private final LookScorer scorer;

    public LookPreviewService(WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                              StyleDnaRepository dnas, HypeQueryService hype) {
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dnas = dnas;
        this.scorer = new LookScorer(pieces, schemes, schemeItems, dnas, hype);
    }

    /**
     * Rascunho do editor. {@code schemeId} (opcional) = look que está sendo editado: os pares de peças dele não contam
     * como "já combinados" na novidade (senão editar um look daria novidade 0 sempre).
     */
    public record PreviewRequest(List<UUID> pieceIds, List<String> occasion, List<String> style, UUID schemeId) {
    }

    /** {@code POST /api/schemes/scores} — seis números do rascunho e a base do Hype (quantas peças têm score). */
    @Transactional(readOnly = true)
    public Map<String, Object> scores(CurrentUser user, PreviewRequest req) {
        if (user == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        List<UUID> ids = req == null || req.pieceIds() == null ? List.of()
                : req.pieceIds().stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.adicione_ao_menos_1_peca"));
        }
        if (ids.size() > MAX_PIECES) {
            throw ApiException.badRequest("PECAS_DEMAIS", Msg.t("schemeHype.previewMaxPieces", MAX_PIECES));
        }
        Map<UUID, WardrobeItem> byId = load(ids);
        List<WardrobeItem> look = ids.stream().map(byId::get).filter(Objects::nonNull).toList();
        if (look.size() < ids.size()) {
            throw ApiException.notFound(Msg.t("common.peca"));
        }
        if (look.stream().anyMatch(w -> w.getUser() == null || !user.id().equals(w.getUser().getId()))) {
            // RF5.CA07b — só peças do acervo real de quem monta (e o Hype pessoal de outra pessoa nunca entra)
            throw ApiException.badRequest("PECA_DE_OUTRO_USUARIO", Msg.t("scheme.use_apenas_pecas_do_seu"));
        }
        LookScorer.Context ctx = context(user.id(), req.schemeId());
        Map<UUID, HypeScoreCurrent> hype = scorer.hypeOf(ids);
        RecommendationScoring.Scores s = declared(ctx, LookScorer.scores(ctx, ids, look, hype), look, req.occasion(), req.style());
        long withHype = ids.stream().map(hype::get).filter(c -> c != null && c.getScore() != null).count();
        Map<String, Object> basis = new LinkedHashMap<>();
        basis.put("basis", "PIECES_AVERAGE");   // média do v2 das peças — o Hype do look só existe depois de salvo
        basis.put("withData", withHype);
        basis.put("total", ids.size());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scores", s.toMap());
        out.put("hype", basis);
        out.put("persisted", false);
        return out;
    }

    /**
     * Seis números de cada composição sugerida pela IA (mesma ordem da lista). Só entram peças do próprio dono; uma
     * composição cujas peças não carregam fica com todas as dimensões nulas ("—" na tela, nunca 0).
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> compositions(CurrentUser user, List<LocalSchemeComposer.Composition> list) {
        if (user == null || list == null || list.isEmpty()) {
            return List.of();
        }
        List<UUID> all = list.stream().flatMap(c -> c.items() == null ? java.util.stream.Stream.<LocalSchemeComposer.Pick>empty() : c.items().stream())
                .map(LocalSchemeComposer.Pick::wardrobeItemId).filter(Objects::nonNull).distinct().toList();
        Map<UUID, WardrobeItem> byId = load(all).entrySet().stream()
                .filter(e -> e.getValue().getUser() != null && user.id().equals(e.getValue().getUser().getId()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
        LookScorer.Context ctx = scorer.context(user.id());
        Map<UUID, HypeScoreCurrent> hype = scorer.hypeOf(byId.keySet());
        List<Map<String, Object>> out = new ArrayList<>();
        for (LocalSchemeComposer.Composition c : list) {
            List<UUID> ids = c.items() == null ? List.of() : c.items().stream().map(LocalSchemeComposer.Pick::wardrobeItemId)
                    .filter(byId::containsKey).distinct().toList();
            List<WardrobeItem> look = ids.stream().map(byId::get).toList();
            RecommendationScoring.Scores s = look.isEmpty() ? new RecommendationScoring.Scores(null, null, null, null, null, null)
                    : declared(ctx, LookScorer.scores(ctx, ids, look, hype), look, c.occasions(), c.styles());
            out.add(s.toMap());
        }
        return out;
    }

    private Map<UUID, WardrobeItem> load(List<UUID> ids) {
        return ids.isEmpty() ? Map.of() : pieces.findByIdIn(new LinkedHashSet<>(ids)).stream()
                .collect(Collectors.toMap(WardrobeItem::getId, Function.identity(), (a, b) -> a));
    }

    /**
     * Compatibilidade com a MESMA régua do look salvo ({@code HypeQueryService.profileOf(Scheme, items)}): estilos
     * declarados + estilos e cores das peças; ocasião declarada (sem ela, a das peças). Sem nada declarado, vale o
     * cálculo do LookScorer (só as peças). As outras cinco dimensões não mudam.
     */
    static RecommendationScoring.Scores declared(LookScorer.Context ctx, RecommendationScoring.Scores base, List<WardrobeItem> look,
                                                 List<String> occasion, List<String> style) {
        boolean hasOccasion = occasion != null && occasion.stream().anyMatch(o -> o != null && !o.isBlank());
        boolean hasStyle = style != null && style.stream().anyMatch(o -> o != null && !o.isBlank());
        if (ctx.dna() == null || look.isEmpty() || (!hasOccasion && !hasStyle)) {
            return base;
        }
        Set<String> styles = new LinkedHashSet<>(), colors = new LinkedHashSet<>(), occasions = new LinkedHashSet<>();
        if (hasStyle) {
            style.stream().filter(x -> x != null && !x.isBlank()).forEach(styles::add);
        }
        if (hasOccasion) {
            occasion.stream().filter(x -> x != null && !x.isBlank()).forEach(occasions::add);
        }
        for (WardrobeItem w : look) {
            styles.addAll(Json.csv(w.getStyleTags()));
            colors.addAll(HypeQueryService.colorsOf(w));
            if (!hasOccasion) {
                occasions.addAll(Json.csv(w.getOccasionTags()));
            }
        }
        Map<String, Object> c = StyleCompatibility.score(ctx.dna(), StyleCompatibility.profile(styles, colors, occasions));
        Integer compat = c == null ? null : ((Number) c.get("score")).intValue();
        return new RecommendationScoring.Scores(compat, base.hype(), base.novelty(), base.reuse(), base.usage(), base.sustainability());
    }

    /** Contexto da rodada; editando um look, os pares dele saem dos "já combinados" (os de outros looks continuam). */
    LookScorer.Context context(UUID userId, UUID editingSchemeId) {
        if (editingSchemeId == null) {
            return scorer.context(userId);
        }
        StyleCompatibility.Profile dna = dnas.findByUserId(userId).map(HypeQueryService::profileOf).orElse(null);
        Set<String> seen = new HashSet<>();
        List<UUID> others = schemes.findByUserIdOrderByCreatedAtDesc(userId).stream().map(Scheme::getId)
                .filter(id -> !editingSchemeId.equals(id)).toList();
        if (!others.isEmpty()) {
            schemeItems.findBySchemeIdIn(others).stream()
                    .collect(Collectors.groupingBy(si -> si.getScheme().getId(), Collectors.mapping(si -> si.getWardrobeItem().getId(), Collectors.toList())))
                    .values().forEach(ids -> {
                        for (int a = 0; a < ids.size(); a++) {
                            for (int b = a + 1; b < ids.size(); b++) {
                                seen.add(RecommendationScoring.pair(ids.get(a), ids.get(b)));
                            }
                        }
                    });
        }
        return new LookScorer.Context(userId, dna, seen, LocalDate.now(FaiPointsService.ZONE));
    }
}
