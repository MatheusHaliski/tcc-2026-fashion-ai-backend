package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.multi.Flair3dMultiKit.codigo;
import static br.com.fashionai.application.flair3d.multi.Flair3dMultiKit.status;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Convites do multiplayer: convidar pelo id da busca, aviso ao convidado, aceite só de quem foi convidada e dentro do
 * prazo, recusa e cancelamento de cada lado, bloqueio, conta privada, convite repetido e a sala invisível para quem
 * está fora dela.
 */
class Flair3dConviteServiceTest {
    private Flair3dMultiKit m;
    private User anaU;
    private User biaU;
    private CurrentUser ana;
    private CurrentUser bia;
    private CurrentUser cara;

    @BeforeEach
    void setUp() {
        m = new Flair3dMultiKit();
        anaU = m.pessoa("ana");
        biaU = m.pessoa("bia");
        ana = m.como(anaU);
        bia = m.como(biaU);
        cara = m.como(m.pessoa("cara"));
    }

    private UUID convidar(CurrentUser de, User para, String jogo, String modo) {
        return (UUID) m.convites.convidar(de, new Flair3dConviteService.Convite(para.getId(), jogo, modo, null)).get("id");
    }

    private Flair3dSala sala(UUID id) {
        return m.kit.dep(Flair3dSalaRepository.class).findById(id).orElseThrow();
    }

    @Test
    void convidarAvisaEAceiteAbreASalaSoParaQuemFoiConvidada() {
        UUID id = convidar(ana, biaU, "batalha_looks", null);
        Flair3dSala s = sala(id);
        assertThat(s.getEstado()).isEqualTo(Flair3dSala.CONVIDADO);
        assertThat(s.getModo()).isEqualTo(Flair3dSala.TURNOS);
        assertThat(s.getRodada()).isEqualTo("BATALHA_DE_3_RODADAS");
        assertThat(Duration.between(Instant.now(), s.getPrazo()).toHours()).isBetween(47L, 48L);
        NotificationService avisos = m.kit.dep(NotificationService.class);
        verify(avisos).notify(eq(bia.id()), eq(ana.id()), eq(NotificationType.FLAIR3D_CONVITE), eq("FLAIR3D_SALA"), eq(id), any(), any(),
                eq(Map.of("href", "/flair/3d/sala/" + id, "salaId", id.toString(), "jogo", "BATALHA_LOOKS", "modo", "TURNOS")));

        assertThat(status(() -> m.convites.aceitar(ana, id))).isEqualTo(403);
        assertThat(status(() -> m.convites.aceitar(cara, id))).isEqualTo(404);
        assertThat(status(() -> m.leitura.ver(cara, id))).isEqualTo(404);
        Map<String, Object> aceita = m.convites.aceitar(bia, id);
        assertThat(aceita).containsEntry("estado", "JOGANDO").containsEntry("voce", "PARA");
        verify(avisos).notify(eq(ana.id()), eq(bia.id()), eq(NotificationType.FLAIR3D_VEZ), any(), eq(id), any(), any(), any());
        assertThat(codigo(() -> m.convites.aceitar(bia, id))).isEqualTo("SALA_ESTADO_INVALIDO");
    }

    @Test
    void recusaECancelamentoSaoDeCadaLadoESemAvisoDeRecusa() {
        UUID a = convidar(ana, biaU, "PASSARELA", "ASSINCRONO");
        assertThat(status(() -> m.convites.recusar(ana, a))).isEqualTo(403);
        assertThat(m.convites.recusar(bia, a)).containsEntry("estado", "RECUSADO");
        verify(m.kit.dep(NotificationService.class), never()).notify(eq(ana.id()), any(), eq(NotificationType.FLAIR3D_VEZ), any(), any(), any(), any(), any());

        UUID b = convidar(ana, biaU, "PASSARELA", "ASSINCRONO");
        assertThat(status(() -> m.convites.cancelar(bia, b))).isEqualTo(403);
        assertThat(m.convites.cancelar(ana, b)).containsEntry("estado", "CANCELADO");
    }

