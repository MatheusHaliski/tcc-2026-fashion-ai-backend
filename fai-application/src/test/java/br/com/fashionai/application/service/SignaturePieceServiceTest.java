package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.SignaturePieceHistory;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserSignaturePiece;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.SignaturePieceHistoryRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.UserSignaturePieceRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Exercício 18 — Peça Assinatura do perfil e histórico: só peça própria e não arquivada; troca idempotente; uma linha
 * de histórico por mudança efetiva; gravação concorrente recusada; quem visita só vê a peça que pode ver; a leitura
 * pública não leva notas, preço, local de compra nem a foto original.
 */
class SignaturePieceServiceTest {
    private Kit kit;
    private SignaturePieceService service;
    private UserSignaturePieceRepository choices;
    private User ana;
    private User bia;
    private CurrentUser asAna;
    private CurrentUser asBia;
    private WardrobeItem blazer;
    private WardrobeItem jeans;
    private FollowRepository follows;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        follows = mock(FollowRepository.class);                  // sem vínculo entre as contas até o teste dizer o contrário
        kit.with(follows, new Guard(e -> {
        }, follows));
        kit.real(ProfileService.class);
        service = kit.build(SignaturePieceService.class);
        choices = kit.dep(UserSignaturePieceRepository.class);
        ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        bia = kit.dep(UserRepository.class).save(Kit.user("bia"));
        ana.setProfileVisibility(Visibility.PUBLIC);             // o perfil nasce privado (RF3.CA19)
        asAna = Kit.as(ana);
        asBia = Kit.as(bia);
        blazer = piece(ana, "Blazer de lã", Visibility.PUBLIC);
        jeans = piece(ana, "Jeans reto", Visibility.PUBLIC);
    }

    private WardrobeItem piece(User owner, String name, Visibility visibility) {
        WardrobeItem w = Kit.piece(owner, name, "upper_piece", "blazer", "gray");
        w.setVisibility(visibility);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.setBrandName("Atelier Lumi");
        w.setNotes("presente da minha avó");
        w.setPurchaseLocation("Loja do centro");
        w.setOriginalImageUrl("/media/foto-privada.jpg");
        return kit.dep(WardrobeItemRepository.class).save(w);
    }

    private List<SignaturePieceHistory> rows() {
        return MemoryRepository.rows(kit.dep(SignaturePieceHistoryRepository.class));
    }

    private static int status(Throwable e) {
        return ((ApiException) e).status();
    }

    @Test
    void escolheTrocaERemoveComUmaLinhaDeHistoricoPorMudancaEfetiva() {
        assertThat(service.mine(asAna)).containsEntry("signaturePiece", null).containsEntry("version", 0L);

        Map<String, Object> first = service.choose(asAna, blazer.getId(), 0L);
        assertThat(map(first.get("signaturePiece"))).containsEntry("id", blazer.getId()).containsEntry("name", "Blazer de lã")
                .containsEntry("visibility", "PUBLIC");
        // a mesma escolha de novo: nada muda e o histórico não cresce
        service.choose(asAna, blazer.getId(), null);
        assertThat(rows()).hasSize(1);
        service.choose(asAna, jeans.getId(), null);
        assertThat(map(service.mine(asAna).get("signaturePiece"))).containsEntry("id", jeans.getId());
        assertThat(MemoryRepository.<UserSignaturePiece>rows(choices)).hasSize(1);

        assertThat(service.clear(asAna, null)).containsEntry("signaturePiece", null);
        service.clear(asAna, null);                              // sem escolha: não grava outra linha
        assertThat(rows()).extracting(SignaturePieceHistory::getPieceId).containsExactly(blazer.getId(), jeans.getId(), null);

        Map<String, Object> page = service.history(asAna, 0, 2);
        assertThat(page).containsEntry("total", 3L).containsEntry("hasMore", true).containsEntry("size", 2);
        assertThat((List<?>) page.get("items")).hasSize(2);
        Map<String, Object> chosen = ((List<?>) service.history(asAna, 0, 50).get("items")).stream().map(br.com.fashionai.application.testkit.World::map)
                .filter(i -> jeans.getId().equals(i.get("pieceId"))).findFirst().orElseThrow();
        assertThat(chosen).containsEntry("removed", false);
        // o retrato do histórico é mínimo: sem notas, preço, local de compra ou fotos
        assertThat(map(chosen.get("snapshot"))).containsOnlyKeys("name", "category", "subcategory", "color", "brandName");
        assertThat(((List<?>) service.history(asAna, 0, 50).get("items")).stream().map(br.com.fashionai.application.testkit.World::map)
                .filter(i -> i.get("pieceId") == null).findFirst().orElseThrow()).containsEntry("removed", true).containsEntry("snapshot", null);
        // o histórico é do dono: a outra pessoa lê o dela, vazio
        assertThat(service.history(asBia, 0, 10)).containsEntry("total", 0L);
    }

    @Test
    void soEntraPecaPropriaENaoArquivada() {
        WardrobeItem daBia = piece(bia, "Vestido", Visibility.PUBLIC);
        assertThatThrownBy(() -> service.choose(asAna, daBia.getId(), null)).satisfies(e -> assertThat(status(e)).isEqualTo(404));
        assertThatThrownBy(() -> service.choose(asAna, UUID.randomUUID(), null)).satisfies(e -> assertThat(status(e)).isEqualTo(404));
        assertThatThrownBy(() -> service.choose(asAna, null, null)).satisfies(e -> assertThat(status(e)).isEqualTo(400));
        jeans.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        assertThatThrownBy(() -> service.choose(asAna, jeans.getId(), null))
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("ASSINATURA_PECA_INDISPONIVEL"));
        assertThatThrownBy(() -> service.choose(null, blazer.getId(), null)).satisfies(e -> assertThat(status(e)).isEqualTo(401));
        assertThat(MemoryRepository.<UserSignaturePiece>rows(choices)).isEmpty();
        assertThat(rows()).isEmpty();
    }

    @Test
    void gravacaoConcorrenteERecusadaEmVezDeSobrescrever() {
        service.choose(asAna, blazer.getId(), 0L);
        UserSignaturePiece saved = choices.findById(ana.getId()).orElseThrow();
        saved.setVersion(3L);
        // outra janela leu a revisão 0 e tenta gravar por cima da 3
        assertThatThrownBy(() -> service.choose(asAna, jeans.getId(), 0L)).satisfies(e -> {
            assertThat(status(e)).isEqualTo(409);
            assertThat(((ApiException) e).code()).isEqualTo("ASSINATURA_ALTERADA");
        });
        assertThatThrownBy(() -> service.clear(asAna, 2L)).satisfies(e -> assertThat(status(e)).isEqualTo(409));
        assertThat(saved.getPieceId()).isEqualTo(blazer.getId());
        assertThat(service.choose(asAna, jeans.getId(), 3L)).containsKey("signaturePiece");
        // dois inserts da primeira escolha ao mesmo tempo: o banco recusa o segundo (chave) e a API devolve 409
        UserSignaturePieceRepository racing = mock(UserSignaturePieceRepository.class);
        when(racing.findById(any())).thenReturn(Optional.empty());
        when(racing.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("Duplicate entry"));
        SignaturePieceService raced = new SignaturePieceService(racing, kit.dep(SignaturePieceHistoryRepository.class),
                kit.dep(WardrobeItemRepository.class), kit.dep(ProfileService.class), kit.dep(Guard.class));
        int before = rows().size();
        assertThatThrownBy(() -> raced.choose(asAna, blazer.getId(), 0L)).satisfies(e -> assertThat(status(e)).isEqualTo(409));
        assertThat(rows()).hasSize(before);
    }

    @Test
    void quemVisitaSoVeAPecaQuePodeVerESemDadosPrivados() {
        service.choose(asAna, blazer.getId(), null);
        Map<String, Object> publico = map(service.ofProfile(null, "ana").get("signaturePiece"));
        assertThat(publico).containsEntry("id", blazer.getId()).containsEntry("name", "Blazer de lã").containsEntry("brandName", "Atelier Lumi")
                .containsEntry("imageUrl", blazer.getThumbnailUrl());
        assertThat(publico).doesNotContainKeys("notes", "purchaseLocation", "price", "originalImageUrl", "visibility");
        assertThat(publico.toString()).doesNotContain("avó", "Loja do centro", "foto-privada");
        assertThat(map(service.ofProfile(asBia, ana.getId().toString()).get("signaturePiece"))).containsEntry("id", blazer.getId());

        // peça privada: só a dona vê; para quem visita a resposta é igual à de quem não escolheu nada
        blazer.setVisibility(Visibility.PRIVATE);
        assertThat(service.ofProfile(asBia, "ana")).containsEntry("signaturePiece", null);
        assertThat(service.ofProfile(null, "ana")).containsEntry("signaturePiece", null);
        assertThat(map(service.ofProfile(asAna, "ana").get("signaturePiece"))).containsEntry("visibility", "PRIVATE");

        // só seguidores: quem segue vê, o visitante anônimo não
        blazer.setVisibility(Visibility.FOLLOWERS);
        assertThat(service.ofProfile(asBia, "ana")).containsEntry("signaturePiece", null);
        Follow follow = new Follow(bia, ana, FollowStatus.ACEITO);
        when(follows.findByFollowerIdAndFollowingId(bia.getId(), ana.getId())).thenReturn(Optional.of(follow));
        assertThat(map(service.ofProfile(asBia, "ana").get("signaturePiece"))).containsEntry("id", blazer.getId());

        // moderação pendente, perfil privado e bloqueio escondem a peça de terceiros
        blazer.setVisibility(Visibility.PUBLIC);
        blazer.setModerationStatus(ModerationStatus.PENDING);
        assertThat(service.ofProfile(null, "ana")).containsEntry("signaturePiece", null);
        blazer.setModerationStatus(ModerationStatus.APPROVED);
        ana.setProfileVisibility(Visibility.PRIVATE);
        assertThat(service.ofProfile(null, "ana")).containsEntry("signaturePiece", null);
        ana.setProfileVisibility(Visibility.PUBLIC);
        follow.setStatus(FollowStatus.BLOQUEADO);
        assertThat(service.ofProfile(asBia, "ana")).containsEntry("signaturePiece", null);
        assertThatThrownBy(() -> service.ofProfile(null, "ninguem")).satisfies(e -> assertThat(status(e)).isEqualTo(404));
    }

    @Test
    void pecaExcluidaOuArquivadaDeixaDeSerAAssinatura() {
        service.choose(asAna, blazer.getId(), null);
        // transferência e encerramento de conta arquivam a peça sem evento: ela deixa de aparecer
        blazer.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        assertThat(service.mine(asAna)).containsEntry("signaturePiece", null);
        assertThat(service.ofProfile(null, "ana")).containsEntry("signaturePiece", null);
        // a escolha parada pode ser trocada normalmente
        assertThat(map(service.choose(asAna, jeans.getId(), null).get("signaturePiece"))).containsEntry("id", jeans.getId());

        // exclusão da peça pelo guarda-roupa: a escolha sai junto e o histórico registra a remoção
        service.onPieceDeleted(new DomainEvents.PieceDeleted(ana.getId(), jeans.getId()));
        assertThat(MemoryRepository.<UserSignaturePiece>rows(choices)).isEmpty();
        assertThat(rows()).last().satisfies(h -> {
            assertThat(h.getPieceId()).isNull();
            assertThat(h.getSnapshotJson()).isNull();
        });
        int before = rows().size();
        service.onPieceDeleted(new DomainEvents.PieceDeleted(ana.getId(), blazer.getId()));   // peça que não é assinatura: nada
        assertThat(rows()).hasSize(before);
    }
}
