package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.seal.SealDesigns;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondOrigin;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Prova de que os criadores de selo (manual e com IA) aceitam textos/prompts variados e de que os selos criados são
 * detectados em peças e looks compatíveis, tanto no modo automático (sugestões/prévia) quanto no seletor manual.
 */
class SealCreatorsCoverageTest {
    private final Map<UUID, User> users = new HashMap<>();
    private final List<Seal> allSeals = new ArrayList<>();
    private final List<SealBond> allBonds = new ArrayList<>();
    private final Map<UUID, Scheme> allSchemes = new HashMap<>();
    private final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    private final Map<UUID, WardrobeItem> allPieces = new HashMap<>();
    private final Map<UUID, BrandProfile> brandByOwner = new HashMap<>();
    private final AiEngine ai = mock(AiEngine.class);
    private final SealRepository sealRepo = mock(SealRepository.class);
    private SealService seals;
    private User brand;
    private User ana;
    private CurrentUser anaSession;
    private CurrentUser brandSession;

    @BeforeEach
    void setUp() {
        brand = user("nike", ProfileType.MARCA);
        brand.setDisplayName("Ana Nike");
        ana = user("ana", ProfileType.PESSOAL);
        anaSession = session(ana);
        brandSession = session(brand);
        BrandProfile bp = new BrandProfile();
        bp.assignId(UUID.randomUUID());
        bp.setOwner(brand);
        bp.setBrandName("Nike");
        bp.setSlug("nike");
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        brandByOwner.put(brand.getId(), bp);

        FollowRepository follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        Guard guard = new Guard(e -> { }, follows);

        when(sealRepo.findByStatus(any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getStatus() == inv.getArgument(0)).toList());
        when(sealRepo.findByOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allSeals.stream()
                .filter(s -> s.getOwner().getId().equals(inv.getArgument(0)) && s.getStatus() == inv.getArgument(1)).toList());
        when(sealRepo.findById(any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getId().equals(inv.getArgument(0))).findFirst());

        SealBondRepository bondRepo = mock(SealBondRepository.class);
        when(bondRepo.save(any())).thenAnswer(inv -> {
            SealBond b = inv.getArgument(0);
            if (b.getId() == null) b.assignId(UUID.randomUUID());
            if (!allBonds.contains(b)) allBonds.add(b);
            return b;
        });
        org.mockito.Mockito.doAnswer(inv -> allBonds.remove((SealBond) inv.getArgument(0))).when(bondRepo).delete(any());
        when(bondRepo.findBySchemeId(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getScheme().getId().equals(inv.getArgument(0))).toList());
        when(bondRepo.findBySchemeIdAndTargetOwnerIdAndStatusIn(any(), any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getScheme().getId().equals(inv.getArgument(0)) && b.getTargetOwner().getId().equals(inv.getArgument(1))
                        && ((Collection<?>) inv.getArgument(2)).contains(b.getStatus())).toList());

        SchemeRepository schemeRepo = mock(SchemeRepository.class);
        when(schemeRepo.findById(any())).thenAnswer(inv -> Optional.ofNullable(allSchemes.get(inv.getArgument(0))));
        SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
        when(schemeItems.findBySchemeIdOrderBySortOrder(any())).thenAnswer(inv -> itemsByScheme.getOrDefault(inv.getArgument(0), List.of()));
        BrandProfileRepository brandRepo = mock(BrandProfileRepository.class);
        when(brandRepo.findByOwnerId(any())).thenAnswer(inv -> Optional.ofNullable(brandByOwner.get(inv.getArgument(0))));
        CelebrityProfileRepository celebRepo = mock(CelebrityProfileRepository.class);
        when(celebRepo.findByOwnerId(any())).thenReturn(Optional.empty());
        UserRepository userRepo = mock(UserRepository.class);
        when(userRepo.findById(any())).thenAnswer(inv -> Optional.ofNullable(users.get(inv.getArgument(0))));
        WardrobeItemRepository wardrobe = mock(WardrobeItemRepository.class);
        when(wardrobe.findByUserIdOrderByCreatedAtDesc(any())).thenReturn(List.of());
        when(wardrobe.findByIdIn(any())).thenAnswer(inv -> ((Collection<?>) inv.getArgument(0)).stream().map(allPieces::get).toList());
        when(ai.local(any(), any(), any(), any())).thenAnswer(inv -> new AiOutcome<>(((Supplier<?>) inv.getArgument(3)).get(), UUID.randomUUID(),
                null, false, "local", "local", 0, BigDecimal.ZERO, null, null, null));

        seals = new SealService(sealRepo, bondRepo, mock(PromotionRepository.class), mock(PromotionRedemptionRepository.class), schemeRepo,
                schemeItems, brandRepo, celebRepo, userRepo, wardrobe, mock(NotificationService.class), ai, guard,
                mock(Audit.class), mock(ApplicationEventPublisher.class), null);
    }