    @Test
    void conviteVencidoExpiraNaLeituraENaoAceita() {
        UUID id = convidar(ana, biaU, "DRESS_FIGHTER", "TURNOS");
        Flair3dSala s = sala(id);
        s.setPrazo(Instant.now().minusSeconds(60));
        m.kit.dep(Flair3dSalaRepository.class).save(s);
        assertThat(codigo(() -> m.convites.aceitar(bia, id))).isEqualTo("CONVITE_EXPIRADO");
        assertThat(sala(id).getEstado()).isEqualTo(Flair3dSala.EXPIRADO);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> recebidos = (List<Map<String, Object>>) m.caixa.caixa(bia).get("recebidos");
        assertThat(recebidos).isEmpty();
    }

    @Test
    void bloqueioEmQualquerSentidoEscondeAPessoaDoConvite() {
        m.segue(biaU, anaU, FollowStatus.BLOQUEADO);
        assertThat(codigo(() -> convidar(ana, biaU, "PASSARELA", null))).isEqualTo("PESSOA_NAO_ENCONTRADA");
        assertThat(codigo(() -> convidar(bia, anaU, "PASSARELA", null))).isEqualTo("PESSOA_NAO_ENCONTRADA");
    }

    @Test
    void contaPrivadaSoRecebeConviteDeQuemASegueComAceite() {
        biaU.setPrivateAccount(true);
        assertThat(codigo(() -> convidar(ana, biaU, "PASSARELA", null))).isEqualTo("CONTA_PRIVADA");
        m.segue(anaU, biaU, FollowStatus.PENDENTE);
        assertThat(status(() -> convidar(ana, biaU, "PASSARELA", null))).isEqualTo(403);
        CurrentUser dani = m.como(m.pessoa("dani"));
        User daniU = m.kit.dep(br.com.fashionai.domain.repository.UserRepository.class).findById(dani.id()).orElseThrow();
        m.segue(daniU, biaU, FollowStatus.ACEITO);
        assertThat(convidar(dani, biaU, "PASSARELA", null)).isNotNull();
    }

    @Test
    void regrasDoConvite() {
        assertThat(codigo(() -> convidar(ana, anaU, "PASSARELA", null))).isEqualTo("CONVITE_CONSIGO");
        assertThat(codigo(() -> convidar(ana, biaU, "PASSARELA", "TURNOS"))).isEqualTo("MODO_INDISPONIVEL");
        assertThat(codigo(() -> convidar(ana, biaU, "XADREZ", null))).isEqualTo("NUCLEO_NAO_ENCONTRADO");
        assertThat(codigo(() -> m.convites.convidar(ana, new Flair3dConviteService.Convite(biaU.getId(), "PASSARELA", null, "NAO_EXISTE"))))
                .isEqualTo("RODADA_INVALIDA");
        convidar(ana, biaU, "PASSARELA", null);
        assertThat(codigo(() -> convidar(ana, biaU, "PASSARELA", null))).isEqualTo("CONVITE_PENDENTE");
        // outro jogo com a mesma pessoa pode; o MAKE UP é sempre assíncrono, no primeiro brief
        UUID mk = convidar(ana, biaU, "make_up", null);
        assertThat(sala(mk).getModo()).isEqualTo(Flair3dSala.ASSINCRONO);
        assertThat(sala(mk).getRodada()).isNotBlank();
    }

    @Test
    void caixaSeparaRecebidosEnviadosEAtivas() {
        UUID a = convidar(ana, biaU, "PASSARELA", null);
        UUID b = convidar(bia, anaU, "LABIRINTO", null);
        m.convites.aceitar(ana, b);
        Map<String, Object> caixa = m.caixa.caixa(ana);
        assertThat(ids(caixa.get("enviados"))).containsExactly(a.toString());
        assertThat(ids(caixa.get("ativas"))).containsExactly(b.toString());
        assertThat(ids(m.caixa.caixa(bia).get("recebidos"))).containsExactly(a.toString());
        assertThat(MemoryRepository.rows(m.kit.dep(Flair3dSalaRepository.class))).hasSize(2);
    }

    @SuppressWarnings("unchecked")
    private static List<String> ids(Object lista) {
        return ((List<Map<String, Object>>) lista).stream().map(x -> String.valueOf(x.get("id"))).toList();
    }
}
