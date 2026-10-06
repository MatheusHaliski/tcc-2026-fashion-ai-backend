package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ReactionType;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Interações (RF19): curtir e reagir (segundo clique desfaz), comentar com limite e moderação, salvar e favoritar,
 * compartilhar no feed ou fora do app (com o card PNG), remixar look, peça ou DNA e voltar ao look de origem da peça.
 */
class SocialServiceTest {
    private Kit kit;
    private World world;
    private SocialService social;
    private CurrentUser ana;
    private CurrentUser bia;
    private Scheme look;
    private WardrobeItem piece;
    private DnaScheme dna;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        SchemeService schemes = kit.dep(SchemeService.class);
        when(schemes.renderCard(any(), any(), anyBoolean())).thenReturn(new byte[]{1, 2});
        when(schemes.remix(any(), any())).thenReturn(Map.of("next", "/create-look"));
        social = kit.build(SocialService.class);
        ana = Kit.as(world.me);
        bia = Kit.as(world.rival);
        look = world.looksOf(world.rival).get(0);
        piece = world.piecesOf(world.rival).get(0);
        piece.setModerationStatus(ModerationStatus.APPROVED);
        dna = new DnaScheme();
        dna.setUser(world.rival);
        dna.setTitle("DNA da Bia");
        dna.setVisibility(Visibility.PUBLIC);
        kit.dep(DnaSchemeRepository.class).save(dna);
    }

    @Test
    void curtirEReagirComSegundoCliqueDesfazendo() {
        long likes = look.getLikeCount();
        assertThat(social.react(ana, TargetType.SCHEME, look.getId(), ReactionType.LIKE)).containsEntry("active", true).containsEntry("count", 1L);
        assertThat(look.getLikeCount()).isEqualTo(likes + 1);
        assertThat(social.react(ana, TargetType.SCHEME, look.getId(), ReactionType.LIKE)).containsEntry("active", false);
        assertThat(look.getLikeCount()).isEqualTo(likes);
        for (ReactionType r : ReactionType.values()) {
            social.react(ana, TargetType.PIECE, piece.getId(), r);
            assertThat(SocialService.label(r)).isNotBlank();
        }
        assertThat(piece.getLikesCount()).isEqualTo(1);
        social.react(ana, TargetType.DNA, dna.getId(), ReactionType.LIKE);
        assertThat(dna.getLikeCount()).isEqualTo(1);
        Map<String, Object> counters = social.counters(ana, TargetType.PIECE, piece.getId());
        assertThat(counters).containsEntry("LIKE", 1L).containsKeys("comments", "shares", "saves", "live");
    }

    @Test
    void pecaEmModeracaoSoParaADonaOuAdmin() {
        WardrobeItem pending = world.piecesOf(world.rival).get(1);
        assertThatThrownBy(() -> social.react(ana, TargetType.PIECE, pending.getId(), ReactionType.LIKE)).isInstanceOf(ApiException.class);
        assertThat(social.react(bia, TargetType.PIECE, pending.getId(), ReactionType.LIKE)).containsEntry("active", true);
        assertThat(social.react(Kit.admin(world.friend), TargetType.PIECE, pending.getId(), ReactionType.TREND)).containsEntry("active", true);
        assertThatThrownBy(() -> social.react(ana, TargetType.SCHEME, UUID.randomUUID(), ReactionType.LIKE)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> social.react(ana, TargetType.DNA, UUID.randomUUID(), ReactionType.LIKE)).isInstanceOf(ApiException.class);
    }

    @Test
    void comentarComLimiteEExcluirSoAutorOuDono() {
        Map<String, Object> c = social.comment(ana, TargetType.SCHEME, look.getId(), "Amei a combinação!", null);
        UUID id = (UUID) c.get("id");
        social.comment(bia, TargetType.SCHEME, look.getId(), "Obrigada!", id);
        assertThat(look.getCommentCount()).isEqualTo(4);   // 2 do mundo de teste + 2
        List<Map<String, Object>> list = social.comments(ana, TargetType.SCHEME, look.getId());
        assertThat(list).hasSize(2);
        assertThat(list.get(0)).containsEntry("canDelete", true);
        assertThatThrownBy(() -> social.comment(ana, TargetType.SCHEME, look.getId(), "  ", null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> social.comment(ana, TargetType.SCHEME, look.getId(), "a".repeat(SocialService.COMMENT_MAX + 1), null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> social.deleteComment(Kit.as(world.friend), id)).isInstanceOf(ApiException.class);
        social.deleteComment(bia, id);   // a dona do look pode excluir
        assertThat(social.comments(ana, TargetType.SCHEME, look.getId())).hasSize(1);
        assertThatThrownBy(() -> social.deleteComment(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        social.comment(ana, TargetType.PIECE, piece.getId(), "Onde comprou?", null);
        social.comment(ana, TargetType.DNA, dna.getId(), "Que história!", null);
        assertThat(piece.getCommentCount()).isEqualTo(1);
    }

    @Test
    void salvarFavoritarECompartilhar() {
        assertThat(social.toggleSave(ana, TargetType.SCHEME, look.getId())).containsEntry("saved", true);
        assertThat(social.favoriteSaved(ana, TargetType.SCHEME, look.getId(), true)).containsEntry("favorite", true);
        assertThat(social.favoriteSaved(ana, TargetType.SCHEME, look.getId(), false)).containsEntry("favorite", false);
        assertThat(social.toggleSave(ana, TargetType.SCHEME, look.getId())).containsEntry("saved", false);
        assertThatThrownBy(() -> social.favoriteSaved(ana, TargetType.SCHEME, look.getId(), true)).isInstanceOf(ApiException.class);
        social.toggleSave(ana, TargetType.PIECE, piece.getId());

        Map<String, Object> ext = social.share(ana, TargetType.SCHEME, look.getId(), ShareChannel.EXTERNAL, "Olha esse look");
        assertThat(String.valueOf(ext.get("imageUrl"))).endsWith(".png");
        assertThat(String.valueOf(ext.get("link"))).isEqualTo("/schemes/" + look.getId());
        Map<String, Object> pieceShare = social.share(ana, TargetType.PIECE, piece.getId(), ShareChannel.EXTERNAL, null);
        assertThat(pieceShare.get("imageUrl")).isEqualTo(piece.getImageUrl());
        assertThat(social.share(ana, TargetType.DNA, dna.getId(), ShareChannel.EXTERNAL, null).get("link")).isEqualTo("/dna-schemes/" + dna.getId());
        assertThat(social.share(ana, TargetType.SCHEME, look.getId(), ShareChannel.FEED, null)).containsKey("shareId");
        look.setDisponivel(false);
        assertThatThrownBy(() -> social.share(ana, TargetType.SCHEME, look.getId(), ShareChannel.FEED, null)).isInstanceOf(ApiException.class);
    }

    @Test
    void remixarEVoltarAoLookDeOrigem() {
        assertThat(social.remix(ana, TargetType.SCHEME, look.getId())).containsEntry("next", "/create-look");
        // peça de outra pessoa: entra no acervo de quem remixa como cópia, e a cópia é a semente do look
        WardrobeItem copy = Kit.piece(world.me, piece.getName(), piece.getCategory(), piece.getSubcategory(), piece.getColor());
        when(kit.dep(WardrobeService.class).addToWardrobe(any(), any())).thenReturn(br.com.fashionai.application.view.Views.piece(copy, null, null));
        Map<String, Object> p = social.remix(ana, TargetType.PIECE, piece.getId());
        assertThat(String.valueOf(p.get("next"))).contains(copy.getId().toString());
        assertThat(p.get("seedPieceId")).isEqualTo(copy.getId());
        assertThat(social.remix(bia, TargetType.PIECE, piece.getId())).containsKey("hint");
        assertThat(social.remix(ana, TargetType.DNA, dna.getId())).containsEntry("next", "/dna/new?remix=" + dna.getId());
        piece.setDisponivel(false);
        assertThatThrownBy(() -> social.remix(ana, TargetType.PIECE, piece.getId())).isInstanceOf(ApiException.class);
        assertThat(social.remix(bia, TargetType.PIECE, piece.getId())).containsKey("next");   // a dona remixa a própria peça
        assertThatThrownBy(() -> social.returnToOrigin(ana, piece.getId(), null)).isInstanceOf(ApiException.class);
        piece.setDisponivel(true);

        when(kit.dep(SchemeService.class).canView(any(), any())).thenReturn(true);
        Map<String, Object> origin = social.returnToOrigin(ana, piece.getId(), null);
        assertThat(origin).containsEntry("pieceId", piece.getId()).containsKey("otherSchemes");
        assertThatThrownBy(() -> social.returnToOrigin(ana, world.piece(world.rival, "hoodie").getId(), world.lookIds(world.rival).get(2)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> social.returnToOrigin(ana, UUID.randomUUID(), null)).isInstanceOf(ApiException.class);
    }
}
