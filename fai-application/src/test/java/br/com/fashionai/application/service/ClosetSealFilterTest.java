package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
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
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF53 — filtro "Com selo" do guarda-roupa: {@code seal=hype|brand|any} em GET /api/me/closet. */
class ClosetSealFilterTest {
    private WardrobeService wardrobe;
    private CurrentUser me;
    private WardrobeItem viral;
    private WardrobeItem branded;
    private WardrobeItem plain;
    private WardrobeItem privateViral;

    private static WardrobeItem piece(User owner, String name, Visibility visibility) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setName(name);
        w.setColor("black");
        w.setVisibility(visibility);
        w.setModerationStatus(ModerationStatus.APPROVED);
        return w;
    }

    private static HypeScoreCurrent hype(WardrobeItem w, double score, HypeLevel level, boolean publicEligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(w.getId());
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(level);
        c.setMomentum(HypeMomentum.STABLE);
        c.setPublicEligible(publicEligible);
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setCalculatedAt(Instant.now());
        return c;
    }

    @BeforeEach
    void setUp() {
        User owner = new User();
        owner.assignId(UUID.randomUUID());
        owner.setUsername("ana");
        owner.setProfileType(ProfileType.PESSOAL);
        owner.setStatus(AccountStatus.ACTIVE);
        owner.setProfileVisibility(Visibility.PUBLIC);
        User brand = new User();
        brand.assignId(UUID.randomUUID());
        brand.setUsername("nike");
        brand.setProfileType(ProfileType.MARCA);
        me = new CurrentUser(owner.getId(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);

        viral = piece(owner, "A viral", Visibility.PUBLIC);
        branded = piece(owner, "B com selo da marca", Visibility.PUBLIC);
        plain = piece(owner, "C sem selo", Visibility.PUBLIC);
        privateViral = piece(owner, "D privada", Visibility.PRIVATE);
        WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
        when(pieces.findByUserIdOrderByCreatedAtDesc(owner.getId())).thenReturn(List.of(viral, branded, plain, privateViral));

        HypeScoreCurrentRepository hypeRepo = mock(HypeScoreCurrentRepository.class);
        when(hypeRepo.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION))).thenReturn(List.of(
                hype(viral, 93, HypeLevel.VIRAL, true),
                hype(branded, 30, HypeLevel.NICHE, true),
                hype(privateViral, 95, HypeLevel.VIRAL, false)));   // peça privada: Hype estrutural, sem selo de Hype

        Scheme look = new Scheme();
        look.assignId(UUID.randomUUID());
        look.setUser(owner);
        look.setStatus(SchemeStatus.PUBLISHED);
        look.setVisibility(Visibility.PUBLIC);
        List<SchemeItem> items = new ArrayList<>();
        for (WardrobeItem w : List.of(branded, plain)) {
            SchemeItem si = new SchemeItem();
            si.setScheme(look);
            si.setWardrobeItem(w);
            items.add(si);
        }
        SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
        when(schemeItems.findByWardrobeItemIdIn(anyCollection())).thenReturn(items);
        SealBond pieceBond = new SealBond();
        pieceBond.assignId(UUID.randomUUID());
        pieceBond.setScheme(look);
        pieceBond.setTargetOwner(brand);
        pieceBond.setRequestedBy(owner);
        pieceBond.setTier(SealTier.PECA);
        pieceBond.setStatus(SealBondStatus.APPROVED);
        pieceBond.setLinkedPieceIdsJson(Json.write(List.of(branded.getId().toString())));
        SealBond lookBond = new SealBond();                        // tier LOOK: não conta como selo na peça
        lookBond.assignId(UUID.randomUUID());
        lookBond.setScheme(look);
        lookBond.setTargetOwner(brand);
        lookBond.setRequestedBy(owner);
        lookBond.setTier(SealTier.LOOK);
        lookBond.setStatus(SealBondStatus.APPROVED);
        lookBond.setLinkedPieceIdsJson(Json.write(List.of(branded.getId().toString(), plain.getId().toString())));
        SealBondRepository bonds = mock(SealBondRepository.class);
        when(bonds.findBySchemeIdInAndStatus(anyCollection(), eq(SealBondStatus.APPROVED))).thenReturn(List.of(pieceBond, lookBond));

        FollowRepository follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        Guard guard = new Guard(e -> {
        }, follows);
        wardrobe = new WardrobeService(pieces, mock(UserRepository.class), null, null, null, null, null, schemeItems, null,
                mock(ReactionRepository.class), mock(SavedItemRepository.class), null, null, null, null, null, null, null, null, null, null,
                guard, null, null, null, null, null, null, hypeRepo, HypeScoreConfig.defaults());
        wardrobe.setSealBonds(bonds);
    }

    private List<String> names(String seal) {
        WardrobeService.ClosetFilter f = new WardrobeService.ClosetFilter(null, null, null, null, null, null, null, "name", 0, 30, null, seal);
        Views.Page<Views.PieceView> page = wardrobe.closet(me, me.id(), f);
        return page.items().stream().map(Views.PieceView::name).toList();
    }

    @Test
    void filtraPorSeloDeHypeDeMarcaOuQualquer() {
        assertThat(names(null)).containsExactly("A viral", "B com selo da marca", "C sem selo", "D privada");
        assertThat(names("hype")).containsExactly("A viral");                       // privada não tem selo de Hype
        assertThat(names("brand")).containsExactly("B com selo da marca");          // só vínculo APROVADO de tier PEÇA
        assertThat(names("any")).containsExactly("A viral", "B com selo da marca");
        assertThat(names("desconhecido")).hasSize(4);                               // valor desconhecido não filtra
    }

    @Test
    void valoresAceitosDoFiltro() {
        assertThat(WardrobeService.sealFilter("HYPE")).isEqualTo("hype");
        assertThat(WardrobeService.sealFilter("marca")).isEqualTo("brand");
        assertThat(WardrobeService.sealFilter("qualquer")).isEqualTo("any");
        assertThat(WardrobeService.sealFilter(" ")).isNull();
    }
}
