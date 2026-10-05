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
import org.junit.jupiter.api.Test;
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
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Esquemas promovidos no perfil de marca/celebridade por POLÍTICA ACEITA, de ponta a ponta com os serviços reais:
 * selo com política padronizada (RF25/RF50) → sugestão no look (RF20/RF21) → aceite de quem criou → revisão do emissor
 * quando exigida (celebridade sempre) → emissão (APPROVED, código rastreável, contador) → "Esquemas em destaque",
 * "Peças em destaque" e "Looks consagrados" (RF14/RF22). E o caminho de volta: recusa, rejeição, teto de emissões,
 * revogação, revalidação após edição e look tornado privado.
 */
class SealPromotionFlowTest {
    private final Map<UUID, User> users = new HashMap<>();
    private final List<Seal> allSeals = new ArrayList<>();
    private final List<SealBond> allBonds = new ArrayList<>();
    private final Map<UUID, Scheme> allSchemes = new HashMap<>();
    private final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    private final Map<UUID, BrandProfile> brandByOwner = new HashMap<>();
    private final Map<UUID, CelebrityProfile> celebByOwner = new HashMap<>();
    private SealService seals;
    private InstitutionalService profiles;
    private User brand;
    private User celeb;
    private User ana;
    private CurrentUser anaSession;
    private CurrentUser brandSession;
    private CurrentUser celebSession;
    private final CurrentUser visitor = new CurrentUser(UUID.randomUUID(), "visitante", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);

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

    private static WardrobeItem piece(User owner, String name, String brandName, String color) {
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

    private Scheme look(String title, WardrobeItem... items) {
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
    private Seal seal(User owner, String name, SealTier tier, Map<String, Object> policy, Integer usageLimit) {
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

    private static Map<String, Object> rule(String key, String value) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("quantifier", "AT_LEAST");
        r.put("count", 1);
        r.put(key, value);
        return r;
    }

    private static Map<String, Object> policyOf(Map<String, Object> rule) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("match", "ALL");
        p.put("rules", List.of(rule));
        return p;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> suggestions(Scheme s) {
        return (List<Map<String, Object>>) seals.suggest(anaSession, s.getId()).get("suggestions");
    }

    private UUID suggestionFor(Scheme s, User issuer) {
        return suggestions(s).stream().filter(m -> ((Views.UserCard) m.get("target")).id().equals(issuer.getId()))
                .map(m -> (UUID) m.get("id")).findFirst().orElseThrow(() -> new AssertionError("sem sugestão de " + issuer.getUsername()));
    }

    private SealBond bond(UUID id) {
        return allBonds.stream().filter(b -> b.getId().equals(id)).findFirst().orElseThrow();
    }

    private List<UUID> destaque(User profile) {
        return profiles.highlightedSchemes(visitor, profile, null, null).stream().map(e -> ((Views.SchemeView) e.get("scheme")).id()).toList();
    }

    private List<UUID> consagrados(User profile) {
        return profiles.consecrated(visitor, profile, null, null, false).stream().map(e -> ((Views.SchemeView) e.get("scheme")).id()).toList();
    }

    private List<UUID> pecasEmDestaque(User profile) {
        return profiles.highlightedPieces(visitor, profile, null, null).stream().map(e -> ((Views.PieceView) e.get("piece")).id()).toList();
    }

    private static int status(Throwable e) {
        return ((ApiException) e).status();
    }

    /**
     * Emula o {@code @Transactional} dos serviços: um ApiException desfaz as mudanças nos vínculos (o aceite sem
     * consentimento não fica "ACCEPTED" pela metade); {@link SealService.SealUnavailable} não desfaz (noRollbackFor).
     */
    private void inTx(Runnable call) {
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

    // ------------------------------------------------------------------ marca: política atendida → aceite → emissão → perfil

    @Test
    void marcaComPoliticaAtendidaSugereEAoAceitarPromoveOLookNoPerfil() {
        Seal selo = seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        WardrobeItem tenis = piece(ana, "Dunk", "Nike", "black");
        WardrobeItem jeans = piece(ana, "501", "Levi's", "blue");
        Scheme s = look("Clube", tenis, jeans);

        UUID bondId = suggestionFor(s, brand);
        SealBond b = bond(bondId);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.SUGGESTED);
        assertThat(b.getSeal()).isEqualTo(selo);
        assertThat(b.getJustification()).contains("Maison Street");
        assertThat(destaque(brand)).as("sugestão ainda não promove").isEmpty();

        seals.accept(anaSession, bondId, null);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(b.getSealCode()).startsWith("BRD");
        assertThat(b.getIssuedAt()).isNotNull();
        assertThat(b.getExpiresAt()).isAfter(b.getIssuedAt());
        assertThat(selo.getUsageCount()).isEqualTo(1);
        assertThat(Json.strings(s.getSealIdsJson())).contains(bondId.toString());

        assertThat(destaque(brand)).containsExactly(s.getId());
        assertThat(consagrados(brand)).containsExactly(s.getId());
        assertThat(pecasEmDestaque(brand)).containsExactlyInAnyOrder(tenis.getId(), jeans.getId());
        assertThat(destaque(celeb)).isEmpty();
    }

    @Test
    void politicaNaoAtendidaNaoSugereENadaApareceNoPerfil() {
        seal(brand, "Só Gucci", SealTier.LOOK, policyOf(rule("brand", "Gucci")), null);
        Scheme s = look("Sem Gucci", piece(ana, "Dunk", "Nike", "black"));
        assertThat(suggestions(s)).noneMatch(m -> ((Views.UserCard) m.get("target")).id().equals(brand.getId()));
        assertThat(destaque(brand)).isEmpty();
    }

    @Test
    void recusarASugestaoNaoPromove() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Recusado", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.refuse(anaSession, bondId);
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.REFUSED);
        assertThat(destaque(brand)).isEmpty();
        assertThat(consagrados(brand)).isEmpty();
    }

