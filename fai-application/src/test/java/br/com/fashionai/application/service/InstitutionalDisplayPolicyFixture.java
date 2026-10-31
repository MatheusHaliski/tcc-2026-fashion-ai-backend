package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Cenário da política de exibição no perfil de marca/celebridade (RF14/RF22 × RF20/RF21/RF50): marca, pessoa,
 * selo, peças, looks, vínculos e Hype em memória.
 * Usada por InstitutionalDisplayPolicyTest e InstitutionalDisplayRankingTest.
 *
 * Montagem comum (Template Method): o {@code @BeforeEach} herdado prepara repositórios simulados e serviços; as
 * subclasses só declaram os testes.
 */
abstract class InstitutionalDisplayPolicyFixture {
    final Instant now = Instant.now();
    final List<SealBond> allBonds = new ArrayList<>();
    final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    final Map<UUID, HypeScoreCurrent> hypeRows = new HashMap<>();
    final List<WardrobeItem> brandCatalog = new ArrayList<>();
    FollowRepository follows;
    HypeQueryService hypeQuery;
    BrandProfileRepository brandProfiles;
    CelebrityProfileRepository celebrityProfiles;
    InstitutionalService service;
    SealService sealPolicies;
    User brand;
    User ana;
    Seal seal;
    WardrobeItem tenis;
    WardrobeItem jeans;
    WardrobeItem camiseta;
    CurrentUser visitor;

    @BeforeEach
    void setUp() {
        brand = user("maison", ProfileType.MARCA);
        ana = user("ana", ProfileType.PESSOAL);
        User leitor = user("leitor", ProfileType.PESSOAL);
        visitor = new CurrentUser(leitor.getId(), "leitor", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        seal = new Seal();
        seal.assignId(UUID.randomUUID());
        seal.setOwner(brand);
        seal.setName("Selo Maison");
        seal.setTier(SealTier.LOOK);
        tenis = piece(ana, "Tênis");
        jeans = piece(ana, "Jeans");
        camiseta = piece(ana, "Camiseta");

        follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        Guard guard = new Guard(e -> {
        }, follows);

        SealBondRepository bonds = mock(SealBondRepository.class);
        when(bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> allBonds.stream()
                .filter(b -> b.getTargetOwner().getId().equals(inv.getArgument(0)) && b.getStatus() == inv.getArgument(1)).toList());
        when(bonds.findBySchemeId(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getScheme().getId().equals(inv.getArgument(0))).toList());
        SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
        when(schemeItems.findBySchemeIdOrderBySortOrder(any())).thenAnswer(inv -> itemsByScheme.getOrDefault(inv.getArgument(0), List.of()));
        WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
        when(pieces.findByUserIdOrderByCreatedAtDesc(brand.getId())).thenAnswer(inv -> brandCatalog);

        SchemeService schemeService = mock(SchemeService.class);
        // mesma regra do SchemeService.canView: arquivado só para o dono; visibilidade do look × perfil × bloqueio
        when(schemeService.canView(any(), any())).thenAnswer(inv -> {
            CurrentUser v = inv.getArgument(0);
            Scheme s = inv.getArgument(1);
            if (s.getStatus() == SchemeStatus.ARCHIVED && (v == null || !v.id().equals(s.getUser().getId()))) {
                return false;
            }
            return guard.canView(v, s.getUser().getId(), SchemeService.moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
        });
        when(schemeService.view(any(), any(), any())).thenAnswer(inv -> {
            Scheme s = inv.getArgument(1);
            Views.SchemeView v = mock(Views.SchemeView.class);
            when(v.id()).thenReturn(s.getId());
            when(v.title()).thenReturn(s.getTitle());
            return v;
        });
        HypeQueryService hype = mock(HypeQueryService.class);
        hypeQuery = hype;
        brandProfiles = mock(BrandProfileRepository.class);
        celebrityProfiles = mock(CelebrityProfileRepository.class);
        when(hype.currentOf(eq(HypeEntityType.SCHEME), anyCollection())).thenAnswer(inv -> {
            Map<UUID, HypeScoreCurrent> out = new HashMap<>();
            for (Object id : (java.util.Collection<?>) inv.getArgument(1)) {
                if (hypeRows.containsKey(id)) {
                    out.put((UUID) id, hypeRows.get(id));
                }
            }
            return out;
        });

        sealPolicies = mock(SealService.class);
        service = new InstitutionalService(mock(UserRepository.class), brandProfiles, celebrityProfiles,
                follows, mock(SealRepository.class), bonds, mock(SchemeRepository.class), schemeItems, pieces, mock(SavedItemRepository.class),
                mock(ReactionRepository.class), mock(SchemeGroupingRepository.class), mock(StyleDnaRepository.class), schemeService,
                sealPolicies, mock(AiEngine.class), guard, hype);
    }

    // ------------------------------------------------------------------ fixtures

    static User user(String username, ProfileType type) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(username);
        u.setProfileType(type);
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileVisibility(Visibility.PUBLIC);
        return u;
    }

    static WardrobeItem piece(User owner, String name) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setName(name);
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
        int i = 0;
        for (WardrobeItem w : items) {
            SchemeItem si = new SchemeItem();
            si.setScheme(s);
            si.setWardrobeItem(w);
            si.setSortOrder(i++);
            list.add(si);
        }
        itemsByScheme.put(s.getId(), list);
        return s;
    }

