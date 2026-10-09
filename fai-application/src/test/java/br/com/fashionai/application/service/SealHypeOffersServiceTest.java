package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.*;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SealHypeOffersServiceTest {
    private final SealRepository repository = mock(SealRepository.class);
    private final SealBondRepository bonds = mock(SealBondRepository.class);
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
    private final BrandProfileRepository brands = mock(BrandProfileRepository.class);
    private final CelebrityProfileRepository celebrities = mock(CelebrityProfileRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final HypeQueryService hype = mock(HypeQueryService.class);
    private final AiEngine ai = mock(AiEngine.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final FollowRepository follows = mock(FollowRepository.class);
    private final List<Seal> allSeals = new ArrayList<>();
    private final List<SealBond> allBonds = new ArrayList<>();
    private final Map<UUID,HypeScoreCurrent> scores = new HashMap<>();
    private SealService seals;
    private SealHypeOffersService offers;
    private User author, issuer;
    private BrandProfile brand;
    private WardrobeItem piece;
    private Scheme scheme;
    private CurrentUser session;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        author = user("ana", ProfileType.PESSOAL); issuer = user("nike", ProfileType.MARCA); session = session(author);
        brand = new BrandProfile(); brand.assignId(UUID.randomUUID()); brand.setOwner(issuer); brand.setBrandName("Nike"); brand.setSlug("nike"); brand.setApprovalStatus(ApprovalStatus.APROVADO);
        when(brands.findByOwnerId(issuer.getId())).thenReturn(Optional.of(brand));
        when(users.findById(author.getId())).thenReturn(Optional.of(author)); when(users.findById(issuer.getId())).thenReturn(Optional.of(issuer));
        piece = new WardrobeItem(); piece.assignId(UUID.randomUUID()); piece.setUser(author); piece.setName("Camiseta"); piece.setBrandName("Nike");
        piece.setCategory("upper_piece"); piece.setColor("black"); piece.setVisibility(Visibility.PUBLIC); piece.setModerationStatus(ModerationStatus.APPROVED);
        piece.setOccasionTags("casual"); piece.setStyleTags("basic");
        when(pieces.findById(piece.getId())).thenReturn(Optional.of(piece)); when(pieces.findByIdIn(anyCollection())).thenReturn(List.of(piece));
        when(pieces.findForSealRequest(piece.getId())).thenReturn(Optional.of(piece));
        scheme = new Scheme(); scheme.assignId(UUID.randomUUID()); scheme.setUser(author); scheme.setTitle("Look Nike"); scheme.setStatus(SchemeStatus.PUBLISHED);
        scheme.setVisibility(Visibility.PUBLIC); scheme.setOccasion("casual"); scheme.setStyle("basic");
        SchemeItem item = new SchemeItem(); item.setScheme(scheme); item.setWardrobeItem(piece);
        when(schemes.findById(scheme.getId())).thenReturn(Optional.of(scheme)); when(schemeItems.findBySchemeIdOrderBySortOrder(scheme.getId())).thenReturn(List.of(item));
        when(schemes.findForSealRequest(scheme.getId())).thenReturn(Optional.of(scheme));
        when(repository.findByStatus(SealStatus.ACTIVE)).thenAnswer(inv -> allSeals.stream().filter(s -> s.getStatus() == SealStatus.ACTIVE).toList());
        when(repository.findById(any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getId().equals(inv.getArgument(0))).findFirst());
        when(repository.findForIssuance(any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getId().equals(inv.getArgument(0))).findFirst());
        when(repository.findByOwnerIdAndStatusOrderByCreatedAtDesc(any(),any())).thenAnswer(inv -> allSeals.stream().filter(s -> s.getOwner().getId().equals(inv.getArgument(0))).toList());
        when(repository.save(any())).thenAnswer(inv -> { Seal s = inv.getArgument(0); if (s.getId() == null) s.assignId(UUID.randomUUID()); allSeals.add(s); return s; });
        when(bonds.save(any())).thenAnswer(inv -> { SealBond b = inv.getArgument(0); if (b.getId() == null) b.assignId(UUID.randomUUID()); allBonds.add(b); return b; });
        when(bonds.findById(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getId().equals(inv.getArgument(0))).findFirst());
        when(bonds.findByPieceId(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getPiece() != null && b.getPiece().getId().equals(inv.getArgument(0))).toList());
        when(bonds.findBySchemeId(any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getScheme() != null && b.getScheme().getId().equals(inv.getArgument(0))).toList());
        when(bonds.findBySchemeIdAndTargetOwnerIdAndStatusIn(any(),any(),any())).thenAnswer(inv -> allBonds.stream().filter(b -> b.getScheme() != null && b.getScheme().getId().equals(inv.getArgument(0))
                && b.getTargetOwner().getId().equals(inv.getArgument(1)) && ((Collection<?>)inv.getArgument(2)).contains(b.getStatus())).toList());
        when(hype.config()).thenReturn(HypeScoreConfig.defaults());
        when(hype.currentOf(any(),anyCollection())).thenAnswer(inv -> { Map<UUID,HypeScoreCurrent> out = new HashMap<>(); for (UUID id : (Collection<UUID>)inv.getArgument(1)) if (scores.containsKey(id)) out.put(id,scores.get(id)); return out; });
        ObjectProvider<HypeQueryService> provider = mock(ObjectProvider.class); when(provider.getIfAvailable()).thenReturn(hype);
        when(ai.local(any(),any(),any(),any())).thenAnswer(inv -> new AiOutcome<>(((Supplier<?>)inv.getArgument(3)).get(),UUID.randomUUID(),null,false,"local","local",0,BigDecimal.ZERO,null,null,null));
        Guard guard = new Guard(e -> {}, follows);
        seals = new SealService(repository,bonds,mock(PromotionRepository.class),mock(PromotionRedemptionRepository.class),schemes,schemeItems,brands,celebrities,users,pieces,
                mock(NotificationService.class),ai,guard,mock(Audit.class),events,mock(OwnMedia.class)); seals.setHypeQuery(provider);
        offers = new SealHypeOffersService(seals,repository,bonds,pieces,schemes,schemeItems,brands,celebrities,provider,guard,ai);
        score(piece.getId(),80); score(scheme.getId(),85);
    }

    private static User user(String name,ProfileType type) { User user = new User(); user.assignId(UUID.randomUUID()); user.setUsername(name); user.setDisplayName(name); user.setProfileType(type); user.setStatus(AccountStatus.ACTIVE); user.setProfileVisibility(Visibility.PUBLIC); return user; }
    private static CurrentUser session(User user) { return new CurrentUser(user.getId(),user.getUsername(),"USER",user.getProfileType(),true,AccountStatus.ACTIVE,null,null); }
    private HypeScoreCurrent score(UUID id,int score) { HypeScoreCurrent row = new HypeScoreCurrent(); row.setEntityId(id); row.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION); row.setStatus(HypeStatus.AVAILABLE); row.setScore(BigDecimal.valueOf(score)); row.setLevel(HypeLevel.TRENDING); row.setMomentum(HypeMomentum.RISING); row.setCalculatedAt(Instant.now()); row.setPublicEligible(true); HypeDimensions dims = new HypeDimensions(); dims.setEngagement(BigDecimal.valueOf(75)); row.setDimensions(dims); scores.put(id,row); return row; }
    private Seal campaign(SealTier tier) { Seal seal = new Seal(); seal.assignId(UUID.randomUUID()); seal.setOwner(issuer); seal.setName("Hype Nike"); seal.setTier(tier); seal.setBackgroundConfigJson(Json.write(Map.of("policy",SealPolicies.normalize(Map.of("mode","HYPE","rules",List.of(Map.of("brand","Nike")),"hype",Map.of("minScore",60,"dimensionMins",Map.of("ENGAGEMENT",70))))))); allSeals.add(seal); return seal; }
    @SuppressWarnings("unchecked") private List<Map<String,Object>> items(Map<String,Object> out) { return (List<Map<String,Object>>)out.get("items"); }

    @Test void criacaoHypeNaoExigeInferenciaCopilotMasExigeEmissorAprovado() {
        var policy = Map.<String,Object>of("mode","HYPE","hype",Map.of("minScore",65));
        var form = new SealService.SealForm("Selo Hype",SealTier.PECA,null,null,null,null,null,null,SealStatus.ACTIVE,null,policy);
        assertThat(seals.createSeal(session(issuer),form).get("policy")).isEqualTo(SealPolicies.normalize(policy));
        brand.setApprovalStatus(ApprovalStatus.PENDENTE);
        assertThatThrownBy(() -> seals.createSeal(session(issuer),form)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> seals.createSeal(session,form)).isInstanceOf(ApiException.class);
    }

    @Test void ofertasRespeitamPrivacidadeEVisitanteNuncaPodeAtribuir() {
        campaign(SealTier.PECA);
        assertThat(items(offers.offers(null,HypeEntityType.PIECE,piece.getId(),0,12)).get(0)).containsEntry("eligible",true).containsEntry("canRequest",false);
        piece.setVisibility(Visibility.PRIVATE);
        assertThatThrownBy(() -> offers.offers(null,HypeEntityType.PIECE,piece.getId(),0,12)).isInstanceOfSatisfying(ApiException.class,e -> assertThat(e.status()).isEqualTo(404));
        User other = user("outra",ProfileType.PESSOAL);
        assertThatThrownBy(() -> offers.offers(session(other),HypeEntityType.PIECE,piece.getId(),0,12)).isInstanceOf(ApiException.class);
        assertThat(items(offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12))).hasSize(1);
    }

    @Test void listaPaginadaNaoCriaVinculosNemRecalculaHype() {
        for (int i=0;i<14;i++) campaign(SealTier.PECA);
        campaign(SealTier.LOOK);
        var out = offers.offers(session,HypeEntityType.PIECE,piece.getId(),1,5);
        assertThat(out).containsEntry("total",14).containsEntry("page",1).containsEntry("size",5);
        assertThat(items(out)).hasSize(5);
        verify(bonds,never()).save(any()); verifyNoInteractions(events); verify(ai,never()).local(any(),any(),any(),any());
    }

    @Test void avaliaPaginaDeOfertasComUmaConsultaDeMetricasPorTipo() {
        for (int i=0;i<14;i++) campaign(SealTier.LOOK);
        assertThat(items(offers.offers(session,HypeEntityType.SCHEME,scheme.getId(),0,12))).hasSize(12);
        verify(hype,times(1)).currentOf(eq(HypeEntityType.SCHEME),anyCollection());
        verify(hype,times(1)).currentOf(eq(HypeEntityType.PIECE),anyCollection());
        verify(bonds,times(1)).findBySchemeId(scheme.getId());
    }

    @Test void lookPublicoNaoRevelaCorrespondenciaDePoliticaDasPecasPrivadas() {
        campaign(SealTier.LOOK); piece.setVisibility(Visibility.PRIVATE);
        assertThat(items(offers.offers(null,HypeEntityType.SCHEME,scheme.getId(),0,12)).get(0))
                .containsEntry("eligible",false).containsEntry("canRequest",false);
        assertThat(items(offers.offers(session,HypeEntityType.SCHEME,scheme.getId(),0,12)).get(0))
                .containsEntry("eligible",true).containsEntry("canRequest",true);
    }

    @Test
    @SuppressWarnings("unchecked")
    void seloDePecaIsoladaApareceNoEndpointEFiltragemDoGuardaRoupa() {
        Seal seal = campaign(SealTier.PECA);
        offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null);
        when(bonds.findByPieceIdInAndStatus(anyCollection(),eq(SealBondStatus.APPROVED))).thenReturn(List.of(allBonds.get(0)));
        Map<String,Object> listed = (Map<String,Object>)seals.pieceSeals(session,List.of(piece.getId())).get("items");
        assertThat((List<?>)listed.get(piece.getId().toString())).hasSize(1);
        assertThat(SealService.approvedPieceBonds(List.of(piece.getId()),schemeItems,bonds,ignored -> false))
                .containsKey(piece.getId());
        allBonds.get(0).setExpiresAt(Instant.now().minusSeconds(1));
        assertThat(SealService.approvedPieceBonds(List.of(piece.getId()),schemeItems,bonds,ignored -> true)).isEmpty();
    }

    @Test void pedidoEmitePecaIsoladaComVinculoAuditadoESemAlterarScore() {
        Seal seal = campaign(SealTier.PECA);
        var result = offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null);
        assertThat(result).containsEntry("status",SealBondStatus.APPROVED).containsEntry("pieceId",piece.getId()).containsEntry("schemeId",null);
        SealBond bond = allBonds.get(0); assertThat(bond.getPiece()).isSameAs(piece); assertThat(bond.getScheme()).isNull();
        assertThat(bond.getAiInferenceId()).isNotNull(); assertThat(seal.getUsageCount()).isEqualTo(1);
        assertThat(scores.get(piece.getId()).getScore()).isEqualByComparingTo("80");
        verify(events).publishEvent(any(DomainEvents.CouponRightsCheck.class));
        assertThat(items(offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12)).get(0)).containsEntry("canRequest",false);
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOfSatisfying(ApiException.class,e -> assertThat(e.status()).isEqualTo(409));
    }

    @Test void somenteAutorPodeSolicitarMesmoQuandoEntidadeEPublica() {
        Seal seal = campaign(SealTier.PECA); User other = user("outra",ProfileType.PESSOAL);
        assertThatThrownBy(() -> offers.request(session(other),HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOfSatisfying(ApiException.class,e -> assertThat(e.status()).isEqualTo(403));
        assertThat(allBonds).isEmpty();
    }

    @Test void metricasAntigasAusentesInsuficientesOuDeOutraVersaoNuncaEmitem() {
        Seal seal = campaign(SealTier.PECA);
        for (int scenario=0;scenario<4;scenario++) {
            var row = score(piece.getId(),80);
            if (scenario==0) row.setCalculatedAt(Instant.now().minus(30,ChronoUnit.DAYS));
            if (scenario==1) scores.clear();
            if (scenario==2) row.setStatus(HypeStatus.INSUFFICIENT_DATA);
            if (scenario==3) row.setAlgorithmVersion("HYPE_FORJADO");
            assertThat(items(offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12)).get(0)).containsEntry("eligible",false).containsEntry("canRequest",false);
            assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOf(ApiException.class);
        }
        assertThat(allBonds).isEmpty();
    }

    @Test void pedidoRevalidaDimensaoEMarcaEmVezDeConfiarNaOfertaAnterior() {
        Seal seal = campaign(SealTier.PECA);
        assertThat(items(offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12)).get(0)).containsEntry("canRequest",true);
        scores.get(piece.getId()).getDimensions().setEngagement(BigDecimal.valueOf(69));
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOf(ApiException.class);
        scores.get(piece.getId()).getDimensions().setEngagement(BigDecimal.valueOf(90)); piece.setBrandName("Adidas");
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOf(ApiException.class);
        assertThat(allBonds).isEmpty();
    }

    @Test void emissorDesaprovadoAposOfertaNaoConcedeSelo() {
        Seal seal = campaign(SealTier.PECA); offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12);
        brand.setApprovalStatus(ApprovalStatus.RECUSADO);
        assertThat(items(offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12))).isEmpty();
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOf(ApiException.class);
    }

    @Test void bloqueioEntreAutorEEmissorImpedeOfertaEPedido() {
        Seal seal = campaign(SealTier.PECA);
        Follow block = new Follow(); block.setStatus(FollowStatus.BLOQUEADO);
        when(follows.findByFollowerIdAndFollowingId(author.getId(),issuer.getId())).thenReturn(Optional.of(block));
        assertThat(items(offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12))).isEmpty();
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null))
                .isInstanceOfSatisfying(ApiException.class,e -> assertThat(e.status()).isEqualTo(404));
    }

    @Test void cotaOuJanelaEsgotadaDepoisDaOfertaImpedeEmissao() {
        Seal seal = campaign(SealTier.PECA);
        assertThat(items(offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12))).hasSize(1);
        seal.setUsageLimit(1); seal.setUsageCount(1);
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null))
                .isInstanceOfSatisfying(ApiException.class,e -> assertThat(e.status()).isEqualTo(409));
        seal.setUsageCount(0); seal.setAvailableUntil(Instant.now().minusSeconds(1));
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOf(ApiException.class);
        assertThat(allBonds).isEmpty();
    }

    @Test void excluirPecaRevogaVinculoDireto() {
        Seal seal = campaign(SealTier.PECA);
        offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null);
        seals.onPieceDeleted(new DomainEvents.PieceDeleted(author.getId(),piece.getId()));
        assertThat(allBonds.get(0).getStatus()).isEqualTo(SealBondStatus.REVOKED);
        assertThat(allBonds.get(0).getReviewNote()).isEqualTo("Peça excluída pelo autor.");
    }

    @Test void pedidoExigeEmailConfirmadoEContaAtiva() {
        Seal seal = campaign(SealTier.PECA);
        for (CurrentUser invalid : List.of(new CurrentUser(author.getId(),"ana","USER",ProfileType.PESSOAL,false,AccountStatus.ACTIVE,null,null),
                new CurrentUser(author.getId(),"ana","USER",ProfileType.PESSOAL,true,AccountStatus.PENDING_VALIDATION,null,null))) {
            assertThatThrownBy(() -> offers.request(invalid,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOf(ApiException.class);
        }
        assertThat(allBonds).isEmpty();
    }

    @Test void celebridadeExigeConsentimentoERevisaoRevalidaMetricas() {
        issuer.setProfileType(ProfileType.CELEBRIDADE);
        CelebrityProfile celeb = new CelebrityProfile(); celeb.setOwner(issuer); celeb.setStageName("Estrela"); celeb.setSlug("estrela"); celeb.setVerificationStatus(ApprovalStatus.APROVADO); celeb.setSealConsentGranted(true);
        when(celebrities.findByOwnerId(issuer.getId())).thenReturn(Optional.of(celeb));
        Seal seal = campaign(SealTier.PECA);
        assertThat(items(offers.offers(session,HypeEntityType.PIECE,piece.getId(),0,12)).get(0)).containsEntry("requiredImageRightsConsent",true).containsEntry("requiresReview",true);
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),false)).isInstanceOf(ApiException.class);
        assertThat(offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),true)).containsEntry("status",SealBondStatus.PENDING_REVIEW);
        scores.get(piece.getId()).setScore(BigDecimal.valueOf(30));
        assertThatThrownBy(() -> seals.review(session(issuer),allBonds.get(0).getId(),true,null)).isInstanceOf(ApiException.class);
        assertThat(allBonds.get(0).getStatus()).isEqualTo(SealBondStatus.PENDING_REVIEW);
        assertThat(seal.getUsageCount()).isZero();
    }

    @Test void campanhaLookUsaScoreDoLookNaoDaPeca() {
        Seal seal = campaign(SealTier.LOOK); scores.get(piece.getId()).setScore(BigDecimal.valueOf(20));
        assertThat(offers.request(session,HypeEntityType.SCHEME,scheme.getId(),seal.getId(),null)).containsEntry("status",SealBondStatus.APPROVED).containsEntry("schemeId",scheme.getId()).containsEntry("pieceId",null);
    }

    @Test void modalidadeDeReferenciaOuTierDiferenteNaoAceitaAtribuicaoPorHype() {
        Seal seal = campaign(SealTier.LOOK);
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOf(ApiException.class);
        seal.setTier(SealTier.PECA); seal.setBackgroundConfigJson(Json.write(Map.of("policy",Map.of("hype",Map.of("minScore",60)))));
        assertThatThrownBy(() -> offers.request(session,HypeEntityType.PIECE,piece.getId(),seal.getId(),null)).isInstanceOf(ApiException.class);
    }
}