    @Test
    void marcaQueExigeRevisaoSoPromoveDepoisDaAprovacao() {
        brandByOwner.get(brand.getId()).setRequiresSealReview(true);
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Na fila", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.accept(anaSession, bondId, null);
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.PENDING_REVIEW);
        assertThat(destaque(brand)).isEmpty();
        seals.review(brandSession, bondId, true, null);
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(destaque(brand)).containsExactly(s.getId());
    }

    // ------------------------------------------------------------------ celebridade: consentimento + revisão sempre

    @Test
    void celebridadeComSeloDePecaExigeConsentimentoERevisaoEDestacaSoAPecaQueAtende() {
        seal(celeb, "Preto Estrela", SealTier.PECA, policyOf(rule("color", "black")), null);
        WardrobeItem preta = piece(ana, "Jaqueta preta", "Zara", "black");
        WardrobeItem azul = piece(ana, "Calça azul", "Zara", "blue");
        Scheme s = look("Noite", preta, azul);

        UUID bondId = suggestionFor(s, celeb);
        SealBond b = bond(bondId);
        assertThat(b.getTier()).isEqualTo(SealTier.PECA);
        assertThat(Json.strings(b.getLinkedPieceIdsJson())).containsExactly(preta.getId().toString());

        assertThatThrownBy(() -> inTx(() -> seals.accept(anaSession, bondId, null))).satisfies(e -> assertThat(status(e)).isEqualTo(400));
        assertThat(b.getStatus()).as("sem consentimento o aceite é desfeito").isEqualTo(SealBondStatus.SUGGESTED);
        seals.accept(anaSession, bondId, true);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.PENDING_REVIEW);
        assertThat(destaque(celeb)).as("celebridade sempre revisa").isEmpty();

        seals.review(celebSession, bondId, true, null);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(b.getSealCode()).startsWith("PRM");
        assertThat(destaque(celeb)).containsExactly(s.getId());
        assertThat(pecasEmDestaque(celeb)).containsExactly(preta.getId());
    }

    @Test
    void celebridadeQueRejeitaNuncaPromove() {
        seal(celeb, "Preto Estrela", SealTier.PECA, policyOf(rule("color", "black")), null);
        Scheme s = look("Rejeitado", piece(ana, "Jaqueta preta", "Zara", "black"));
        UUID bondId = suggestionFor(s, celeb);
        seals.accept(anaSession, bondId, true);
        assertThatThrownBy(() -> inTx(() -> seals.review(celebSession, bondId, false, " "))).satisfies(e -> assertThat(status(e)).isEqualTo(400));
        seals.review(celebSession, bondId, false, "não combina com a era");
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.REJECTED);
        assertThat(destaque(celeb)).isEmpty();
        assertThat(consagrados(celeb)).isEmpty();
    }

    // ------------------------------------------------------------------ teto de emissões, revogação, revalidação, privacidade

    @Test
    void tetoDeEmissoesPromoveSoOPrimeiroAceite() {
        Seal selo = seal(brand, "Edição limitada", SealTier.LOOK, policyOf(rule("brand", "Nike")), 1);
        Scheme a = look("Primeiro", piece(ana, "Dunk", "Nike", "black"));
        Scheme b = look("Segundo", piece(ana, "Air Max", "Nike", "white"));
        UUID first = suggestionFor(a, brand);
        UUID second = suggestionFor(b, brand);
        seals.accept(anaSession, first, null);
        assertThatThrownBy(() -> inTx(() -> seals.accept(anaSession, second, null)))
                .isInstanceOf(SealService.SealUnavailable.class).satisfies(e -> assertThat(status(e)).isEqualTo(409));
        assertThat(bond(second).getStatus()).as("a recusa por teto fica registrada (noRollbackFor)").isEqualTo(SealBondStatus.REJECTED);
        assertThat(bond(second).getReviewNote()).isNotBlank();
        assertThat(selo.getUsageCount()).isEqualTo(1);
        assertThat(destaque(brand)).containsExactly(a.getId());
    }

    @Test
    void revogacaoPeloEmissorTiraOLookDoPerfil() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Revogado", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.accept(anaSession, bondId, null);
        assertThat(destaque(brand)).containsExactly(s.getId());
        seals.revoke(brandSession, bondId, "uso indevido");
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.REVOKED);
        assertThat(destaque(brand)).isEmpty();
        assertThat(consagrados(brand)).isEmpty();
    }

    @Test
    void editarAsPecasPedeRevalidacaoQueTiraDoDestaqueAteOEmissorRevalidar() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Editado", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.accept(anaSession, bondId, null);

        seals.flagRevalidation(s);
        assertThat(s.isRevalidationPending()).isTrue();
        assertThat(destaque(brand)).isEmpty();
        List<Map<String, Object>> hall = profiles.consecrated(visitor, brand, null, null, false);
        assertThat(hall).hasSize(1);
        assertThat(hall.get(0).get("promotion")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP).containsEntry("revalidationPending", true);

        seals.review(brandSession, bondId, true, null);
        assertThat(s.isRevalidationPending()).isFalse();
        assertThat(destaque(brand)).containsExactly(s.getId());
    }

    @Test
    void lookTornadoPrivadoRevogaOSeloESomeDoPerfil() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Privado depois", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.accept(anaSession, bondId, null);
        s.setVisibility(Visibility.PRIVATE);
        assertThat(destaque(brand)).as("a visibilidade já esconde antes da revogação").isEmpty();
        seals.revokeForScheme(s.getId(), "look privado");
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.REVOKED);
        s.setVisibility(Visibility.PUBLIC);
        assertThat(destaque(brand)).as("voltar a público não devolve o selo revogado").isEmpty();
    }

    @Test
    void mesmoLookNaoGanhaDoisVinculosDoMesmoEmissor() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Único", piece(ana, "Dunk", "Nike", "black"));
        seals.accept(anaSession, suggestionFor(s, brand), null);
        assertThat(suggestions(s)).noneMatch(m -> ((Views.UserCard) m.get("target")).id().equals(brand.getId()));
        assertThatThrownBy(() -> inTx(() -> seals.linkManually(anaSession, s.getId(), brand.getId(), null))).satisfies(e -> assertThat(status(e)).isEqualTo(409));
        assertThat(destaque(brand)).containsExactly(s.getId());
    }
}
