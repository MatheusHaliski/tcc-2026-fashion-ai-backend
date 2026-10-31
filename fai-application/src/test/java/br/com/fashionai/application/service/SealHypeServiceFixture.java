package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.Json;
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
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Cenário de RF53 — Selos × HypeScore no SealService: usuários, marcas, peças, looks, selos, vínculos e Hype de
 * peça/look em memória.
 * Usada por SealHypeServiceTest e SealHypeIssuerPiecesTest.
 *
 * Montagem comum (Template Method): o {@code @BeforeEach} herdado prepara repositórios simulados e serviços; as
 * subclasses só declaram os testes.
 */
abstract class SealHypeServiceFixture {
    final Map<UUID, User> users = new HashMap<>();
    final List<Seal> allSeals = new ArrayList<>();
    final List<SealBond> allBonds = new ArrayList<>();
    final Map<UUID, Scheme> allSchemes = new HashMap<>();
    final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    final List<WardrobeItem> allPieces = new ArrayList<>();
    final Map<UUID, BrandProfile> brandByOwner = new HashMap<>();
    final Map<UUID, HypeScoreCurrent> pieceHype = new HashMap<>();
    final Map<UUID, HypeScoreCurrent> lookHype = new HashMap<>();

    SealRepository sealRepo;
    SealBondRepository bondRepo;
    SchemeRepository schemeRepo;
    SchemeItemRepository schemeItems;
    BrandProfileRepository brandRepo;
    CelebrityProfileRepository celebRepo;
    UserRepository userRepo;
    WardrobeItemRepository pieceRepo;
    AiEngine ai;
    Guard guard;
    ApplicationEventPublisher events;
    SealService seals;

    User ana;
    User nike;
    User adidas;
    CurrentUser anaSession;
    CurrentUser nikeSession;
    final CurrentUser visitor = new CurrentUser(UUID.randomUUID(), "visitante", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    WardrobeItem p1;
    WardrobeItem p2;

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
    SealService service() {
        return new SealService(sealRepo, bondRepo, mock(PromotionRepository.class), mock(PromotionRedemptionRepository.class), schemeRepo,
                schemeItems, brandRepo, celebRepo, userRepo, pieceRepo, mock(NotificationService.class), ai, guard,
                mock(Audit.class), events, mock(OwnMedia.class));
    }

    static Map<UUID, HypeScoreCurrent> pick(Map<UUID, HypeScoreCurrent> rows, Collection<UUID> ids) {
        Map<UUID, HypeScoreCurrent> out = new HashMap<>();
        ids.forEach(id -> {
            if (rows.containsKey(id)) {
                out.put(id, rows.get(id));
            }
        });
        return out;
    }

    // ------------------------------------------------------------------ fixtures

    User user(String username, ProfileType type) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(username);
        u.setProfileType(type);
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileVisibility(Visibility.PUBLIC);
        users.put(u.getId(), u);
        return u;
    }

    void brand(User owner, String name) {
        BrandProfile bp = new BrandProfile();
        bp.assignId(UUID.randomUUID());
        bp.setOwner(owner);
        bp.setBrandName(name);
        bp.setSlug(name.toLowerCase());
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        brandByOwner.put(owner.getId(), bp);
    }

    static CurrentUser session(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", u.getProfileType(), true, AccountStatus.ACTIVE, null, null);
    }

    WardrobeItem piece(String name, String brandName, String color) {
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

    Scheme look(Visibility visibility, WardrobeItem... items) {
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

    Seal seal(User owner, String name, SealTier tier, Map<String, Object> policy) {
        Seal s = new Seal();
        s.assignId(UUID.randomUUID());
        s.setOwner(owner);
        s.setName(name);
        s.setTier(tier);
        s.setBackgroundConfigJson(Json.write(Map.of("policy", SealPolicies.normalize(policy))));
        allSeals.add(s);
        return s;
    }

    SealBond approved(Seal seal, Scheme scheme, SealTier tier, WardrobeItem... linked) {
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

    static HypeScoreCurrent hype(UUID id, double score, HypeLevel level, HypeMomentum momentum, boolean publicEligible) {
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
    static List<Map<String, Object>> suggestions(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("suggestions");
    }
}
