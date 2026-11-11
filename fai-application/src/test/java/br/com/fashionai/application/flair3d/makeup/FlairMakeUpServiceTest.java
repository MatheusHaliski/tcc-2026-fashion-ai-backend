package br.com.fashionai.application.flair3d.makeup;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * FLAIR 3D MAKE UP — serviço com repositórios em memória: nível mínimo do brief (403), Prestígio só das estrelas novas,
 * carreira subindo de nível, carta alheia e cor fora da paleta (422).
 */
class FlairMakeUpServiceTest {
    private Kit kit;
    private FlairMakeUpService service;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        kit.real(Flair3dCartas.class);
        service = kit.build(FlairMakeUpService.class);
    }

    Entrega verao(String acabamento) {
        FlairCardInstance sup = kit.save(FlairCardInstanceRepository.class,
                Flair3dFixtures.instance(ana.id(), "SUP", "occasion:casual", "material:linen"));
        return new Entrega(Map.of("SUP", sup.getId()), null, Map.of("LABIOS", new Entrega.Maquiagem("CORAL", acabamento)), null);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> brief(Map<String, Object> briefs, String codigo) {
        return ((List<Map<String, Object>>) briefs.get("briefs")).stream().filter(b -> codigo.equals(b.get("codigo"))).findFirst().orElseThrow();
    }

    @Test
    void briefDeNivel2Da403NoNivel1() {
        assertThat(service.carreira(ana)).containsEntry("nivel", 1).containsEntry("prestigio", 0).containsEntry("faltaParaProximo", 60);
        assertThat(brief(service.briefs(ana), "PRIMEIRO_ENCONTRO")).containsEntry("liberado", false).containsEntry("nivelMin", 2);
        ApiException e = catchThrowableOfType(ApiException.class,
                () -> service.entregar(ana, "PRIMEIRO_ENCONTRO", new Entrega(null, null, null, null)));
        assertThat(e.status()).isEqualTo(403);
        assertThat(e.code()).isEqualTo("NIVEL_INSUFICIENTE");
        assertThat(catchThrowableOfType(ApiException.class, () -> service.detalhe("XYZ")).status()).isEqualTo(404);
    }

    @Test
    @SuppressWarnings("unchecked")
    void repetirOBriefSoPagaAsEstrelasNovasESobeDeNivel() {
        Map<String, Object> uma = service.entregar(ana, "ENSAIO_VERAO", verao("FOSCO"));
        assertThat(uma).containsEntry("pontos", 75).containsEntry("estrelas", 1).containsEntry("prestigioGanho", 20);

        Map<String, Object> tres = service.entregar(ana, "ENSAIO_VERAO", verao("GLOSS"));
        assertThat(tres).containsEntry("estrelas", 3).containsEntry("prestigioGanho", 40);
        assertThat((Map<String, Object>) tres.get("carreira")).containsEntry("nivel", 2).containsEntry("prestigio", 60);

        Map<String, Object> repetida = service.entregar(ana, "ENSAIO_VERAO", verao("GLOSS"));
        assertThat(repetida).containsEntry("prestigioGanho", 0);
        assertThat(brief(service.briefs(ana), "ENSAIO_VERAO")).containsEntry("melhoresEstrelas", 3);
        assertThat(brief(service.briefs(ana), "PRIMEIRO_ENCONTRO")).containsEntry("liberado", true);
        assertThat(service.carreira(bia)).containsEntry("prestigio", 0);
    }

    @Test
    void cartaAlheiaEForaDaPaletaSao422() {
        FlairCardInstance daBia = kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(bia.id(), "SUP"));
        ApiException alheia = catchThrowableOfType(ApiException.class,
                () -> service.entregar(ana, "ENTREVISTA", new Entrega(Map.of("SUP", daBia.getId()), null, null, null)));
        assertThat(alheia.status()).isEqualTo(422);
        assertThat(alheia.code()).isEqualTo("CARTA_ALHEIA");
        Entrega azul = new Entrega(null, null, Map.of("LABIOS", new Entrega.Maquiagem("AZUL", "FOSCO")), null);
        assertThat(catchThrowableOfType(ApiException.class, () -> service.entregar(ana, "ENTREVISTA", azul)).status()).isEqualTo(422);
    }

    @Test
    void detalheTrazRegrasVagasAreasEPaleta() {
        Map<String, Object> d = service.detalhe("entrevista");
        assertThat(d).containsEntry("codigo", "ENTREVISTA").containsEntry("nivelMin", 1).containsKeys("regras", "vagas", "areas", "paleta");
        assertThat(FlairMakeUpPaleta.FAMILIAS.get("LABIOS")).containsExactly("NUDE", "ROSA", "CORAL", "VERMELHO", "VINHO");
    }
}
