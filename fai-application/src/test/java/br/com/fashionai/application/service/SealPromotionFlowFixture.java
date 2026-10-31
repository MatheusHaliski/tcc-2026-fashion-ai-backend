package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
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
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Cenário de ponta a ponta dos esquemas promovidos por POLÍTICA ACEITA com os serviços reais (SealService +
 * InstitutionalService): marca, celebridade, pessoa, selos com política padronizada e consultas do perfil.
 * Usada por SealPromotionFlowTest e SealPromotionLifecycleTest.
 *
 * Montagem comum (Template Method): o {@code @BeforeEach} herdado prepara repositórios simulados e serviços; as
 * subclasses só declaram os testes.
 */
abstract class SealPromotionFlowFixture {
    final Map<UUID, User> users = new HashMap<>();
    final List<Seal> allSeals = new ArrayList<>();
    final List<SealBond> allBonds = new ArrayList<>();
    final Map<UUID, Scheme> allSchemes = new HashMap<>();
    final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    final Map<UUID, BrandProfile> brandByOwner = new HashMap<>();
    final Map<UUID, CelebrityProfile> celebByOwner = new HashMap<>();
    SealService seals;
    InstitutionalService profiles;
    User brand;
    User celeb;
    User ana;
    CurrentUser anaSession;
    CurrentUser brandSession;
    CurrentUser celebSession;
    final CurrentUser visitor = new CurrentUser(UUID.randomUUID(), "visitante", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);

