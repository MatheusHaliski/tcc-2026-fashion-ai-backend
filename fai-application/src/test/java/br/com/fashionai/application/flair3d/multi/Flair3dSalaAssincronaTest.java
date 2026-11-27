package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.multi.Flair3dMultiKit.codigo;
import static br.com.fashionai.application.flair3d.multi.Flair3dMultiKit.ids;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Sala com a mesma semente: as duas partidas abrem pela sala com a semente e a rodada dela, uma por lado; a nota da
 * outra pessoa só aparece quando as duas terminaram; quem falta é avisado uma vez; mais pontos vence.
 */
class Flair3dSalaAssincronaTest {
    private Flair3dMultiKit m;
    private CurrentUser ana;
    private CurrentUser bia;
    private User biaU;

    @BeforeEach
    void setUp() {
        m = new Flair3dMultiKit();
        ana = m.como(m.pessoa("ana"));
        biaU = m.pessoa("bia");
        bia = m.como(biaU);
    }

    private Flair3dNucleoService.AbrirPartida deck(CurrentUser quem) {
        FlairCardInstance sup = m.carta(quem, "SUP", "brand:Farm");
        FlairCardInstance inf = m.carta(quem, "INF", "brand:Farm");
        FlairCardInstance cal = m.carta(quem, "CAL", "brand:Farm");
        return new Flair3dNucleoService.AbrirPartida(ids(sup, inf, cal), null);
    }

    private void terminar(UUID partida, int pontos) {
        Flair3dMatch match = m.kit.dep(Flair3dMatchRepository.class).findById(partida).orElseThrow();
        match.setStatus(Flair3dMatch.ENTREGUE);
        match.setPontos(pontos);
        match.setEstrelas(pontos >= 80 ? 2 : 1);
        m.kit.dep(Flair3dMatchRepository.class).save(match);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> lado(Map<String, Object> sala, String qual) {
        return (Map<String, Object>) ((Map<String, Object>) sala.get("assincrono")).get(qual);
    }

    @Test
    void asDuasPartidasTemAMesmaSementeEASalaFechaComOsDoisLados() {
        UUID id = (UUID) m.convites.convidar(ana, new Flair3dConviteService.Convite(biaU.getId(), "PASSARELA", null, null)).get("id");
        assertThat(codigo(() -> m.assincrona.abrir(ana, id, deck(ana)))).isEqualTo("SALA_ESTADO_INVALIDO");
        m.convites.aceitar(bia, id);
        long semente = m.kit.dep(Flair3dSalaRepository.class).findById(id).orElseThrow().getSemente();

        Map<String, Object> pa = m.assincrona.abrir(ana, id, deck(ana));
        Map<String, Object> pb = m.assincrona.abrir(bia, id, deck(bia));
        assertThat(pa.get("semente")).isEqualTo(semente);
        assertThat(pb.get("semente")).isEqualTo(semente);
        assertThat(pa.get("abertura")).isEqualTo(pb.get("abertura"));
        assertThat(pa).containsEntry("sala", id);
        assertThat(codigo(() -> m.assincrona.abrir(ana, id, deck(ana)))).isEqualTo("SALA_PARTIDA_JA_ABERTA");

        terminar((UUID) pa.get("id"), 81);
        Map<String, Object> vistaAna = m.leitura.ver(ana, id);
        assertThat(lado(vistaAna, "eu")).containsEntry("pontos", 81);
        assertThat(lado(vistaAna, "outro")).isEqualTo(Map.of("terminou", false));
        Map<String, Object> vistaBia = m.leitura.ver(bia, id);
        // bia vê que ana terminou, mas não a nota (ninguém joga sabendo o alvo)
        assertThat(lado(vistaBia, "outro")).isEqualTo(Map.of("terminou", true));
        m.leitura.ver(bia, id);
        verify(m.kit.dep(NotificationService.class), times(1)).notify(eq(bia.id()), eq(ana.id()), eq(NotificationType.FLAIR3D_VEZ), any(), eq(id), any(), any(), any());

        terminar((UUID) pb.get("id"), 64);
        Map<String, Object> fechada = m.leitura.ver(bia, id);
        assertThat(fechada).containsEntry("estado", "FECHADO").containsEntry("vencedor", "DE").containsEntry("semente", semente);
        assertThat(lado(fechada, "outro")).containsEntry("pontos", 81);
        verify(m.kit.dep(NotificationService.class), times(2)).notify(any(), any(), eq(NotificationType.FLAIR3D_RESULTADO), any(), eq(id), any(), any(), any());
    }

    @Test
    void empateEmPontosDesempataPelasEstrelasESenaoEmpata() {
        assertThat(Flair3dSalaAssincrona.compara(Map.of("pontos", 70, "estrelas", 1), Map.of("pontos", 70, "estrelas", 2))).isNegative();
        assertThat(Flair3dSalaAssincrona.compara(Map.of("pontos", 70, "estrelas", 1), Map.of("pontos", 70, "estrelas", 1))).isZero();
        assertThat(Flair3dSalaAssincrona.compara(Map.of("pontos", 90, "estrelas", 1), Map.of("pontos", 70, "estrelas", 3))).isPositive();
    }

    @Test
    void salaPorTurnosNaoAbrePartidaAssincrona() {
        UUID id = (UUID) m.convites.convidar(ana, new Flair3dConviteService.Convite(biaU.getId(), "BATALHA_LOOKS", "TURNOS", null)).get("id");
        m.convites.aceitar(bia, id);
        assertThat(codigo(() -> m.assincrona.abrir(ana, id, deck(ana)))).isEqualTo("SALA_MODO_ERRADO");
        assertThat(m.kit.dep(Flair3dSalaRepository.class).findById(id).orElseThrow().getEstado()).isEqualTo(Flair3dSala.JOGANDO);
    }
}
