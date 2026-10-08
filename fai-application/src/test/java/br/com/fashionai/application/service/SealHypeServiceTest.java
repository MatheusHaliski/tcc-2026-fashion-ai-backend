package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.HypeCache;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
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
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 — Selos × HypeScore no SealService: critério de Hype nas sugestões (peça e look), ordem por Hype, "Hype do
 * selo" na listagem, selos de marca/celebridade das peças e o princípio anti pay-to-win (vínculo/selo nunca vira sinal
 * do Hype).
 */
class SealHypeServiceTest {
    private final Map<UUID, User> users = new HashMap<>();
    private final List<Seal> allSeals = new ArrayList<>();
    private final List<SealBond> allBonds = new ArrayList<>();
    private final Map<UUID, Scheme> allSchemes = new HashMap<>();
    private final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    private final List<WardrobeItem> allPieces = new ArrayList<>();
    private final Map<UUID, BrandProfile> brandByOwner = new HashMap<>();
    private final Map<UUID, HypeScoreCurrent> pieceHype = new HashMap<>();
    private final Map<UUID, HypeScoreCurrent> lookHype = new HashMap<>();

    private SealRepository sealRepo;
    private SealBondRepository bondRepo;
    private SchemeRepository schemeRepo;
    private SchemeItemRepository schemeItems;
    private BrandProfileRepository brandRepo;
    private CelebrityProfileRepository celebRepo;
    private UserRepository userRepo;
    private WardrobeItemRepository pieceRepo;
    private AiEngine ai;
    private Guard guard;
    private ApplicationEventPublisher events;
    private SealService seals;