    SealBond bond(Scheme s, SealBondStatus status, SealTier tier, Instant issuedAt, Instant expiresAt, WardrobeItem... linked) {
        SealBond b = new SealBond();
        b.assignId(UUID.randomUUID());
        b.setScheme(s);
        b.setTargetOwner(brand);
        b.setRequestedBy(ana);
        b.setSeal(seal);
        b.setTier(tier);
        b.setStatus(status);
        b.setIssuedAt(issuedAt);
        b.setExpiresAt(expiresAt);
        List<WardrobeItem> pieces = linked.length > 0 ? List.of(linked) : itemsByScheme.get(s.getId()).stream().map(SchemeItem::getWardrobeItem).toList();
        b.setLinkedPieceIdsJson(Json.write(pieces.stream().map(w -> w.getId().toString()).toList()));
        allBonds.add(b);
        return b;
    }

    /** Vínculo direto numa peça, sem look (é assim que o selo Hype de peça nasce). */
    SealBond direct(WardrobeItem w, Instant expiresAt) {
        SealBond b = new SealBond();
        b.assignId(UUID.randomUUID());
        b.setPiece(w);
        b.setTargetOwner(brand);
        b.setRequestedBy(ana);
        b.setSeal(seal);
        b.setTier(SealTier.PECA);
        b.setStatus(SealBondStatus.APPROVED);
        b.setIssuedAt(now.minus(1, ChronoUnit.DAYS));
        b.setExpiresAt(expiresAt);
        b.setLinkedPieceIdsJson(Json.write(List.of(w.getId().toString())));
        allBonds.add(b);
        return b;
    }

    SealBond approved(Scheme s) {
        return bond(s, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(2, ChronoUnit.DAYS), now.plus(30, ChronoUnit.DAYS));
    }

    HypeScoreCurrent hype(Scheme s, double score) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.SCHEME);
        c.setEntityId(s.getId());
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setPublicEligible(true);   // destaques são de looks de outras pessoas: só o Hype público ordena
        hypeRows.put(s.getId(), c);
        return c;
    }

    /** Hype com crescimento (dimensão TREND do v2) e Δ. */
    HypeScoreCurrent hype(Scheme s, double score, double trend, double delta) {
        HypeScoreCurrent c = hype(s, score);
        br.com.fashionai.domain.model.HypeDimensions d = new br.com.fashionai.domain.model.HypeDimensions();
        d.setTrend(BigDecimal.valueOf(trend));
        c.setDimensions(d);
        c.setDeltaPoints(BigDecimal.valueOf(delta));
        return c;
    }

    List<UUID> ids(List<Map<String, Object>> entries) {
        return entries.stream().map(e -> ((Views.SchemeView) e.get("scheme")).id()).toList();
    }

    List<UUID> destaque(CurrentUser viewer) {
        return ids(service.highlightedSchemes(viewer, brand, null, null));
    }

    List<UUID> consagrados(CurrentUser viewer) {
        return ids(service.consecrated(viewer, brand, null, null, false));
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> promotion(Map<String, Object> entry) {
        return (Map<String, Object>) entry.get("promotion");
    }
}
