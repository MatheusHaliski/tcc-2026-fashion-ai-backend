package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
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
 * Batalha de Looks por turnos entre duas pessoas (piloto): deck conferido, lance selado até a outra pessoa lançar,
 * turno julgado no servidor, fora de ordem e lance repetido recusados (409, o segundo clique ou dois pedidos ao mesmo
 * tempo), o julgamento não depende da ordem dos lances, fechamento com aviso aos dois e revanche com a semente seguinte.
 */
class Flair3dSalaTurnosTest {
    private Flair3dMultiKit m;
    private CurrentUser ana;
    private CurrentUser bia;
    private User biaU;
    private FlairCardInstance[] deckAna;
    private FlairCardInstance[] deckBia;

    @BeforeEach
    void setUp() {
        m = new Flair3dMultiKit();
        ana = m.como(m.pessoa("ana"));
        biaU = m.pessoa("bia");
        bia = m.como(biaU);
        deckAna = new FlairCardInstance[]{m.carta(ana, "SUP", "color:blue", "occasion:formal"), m.carta(ana, "INF", "color:blue", "occasion:formal"),
                m.carta(ana, "CAL", "color:blue", "occasion:formal"), m.carta(ana, "SUP", "color:black", "occasion:casual"),
                m.carta(ana, "INF", "color:black", "occasion:casual"), m.carta(ana, "CAL", "color:black", "occasion:casual")};
        deckBia = new FlairCardInstance[]{m.carta(bia, "SUP", "color:red"), m.carta(bia, "INF", "color:red"), m.carta(bia, "CAL", "color:red")};
    }

    private UUID salaAceita(long semente) {
        UUID id = (UUID) m.convites.convidar(ana, new Flair3dConviteService.Convite(biaU.getId(), "BATALHA_LOOKS", "TURNOS", null)).get("id");
        Flair3dSala s = m.kit.dep(Flair3dSalaRepository.class).findById(id).orElseThrow();
        s.setSemente(semente);
        m.kit.dep(Flair3dSalaRepository.class).save(s);
        m.convites.aceitar(bia, id);
        m.turnos.escolherDeck(ana, id, ids(deckAna));
        m.turnos.escolherDeck(bia, id, ids(deckBia));
        return id;
    }

    private static Map<String, UUID> look(FlairCardInstance sup, FlairCardInstance inf, FlairCardInstance cal) {
        return Map.of("SUP", sup.getId(), "INF", inf.getId(), "CAL", cal.getId());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> turnos(Map<String, Object> sala) {
        return (Map<String, Object>) sala.get("turnos");
    }

    @Test
    void deckEhConferidoPelasRegrasDoJogo() {
        UUID id = (UUID) m.convites.convidar(ana, new Flair3dConviteService.Convite(biaU.getId(), "BATALHA_LOOKS", null, null)).get("id");
        assertThat(codigo(() -> m.turnos.escolherDeck(ana, id, ids(deckAna)))).isEqualTo("SALA_ESTADO_INVALIDO");
        m.convites.aceitar(bia, id);
        assertThat(codigo(() -> m.turnos.escolherDeck(ana, id, ids(deckAna[0], deckAna[1])))).isEqualTo("DECK_INVALIDO");
        assertThat(codigo(() -> m.turnos.escolherDeck(bia, id, ids(deckAna)))).isEqualTo("CARTA_ALHEIA");
        assertThat(codigo(() -> m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(1, Map.of())))).isEqualTo("SEM_DECK_NA_SALA");
    }

