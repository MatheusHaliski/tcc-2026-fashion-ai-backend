package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
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
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Política de exibição no perfil de marca/celebridade (RF14/RF22 × RF20/RF21/RF50): só aparece o que passou pela
 * política do selo (vínculo APPROVED), com destaque vigente, histórico de consagrados, peças cobertas pelo selo e
 * catálogo filtrado para o visitante.
 */
class InstitutionalDisplayPolicyTest {
    private final Instant now = Instant.now();
    private final List<SealBond> allBonds = new ArrayList<>();
    private final Map<UUID, List<SchemeItem>> itemsByScheme = new HashMap<>();
    private final Map<UUID, HypeScoreCurrent> hypeRows = new HashMap<>();
    private final List<WardrobeItem> brandCatalog = new ArrayList<>();
    private FollowRepository follows;
    private HypeQueryService hypeQuery;
    private BrandProfileRepository brandProfiles;
    private CelebrityProfileRepository celebrityProfiles;
    private InstitutionalService service;
    private SealService sealPolicies;
    private User brand;
    private User ana;
    private Seal seal;
    private WardrobeItem tenis;
    private WardrobeItem jeans;
    private WardrobeItem camiseta;
    private CurrentUser visitor;

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

    @Test
    void perfilAdicionaItensElegiveisSemInventarSelosConquistados() {
        Scheme look = look("Elegível", tenis);
        when(sealPolicies.hasProfilePolicies(brand.getId())).thenReturn(true);
        when(sealPolicies.profileSchemes(eq(brand.getId()), any(), eq(60))).thenReturn(List.of(look));
        when(sealPolicies.profilePieces(eq(brand.getId()), any(), eq(60))).thenReturn(List.of(tenis));
        List<Map<String, Object>> looks = service.highlightedSchemes(visitor, brand, null, null);
        assertThat(ids(looks)).containsExactly(look.getId());
        assertThat(looks.get(0).get("seals")).isEqualTo(List.of());
        assertThat(service.highlightedPieces(visitor, brand, "RECENTES", null))
                .extracting(e -> ((Views.PieceView) e.get("piece")).id()).containsExactly(tenis.getId());
        assertThat(allBonds).isEmpty();
    }

    @Test
    void perfilComPoliticaAtivaFiltraDestaquesAntigosQueNaoAtendemMais() {
        Scheme old = look("Antigo", jeans); approved(old);
        when(sealPolicies.hasProfilePolicies(brand.getId())).thenReturn(true);
        assertThat(service.highlightedSchemes(visitor, brand, null, null)).isEmpty();
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
    }

    // ------------------------------------------------------------------ fixtures