    // ------------------------------------------------------------------ fixtures

    private User user(String username, ProfileType type) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(username);
        u.setProfileType(type);
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileVisibility(Visibility.PUBLIC);
        users.put(u.getId(), u);
        return u;
    }

    private static CurrentUser session(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", u.getProfileType(), true, AccountStatus.ACTIVE, null, null);
    }

    private WardrobeItem piece(String brandName, String color) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(ana);
        w.setName(color + " " + brandName);
        w.setCategory("upper_piece");
        w.setSubcategory("t_shirt");
        w.setBrandName(brandName);
        w.setColor(color);
        allPieces.put(w.getId(), w);
        return w;
    }

    private Scheme look(WardrobeItem... items) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(ana);
        s.setTitle("Look");
        List<SchemeItem> list = new ArrayList<>();
        for (int i = 0; i < items.length; i++) {
            SchemeItem si = new SchemeItem();
            si.setScheme(s);
            si.setWardrobeItem(items[i]);
            si.setSortOrder(i);
            list.add(si);
        }
        allSchemes.put(s.getId(), s);
        itemsByScheme.put(s.getId(), list);
        return s;
    }

    private static Map<String, Object> referenceModel(SealTier tier, String title, int count, String brandName, String color) {
        Map<String, Object> part = new LinkedHashMap<>();
        part.put("count", count);
        part.put("category", "upper_piece");
        part.put("subcategory", "t_shirt");
        part.put("brand", brandName);
        part.put("color", color);
        return new LinkedHashMap<>(Map.of("version", 1, "tier", tier.name(), "title", title, "description", title,
                "minPieces", 1, "pieces", List.of(part)));
    }

    private static Map<String, Object> referencePolicy(SealTier tier, String title, int count, String brandName, String color) {
        return Map.of("referenceModel", referenceModel(tier, title, count, brandName, color));
    }

    /** Selo ativo cujo JSON de política passa pela mesma normalização do criador. */
    private Seal activeSeal(String name, SealTier tier, Map<String, Object> policy) {
        Seal s = new Seal();
        s.assignId(UUID.randomUUID());
        s.setOwner(brand);
        s.setName(name);
        s.setTier(tier);
        s.setStatus(SealStatus.ACTIVE);
        s.setBackgroundConfigJson(Json.write(Map.of("policy", SealPolicies.normalize(policy))));
        allSeals.add(s);
        return s;
    }

    private static boolean matches(Map<String, Object> policy, SealTier tier, WardrobeItem... pieces) {
        return SealPolicies.evaluate(SealPolicies.parse(SealPolicies.normalize(policy)), tier, List.of(pieces), List.of(), List.of()).matched();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Map<String, Object> result, String key) {
        return (List<Map<String, Object>>) result.get(key);
    }

    private static boolean suggestsBrand(List<Map<String, Object>> suggestions, User issuer) {
        return suggestions.stream().anyMatch(m -> issuer.getId().equals(m.get("targetOwnerId")));
    }

    // ------------------------------------------------------------------ criador manual: textos variados

    @ParameterizedTest
    @CsvSource({
            "Azul,navy,Zara,ZARA",
            "Azul,denim,Zara,zara",
            "' Azul ',cobalt,' Zara ',Zara",
            "Vermelho,burgundy,Nike,NIKE",
            "Preto,black,Adidas,adidas",
            "blue,blue,Zara,Zara",
    })
    void criadorManualAceitaVariacoesDeTextoDeCorEMarca(String color, String pieceColor, String brandText, String pieceBrand) {
        Map<String, Object> raw = Map.of("rules", List.of(Map.of("quantifier", "AT_LEAST", "count", 1, "color", color, "brand", brandText)));
        assertThat(SealPolicies.normalize(raw)).isNotNull();
        assertThat(matches(raw, SealTier.PECA, piece(pieceBrand, pieceColor))).isTrue();
        assertThat(matches(raw, SealTier.PECA, piece("Marca Desconhecida", pieceColor))).isFalse();
        assertThat(matches(raw, SealTier.PECA, piece(pieceBrand, "white"))).isFalse();
    }

    @ParameterizedTest
    @CsvSource({
            "'Camiseta azul da Nike'",
            "'Seleção de verão — coleção 2026'",
            "'Édredon São João & Cia'",
            "'Look \"premium\" de inverno'",
            "'AB'",
    })
    void criadorManualAceitaTitulosEDescricoesVariadosNoModeloDeReferencia(String title) {
        Map<String, Object> normalized = SealPolicies.normalize(referencePolicy(SealTier.LOOK, title, 2, "Nike", "blue"));
        assertThat(normalized).isNotNull();
        Map<?, ?> model = (Map<?, ?>) normalized.get("referenceModel");
        assertThat(model.get("title")).asString().isNotBlank().contains(title.strip().substring(0, 2));
        assertThat(matches(referencePolicy(SealTier.LOOK, title, 2, "Nike", "blue"), SealTier.LOOK,
                piece("Nike", "blue"), piece("Nike", "blue"))).isTrue();
        assertThat(matches(referencePolicy(SealTier.LOOK, title, 2, "Nike", "blue"), SealTier.LOOK, piece("Nike", "blue"))).isFalse();
    }

    @Test
    void criadorManualRejeitaTextosForaDaTaxonomiaSemDescartarCriteriosEmSilencio() {
        assertThatThrownBy(() -> SealPolicies.normalize(Map.of("rules", List.of(Map.of("color", "fúcsia"))))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SealPolicies.normalize(Map.of("occasions", List.of("baile")))).isInstanceOf(ApiException.class);
        Map<String, Object> unknown = referenceModel(SealTier.LOOK, "Azul", 1, "Nike", "blue");
        unknown.put("pieces", List.of(Map.of("nonexistent", "x")));
        assertThatThrownBy(() -> SealPolicies.normalize(Map.of("referenceModel", unknown))).isInstanceOf(ApiException.class);
    }

    // ------------------------------------------------------------------ criador com IA: prompts variados

    @ParameterizedTest
    @ValueSource(strings = {
            "#createsealpolicy Duas camisetas azuis da Nike",
            "  #createsealpolicy   uma peça vermelha da Nike  ",
            "#CREATESEALPOLICY Look com três peças pretas",
            "#createsealpolicy two blue Nike t-shirts, please",
            "#createsealpolicy\nCamiseta azul\nda Nike\npara o verão",
            "#createsealpolicy Seleção de verão — coleção 2026 «Nike» & cia.",
    })
    @SuppressWarnings("unchecked")
    void copilotAceitaPromptsVariadosEReenviaOPedidoSemPublicarOSelo(String prompt) {
        assertThat(SealPolicyCopilot.tagged(prompt)).isTrue();
        UUID inference = UUID.randomUUID();
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            Map<String, Object> sent = Json.map(call.prompt());
            assertThat(sent.get("request")).isEqualTo(prompt.strip().replaceAll(" +", " "));
            Map<String, Object> parsed = call.parser().apply(Json.write(Map.of("status", "VALID", "name", "Azul Nike", "tier", "PECA",
                    "text", "Ana, rascunho pronto para revisão.", "policy", referencePolicy(SealTier.PECA, "Azul Nike", 1, "Nike", "blue"),
                    "design", SealDesigns.defaultDesign(false, SealTier.PECA))));
            return new AiOutcome<>(parsed, inference, AiCallResult.SUCCESS, false, "remote", "test", 0, BigDecimal.ZERO, null, null, null);
        });
        Map<String, Object> out = seals.draft(brandSession, SealTier.PECA, prompt, null, null);
        assertThat(out.get("status")).isEqualTo("VALID");
        assertThat(out.get("intent")).isEqualTo("SEAL_POLICY");
        assertThat(out.get("inferenceId")).isEqualTo(inference);
        assertThat((Map<String, Object>) out.get("policy")).containsEntry("aiInferenceId", inference.toString());
        verify(sealRepo, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Nike", "nike", "NIKE"})
    @SuppressWarnings("unchecked")
    void copilotAceitaMarcaEmQualquerCaixaEPoliticaGeradaDetectaPecasECompativeis(String brandText) {
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            Map<String, Object> parsed = call.parser().apply(Json.write(Map.of("status", "VALID", "name", "Look azul", "tier", "LOOK",
                    "policy", referencePolicy(SealTier.LOOK, "Look azul", 2, brandText, "blue"),
                    "design", SealDesigns.defaultDesign(false, SealTier.LOOK))));
            return new AiOutcome<>(parsed, UUID.randomUUID(), AiCallResult.SUCCESS, false, "remote", "test", 0, BigDecimal.ZERO, null, null, null);
        });
        Map<String, Object> out = seals.draft(brandSession, SealTier.LOOK, "#createsealpolicy Duas peças azuis da " + brandText, null, null);
        Map<String, Object> policy = (Map<String, Object>) out.get("policy");
        assertThat(matches(policy, SealTier.LOOK, piece("Nike", "blue"), piece("Nike", "blue"))).isTrue();
        assertThat(matches(policy, SealTier.LOOK, piece("Nike", "blue"), piece("Nike", "red"))).isFalse();
        assertThat(matches(policy, SealTier.LOOK, piece("Zara", "blue"), piece("Zara", "blue"))).isFalse();
    }

    @Test
    void copilotPerguntaQuandoOPedidoCitaMarcaDesconhecidaEAceitaRespostaEmBlocoDeCodigo() {
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            String fenced = "```json\n" + Json.write(Map.of("status", "VALID", "name", "Azul Gucci", "tier", "PECA",
                    "policy", referencePolicy(SealTier.PECA, "Azul Gucci", 1, "Gucci", "blue"),
                    "design", SealDesigns.defaultDesign(false, SealTier.PECA))) + "\n```";
            return new AiOutcome<>(call.parser().apply(fenced), UUID.randomUUID(), AiCallResult.SUCCESS, false, "remote", "test", 0, BigDecimal.ZERO, null, null, null);
        });
        Map<String, Object> out = seals.draft(brandSession, SealTier.PECA, "#createsealpolicy Peça azul da Gucci", null, null);
        assertThat(out.get("status")).isEqualTo("INCOMPLETE");
        assertThat(out).doesNotContainKey("policy");
        assertThat((List<?>) out.get("questions")).isNotEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Peça azul da Nike", "#createsealpolicyextra azul", "#createsealpolicy", "   #createsealpolicy   "})
    void copilotRejeitaPromptsSemATagOuSoComATagAntesDeChamarAIA(String prompt) {
        assertThatThrownBy(() -> seals.draft(brandSession, SealTier.PECA, prompt, null, null)).isInstanceOf(ApiException.class);
        verifyNoInteractions(ai);
    }

    @Test
    void copilotRespeitaONivelPedidoEDescartaModeloDeOutroNivel() {
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            Map<String, Object> parsed = call.parser().apply(Json.write(Map.of("status", "VALID", "name", "Azul Nike", "tier", "LOOK",
                    "policy", referencePolicy(SealTier.LOOK, "Azul Nike", 1, "Nike", "blue"),
                    "design", SealDesigns.defaultDesign(false, SealTier.LOOK))));
            return new AiOutcome<>(parsed, UUID.randomUUID(), AiCallResult.SUCCESS, true, "remote", "test", 0, BigDecimal.ZERO, null, null, null);
        });
        assertThatThrownBy(() -> seals.draft(brandSession, SealTier.PECA, "#createsealpolicy Peça azul da Nike", null, null))
                .isInstanceOf(ApiException.class);
    }

    // ------------------------------------------------------------------ detecção automática (selo automático)

    @ParameterizedTest
    @CsvSource({"blue,Nike,red,Nike", "red,Nike,blue,Nike", "black,Nike,black,Zara"})
    void modoAutomaticoDetectaPecaCompativelNaPreviaDoCadastro(String wantedColor, String wantedBrand, String otherColor, String otherBrand) {
        activeSeal("Selo de peça", SealTier.PECA, referencePolicy(SealTier.PECA, "Selo de peça", 1, wantedBrand, wantedColor));
        SealService.PieceFields compatible = new SealService.PieceFields("Camiseta", "upper_piece", "t_shirt", wantedColor, wantedBrand, List.of(), List.of());
        SealService.PieceFields incompatible = new SealService.PieceFields("Camiseta", "upper_piece", "t_shirt", otherColor, otherBrand, List.of(), List.of());
        assertThat(suggestsBrand(list(seals.previewPiece(anaSession, compatible), "suggestions"), brand)).isTrue();
        assertThat(suggestsBrand(list(seals.previewPiece(anaSession, incompatible), "suggestions"), brand)).isFalse();
    }

    @Test
    void modoAutomaticoDetectaLookCompativelNaPreviaESoLigaAsPecasQueSustentamAPolitica() {
        activeSeal("Duas azuis", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Duas azuis", 2, "Nike", "blue"));
        WardrobeItem a = piece("Nike", "blue"), b = piece("Nike", "blue"), c = piece("Nike", "red"), d = piece("Zara", "blue");
        assertThat(suggestsBrand(list(seals.preview(anaSession, List.of(a.getId(), b.getId(), c.getId()), List.of(), List.of()), "suggestions"), brand)).isTrue();
        assertThat(suggestsBrand(list(seals.preview(anaSession, List.of(a.getId(), c.getId()), List.of(), List.of()), "suggestions"), brand)).isFalse();
        assertThat(suggestsBrand(list(seals.preview(anaSession, List.of(a.getId(), d.getId()), List.of(), List.of()), "suggestions"), brand)).isFalse();
    }

    @Test
    void modoAutomaticoSugereParaPecasELooksSalvosEOsSelosDePecaVinculamSoAsPecasCompativeis() {
        activeSeal("Peça azul", SealTier.PECA, referencePolicy(SealTier.PECA, "Peça azul", 1, "Nike", "blue"));
        activeSeal("Look Nike", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Look Nike", 2, "Nike", "blue"));
        WardrobeItem blue = piece("Nike", "blue"), red = piece("Nike", "red");
        Scheme two = look(blue, red);
        Map<String, Object> out = seals.suggest(anaSession, two.getId());
        List<Map<String, Object>> suggestions = list(out, "suggestions");
        assertThat(suggestions).hasSize(1);                                   // um selo por emissor: só o de peça atende
        SealBond bond = allBonds.stream().filter(x -> x.getStatus() == SealBondStatus.SUGGESTED).findFirst().orElseThrow();
        assertThat(bond.getTier()).isEqualTo(SealTier.PECA);
        assertThat(bond.getOrigin()).isEqualTo(SealBondOrigin.AI_SUGGESTION);
        assertThat(Json.strings(bond.getLinkedPieceIdsJson())).containsExactly(blue.getId().toString());
        Scheme none = look(red);
        assertThat(list(seals.suggest(anaSession, none.getId()), "suggestions")).isEmpty();
    }

    // ------------------------------------------------------------------ seletor manual

    @Test
    void seletorManualVinculaMarcaCompativelEmPecaELookComOrigemManual() {
        activeSeal("Peça azul", SealTier.PECA, referencePolicy(SealTier.PECA, "Peça azul", 1, "Nike", "blue"));
        activeSeal("Look azul", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Look azul", 2, "Nike", "blue"));
        Scheme single = look(piece("Nike", "blue"));
        Map<String, Object> bondOfPiece = seals.linkManually(anaSession, single.getId(), brand.getId(), null);
        assertThat(bondOfPiece.get("status")).isEqualTo(SealBondStatus.APPROVED);
        SealBond pieceBond = allBonds.get(0);
        assertThat(pieceBond.getOrigin()).isEqualTo(SealBondOrigin.MANUAL);
        assertThat(pieceBond.getTier()).isEqualTo(SealTier.PECA);

        Scheme multi = look(piece("Nike", "blue"), piece("Nike", "blue"));
        seals.linkManually(anaSession, multi.getId(), brand.getId(), null);
        SealBond lookBond = allBonds.get(1);
        assertThat(lookBond.getOrigin()).isEqualTo(SealBondOrigin.MANUAL);
        assertThat(lookBond.getTier()).isEqualTo(SealTier.LOOK);
        assertThat(lookBond.getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(lookBond.getSeal().getName()).isEqualTo("Look azul");
    }

    @Test
    void seletorManualNaoEmiteSeloParaPecaOuLookIncompativeis() {
        activeSeal("Peça azul", SealTier.PECA, referencePolicy(SealTier.PECA, "Peça azul", 1, "Nike", "blue"));
        activeSeal("Look azul", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Look azul", 2, "Nike", "blue"));
        Scheme redPiece = look(piece("Nike", "red"));
        Scheme mixedLook = look(piece("Nike", "blue"), piece("Nike", "red"));
        for (Scheme s : List.of(redPiece, mixedLook)) {
            assertThatThrownBy(() -> seals.linkManually(anaSession, s.getId(), brand.getId(), null))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isIn(400, 409));
        }
        assertThat(allBonds).noneMatch(x -> x.getStatus() == SealBondStatus.APPROVED);
    }

    @Test
    void automaticoEManualConcordamSobreACompatibilidadeDoMesmoLook() {
        activeSeal("Look azul", SealTier.LOOK, referencePolicy(SealTier.LOOK, "Look azul", 2, "Nike", "blue"));
        Scheme compatible = look(piece("Nike", "blue"), piece("Nike", "blue"));
        Scheme incompatible = look(piece("Nike", "blue"), piece("Zara", "blue"));
        assertThat(list(seals.suggest(anaSession, compatible.getId()), "suggestions")).hasSize(1);
        assertThat(list(seals.suggest(anaSession, incompatible.getId()), "suggestions")).isEmpty();
        assertThat(seals.linkManually(anaSession, compatible.getId(), brand.getId(), null)).containsKey("id");
        assertThatThrownBy(() -> seals.linkManually(anaSession, incompatible.getId(), brand.getId(), null)).isInstanceOf(ApiException.class);
    }
}