    @Test
    void batalhaPorTurnosAteOResultadoJulgadaNoServidor() {
        UUID id = salaAceita(42L);
        Map<String, Object> r1 = m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(1, look(deckAna[0], deckAna[1], deckAna[2])));
        assertThat(turnos(r1)).containsEntry("esperando", true).containsEntry("julgados", List.of());
        // o lance de ana fica selado: bia só sabe que ela lançou
        Map<String, Object> vistaBia = m.leitura.ver(bia, id);
        assertThat(turnos(vistaBia)).containsEntry("outroLancou", true).containsEntry("meuLance", null);
        assertThat(codigo(() -> m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(2, look(deckAna[3], deckAna[4], deckAna[5])))))
                .isEqualTo("ESPERE_A_VEZ");
        // o segundo clique no mesmo turno (ou dois pedidos ao mesmo tempo) não grava nada
        assertThat(codigo(() -> m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(1, look(deckAna[0], deckAna[1], deckAna[2])))))
                .isEqualTo("TURNO_FORA_DE_ORDEM");
        verify(m.kit.dep(NotificationService.class)).notify(eq(bia.id()), eq(ana.id()), eq(NotificationType.FLAIR3D_VEZ), any(), eq(id), any(), any(), any());

        Map<String, Object> j1 = turnos(m.turnos.lancar(bia, id, new Flair3dSalaTurnos.Lance(1, look(deckBia[0], deckBia[1], deckBia[2]))));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> julgados = (List<Map<String, Object>>) j1.get("julgados");
        assertThat(julgados).hasSize(1);
        assertThat(julgados.get(0)).containsKeys("desafio", "de", "para", "vencedor");
        assertThat((List<?>) j1.get("desafios")).hasSize(2);

        // bia repete o look (cansado) nas rodadas 2 e 3; ana alterna
        m.turnos.lancar(bia, id, new Flair3dSalaTurnos.Lance(2, look(deckBia[0], deckBia[1], deckBia[2])));
        m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(2, look(deckAna[3], deckAna[4], deckAna[5])));
        m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(3, look(deckAna[0], deckAna[1], deckAna[2])));
        Map<String, Object> fim = m.turnos.lancar(bia, id, new Flair3dSalaTurnos.Lance(3, look(deckBia[0], deckBia[1], deckBia[2])));
        assertThat(fim).containsEntry("estado", "FECHADO");
        assertThat(turnos(fim)).containsEntry("encerrado", true);
        Flair3dSala s = m.kit.dep(Flair3dSalaRepository.class).findById(id).orElseThrow();
        assertThat(s.getVencedorUserId()).isEqualTo(ana.id());
        verify(m.kit.dep(NotificationService.class), times(2)).notify(any(), any(), eq(NotificationType.FLAIR3D_RESULTADO), any(), eq(id), any(), any(), any());
        assertThat(m.leitura.ver(ana, id)).containsEntry("vencedor", "DE").containsKey("resultado");
        assertThat(codigo(() -> m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(4, Map.of())))).isEqualTo("SALA_ESTADO_INVALIDO");

        Map<String, Object> placar = m.caixa.historico(bia, ana.id());
        assertThat(placar.get("placar")).isEqualTo(Map.of("vitorias", 0L, "derrotas", 1L, "empates", 0L));
        Map<String, Object> revanche = m.convites.revanche(bia, id);
        Flair3dSala nova = m.kit.dep(Flair3dSalaRepository.class).findById((UUID) revanche.get("id")).orElseThrow();
        assertThat(nova.getSemente()).isEqualTo(43L);
        assertThat(nova.getDeUserId()).isEqualTo(bia.id());
        assertThat(nova.getRevancheDe()).isEqualTo(id);
    }

    @Test
    void cartaForaDoDeckOuNaVagaErradaNaoValeEODeckTravaNoPrimeiroLance() {
        UUID id = salaAceita(7L);
        assertThat(codigo(() -> m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(1, Map.of("SUP", deckBia[0].getId())))))
                .isEqualTo("CARTA_FORA_DO_DECK");
        assertThat(codigo(() -> m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(1, Map.of("INF", deckAna[0].getId())))))
                .isEqualTo("CARTA_NA_VAGA_ERRADA");
        assertThat(codigo(() -> m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(1, Map.of())))).isEqualTo("LANCE_VAZIO");
        m.turnos.lancar(ana, id, new Flair3dSalaTurnos.Lance(1, Map.of("SUP", deckAna[0].getId())));
        assertThat(codigo(() -> m.turnos.escolherDeck(ana, id, ids(deckAna)))).isEqualTo("DECK_TRAVADO");
    }

    @Test
    void oJulgamentoNaoDependeDaOrdemEmQueOsLancesChegam() {
        UUID a = salaAceita(99L);
        m.turnos.lancar(ana, a, new Flair3dSalaTurnos.Lance(1, look(deckAna[0], deckAna[1], deckAna[2])));
        Map<String, Object> primeiroAna = turnos(m.turnos.lancar(bia, a, new Flair3dSalaTurnos.Lance(1, look(deckBia[0], deckBia[1], deckBia[2]))));
        UUID b = salaAceita2(99L);
        m.turnos.lancar(bia, b, new Flair3dSalaTurnos.Lance(1, look(deckBia[0], deckBia[1], deckBia[2])));
        Map<String, Object> primeiroBia = turnos(m.turnos.lancar(ana, b, new Flair3dSalaTurnos.Lance(1, look(deckAna[0], deckAna[1], deckAna[2]))));
        assertThat(primeiroBia.get("julgados")).isEqualTo(primeiroAna.get("julgados"));
        assertThat(primeiroBia.get("pontos")).isEqualTo(primeiroAna.get("pontos"));
    }

    /** Segunda sala de Batalha com a mesma pessoa: a primeira precisa fechar ou ser outra; aqui bia convida ana. */
    private UUID salaAceita2(long semente) {
        UUID id = (UUID) m.convites.convidar(bia, new Flair3dConviteService.Convite(ana.id(), "BATALHA_LOOKS", "TURNOS", null)).get("id");
        Flair3dSala s = m.kit.dep(Flair3dSalaRepository.class).findById(id).orElseThrow();
        s.setSemente(semente);
        // os lados invertem: para manter ana em "de" na comparação, troca de volta
        s.setDeUserId(ana.id());
        s.setParaUserId(bia.id());
        m.kit.dep(Flair3dSalaRepository.class).save(s);
        m.convites.aceitar(bia, id);
        m.turnos.escolherDeck(ana, id, ids(deckAna));
        m.turnos.escolherDeck(bia, id, ids(deckBia));
        return id;
    }
}
