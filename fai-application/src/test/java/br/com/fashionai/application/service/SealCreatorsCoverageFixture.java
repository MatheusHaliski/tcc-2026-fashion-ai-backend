package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Cenário da cobertura dos criadores de selo (manual e com IA) e da detecção em peças e looks compatíveis.
 * Usada por SealCreatorsCoverageTest e SealDetectionCoverageTest.
 *
 * Montagem comum (Template Method): o {@code @BeforeEach} herdado prepara repositórios simulados e serviços; as
 * subclasses só declaram os testes.
 */
abstract class SealCreatorsCoverageFixture {
    final Map<UUID, User> users = new HashMap<>();
    final List<Seal> allSeals = new ArrayList<>();
    final List<SealBond> allBonds = new ArrayList<>();
    final Map<UUID, Scheme> allSchemes = new HashMap<>();
    final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    final Map<UUID, WardrobeItem> allPieces = new HashMap<>();
    final Map<UUID, BrandProfile> brandByOwner = new HashMap<>();
    final AiEngine ai = mock(AiEngine.class);
    final SealRepository sealRepo = mock(SealRepository.class);
    SealService seals;
    User brand;
    User ana;
    CurrentUser anaSession;
    CurrentUser brandSession;

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

    static CurrentUser session(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", u.getProfileType(), true, AccountStatus.ACTIVE, null, null);
    }

    WardrobeItem piece(String brandName, String color) {
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

    Scheme look(WardrobeItem... items) {
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

    static Map<String, Object> referenceModel(SealTier tier, String title, int count, String brandName, String color) {
        Map<String, Object> part = new LinkedHashMap<>();
        part.put("count", count);
        part.put("category", "upper_piece");
        part.put("subcategory", "t_shirt");
        part.put("brand", brandName);
        part.put("color", color);
        return new LinkedHashMap<>(Map.of("version", 1, "tier", tier.name(), "title", title, "description", title,
                "minPieces", 1, "pieces", List.of(part)));
    }

    static Map<String, Object> referencePolicy(SealTier tier, String title, int count, String brandName, String color) {
        return Map.of("referenceModel", referenceModel(tier, title, count, brandName, color));
    }

    /** Selo ativo cujo JSON de política passa pela mesma normalização do criador. */
    Seal activeSeal(String name, SealTier tier, Map<String, Object> policy) {
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

    static boolean matches(Map<String, Object> policy, SealTier tier, WardrobeItem... pieces) {
        return SealPolicies.evaluate(SealPolicies.parse(SealPolicies.normalize(policy)), tier, List.of(pieces), List.of(), List.of()).matched();
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> list(Map<String, Object> result, String key) {
        return (List<Map<String, Object>>) result.get(key);
    }

    static boolean suggestsBrand(List<Map<String, Object>> suggestions, User issuer) {
        return suggestions.stream().anyMatch(m -> issuer.getId().equals(m.get("targetOwnerId")));
    }
}
