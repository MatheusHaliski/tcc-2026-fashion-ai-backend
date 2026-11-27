package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização da abertura extraída de Flair3dNucleoService (Flair3dPartidaAbertura): o contrato da resposta
 * (chaves, status, rodada, participantes) é o mesmo da abertura solo, e a abertura com semente dada grava essa semente
 * e devolve a mesma abertura para duas pessoas (a base do duelo assíncrono).
 */
class Flair3dPartidaAberturaTest {
    private Kit kit;
    private Flair3dNucleoService service;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        kit.real(Flair3dCartas.class);
        service = kit.build(Flair3dNucleoService.class);
    }

    private Flair3dNucleoService.AbrirPartida deck(CurrentUser dono, String rodada) {
        List<FlairCardInstance> cartas = List.of("SUP", "INF", "CAL").stream()
                .map(p -> kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(dono.id(), p, "color:blue"))).toList();
        return new Flair3dNucleoService.AbrirPartida(cartas.stream().map(FlairCardInstance::getId).toList(), null, rodada);
    }

    @Test
    void aberturaSoloMantemOContrato() {
        Map<String, Object> solo = service.abrir(ana, "BATALHA_LOOKS", deck(ana, "BATALHA_DE_3_RODADAS"));
        assertThat(solo.keySet()).containsExactly("id", "nucleo", "status", "semente", "deck", "participantes", "rodada", "abertura");
        assertThat(solo).containsEntry("status", "ABERTA").containsEntry("rodada", "BATALHA_DE_3_RODADAS");
        assertThat(((Map<?, ?>) solo.get("abertura")).containsKey("etapa")).isTrue();
    }

    @Test
    void comSementeGravaASementeEDaAMesmaAberturaParaAsDuasPessoas() {
        Map<String, Object> a = service.abrirComSemente(ana, "BATALHA_LOOKS", deck(ana, "BATALHA_DE_3_RODADAS"), 123L);
        Map<String, Object> b = service.abrirComSemente(bia, "BATALHA_LOOKS", deck(bia, "BATALHA_DE_3_RODADAS"), 123L);
        assertThat(a.get("semente")).isEqualTo(123L);
        assertThat(a.get("abertura")).isEqualTo(b.get("abertura"));
        Map<String, Object> semId = new LinkedHashMap<>(a);
        semId.keySet().removeAll(List.of("id", "deck", "participantes"));
        Map<String, Object> outro = new LinkedHashMap<>(b);
        outro.keySet().removeAll(List.of("id", "deck", "participantes"));
        assertThat(semId).isEqualTo(outro);
        List<Flair3dMatch> salvas = MemoryRepository.rows(kit.dep(Flair3dMatchRepository.class));
        assertThat(salvas).extracting(Flair3dMatch::getSemente).containsOnly(123L);
    }
}
