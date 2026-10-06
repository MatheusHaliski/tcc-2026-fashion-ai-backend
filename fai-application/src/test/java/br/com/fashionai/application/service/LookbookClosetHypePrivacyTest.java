package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
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

/**
 * P2-11 (docs/hype/HYPE_AUDITORIA_ABAS.md, Lote A4) — Lookbook › Peças: GET /api/users/{id}/closet com {@code sort} e
 * {@code hypeLevel}. Quem visita (seguidor ou visitante sem conta) só ordena e filtra pelo Hype PÚBLICO
 * ({@code publicEligible}); o score pessoal de uma peça só para seguidores, de uma conta fora da régua pública ou privada
 * nunca muda a posição nem passa no filtro ("—", por último). O dono ordena pelo próprio Hype pessoal.
 */
class LookbookClosetHypePrivacyTest {
    private WardrobeService wardrobe;
    private CurrentUser ana;
    private CurrentUser bia;
    private UUID anaId;

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

    private static HypeScoreCurrent hype(WardrobeItem w, double score, HypeLevel level, boolean publicEligible, Double delta) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(w.getId());
        c.setOwnerId(w.getUser().getId());
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(level);
        c.setMomentum(HypeMomentum.STABLE);
        c.setPublicEligible(publicEligible);
        c.setDeltaPoints(delta == null ? null : BigDecimal.valueOf(delta));
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
        anaId = owner.getId();
        UUID biaId = UUID.randomUUID();
        ana = new CurrentUser(anaId, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        bia = new CurrentUser(biaId, "bia", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);

        // ordem do repositório (mais recentes primeiro): as peças com score NÃO público vêm antes, com os maiores números
        // e o maior crescimento — se a guarda falhar, elas pulam para o topo e o teste quebra
        WardrobeItem followers95 = piece(owner, "B seguidores 95", Visibility.FOLLOWERS);
        WardrobeItem notEligible99 = piece(owner, "C pública fora da régua 99", Visibility.PUBLIC);
        WardrobeItem private97 = piece(owner, "F privada 97", Visibility.PRIVATE);
        WardrobeItem pub50 = piece(owner, "A pública 50", Visibility.PUBLIC);
        WardrobeItem noHype = piece(owner, "E sem Hype", Visibility.PUBLIC);
        WardrobeItem pub80 = piece(owner, "D pública 80", Visibility.PUBLIC);
        WardrobeItem rounds = piece(owner, "G pública 59,6", Visibility.PUBLIC);
        WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
        when(pieces.findByUserIdOrderByCreatedAtDesc(anaId)).thenReturn(List.of(followers95, notEligible99, private97, pub50, noHype, pub80, rounds));

        HypeScoreCurrentRepository hypeRepo = mock(HypeScoreCurrentRepository.class);
        when(hypeRepo.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION))).thenReturn(List.of(
                hype(followers95, 95, HypeLevel.VIRAL, false, 30.0),       // só para seguidores: Hype pessoal
                hype(notEligible99, 99, HypeLevel.VIRAL, false, 40.0),     // pública, mas fora da régua (ex.: conta em modo de teste)
                hype(private97, 97, HypeLevel.VIRAL, false, 25.0),
                hype(pub50, 50, HypeLevel.RELEVANT, true, 2.0),
                hype(pub80, 80, HypeLevel.TRENDING, true, 10.0),
                hype(rounds, 59.6, HypeLevel.HOT, true, 0.0)));          // aparece como 60: já é "Em alta"

        // Bia segue a Ana (vê as peças "só para seguidores")
        Follow follow = new Follow();
        follow.setStatus(FollowStatus.ACEITO);
        FollowRepository follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        when(follows.findByFollowerIdAndFollowingId(biaId, anaId)).thenReturn(Optional.of(follow));
        Guard guard = new Guard(e -> {
        }, follows);
        wardrobe = new WardrobeService(pieces, mock(UserRepository.class), null, null, null, null, null, null, null,
                mock(ReactionRepository.class), mock(SavedItemRepository.class), null, null, null, null, null, null, null, null, null, null,
                guard, null, null, null, null, null, null, hypeRepo, HypeScoreConfig.defaults());
    }

    private List<String> names(CurrentUser viewer, String sort, String hypeLevel) {
        WardrobeService.ClosetFilter f = new WardrobeService.ClosetFilter(null, null, null, null, null, null, null, sort, 0, 30, hypeLevel);
        Views.Page<Views.PieceView> page = wardrobe.closet(viewer, anaId, f);
        assertThat(page.total()).isEqualTo(page.items().size());
        return new ArrayList<>(page.items().stream().map(Views.PieceView::name).toList());
    }

    @Test
    void seguidorOrdenaSoPeloHypePublico() {
        // "B seguidores 95" e "C … 99" aparecem (são visíveis), mas sem Hype público: "—", por último, na ordem de sempre
        assertThat(names(bia, "hype_desc", null)).containsExactly(
                "D pública 80", "G pública 59,6", "A pública 50", "B seguidores 95", "C pública fora da régua 99", "E sem Hype");
        // menor Hype primeiro: sem Hype público continua por último (nunca vale 0)
        assertThat(names(bia, "hype_asc", null)).containsExactly(
                "A pública 50", "G pública 59,6", "D pública 80", "B seguidores 95", "C pública fora da régua 99", "E sem Hype");
        // crescimento: o +30/+40 pessoal não conta
        assertThat(names(bia, "growth", null)).containsExactly(
                "D pública 80", "A pública 50", "G pública 59,6", "B seguidores 95", "C pública fora da régua 99", "E sem Hype");
    }

    @Test
    void filtroPorFaixaUsaSoOHypePublicoEOArredondamentoExibido() {
        // 59,6 aparece como 60 (Em alta) e passa; 95 e 99 pessoais nunca passam no filtro de quem visita
        assertThat(names(bia, "hype_desc", "HOT")).containsExactly("D pública 80", "G pública 59,6");
        assertThat(names(bia, "hype_desc", "TRENDING")).containsExactly("D pública 80");
        assertThat(names(bia, "hype_desc", "VIRAL")).isEmpty();
        assertThat(names(bia, "hype_desc", "RELEVANT")).containsExactly("D pública 80", "G pública 59,6", "A pública 50");
    }

    @Test
    void visitanteSemContaNemVeAsDeSeguidoresENemOrdenaPeloScorePessoal() {
        assertThat(names(null, "hype_desc", null)).containsExactly(
                "D pública 80", "G pública 59,6", "A pública 50", "C pública fora da régua 99", "E sem Hype");
        assertThat(names(null, "hype_desc", "VIRAL")).isEmpty();
    }

    @Test
    void donoOrdenaEFiltraPeloProprioHypePessoal() {
        assertThat(names(ana, "hype_desc", null)).containsExactly(
                "C pública fora da régua 99", "F privada 97", "B seguidores 95", "D pública 80", "G pública 59,6", "A pública 50", "E sem Hype");
        assertThat(names(ana, "hype_desc", "VIRAL")).containsExactly("C pública fora da régua 99", "F privada 97", "B seguidores 95");
        assertThat(names(ana, "growth", null).subList(0, 3)).containsExactly("C pública fora da régua 99", "B seguidores 95", "F privada 97");
    }
}