    private User ana;
    private User nike;
    private User adidas;
    private CurrentUser anaSession;
    private CurrentUser nikeSession;
    private final CurrentUser visitor = new CurrentUser(UUID.randomUUID(), "visitante", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private WardrobeItem p1;
    private WardrobeItem p2;

    @BeforeEach
    void setUp() {
        ana = user("ana", ProfileType.PESSOAL);
        nike = user("nike", ProfileType.MARCA);
        adidas = user("adidas", ProfileType.MARCA);
        anaSession = session(ana);
        nikeSession = session(nike);
        brand(nike, "Nike");
        brand(adidas, "Adidas");
        p1 = piece("Tênis", "Nike", "black");
        p2 = piece("Jaqueta", "Adidas", "blue");

        FollowRepository follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        guard = new Guard(e -> {
        }, follows);

        sealRepo = mock(SealRepository.class);
        when(sealRepo.findByStatus(any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getStatus() == inv.getArgument(0)).toList());
        when(sealRepo.findByOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allSeals.stream()
                .filter(s -> s.getOwner().getId().equals(inv.getArgument(0)) && s.getStatus() == inv.getArgument(1)).toList());
        when(sealRepo.findByOwnerIdOrderByCreatedAtDesc(any())).thenAnswer(inv -> allSeals.stream()
                .filter(s -> s.getOwner().getId().equals(inv.getArgument(0))).toList());
        when(sealRepo.findById(any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getId().equals(inv.getArgument(0))).findFirst());

        bondRepo = mock(SealBondRepository.class);
        when(bondRepo.save(any())).thenAnswer(inv -> {
            SealBond b = inv.getArgument(0);
            if (b.getId() == null) {
                b.assignId(UUID.randomUUID());
            }
            if (!allBonds.contains(b)) {
                allBonds.add(b);
            }
            return b;
        });
        when(bondRepo.findById(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getId().equals(inv.getArgument(0))).findFirst());
        when(bondRepo.findBySchemeId(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getScheme().getId().equals(inv.getArgument(0))).toList());
        when(bondRepo.findBySchemeIdAndTargetOwnerIdAndStatusIn(any(), any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getScheme().getId().equals(inv.getArgument(0)) && b.getTargetOwner().getId().equals(inv.getArgument(1))
                        && ((Collection<?>) inv.getArgument(2)).contains(b.getStatus())).toList());
        when(bondRepo.findBySealCode(any())).thenAnswer(inv -> allBonds.stream().filter(b -> inv.getArgument(0).equals(b.getSealCode())).findFirst());
        when(bondRepo.findBySealIdInAndStatus(anyCollection(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getSeal() != null && ((Collection<?>) inv.getArgument(0)).contains(b.getSeal().getId()) && b.getStatus() == inv.getArgument(1)).toList());
        when(bondRepo.findBySchemeIdInAndStatus(anyCollection(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> ((Collection<?>) inv.getArgument(0)).contains(b.getScheme().getId()) && b.getStatus() == inv.getArgument(1)).toList());

        schemeRepo = mock(SchemeRepository.class);
        when(schemeRepo.findById(any())).thenAnswer(inv -> Optional.ofNullable(allSchemes.get(inv.getArgument(0))));
        schemeItems = mock(SchemeItemRepository.class);
        when(schemeItems.findBySchemeIdOrderBySortOrder(any())).thenAnswer(inv -> itemsByScheme.getOrDefault(inv.getArgument(0), List.of()));
        when(schemeItems.findByWardrobeItemIdIn(anyCollection())).thenAnswer(inv -> itemsByScheme.values().stream().flatMap(List::stream)
                .filter(si -> ((Collection<?>) inv.getArgument(0)).contains(si.getWardrobeItem().getId())).toList());
        brandRepo = mock(BrandProfileRepository.class);
        when(brandRepo.findByOwnerId(any())).thenAnswer(inv -> Optional.ofNullable(brandByOwner.get(inv.getArgument(0))));
        // sem a heurística de marca pelo nome: aqui só as políticas padronizadas decidem
        when(brandRepo.findByApprovalStatusOrderByCreatedAtDesc(any())).thenReturn(List.of());
        celebRepo = mock(CelebrityProfileRepository.class);
        when(celebRepo.findByOwnerId(any())).thenReturn(Optional.empty());
        when(celebRepo.findByVerificationStatusOrderByCreatedAtDesc(any())).thenReturn(List.of());
        userRepo = mock(UserRepository.class);
        when(userRepo.findById(any())).thenAnswer(inv -> Optional.ofNullable(users.get(inv.getArgument(0))));
        pieceRepo = mock(WardrobeItemRepository.class);
        when(pieceRepo.findByIdIn(anyCollection())).thenAnswer(inv -> allPieces.stream()
                .filter(w -> ((Collection<?>) inv.getArgument(0)).contains(w.getId())).toList());
        ai = mock(AiEngine.class);
        when(ai.local(any(), any(), any(), any())).thenAnswer(inv -> new AiOutcome<>(((Supplier<?>) inv.getArgument(3)).get(), UUID.randomUUID(),
                null, false, "local", "local", 0, BigDecimal.ZERO, null, null, null));
        events = mock(ApplicationEventPublisher.class);

        seals = service();
        HypeQueryService hype = mock(HypeQueryService.class);
        when(hype.config()).thenReturn(HypeScoreConfig.defaults());
        when(hype.currentOf(eq(HypeEntityType.PIECE), anyCollection())).thenAnswer(inv -> pick(pieceHype, inv.getArgument(1)));
        when(hype.currentOf(eq(HypeEntityType.SCHEME), anyCollection())).thenAnswer(inv -> pick(lookHype, inv.getArgument(1)));
        @SuppressWarnings("unchecked")
        ObjectProvider<HypeQueryService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(hype);
        seals.setHypeQuery(provider);
        RenderCachePort cache = mock(RenderCachePort.class);
        when(cache.get(any())).thenReturn(Optional.empty());
        seals.setHypeCache(new HypeCache(cache));
    }

    /** O construtor de 16 argumentos (sem Hype injetado) continua valendo. */
    private SealService service() {
        return new SealService(sealRepo, bondRepo, mock(PromotionRepository.class), mock(PromotionRedemptionRepository.class), schemeRepo,
                schemeItems, brandRepo, celebRepo, userRepo, pieceRepo, mock(NotificationService.class), ai, guard,
                mock(Audit.class), events, mock(OwnMedia.class));
    }

    private static Map<UUID, HypeScoreCurrent> pick(Map<UUID, HypeScoreCurrent> rows, Collection<UUID> ids) {
        Map<UUID, HypeScoreCurrent> out = new HashMap<>();
        ids.forEach(id -> {
            if (rows.containsKey(id)) {
                out.put(id, rows.get(id));
            }
        });
        return out;
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

    private void brand(User owner, String name) {
        BrandProfile bp = new BrandProfile();
        bp.assignId(UUID.randomUUID());
        bp.setOwner(owner);
        bp.setBrandName(name);
        bp.setSlug(name.toLowerCase());
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        brandByOwner.put(owner.getId(), bp);
    }

    private static CurrentUser session(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", u.getProfileType(), true, AccountStatus.ACTIVE, null, null);
    }

    private WardrobeItem piece(String name, String brandName, String color) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(ana);
        w.setName(name);
        w.setBrandName(brandName);
        w.setColor(color);
        w.setCategory("upper_piece");
        w.setVisibility(Visibility.PUBLIC);
        w.setModerationStatus(ModerationStatus.APPROVED);
        allPieces.add(w);
        return w;
    }

    private Scheme look(Visibility visibility, WardrobeItem... items) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(ana);
        s.setTitle("Look");
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setVisibility(visibility);
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

    private Seal seal(User owner, String name, SealTier tier, Map<String, Object> policy) {
        Seal s = new Seal();
        s.assignId(UUID.randomUUID());
        s.setOwner(owner);
        s.setName(name);
        s.setTier(tier);
        s.setBackgroundConfigJson(Json.write(Map.of("policy", SealPolicies.normalize(policy))));
        allSeals.add(s);
        return s;
    }

    private SealBond approved(Seal seal, Scheme scheme, SealTier tier, WardrobeItem... linked) {
        SealBond b = new SealBond();
        b.assignId(UUID.randomUUID());
        b.setSeal(seal);
        b.setScheme(scheme);
        b.setTargetOwner(seal.getOwner());
        b.setRequestedBy(ana);
        b.setTier(tier);
        b.setStatus(SealBondStatus.APPROVED);
        b.setLinkedPieceIdsJson(Json.write(Arrays.stream(linked).map(w -> w.getId().toString()).toList()));
        allBonds.add(b);
        return b;
    }

    private static HypeScoreCurrent hype(UUID id, double score, HypeLevel level, HypeMomentum momentum, boolean publicEligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityId(id);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(level);
        c.setMomentum(momentum);
        c.setPublicEligible(publicEligible);
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setCalculatedAt(Instant.now());
        return c;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> suggestions(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("suggestions");
    }

    @Test
    @SuppressWarnings("unchecked")
    void copilotGeraModeloMesmoSemPecasEPublicacaoExigeSuaInferenciaOriginal() {
        var logs = mock(br.com.fashionai.domain.repository.AiInferenceLogRepository.class);
        seals.setSealPolicyContext(logs, mock(br.com.fashionai.domain.repository.BrandRepository.class), mock(BackgroundStudioService.class));
        UUID inferenceId = UUID.randomUUID();
        Map<String, Object> reference = Map.of("version", 1, "tier", "LOOK", "title", "Nike Azul", "description", "Uma peça azul Nike",
                "minPieces", 1, "pieces", List.of(Map.of("count", 1, "brand", "Nike", "color", "blue")));
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<Map<String, Object>> call = inv.getArgument(0);
            assertThat(call.prompt()).contains("#createsealpolicy", "Uma peça azul Nike");
            assertThat(call.local().get()).isNull();
            Map<String, Object> parsed = call.parser().apply(Json.write(Map.of("status", "VALID", "name", "Nike Azul", "tier", "LOOK",
                    "policy", Map.of("referenceModel", reference), "design", br.com.fashionai.application.seal.SealDesigns.defaultDesign(false, SealTier.LOOK))));
            assertThat(parsed).isNotNull();
            var log = new br.com.fashionai.domain.model.AiInferenceLog();
            log.setId(inferenceId); log.setUserId(nike.getId()); log.setCapability("COPILOT"); log.setProvider("remote");
            log.setResult(br.com.fashionai.domain.model.enums.AiCallResult.SUCCESS);
            log.setInputSummaryJson(Json.write(call.inputsUsed()));
            when(logs.findById(inferenceId)).thenReturn(Optional.of(log));
            return new AiOutcome<>(parsed, inferenceId, br.com.fashionai.domain.model.enums.AiCallResult.SUCCESS, false,
                    "remote", "test-model", 0, BigDecimal.ZERO, null, null, null);
        });
        Map<String, Object> draft = seals.draft(nikeSession, SealTier.LOOK, "#createsealpolicy Uma peça azul Nike", null);
        Map<String, Object> policy = (Map<String, Object>) draft.get("policy");
        assertThat(policy.get("aiInferenceId")).isEqualTo(inferenceId.toString());
        when(sealRepo.save(any())).thenAnswer(inv -> { Seal s = inv.getArgument(0); s.assignId(UUID.randomUUID()); allSeals.add(s); return s; });
        var form = new SealService.SealForm("Nike Azul", SealTier.LOOK, null, null, null, null, null, null, SealStatus.ACTIVE, null, policy);
        assertThat(seals.createSeal(nikeSession, form).get("policy")).isNotNull();
        Map<String, Object> changed = Json.map(Json.write(policy));
        ((Map<String, Object>) changed.get("referenceModel")).put("minPieces", 2);
        var forged = new SealService.SealForm("Forjado", SealTier.LOOK, null, null, null, null, null, null, SealStatus.ACTIVE, null, changed);
        assertThatThrownBy(() -> seals.createSeal(nikeSession, forged)).isInstanceOf(br.com.fashionai.application.common.ApiException.class);
        var manual = new SealService.SealForm("Manual", SealTier.LOOK, null, null, null, null, null, null, SealStatus.ACTIVE, null, null);
        assertThatThrownBy(() -> seals.createSeal(nikeSession, manual)).isInstanceOf(br.com.fashionai.application.common.ApiException.class);
    }

    @Test
    void criacaoNaoRecorreAoPalpiteLocalQuandoIAEstaIndisponivel() {
        when(ai.text(any())).thenReturn(new AiOutcome<>(null, UUID.randomUUID(),
                br.com.fashionai.domain.model.enums.AiCallResult.ERROR, true, "local", "local", 0,
                BigDecimal.ZERO, "IA indisponível", null, null));
        assertThatThrownBy(() -> seals.draft(nikeSession, SealTier.LOOK, "#createsealpolicy Peça azul", null))
                .isInstanceOf(br.com.fashionai.application.common.ApiException.class)
                .hasMessage("IA indisponível");
        assertThat(allSeals).isEmpty();
    }

    @Test
    void politicaDePerfilExibeSomenteItensComSelosConquistadosVigentes() {
        Seal earned = seal(nike, "Nike Peça", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme look = look(Visibility.PUBLIC, p1, p2);
        SealBond bond = approved(earned, look, SealTier.PECA, p1);
        when(bondRepo.findByRequestedByIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getRequestedBy().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        when(pieceRepo.findAllPublic(any())).thenReturn(List.of(p1, p2));
        when(schemeRepo.findAllPublic(any())).thenReturn(List.of(look));
        seal(adidas, "Perfil com Nike Peça", SealTier.PERFIL, Map.of("referenceModel", Map.of(
                "version", 1, "tier", "PERFIL", "target", "BOTH", "title", "Perfil", "description", "Exige Nike Peça",
                "minPieces", 1, "pieces", List.of(Map.of("count", 1)),
                "earnedSeals", Map.of("match", "ALL", "rules", List.of(Map.of("sealId", earned.getId().toString(), "scope", "PIECES", "minCount", 1))))));
        assertThat(seals.profilePieces(adidas.getId(), w -> true, 60)).containsExactly(p1);
        assertThat(seals.profileSchemes(adidas.getId(), s -> true, 60)).containsExactly(look);
        assertThat(seals.profilePieces(adidas.getId(), w -> false, 60)).isEmpty();
        bond.setExpiresAt(Instant.now().minusSeconds(1));
        assertThat(seals.profilePieces(adidas.getId(), w -> true, 60)).isEmpty();
        assertThat(seals.profileSchemes(adidas.getId(), s -> true, 60)).isEmpty();
        bond.setExpiresAt(null); bond.setStatus(SealBondStatus.REVOKED);
        assertThat(seals.profilePieces(adidas.getId(), w -> true, 60)).isEmpty();
    }

    // ------------------------------------------------------------------ sugestões

    @Test
    void sugestoesOrdenadasPorHypeComOHypeDaEntidadeEOTrechoNoPorque() {
        seal(nike, "Nike Club", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        seal(adidas, "Adidas Hot", SealTier.PECA, Map.of("hype", Map.of("minLevel", "HOT")));
        pieceHype.put(p1.getId(), hype(p1.getId(), 50, HypeLevel.RELEVANT, HypeMomentum.STABLE, true));
        pieceHype.put(p2.getId(), hype(p2.getId(), 85, HypeLevel.TRENDING, HypeMomentum.RISING, true));

        List<Map<String, Object>> list = suggestions(seals.preview(anaSession, List.of(p1.getId(), p2.getId()), List.of(), List.of()));

        assertThat(list).extracting(m -> m.get("name")).containsExactly("Adidas", "Nike");   // Hype desc (sem Hype seria Nike primeiro)
        assertThat(list.get(0).get("hype")).isEqualTo(Map.of("score", 85.0, "level", "TRENDING"));
        assertThat(list.get(1).get("hype")).isEqualTo(Map.of("score", 50.0, "level", "RELEVANT"));
        assertThat((String) list.get(0).get("justification")).contains("peça com Hype ≥ Em alta (atual: 85)");
        assertThat((String) list.get(1).get("justification")).doesNotContain("Hype");
    }

    @Test
    void semServicoDeHypeOCriterioNaoEhAtendidoEAOrdemFicaComoAntes() {
        seal(nike, "Nike Club", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        seal(adidas, "Adidas Hot", SealTier.PECA, Map.of("hype", Map.of("minLevel", "HOT")));
        pieceHype.put(p2.getId(), hype(p2.getId(), 85, HypeLevel.TRENDING, HypeMomentum.RISING, true));

        List<Map<String, Object>> list = suggestions(service().preview(anaSession, List.of(p1.getId(), p2.getId()), List.of(), List.of()));

        assertThat(list).extracting(m -> m.get("name")).containsExactly("Nike");
        assertThat(list.get(0).get("hype")).isNull();
    }

    @Test
    void criterioDeHypeDoLookSoValeComOLookSalvoEComHype() {
        Seal s = seal(nike, "Nike em alta", SealTier.LOOK, Map.of("hype", Map.of("minScore", 60, "momentum", List.of("RISING"))));
        Scheme look = look(Visibility.PUBLIC, p1, p2);

        // criador de look: o look ainda não existe, então não tem Hype
        assertThat(suggestions(seals.preview(anaSession, List.of(p1.getId(), p2.getId()), List.of(), List.of()))).isEmpty();
        // look salvo, ainda sem Hype calculado
        assertThat(suggestions(seals.suggest(anaSession, look.getId()))).isEmpty();
        // com Hype ≥ 60 e em crescimento: vínculo SUGERIDO com o Hype do look
        lookHype.put(look.getId(), hype(look.getId(), 72.4, HypeLevel.HOT, HypeMomentum.RISING, true));
        List<Map<String, Object>> list = suggestions(seals.suggest(anaSession, look.getId()));
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("hype")).isEqualTo(Map.of("score", 72.4, "level", "HOT"));
        assertThat((String) list.get(0).get("justification")).contains("look com Hype ≥ 60 e em crescimento (atual: 72)");
        assertThat(allBonds).singleElement().satisfies(b -> {
            assertThat(b.getStatus()).isEqualTo(SealBondStatus.SUGGESTED);
            assertThat(b.getSeal()).isSameAs(s);
        });
        // esfriou: deixa de atender
        lookHype.put(look.getId(), hype(look.getId(), 72.4, HypeLevel.HOT, HypeMomentum.COOLING, true));
        assertThat(suggestions(seals.suggest(anaSession, look.getId()))).isEmpty();
    }

    // ------------------------------------------------------------------ Hype do selo

    @Test
    void hypeDoSeloEhAMediaDosItensComVinculoAprovado() {
        Seal lookSeal = seal(nike, "Nike Look", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Seal pieceSeal = seal(nike, "Nike Peça", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Seal empty = seal(nike, "Nike Novo", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme a = look(Visibility.PUBLIC, p1);
        Scheme b = look(Visibility.PUBLIC, p1);
        Scheme priv = look(Visibility.PUBLIC, p1);
        Scheme old = look(Visibility.PUBLIC, p1);
        approved(lookSeal, a, SealTier.LOOK, p1);
        approved(lookSeal, b, SealTier.LOOK, p1);
        approved(lookSeal, priv, SealTier.LOOK, p1);
        approved(lookSeal, old, SealTier.LOOK, p1).setExpiresAt(Instant.now().minusSeconds(60));   // vencido: fora
        SealBond revoked = approved(lookSeal, old, SealTier.LOOK, p1);
        revoked.setStatus(SealBondStatus.REVOKED);                                                     // revogado: fora
        lookHype.put(a.getId(), hype(a.getId(), 80, HypeLevel.TRENDING, HypeMomentum.STABLE, true));
        lookHype.put(b.getId(), hype(b.getId(), 60, HypeLevel.HOT, HypeMomentum.STABLE, true));
        lookHype.put(priv.getId(), hype(priv.getId(), 99, HypeLevel.VIRAL, HypeMomentum.STABLE, false)); // Hype pessoal: fora da média
        lookHype.put(old.getId(), hype(old.getId(), 10, HypeLevel.LOW_SIGNAL, HypeMomentum.STABLE, true));
        approved(pieceSeal, a, SealTier.PECA, p1, p2);
        pieceHype.put(p1.getId(), hype(p1.getId(), 50, HypeLevel.RELEVANT, HypeMomentum.STABLE, true));
        pieceHype.put(p2.getId(), hype(p2.getId(), 85, HypeLevel.TRENDING, HypeMomentum.STABLE, true));

        Map<Object, Object> byName = new HashMap<>();
        seals.sealsOf(visitor, nike.getId()).forEach(v -> byName.put(v.get("name"), v.get("hype")));

        Map<String, Object> expectedLook = new HashMap<>();
        expectedLook.put("avgScore", 70.0);
        expectedLook.put("level", "HOT");
        expectedLook.put("bonded", 3);
        assertThat(byName.get("Nike Look")).isEqualTo(expectedLook);
        Map<String, Object> expectedPiece = new HashMap<>();
        expectedPiece.put("avgScore", 67.5);
        expectedPiece.put("level", "HOT");
        expectedPiece.put("bonded", 2);
        assertThat(byName.get("Nike Peça")).isEqualTo(expectedPiece);
        Map<String, Object> none = new HashMap<>();
        none.put("avgScore", null);
        none.put("level", null);
        none.put("bonded", 0);
        assertThat(byName.get("Nike Novo")).isEqualTo(none);
        assertThat(empty.getId()).isNotNull();
        // a aba MEUS_SELOS (sealsOf do dono) traz o mesmo Hype
        assertThat(seals.sealsOf(nike.getId())).allSatisfy(v -> assertThat(v).containsKey("hype"));
    }

    // ------------------------------------------------------------------ métricas do emissor (Lote A2 · P2-09)

    @Test
    @SuppressWarnings("unchecked")
    void metricasDoEmissorTrazemOHypeDosLooksVinculadosSoPublicos() {
        when(bondRepo.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getTargetOwner().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        Seal lookSeal = seal(nike, "Nike Look", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Seal pieceSeal = seal(nike, "Nike Peça", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme alto = look(Visibility.PUBLIC, p1);
        Scheme medio = look(Visibility.PUBLIC, p1);
        Scheme semDados = look(Visibility.PUBLIC, p1);
        Scheme privado = look(Visibility.FOLLOWERS, p1);
        Scheme vencido = look(Visibility.PUBLIC, p1);
        approved(lookSeal, alto, SealTier.LOOK, p1);
        approved(pieceSeal, alto, SealTier.PECA, p1);              // dois selos no mesmo look: conta uma vez
        approved(lookSeal, medio, SealTier.LOOK, p1);
        approved(lookSeal, semDados, SealTier.LOOK, p1);
        approved(lookSeal, privado, SealTier.LOOK, p1);
        approved(lookSeal, vencido, SealTier.LOOK, p1).setExpiresAt(Instant.now().minusSeconds(60));
        HypeScoreCurrent a = hype(alto.getId(), 80, HypeLevel.TRENDING, HypeMomentum.RISING, true);
        a.setDeltaPoints(BigDecimal.valueOf(6));
        HypeScoreCurrent b = hype(medio.getId(), 60, HypeLevel.HOT, HypeMomentum.STABLE, true);
        b.setDeltaPoints(BigDecimal.valueOf(2));
        HypeScoreCurrent insuficiente = hype(semDados.getId(), 0, HypeLevel.LOW_SIGNAL, HypeMomentum.STABLE, true);
        insuficiente.setStatus(HypeStatus.INSUFFICIENT_DATA);
        insuficiente.setScore(null);
        lookHype.put(alto.getId(), a);
        lookHype.put(medio.getId(), b);
        lookHype.put(semDados.getId(), insuficiente);
        lookHype.put(privado.getId(), hype(privado.getId(), 99, HypeLevel.VIRAL, HypeMomentum.STABLE, false));   // Hype pessoal: fora
        lookHype.put(vencido.getId(), hype(vencido.getId(), 97, HypeLevel.VIRAL, HypeMomentum.STABLE, true));    // vínculo vencido: fora

        Map<String, Object> metrics = seals.issuerMetrics(nikeSession);
        assertThat(metrics).containsKeys("suggested", "approved", "redemptions");   // campos antigos continuam
        Map<String, Object> h = (Map<String, Object>) metrics.get("hype");
        assertThat(h).containsEntry("bonded", 4).containsEntry("withHype", 2).containsEntry("avgScore", 70.0).containsEntry("level", "HOT")
                .containsEntry("deltaPoints", 4.0).containsEntry("direction", "UP").containsEntry("deltaWindowDays", 7);
        List<Map<String, Object>> top = (List<Map<String, Object>>) h.get("top");
        assertThat(top).extracting(t -> t.get("schemeId")).containsExactly(alto.getId().toString(), medio.getId().toString());
        assertThat(top.get(0)).containsEntry("score", 80.0).containsEntry("level", "TRENDING").containsEntry("title", "Look");
    }

    @Test
    @SuppressWarnings("unchecked")
    void metricasDoEmissorSemHypePublicoNaoViramZero() {
        when(bondRepo.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getTargetOwner().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        Seal lookSeal = seal(nike, "Nike Look", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Scheme s = look(Visibility.PUBLIC, p1);
        approved(lookSeal, s, SealTier.LOOK, p1);
        Map<String, Object> h = (Map<String, Object>) seals.issuerMetrics(nikeSession).get("hype");
        assertThat(h).containsEntry("bonded", 1).containsEntry("withHype", 0);
        assertThat(h.get("avgScore")).isNull();
        assertThat(h.get("level")).isNull();
        assertThat(h.get("deltaPoints")).isNull();
        assertThat(h.get("direction")).isNull();
        assertThat((List<?>) h.get("top")).isEmpty();
    }

    // ------------------------------------------------------------------ selos das peças (guarda-roupa)

    @Test
    void selosDasPecasSoAprovadosDeTierPecaVisiveis() {
        Seal pieceSeal = seal(nike, "Nike Peça", SealTier.PECA, Map.of("rules", List.of(Map.of("brand", "Nike"))));
        Seal lookSeal = seal(adidas, "Adidas Look", SealTier.LOOK, Map.of("rules", List.of(Map.of("brand", "Adidas"))));
        WardrobeItem hidden = piece("Diário", "Nike", "black");
        hidden.setVisibility(Visibility.PRIVATE);
        Scheme pub = look(Visibility.PUBLIC, p1, p2, hidden);
        Scheme privLook = look(Visibility.PRIVATE, p2);
        approved(pieceSeal, pub, SealTier.PECA, p1, hidden);
        approved(lookSeal, pub, SealTier.LOOK, p1, p2);           // tier LOOK: não vai para a peça
        approved(pieceSeal, privLook, SealTier.PECA, p2);         // look privado: só o dono vê

        Map<String, Object> out = seals.pieceSeals(visitor, List.of(p1.getId(), p2.getId(), hidden.getId()));
        @SuppressWarnings("unchecked")
        Map<String, List<Map<String, Object>>> items = (Map<String, List<Map<String, Object>>>) out.get("items");
        assertThat(items).containsOnlyKeys(p1.getId().toString(), p2.getId().toString());   // peça privada some
        assertThat(items.get(p1.getId().toString())).singleElement().satisfies(badge -> {
            assertThat(badge).containsEntry("tier", "PECA").containsEntry("owner", "nike").containsEntry("name", "Nike Peça")
                    .containsEntry("premium", false).containsKeys("iconUrl", "design", "linkedPieceIds");
        });
        assertThat(items.get(p2.getId().toString())).isEmpty();
        // o dono vê o selo vindo do próprio look privado
        @SuppressWarnings("unchecked")
        Map<String, List<Map<String, Object>>> mine = (Map<String, List<Map<String, Object>>>) seals.pieceSeals(anaSession, List.of(p2.getId())).get("items");
        assertThat(mine.get(p2.getId().toString())).hasSize(1);
    }

    @Test
    void selosDasPecasAte60Ids() {
        List<UUID> many = IntStream.range(0, 75).mapToObj(i -> UUID.randomUUID()).toList();
        seals.pieceSeals(visitor, many);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<UUID>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(pieceRepo).findByIdIn(captor.capture());
        assertThat(captor.getValue()).hasSize(SealService.MAX_PIECE_SEALS).hasSize(60);
    }

    // ------------------------------------------------------------------ anti pay-to-win

    @Test
    void vinculoESeloNuncaViramSinalDeHype() {
        seal(nike, "Nike em alta", SealTier.LOOK, Map.of("hype", Map.of("minScore", 60)));
        Scheme look = look(Visibility.PUBLIC, p1, p2);
        lookHype.put(look.getId(), hype(look.getId(), 75, HypeLevel.TRENDING, HypeMomentum.RISING, true));

        Map<String, Object> suggested = suggestions(seals.suggest(anaSession, look.getId())).get(0);
        UUID bondId = (UUID) suggested.get("id");
        seals.accept(anaSession, bondId, null);                        // marca sem revisão: emite na hora
        assertThat(allBonds).singleElement().satisfies(b -> assertThat(b.getStatus()).isEqualTo(SealBondStatus.APPROVED));
        seals.revoke(nikeSession, bondId, "teste");

        ArgumentCaptor<Object> published = ArgumentCaptor.forClass(Object.class);
        verify(events, atLeastOnce()).publishEvent(published.capture());
        assertThat(published.getAllValues()).isNotEmpty().noneMatch(e -> e instanceof DomainEvents.HypeSignal)
                .allMatch(e -> e instanceof DomainEvents.CouponRightsCheck);
        // e não existe tipo de sinal de Hype ligado a selo/vínculo/promoção
        assertThat(HypeSignalType.values()).extracting(Enum::name)
                .noneMatch(n -> n.contains("SEAL") || n.contains("BOND") || n.contains("PROMO") || n.contains("COUPON"));
    }
}