    @BeforeEach
    void setUp() {
        brand = user("maison", ProfileType.MARCA);
        celeb = user("estrela", ProfileType.CELEBRIDADE);
        ana = user("ana", ProfileType.PESSOAL);
        anaSession = session(ana);
        brandSession = session(brand);
        celebSession = session(celeb);
        BrandProfile bp = new BrandProfile();
        bp.assignId(UUID.randomUUID());
        bp.setOwner(brand);
        bp.setBrandName("Maison");
        bp.setSlug("maison");
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        brandByOwner.put(brand.getId(), bp);
        CelebrityProfile cp = new CelebrityProfile();
        cp.assignId(UUID.randomUUID());
        cp.setOwner(celeb);
        cp.setStageName("Estrela");
        cp.setSlug("estrela");
        cp.setVerificationStatus(ApprovalStatus.APROVADO);
        cp.setSealConsentGranted(true);
        celebByOwner.put(celeb.getId(), cp);

        FollowRepository follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        Guard guard = new Guard(e -> {
        }, follows);

        SealRepository sealRepo = mock(SealRepository.class);
        when(sealRepo.findByStatus(any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getStatus() == inv.getArgument(0)).toList());
        when(sealRepo.findByOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allSeals.stream()
                .filter(s -> s.getOwner().getId().equals(inv.getArgument(0)) && s.getStatus() == inv.getArgument(1)).toList());
        when(sealRepo.findById(any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getId().equals(inv.getArgument(0))).findFirst());

        SealBondRepository bondRepo = mock(SealBondRepository.class);
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
        org.mockito.Mockito.doAnswer(inv -> allBonds.remove((SealBond) inv.getArgument(0))).when(bondRepo).delete(any());
        when(bondRepo.findById(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getId().equals(inv.getArgument(0))).findFirst());
        when(bondRepo.findBySchemeId(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getScheme().getId().equals(inv.getArgument(0))).toList());
        when(bondRepo.findBySchemeIdAndTargetOwnerIdAndStatusIn(any(), any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getScheme().getId().equals(inv.getArgument(0)) && b.getTargetOwner().getId().equals(inv.getArgument(1))
                        && ((Collection<?>) inv.getArgument(2)).contains(b.getStatus())).toList());
        when(bondRepo.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getTargetOwner().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        when(bondRepo.findByTargetOwnerIdAndStatusOrderByCreatedAtAsc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getTargetOwner().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        when(bondRepo.findBySealCode(any())).thenAnswer(inv -> allBonds.stream().filter(b -> inv.getArgument(0).equals(b.getSealCode())).findFirst());

        SchemeRepository schemeRepo = mock(SchemeRepository.class);
        when(schemeRepo.findById(any())).thenAnswer(inv -> Optional.ofNullable(allSchemes.get(inv.getArgument(0))));
        SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
        when(schemeItems.findBySchemeIdOrderBySortOrder(any())).thenAnswer(inv -> itemsByScheme.getOrDefault(inv.getArgument(0), List.of()));
        BrandProfileRepository brandRepo = mock(BrandProfileRepository.class);
        when(brandRepo.findByOwnerId(any())).thenAnswer(inv -> Optional.ofNullable(brandByOwner.get(inv.getArgument(0))));
        when(brandRepo.findByApprovalStatusOrderByCreatedAtDesc(any())).thenAnswer(inv -> new ArrayList<>(brandByOwner.values()));
        when(brandRepo.findById(any())).thenAnswer(inv -> brandByOwner.values().stream().filter(b -> b.getId().equals(inv.getArgument(0))).findFirst());
        CelebrityProfileRepository celebRepo = mock(CelebrityProfileRepository.class);
        when(celebRepo.findByOwnerId(any())).thenAnswer(inv -> Optional.ofNullable(celebByOwner.get(inv.getArgument(0))));
        when(celebRepo.findByVerificationStatusOrderByCreatedAtDesc(any())).thenAnswer(inv -> new ArrayList<>(celebByOwner.values()));
        UserRepository userRepo = mock(UserRepository.class);
        when(userRepo.findById(any())).thenAnswer(inv -> Optional.ofNullable(users.get(inv.getArgument(0))));
        AiEngine ai = mock(AiEngine.class);
        when(ai.local(any(), any(), any(), any())).thenAnswer(inv -> new AiOutcome<>(((Supplier<?>) inv.getArgument(3)).get(), UUID.randomUUID(),
                null, false, "local", "local", 0, BigDecimal.ZERO, null, null, null));

        seals = new SealService(sealRepo, bondRepo, mock(PromotionRepository.class), mock(PromotionRedemptionRepository.class), schemeRepo,
                schemeItems, brandRepo, celebRepo, userRepo, mock(WardrobeItemRepository.class), mock(NotificationService.class), ai, guard,
                mock(Audit.class), mock(ApplicationEventPublisher.class), null);

        SchemeService schemeService = mock(SchemeService.class);
        when(schemeService.canView(any(), any())).thenAnswer(inv -> {
            CurrentUser v = inv.getArgument(0);
            Scheme s = inv.getArgument(1);
            return guard.canView(v, s.getUser().getId(), SchemeService.moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
        });
        when(schemeService.view(any(), any(), any())).thenAnswer(inv -> {
            Scheme s = inv.getArgument(1);
            Views.SchemeView v = mock(Views.SchemeView.class);
            when(v.id()).thenReturn(s.getId());
            return v;
        });
        HypeQueryService hype = mock(HypeQueryService.class);
        when(hype.currentOf(any(), anyCollection())).thenReturn(Map.of());
        profiles = new InstitutionalService(userRepo, brandRepo, celebRepo, follows, sealRepo, bondRepo, schemeRepo, schemeItems,
                mock(WardrobeItemRepository.class), mock(SavedItemRepository.class), mock(ReactionRepository.class), mock(SchemeGroupingRepository.class),
                mock(StyleDnaRepository.class), schemeService, seals, ai, guard, hype);
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

    static WardrobeItem piece(User owner, String name, String brandName, String color) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setName(name);
        w.setBrandName(brandName);
        w.setColor(color);
        w.setCategory("upper_piece");
        w.setVisibility(Visibility.PUBLIC);
        w.setModerationStatus(ModerationStatus.APPROVED);
        return w;
    }

    Scheme look(String title, WardrobeItem... items) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(ana);
        s.setTitle(title);
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setVisibility(Visibility.PUBLIC);
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

    /** Selo ativo com política padronizada (o JSON passa pela mesma validação da tela). */
    Seal seal(User owner, String name, SealTier tier, Map<String, Object> policy, Integer usageLimit) {
        Seal s = new Seal();
        s.assignId(UUID.randomUUID());
        s.setOwner(owner);
        s.setName(name);
        s.setTier(tier);
        s.setStatus(SealStatus.ACTIVE);
        s.setPremium(owner.getProfileType() == ProfileType.CELEBRIDADE);
        s.setUsageLimit(usageLimit);
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("policy", SealPolicies.normalize(policy));
        s.setBackgroundConfigJson(Json.write(cfg));
        allSeals.add(s);
        return s;
    }

    static Map<String, Object> rule(String key, String value) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("quantifier", "AT_LEAST");
        r.put("count", 1);
        r.put(key, value);
        return r;
    }

    static Map<String, Object> policyOf(Map<String, Object> rule) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("match", "ALL");
        p.put("rules", List.of(rule));
        return p;
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> suggestions(Scheme s) {
        return (List<Map<String, Object>>) seals.suggest(anaSession, s.getId()).get("suggestions");
    }

    UUID suggestionFor(Scheme s, User issuer) {
        return suggestions(s).stream().filter(m -> ((Views.UserCard) m.get("target")).id().equals(issuer.getId()))
                .map(m -> (UUID) m.get("id")).findFirst().orElseThrow(() -> new AssertionError("sem sugestão de " + issuer.getUsername()));
    }

    SealBond bond(UUID id) {
        return allBonds.stream().filter(b -> b.getId().equals(id)).findFirst().orElseThrow();
    }

    List<UUID> destaque(User profile) {
        return profiles.highlightedSchemes(visitor, profile, null, null).stream().map(e -> ((Views.SchemeView) e.get("scheme")).id()).toList();
    }

    List<UUID> consagrados(User profile) {
        return profiles.consecrated(visitor, profile, null, null, false).stream().map(e -> ((Views.SchemeView) e.get("scheme")).id()).toList();
    }

    List<UUID> pecasEmDestaque(User profile) {
        return profiles.highlightedPieces(visitor, profile, null, null).stream().map(e -> ((Views.PieceView) e.get("piece")).id()).toList();
    }

    static int status(Throwable e) {
        return ((ApiException) e).status();
    }

    /**
     * Emula o {@code @Transactional} dos serviços: um ApiException desfaz as mudanças nos vínculos (o aceite sem
     * consentimento não fica "ACCEPTED" pela metade); {@link SealService.SealUnavailable} não desfaz (noRollbackFor).
     */
    void inTx(Runnable call) {
        List<SealBond> before = new ArrayList<>(allBonds);
        Map<SealBond, Object[]> snap = new HashMap<>();
        for (SealBond b : allBonds) {
            snap.put(b, new Object[]{b.getStatus(), b.getImageRightsConsent(), b.getRespondedAt(), b.getReviewNote(), b.getSeal(), b.isRequiresReview()});
        }
        try {
            call.run();
        } catch (SealService.SealUnavailable e) {
            throw e;
        } catch (ApiException e) {
            allBonds.retainAll(before);
            snap.forEach((b, v) -> {
                b.setStatus((SealBondStatus) v[0]);
                b.setImageRightsConsent((Boolean) v[1]);
                b.setRespondedAt((java.time.Instant) v[2]);
                b.setReviewNote((String) v[3]);
                b.setSeal((Seal) v[4]);
                b.setRequiresReview((boolean) v[5]);
            });
            throw e;
        }
    }
}