    private static User user(String username, ProfileType type) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(username);
        u.setProfileType(type);
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileVisibility(Visibility.PUBLIC);
        return u;
    }

    private static WardrobeItem piece(User owner, String name) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setName(name);
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

    private SealBond bond(Scheme s, SealBondStatus status, SealTier tier, Instant issuedAt, Instant expiresAt, WardrobeItem... linked) {
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

    private SealBond approved(Scheme s) {
        return bond(s, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(2, ChronoUnit.DAYS), now.plus(30, ChronoUnit.DAYS));
    }

    private HypeScoreCurrent hype(Scheme s, double score) {
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
    private HypeScoreCurrent hype(Scheme s, double score, double trend, double delta) {
        HypeScoreCurrent c = hype(s, score);
        br.com.fashionai.domain.model.HypeDimensions d = new br.com.fashionai.domain.model.HypeDimensions();
        d.setTrend(BigDecimal.valueOf(trend));
        c.setDimensions(d);
        c.setDeltaPoints(BigDecimal.valueOf(delta));
        return c;
    }

    private List<UUID> ids(List<Map<String, Object>> entries) {
        return entries.stream().map(e -> ((Views.SchemeView) e.get("scheme")).id()).toList();
    }

    private List<UUID> destaque(CurrentUser viewer) {
        return ids(service.highlightedSchemes(viewer, brand, null, null));
    }

    private List<UUID> consagrados(CurrentUser viewer) {
        return ids(service.consecrated(viewer, brand, null, null, false));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> promotion(Map<String, Object> entry) {
        return (Map<String, Object>) entry.get("promotion");
    }

    // ------------------------------------------------------------------ looks

    @Test
    void lookPromovidoPorPoliticaAceitaApareceEmDestaqueEConsagrados() {
        Scheme s = look("Clube", tenis, jeans);
        approved(s);
        assertThat(destaque(null)).containsExactly(s.getId());
        assertThat(destaque(visitor)).containsExactly(s.getId());
        assertThat(consagrados(visitor)).containsExactly(s.getId());
        Map<String, Object> e = service.highlightedSchemes(visitor, brand, null, null).get(0);
        assertThat(promotion(e)).containsEntry("expired", false).containsEntry("revalidationPending", false);
        assertThat(promotion(e).get("issuedAt")).isNotNull();
        assertThat((List<?>) e.get("seals")).hasSize(1);
    }

    @Test
    void vinculoQueNaoFoiAprovadoNuncaApareceNoPerfil() {
        for (SealBondStatus st : List.of(SealBondStatus.SUGGESTED, SealBondStatus.ACCEPTED, SealBondStatus.EDITED, SealBondStatus.PENDING_REVIEW,
                SealBondStatus.REFUSED, SealBondStatus.REJECTED, SealBondStatus.REVOKED)) {
            bond(look("Look " + st, tenis), st, SealTier.LOOK, null, null);
        }
        assertThat(destaque(visitor)).isEmpty();
        assertThat(consagrados(visitor)).isEmpty();
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
    }

    @Test
    void seloExpiradoSaiDoDestaqueMasFicaNoHistoricoDeConsagrados() {
        Scheme s = look("Verão passado", tenis);
        bond(s, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(400, ChronoUnit.DAYS), now.minus(1, ChronoUnit.DAYS));
        assertThat(destaque(visitor)).isEmpty();
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
        List<Map<String, Object>> hall = service.consecrated(visitor, brand, null, null, false);
        assertThat(ids(hall)).containsExactly(s.getId());
        assertThat(promotion(hall.get(0))).containsEntry("expired", true);
    }

    @Test
    void lookComUmVinculoExpiradoEOutroVigenteApareceUmaVezComOVigente() {
        Scheme s = look("Renovado", tenis);
        bond(s, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(400, ChronoUnit.DAYS), now.minus(10, ChronoUnit.DAYS));
        SealBond vigente = approved(s);
        List<Map<String, Object>> list = service.highlightedSchemes(visitor, brand, null, null);
        assertThat(ids(list)).containsExactly(s.getId());
        assertThat((List<?>) list.get(0).get("seals")).hasSize(1);
        assertThat(promotion(list.get(0)).get("expiresAt")).isEqualTo(vigente.getExpiresAt());
    }

    @Test
    void revalidacaoPendenteTiraDoDestaqueEMarcaNosConsagrados() {
        Scheme s = look("Editado", tenis, jeans);
        approved(s);
        s.setRevalidationPending(true);
        assertThat(destaque(visitor)).isEmpty();
        List<Map<String, Object>> hall = service.consecrated(visitor, brand, null, null, false);
        assertThat(ids(hall)).containsExactly(s.getId());
        assertThat(promotion(hall.get(0))).containsEntry("revalidationPending", true).containsEntry("expired", false);
    }

    @Test
    void lookPrivadoRascunhoOuArquivadoNaoAparece() {
        Scheme privado = look("Privado", tenis);
        privado.setVisibility(Visibility.PRIVATE);
        Scheme rascunho = look("Rascunho", tenis);
        rascunho.setStatus(SchemeStatus.DRAFT);
        Scheme arquivado = look("Arquivado", tenis);
        arquivado.setStatus(SchemeStatus.ARCHIVED);
        approved(privado);
        approved(rascunho);
        approved(arquivado);
        assertThat(destaque(visitor)).isEmpty();
        assertThat(consagrados(visitor)).isEmpty();
    }

    @Test
    void perfilPrivadoDoAutorEscondeOLookPublico() {
        Scheme s = look("Público em perfil privado", tenis);
        approved(s);
        ana.setProfileVisibility(Visibility.PRIVATE);
        assertThat(destaque(visitor)).isEmpty();
        assertThat(destaque(null)).isEmpty();
    }

    @Test
    void lookSoParaSeguidoresApareceSoParaQuemSegue() {
        Scheme s = look("Seguidores", tenis);
        s.setVisibility(Visibility.FOLLOWERS);
        approved(s);
        assertThat(destaque(null)).isEmpty();
        assertThat(destaque(visitor)).isEmpty();
        Follow f = new Follow();
        f.setStatus(FollowStatus.ACEITO);
        when(follows.findByFollowerIdAndFollowingId(visitor.id(), ana.getId())).thenReturn(Optional.of(f));
        assertThat(destaque(visitor)).containsExactly(s.getId());
    }

    @Test
    void bloqueioEntreVisitanteEAutorEscondeOLook() {
        Scheme s = look("Bloqueado", tenis);
        approved(s);
        Follow block = new Follow();
        block.setStatus(FollowStatus.BLOQUEADO);
        when(follows.findByFollowerIdAndFollowingId(ana.getId(), visitor.id())).thenReturn(Optional.of(block));
        assertThat(destaque(visitor)).isEmpty();
        assertThat(destaque(null)).containsExactly(s.getId());
    }

    @Test
    void autorSuspensoOuEmExclusaoSomeDoPerfil() {
        Scheme s = look("Autor suspenso", tenis);
        approved(s);
        ana.setStatus(AccountStatus.SUSPENDED);
        assertThat(destaque(visitor)).isEmpty();
        ana.setStatus(AccountStatus.DELETION_SCHEDULED);
        assertThat(consagrados(visitor)).isEmpty();
        ana.setStatus(AccountStatus.ACTIVE);
        assertThat(destaque(visitor)).containsExactly(s.getId());
    }

    @Test
    void destaqueOrdenaPeloHypeV2EDepoisPelaEmissaoMaisRecente() {
        Scheme frio = look("Frio", tenis);
        Scheme quente = look("Quente", jeans);
        Scheme semScoreNovo = look("Sem score, novo", camiseta);
        Scheme semScoreAntigo = look("Sem score, antigo", camiseta);
        bond(frio, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(1, ChronoUnit.DAYS), null);
        bond(quente, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(9, ChronoUnit.DAYS), null);
        bond(semScoreNovo, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(2, ChronoUnit.DAYS), null);
        bond(semScoreAntigo, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(20, ChronoUnit.DAYS), null);
        hype(frio, 31);
        hype(quente, 88);
        assertThat(destaque(visitor)).containsExactly(quente.getId(), frio.getId(), semScoreNovo.getId(), semScoreAntigo.getId());
        // consagrados: histórico pela emissão mais recente
        assertThat(consagrados(visitor)).containsExactly(frio.getId(), semScoreNovo.getId(), quente.getId(), semScoreAntigo.getId());
    }

    @Test
    void filtroDestaquesUsaOHypeV2ESoLooksComScore() {
        Scheme a = look("A", tenis);
        Scheme b = look("B", jeans);
        Scheme c = look("C", camiseta);
        approved(a);
        approved(b);
        approved(c);
        hype(a, 40);
        hype(b, 75);
        HypeScoreCurrent insuficiente = new HypeScoreCurrent();
        insuficiente.setStatus(HypeStatus.INSUFFICIENT_DATA);
        hypeRows.put(c.getId(), insuficiente);
        assertThat(ids(service.highlightedSchemes(visitor, brand, "DESTAQUES", null))).containsExactly(b.getId(), a.getId());
    }

    @Test
    void hypeQueNaoEhPublicoNaoOrdenaODestaqueDeTerceiros() {
        Scheme seguidores = look("Só seguidores (Hype pessoal)", tenis);
        Scheme publico = look("Público", jeans);
        bond(seguidores, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(1, ChronoUnit.DAYS), null);
        bond(publico, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(5, ChronoUnit.DAYS), null);
        hype(seguidores, 95).setPublicEligible(false);
        hype(publico, 40);
        assertThat(destaque(visitor)).containsExactly(publico.getId(), seguidores.getId());   // o 95 pessoal não conta: vai para o fim
        assertThat(ids(service.highlightedSchemes(visitor, brand, "DESTAQUES", null))).containsExactly(publico.getId());
    }

    // ------------------------------------------------------------------ ordenação das abas de destaque (Lote A2 · P3-17)

    @Test
    void ordenacaoRecentesHypeEEmCrescimentoSoMudaAOrdemNuncaQuemAparece() {
        Scheme classico = look("Clássico (Hype alto, parado)", tenis);
        Scheme subindo = look("Subindo (Hype médio, trend alto)", jeans);
        Scheme semHype = look("Sem Hype", camiseta);
        Scheme pessoal = look("Hype só pessoal", camiseta);
        bond(classico, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(9, ChronoUnit.DAYS), null);
        bond(subindo, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(5, ChronoUnit.DAYS), null);
        bond(semHype, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(1, ChronoUnit.DAYS), null);
        bond(pessoal, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(3, ChronoUnit.DAYS), null);
        hype(classico, 88, 35, -1);
        hype(subindo, 61, 82, 9);
        hype(pessoal, 99, 99, 20).setPublicEligible(false);
        bond(look("Rejeitado", tenis), SealBondStatus.REJECTED, SealTier.LOOK, now, null);   // a política continua valendo

        assertThat(ids(service.highlightedSchemes(visitor, brand, "RECENTES", null)))
                .containsExactly(semHype.getId(), pessoal.getId(), subindo.getId(), classico.getId());
        assertThat(ids(service.highlightedSchemes(visitor, brand, "HYPE", null)))
                .containsExactly(classico.getId(), subindo.getId(), semHype.getId(), pessoal.getId());
        // crescimento = TREND do v2, não volume: o look médio que está subindo passa o clássico parado; sem Hype público no fim
        assertThat(ids(service.highlightedSchemes(visitor, brand, "GROWTH", null)))
                .containsExactly(subindo.getId(), classico.getId(), semHype.getId(), pessoal.getId());
        // consagrados (histórico) e peças em destaque aceitam a mesma ordenação
        assertThat(ids(service.consecrated(visitor, brand, "GROWTH", null, false))).startsWith(subindo.getId(), classico.getId());
        assertThat(service.highlightedPieces(visitor, brand, "GROWTH", null)).extracting(m -> ((Views.PieceView) m.get("piece")).id())
                .startsWith(jeans.getId(), tenis.getId());
    }

    @Test
    void empateNoCrescimentoDecidePeloDelta() {
        Scheme a = look("A", tenis);
        Scheme b = look("B", jeans);
        approved(a);
        approved(b);
        hype(a, 50, 70, 1);
        hype(b, 50, 70, 6);
        assertThat(ids(service.highlightedSchemes(visitor, brand, "growth", null))).containsExactly(b.getId(), a.getId());
    }

    // ------------------------------------------------------------------ /brands: ordem "Em alta" (Lote A2 · P2-05)

    private static br.com.fashionai.domain.model.BrandProfile brandProfile(String name) {
        br.com.fashionai.domain.model.BrandProfile b = new br.com.fashionai.domain.model.BrandProfile();
        b.setOwner(user(name.toLowerCase(), ProfileType.MARCA));
        b.setBrandName(name);
        b.setSlug(name.toLowerCase());
        return b;
    }

    @Test
    @SuppressWarnings("unchecked")
    void feedDeMarcasEmAltaOrdenaPeloHypeAgregadoESemBaseFicaNoFim() {
        var nova = brandProfile("Nova");
        var media = brandProfile("Media");
        var topo = brandProfile("Topo");
        var pouca = brandProfile("Pouca");
        when(brandProfiles.findByApprovalStatusOrderByCreatedAtDesc(any())).thenReturn(List.of(nova, media, topo, pouca));
        Map<String, Object> groups = new HashMap<>();
        groups.put("media", Map.of("key", "media", "sufficient", true, "value", 55.0, "level", "RELEVANT", "items", 4));
        groups.put("topo", Map.of("key", "topo", "sufficient", true, "value", 81.0, "level", "TRENDING", "items", 6));
        groups.put("pouca", Map.of("key", "pouca", "sufficient", false, "items", 2));
        when(hypeQuery.groups(any(), eq(HypeQueryService.RankGroup.BRAND), anyCollection(), eq(7))).thenReturn(Map.of("items", groups));

        Map<String, Object> out = service.brandFeed(null, null, "EM_ALTA");
        List<Map<String, Object>> cards = (List<Map<String, Object>>) out.get("brands");
        assertThat(cards).extracting(m -> m.get("name")).containsExactly("Topo", "Media", "Nova", "Pouca");   // sem base: ordem recente
        assertThat(out.get("order")).isEqualTo("EM_ALTA");
        assertThat((List<String>) out.get("orders")).contains("AFINIDADE", "RECENTES", "EM_ALTA");
        assertThat(cards.get(0).get("hype")).isEqualTo(groups.get("topo"));
        assertThat(cards.get(2).get("hype")).isNull();                                        // sem dado: nada (nunca 0)
        // as outras ordens não mudam, mas o card também traz o Hype
        List<Map<String, Object>> recent = (List<Map<String, Object>>) service.brandFeed(null, null, "RECENTES").get("brands");
        assertThat(recent).extracting(m -> m.get("name")).containsExactly("Nova", "Media", "Topo", "Pouca");
        assertThat(recent.get(1).get("hype")).isEqualTo(groups.get("media"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void feedDeCelebridadesUsaOAgregadoDeCriadorPeloIdDaPessoa() {
        var c1 = new br.com.fashionai.domain.model.CelebrityProfile();
        c1.setOwner(ana);
        c1.setStageName("Ana Star");
        c1.setSlug("ana-star");
        when(celebrityProfiles.findByVerificationStatusOrderByCreatedAtDesc(any())).thenReturn(List.of(c1));
        when(hypeQuery.groups(any(), eq(HypeQueryService.RankGroup.CREATOR), anyCollection(), eq(7)))
                .thenReturn(Map.of("items", Map.of(ana.getId().toString(), Map.of("sufficient", true, "value", 77.0, "level", "TRENDING"))));
        List<Map<String, Object>> cards = (List<Map<String, Object>>) service.celebrityFeed(visitor, null, "EM_ALTA").get("celebrities");
        assertThat(cards).singleElement().satisfies(m -> assertThat((Map<String, Object>) m.get("hype")).containsEntry("level", "TRENDING"));
    }

    // ------------------------------------------------------------------ peças em destaque

    @SuppressWarnings("unchecked")
    private Map<UUID, Integer> sealsPerPiece(List<Map<String, Object>> entries) {
        Map<UUID, Integer> out = new java.util.LinkedHashMap<>();
        for (Map<String, Object> e : entries) {
            out.put(((Views.PieceView) e.get("piece")).id(), ((List<Map<String, Object>>) e.get("seals")).size());
        }
        return out;
    }

    @Test
    void seloDePecaDestacaSoAsPecasVinculadas() {
        Scheme s = look("Tênis em destaque", tenis, jeans, camiseta);
        bond(s, SealBondStatus.APPROVED, SealTier.PECA, now.minus(1, ChronoUnit.DAYS), null, tenis);
        Map<UUID, Integer> got = sealsPerPiece(service.highlightedPieces(visitor, brand, null, null));
        assertThat(got).containsOnlyKeys(tenis.getId());
    }

    @Test
    void seloDeLookDestacaTodasAsPecasECadaPecaLevaSoOsSelosQueACobrem() {
        Scheme a = look("Look inteiro", tenis, jeans);
        Scheme b = look("Só o tênis", tenis, camiseta);
        approved(a);
        bond(b, SealBondStatus.APPROVED, SealTier.PECA, now.minus(1, ChronoUnit.DAYS), null, tenis);
        Map<UUID, Integer> got = sealsPerPiece(service.highlightedPieces(visitor, brand, null, null));
        assertThat(got).containsOnlyKeys(tenis.getId(), jeans.getId());
        assertThat(got.get(tenis.getId())).isEqualTo(2);     // selo do look A + selo de peça do look B
        assertThat(got.get(jeans.getId())).isEqualTo(1);
    }

    @Test
    void pecaPrivadaEmModeracaoOuArquivadaNaoApareceMesmoEmLookPublico() {
        Scheme s = look("Look público", tenis, jeans, camiseta);
        approved(s);
        jeans.setVisibility(Visibility.PRIVATE);
        camiseta.setModerationStatus(ModerationStatus.PENDING);
        tenis.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
        assertThat(destaque(visitor)).containsExactly(s.getId());      // o look continua; as peças não
    }

    @Test
    void pecasDoLegadoHighlightedSeguemAMesmaPolitica() {
        Scheme s = look("Legado", tenis, jeans);
        bond(s, SealBondStatus.APPROVED, SealTier.PECA, now.minus(1, ChronoUnit.DAYS), null, jeans);
        Map<String, Object> both = service.highlighted(visitor, brand, null, null);
        assertThat((List<?>) both.get("schemes")).hasSize(1);
        assertThat(sealsPerPiece(castList(both.get("pieces")))).containsOnlyKeys(jeans.getId());
        assertThat(both.get("empty")).isNull();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> castList(Object o) {
        return (List<Map<String, Object>>) o;
    }

    // ------------------------------------------------------------------ catálogo

    @Test
    void catalogoDoVisitanteSoMostraPecasAprovadasEVisiveisOAdministradorVeTudo() {
        WardrobeItem publica = piece(brand, "Pública");
        WardrobeItem privada = piece(brand, "Privada");
        privada.setVisibility(Visibility.PRIVATE);
        WardrobeItem moderacao = piece(brand, "Em moderação");
        moderacao.setModerationStatus(ModerationStatus.PENDING);
        WardrobeItem arquivada = piece(brand, "Arquivada");
        arquivada.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        brandCatalog.addAll(List.of(publica, privada, moderacao, arquivada));
        CurrentUser admin = new CurrentUser(brand.getId(), "maison", "USER", ProfileType.MARCA, true, AccountStatus.ACTIVE, null, null);
        assertThat(service.catalog(visitor, brand, null, false)).extracting(m -> ((Views.PieceView) m.get("piece")).id()).containsExactly(publica.getId());
        assertThat(service.catalog(null, brand, null, false)).hasSize(1);
        assertThat(service.catalog(admin, brand, null, true)).extracting(m -> ((Views.PieceView) m.get("piece")).id())
                .containsExactly(publica.getId(), privada.getId(), moderacao.getId());
    }
}
