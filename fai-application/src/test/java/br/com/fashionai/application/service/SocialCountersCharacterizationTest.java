package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.CounterStorePort;
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

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caracterização (lote 07) dos contadores persistidos que o {@link SocialService} mantém em look, peça e DNA:
 * qual campo cada interação move por tipo de alvo, piso em zero (nunca contagem negativa) e o espelho no
 * {@link CounterStorePort} (mesmo campo e delta, inclusive quando a entidade não tem aquele contador).
 */
class SocialCountersCharacterizationTest {
    private Kit kit;
    private SocialService social;
    private CounterStorePort store;
    private CurrentUser ana;
    private CurrentUser bia;
    private Scheme look;
    private WardrobeItem piece;
    private DnaScheme dna;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        World world = new World(kit);
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        SchemeService schemes = kit.dep(SchemeService.class);
        when(schemes.renderCard(any(), any(), anyBoolean())).thenReturn(new byte[]{1, 2});
        when(schemes.remix(any(), any())).thenReturn(Map.of("next", "/create-look"));
        social = kit.build(SocialService.class);
        store = kit.dep(CounterStorePort.class);
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
    void lookMoveCadaContadorEEspelhaNoStore() {
        long likes = look.getLikeCount(), comments = look.getCommentCount(), shares = look.getShareCount();
        long saves = look.getSaveCount(), remixes = look.getRemixCount();
        social.react(ana, TargetType.SCHEME, look.getId(), ReactionType.LIKE);
        social.react(ana, TargetType.SCHEME, look.getId(), ReactionType.TREND);   // reação qualitativa não move "likes"
        social.comment(ana, TargetType.SCHEME, look.getId(), "Lindo", null);
        social.share(ana, TargetType.SCHEME, look.getId(), ShareChannel.FEED);
        social.toggleSave(ana, TargetType.SCHEME, look.getId());
        assertThat(look.getLikeCount()).isEqualTo(likes + 1);
        assertThat(look.getCommentCount()).isEqualTo(comments + 1);
        assertThat(look.getShareCount()).isEqualTo(shares + 1);
        assertThat(look.getSaveCount()).isEqualTo(saves + 1);
        assertThat(look.getRemixCount()).isEqualTo(remixes);   // remix de look é do SchemeService, não conta aqui
        verify(store).increment("scheme", look.getId(), "likes", 1);
        verify(store).increment("scheme", look.getId(), "comments", 1);
        verify(store).increment("scheme", look.getId(), "shares", 1);
        verify(store).increment("scheme", look.getId(), "saves", 1);
        social.toggleSave(ana, TargetType.SCHEME, look.getId());
        assertThat(look.getSaveCount()).isEqualTo(saves);
        verify(store).increment("scheme", look.getId(), "saves", -1);
    }

    @Test
    void contadorNuncaFicaNegativo() {
        social.react(ana, TargetType.SCHEME, look.getId(), ReactionType.LIKE);
        look.setLikeCount(0);
        social.react(ana, TargetType.SCHEME, look.getId(), ReactionType.LIKE);   // descurtir com contador já zerado
        assertThat(look.getLikeCount()).isZero();
        verify(store).increment("scheme", look.getId(), "likes", -1);

        social.toggleSave(ana, TargetType.SCHEME, look.getId());
        look.setSaveCount(0);
        social.toggleSave(ana, TargetType.SCHEME, look.getId());
        assertThat(look.getSaveCount()).isZero();

        UUID c = (UUID) social.comment(ana, TargetType.PIECE, piece.getId(), "Onde comprou?", null).get("id");
        piece.setCommentCount(0);
        social.deleteComment(ana, c);
        assertThat(piece.getCommentCount()).isZero();
        verify(store).increment("piece", piece.getId(), "comments", -1);
    }

    @Test
    void pecaNaoTemContadorDeSalvosMasOStoreRecebeODelta() {
        long likes = piece.getLikesCount(), comments = piece.getCommentCount(), shares = piece.getSharesCount();
        long remixes = piece.getRemixesCount();
        social.toggleSave(ana, TargetType.PIECE, piece.getId());
        assertThat(piece.getLikesCount()).isEqualTo(likes);
        assertThat(piece.getCommentCount()).isEqualTo(comments);
        assertThat(piece.getSharesCount()).isEqualTo(shares);
        assertThat(piece.getRemixesCount()).isEqualTo(remixes);
        verify(store).increment("piece", piece.getId(), "saves", 1);

        social.react(ana, TargetType.PIECE, piece.getId(), ReactionType.LIKE);
        social.share(ana, TargetType.PIECE, piece.getId(), ShareChannel.FEED);
        social.remix(bia, TargetType.PIECE, piece.getId());   // a dona remixa a própria peça (sem importar cópia)
        assertThat(piece.getLikesCount()).isEqualTo(likes + 1);
        assertThat(piece.getSharesCount()).isEqualTo(shares + 1);
        assertThat(piece.getRemixesCount()).isEqualTo(remixes + 1);
        verify(store).increment("piece", piece.getId(), "remixes", 1);
    }

    @Test
    void dnaMoveCurtidasComentariosCompartilhamentosERemixes() {
        social.react(ana, TargetType.DNA, dna.getId(), ReactionType.LIKE);
        UUID c = (UUID) social.comment(ana, TargetType.DNA, dna.getId(), "Que história!", null).get("id");
        social.share(ana, TargetType.DNA, dna.getId(), ShareChannel.EXTERNAL);
        social.remix(ana, TargetType.DNA, dna.getId());
        social.toggleSave(ana, TargetType.DNA, dna.getId());   // DNA não tem contador de salvos
        assertThat(dna.getLikeCount()).isEqualTo(1);
        assertThat(dna.getCommentCount()).isEqualTo(1);
        assertThat(dna.getShareCount()).isEqualTo(1);
        assertThat(dna.getRemixCount()).isEqualTo(1);
        verify(store).increment("dna", dna.getId(), "saves", 1);
        social.deleteComment(bia, c);
        assertThat(dna.getCommentCount()).isZero();
    }
}
