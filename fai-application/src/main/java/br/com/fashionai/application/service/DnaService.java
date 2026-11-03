package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.enums.DnaCell;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.DnaSchemeItemRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.StyleDnaVersionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF13 / HU20 — DNA de Estilo: sempre disponível (bloco 12 — não precisa ser destravado; ≥ 10 peças e ≥ 5 avaliações
 * positivas só tornam a síntese mais precisa), Camada 1 inferida
 * (arquétipo, paleta de 5 cores ΔE-agrupada, silhueta, índice de ousadia em percentil, peça ícone que nunca é acessório
 * básico), Camada 2 declarada e cifrada (lugares ≤ 3, pessoas ≤ 3, animais ≤ 2, objetos ≤ 4; 30 caracteres),
 * Frase de Identidade sintetizada pela IA, versões, recálculo a cada 10 interações, card PNG com marca d'água só com
 * campos visíveis (link expira em 30 dias) — e os Esquemas de DNA (anatomias A1–A4 e 12 narrativas do DNA v4), criados
 * com o mesmo construtor do RF5 (modo manual/IA → esquemas → dados → Background Studio → revisar e salvar).
 * <p>
 * Hype ≠ DNA: o HypeScore nunca entra na síntese do DNA (arquétipo, paleta, silhueta, ousadia, frase). Ele só aparece
 * como dado de cada célula e na narrativa HYPE_FOCUS (B10), sempre em v2 (P2-12): o dono vê o Hype pessoal dos próprios
 * looks; quem visita um DNA publicado vê só o Hype público elegível. "Sem dados" chega como status, nunca como 0.
 * <p>
 * Facade: dono das transações; cada caso de uso fica num colaborador package-private ({@link DnaSynthesis},
 * {@link DnaOverview}, {@link DnaLifeIdentity}, {@link DnaCard}, {@link DnaSchemeWriter}, {@link DnaSchemeViews},
 * {@link DnaBuilderSteps}, {@link DnaCompositions}) e as regras puras em {@link DnaLocalProposals},
 * {@link DnaNarratives}, {@link DnaLogos} e {@link DnaViews}.
 */
@Service
public class DnaService {
    public static final int MIN_PIECES = 10;
    public static final int MIN_POSITIVE = 5;
    public static final int RECALC_INTERACTIONS = 10;
    public static final List<String> LAYOUTS = List.of("AMPLIADO", "GRADE", "HORIZONTAL", "LATERAL");
    /** DET-K06 / ETI-03 — tamanho mínimo do grupo para mostrar um número de prova social. */
    public static final int SOCIAL_PROOF_MIN = 10;

    public record LifeForm(Map<String, List<String>> fields, List<String> privateFields, Boolean skip) {
    }

    public record DnaCellForm(UUID schemeId, String eraLabel, Boolean milestone) {
    }

    public record DnaSchemeForm(String title, List<DnaCellForm> cells, String cardLayout, String targetElement, NarrativeType narrativeType,
                                String occasion, String style, Season seasonalTheme, Visibility visibility, Map<String, Object> background,
                                Boolean publish, String creationMode) {
    }

    /** Célula do DNA (persistida ou transitória na pré-visualização): esquema referenciado + rótulo de época + marco. */
    record CellRef(DnaCell cell, Scheme scheme, String eraLabel, boolean milestone) {
    }

    public record DnaComposeRequest(String prompt, List<String> occasion, List<String> style, NarrativeType narrativeType, Season season) {
    }

    public record DnaProposal(String title, NarrativeType narrativeType, String cardLayout, List<DnaCellForm> cells, List<String> occasion,
                              List<String> style, Season seasonalTheme, String rationale) {
    }

    private final DnaOverview overviews;
    private final DnaLifeIdentity life;
    private final DnaCard card;
    private final DnaSchemeWriter writer;
    private final DnaSchemeViews schemeViews;
    private final DnaBuilderSteps builderSteps;
    private final DnaCompositions compositions;

    public DnaService(StyleDnaRepository dnas, StyleDnaVersionRepository versions, DnaSchemeRepository dnaSchemes, DnaSchemeItemRepository dnaItems,
                      WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems, DailyLookRepository dailyLooks,
                      UserRepository users, MediaService media,
                      NotificationService notifications, AiEngine ai, Guard guard, SchemeService schemeService,
                      HypeScoreCurrentRepository hypeV2, HypeScoreConfig hypeV2Config) {
        DnaIdentityPhrase identityPhrase = new DnaIdentityPhrase(ai);
        DnaSynthesis synthesis = new DnaSynthesis(dnas, versions, pieces, schemes, schemeItems, dailyLooks, users, ai, identityPhrase);
        this.schemeViews = new DnaSchemeViews(dnaSchemes, dnaItems, schemeItems, guard, hypeV2, hypeV2Config);
        this.overviews = new DnaOverview(dnas, versions, notifications, synthesis);
        this.life = new DnaLifeIdentity(users, dnas, synthesis, identityPhrase);
        this.card = new DnaCard(dnas, media);
        this.writer = new DnaSchemeWriter(users, dnaSchemes, dnaItems, schemes, guard, synthesis, schemeViews);
        this.builderSteps = new DnaBuilderSteps(schemes, users, guard, schemeService, synthesis, schemeViews, writer);
        this.compositions = new DnaCompositions(ai, schemes, synthesis, schemeViews);
    }

    // ================================================================== DNA de Estilo (CA01–CA09)
    @Transactional
    public Map<String, Object> overview(CurrentUser user) {
        return overviews.overview(user);
    }

    /** DET-K06 — prova social pelo DNA (só grupos com {@value #SOCIAL_PROOF_MIN} pessoas ou mais, sem identificar ninguém). */
    @Transactional(readOnly = true)
    public Map<String, Object> socialProof(CurrentUser user) {
        return overviews.socialProof(user);
    }

    @Transactional
    public Map<String, Object> generate(CurrentUser user, LifeForm form) {
        return life.generate(user, form);
    }

    /** CA05 — editar a Identidade de Vida regenera só a Frase; a Camada 1 permanece intacta. */
    @Transactional
    public Map<String, Object> updateLife(CurrentUser user, LifeForm form) {
        return life.updateLife(user, form);
    }

    /** CA06 / RN07 — visibilidade por campo da Camada 2 no card exportado. */
    @Transactional
    public Map<String, Object> setPrivateFields(CurrentUser user, List<String> privateFields) {
        return life.setPrivateFields(user, privateFields);
    }

    /** DET-M05 — estação da coloração pessoal (opcional). */
    @Transactional
    public Map<String, Object> setColorSeason(CurrentUser user, String season) {
        return life.setColorSeason(user, season);
    }

    /** CA09 / RN07 / RN08 — card PNG com marca d'água. */
    @Transactional
    public Map<String, Object> shareCard(CurrentUser user) {
        return card.shareCard(user);
    }

    // ================================================================== Esquemas de DNA (anatomias A1–A4, narrativas B1–B12)
    @Transactional
    public Map<String, Object> createDnaScheme(CurrentUser user, DnaSchemeForm f) {
        return writer.createDnaScheme(user, f);
    }

    @Transactional
    public Map<String, Object> updateDnaScheme(CurrentUser user, UUID id, DnaSchemeForm f) {
        return writer.updateDnaScheme(user, id, f);
    }

    @Transactional
    public Map<String, Object> getDnaScheme(CurrentUser viewer, UUID id) {
        return schemeViews.getDnaScheme(viewer, id);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> myDnaSchemes(CurrentUser user) {
        return schemeViews.myDnaSchemes(user);
    }

    @Transactional
    public void deleteDnaScheme(CurrentUser user, UUID id) {
        writer.deleteDnaScheme(user, id);
    }

    Map<String, Object> dnaSchemeView(CurrentUser viewer, DnaScheme d, List<CellRef> items) {
        return schemeViews.dnaSchemeView(viewer, d, items);
    }

    // ================================================================== construtor igual ao RF5 (bloco 12)
    /** Etapas 1–2: os "itens" de um Esquema de DNA são os esquemas de vestimenta do próprio usuário (RF5), de 2 a 6. */
    @Transactional
    public Map<String, Object> builder(CurrentUser user) {
        return builderSteps.builder(user);
    }

    /** Etapa 5 / pré-visualização ao vivo: monta o card do DNA sem salvar (células transitórias). */
    @Transactional
    public Map<String, Object> preview(CurrentUser user, DnaSchemeForm f) {
        return builderSteps.preview(user, f);
    }

    /** Etapa 1 (modo IA): propõe até 3 DNAs a partir dos esquemas do usuário; sem IA remota, o motor local monta as propostas. */
    @Transactional
    public Map<String, Object> compositions(CurrentUser user, DnaComposeRequest req) {
        return compositions.compositions(user, req);
    }

    List<DnaProposal> parseProposals(String text, Map<String, Scheme> byRef) {
        return compositions.parseProposals(text, byRef);
    }

    static <E extends Enum<E>> E enumOr(Class<E> type, Object raw, E fallback) {
        return DnaCompositions.enumOr(type, raw, fallback);
    }

    static List<DnaProposal> localProposals(List<Scheme> own, Map<UUID, List<SchemeItem>> itemsBy, DnaComposeRequest r, Map<UUID, Double> hypeV2) {
        return DnaLocalProposals.localProposals(own, itemsBy, r, hypeV2);
    }

    static List<Scheme> pickFor(NarrativeType nt, List<Scheme> pool, Map<UUID, List<SchemeItem>> itemsBy, Season season, Map<UUID, Double> hypeV2) {
        return DnaLocalProposals.pickFor(nt, pool, itemsBy, season, hypeV2);
    }

    static List<Scheme> spread(List<Scheme> list, int n) {
        return DnaLocalProposals.spread(list, n);
    }

    static String harmony(List<String> colors) {
        return DnaNarratives.harmony(colors);
    }
}
