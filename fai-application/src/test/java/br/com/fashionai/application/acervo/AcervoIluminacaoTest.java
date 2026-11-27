package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.acervo.AcervoAmbiente;
import br.com.fashionai.domain.model.acervo.TipoIluminacao;
import br.com.fashionai.domain.repository.acervo.TipoIluminacaoRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.acervo.AcervoKit.de;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercício 07 no acervo (o quarto saiu do app): tipo de iluminação (FK ativa) e temperatura 2700–6500 K do ambiente.
 * Campos relacionais são a única fonte; o GET do acervo devolve a luz derivada deles; legado lê nulo; só o dono muda.
 */
class AcervoIluminacaoTest {
    final AcervoKit kit = new AcervoKit();
    final TipoIluminacaoRepository tipos = MemoryRepository.of(TipoIluminacaoRepository.class);
    final AcervoIluminacaoService luz = new AcervoIluminacaoService(kit.acesso, kit.ambientes, new AcervoLightingWriter(tipos));

    private TipoIluminacao tipo(String codigo, String nome, boolean ativo) {
        TipoIluminacao t = new TipoIluminacao();
        t.assignId(UUID.randomUUID());
        t.setCodigo(codigo);
        t.setNome(nome);
        t.setAtivo(ativo);
        return tipos.save(t);
    }

    private UUID closetDaAna() {
        return (UUID) kit.estrutura.criarAmbiente(de(kit.ana), new AcervoEstruturaService.NomeForm("Closet")).get("id");
    }

    private AcervoAmbiente ambiente(UUID id) {
        return kit.ambientes.findById(id).orElseThrow();
    }

    private static AcervoIluminacaoService.LuzForm luz(UUID tipo, Integer kelvin) {
        return new AcervoIluminacaoService.LuzForm(tipo, kelvin, false, false);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> iluminacaoNoGet(UUID ambienteId) {
        List<Map<String, Object>> ambientes = (List<Map<String, Object>>) kit.pecas.arvore(de(kit.ana)).get("ambientes");
        return (Map<String, Object>) ambientes.stream().filter(a -> ambienteId.equals(a.get("id"))).findFirst().orElseThrow().get("iluminacao");
    }

    @Test
    void ambienteLegadoLeSemClassificacaoNemTemperatura() {
        UUID closet = closetDaAna();
        Map<String, Object> view = iluminacaoNoGet(closet);
        assertThat(view.get("tipo")).isNull();
        assertThat(view.get("temperaturaKelvin")).isNull();
    }

    @Test
    void tipoAtivoETemperaturaNaFaixaGravamEOGetDevolveOsCamposRelacionais() {
        TipoIluminacao quente = tipo("QUENTE", "Luz quente", true);
        UUID closet = closetDaAna();
        Map<String, Object> out = luz.iluminar(de(kit.ana), closet, luz(quente.getId(), 2700));
        assertThat(out).containsKey("iluminacao");
        assertThat(ambiente(closet).getTipoIluminacao()).isEqualTo(quente);
        assertThat(ambiente(closet).getTemperaturaKelvin()).isEqualTo(2700);
        Map<String, Object> view = iluminacaoNoGet(closet);
        assertThat(view.get("temperaturaKelvin")).isEqualTo(2700);
        assertThat((Map<String, Object>) view.get("tipo")).containsEntry("codigo", "QUENTE").containsEntry("nome", "Luz quente");
        luz.iluminar(de(kit.ana), closet, luz(null, 6500));                       // o outro limite da faixa também vale
        assertThat(ambiente(closet).getTemperaturaKelvin()).isEqualTo(6500);
    }

    @Test
    void temperaturaForaDaFaixaERecusadaSemClampENadaMuda() {
        UUID closet = closetDaAna();
        luz.iluminar(de(kit.ana), closet, luz(null, 4000));
        for (int k : new int[]{2699, 6501, 0, 10000}) {
            assertThatThrownBy(() -> luz.iluminar(de(kit.ana), closet, luz(null, k)))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(400));
        }
        assertThat(ambiente(closet).getTemperaturaKelvin()).isEqualTo(4000);
    }

    @Test
    void tipoInativoNovoERecusadoMasOQueOAmbienteJaUsaContinuaValendo() {
        TipoIluminacao natural = tipo("NATURAL", "Luz natural", true);
        UUID closet = closetDaAna();
        luz.iluminar(de(kit.ana), closet, luz(natural.getId(), null));
        natural.setAtivo(false);
        tipos.save(natural);
        luz.iluminar(de(kit.ana), closet, luz(natural.getId(), 5000));           // reenviar o mesmo tipo (já em uso) passa
        assertThat(ambiente(closet).getTipoIluminacao()).isEqualTo(natural);
        TipoIluminacao antiga = tipo("ANTIGA", "Opção retirada", false);
        assertThatThrownBy(() -> luz.iluminar(de(kit.ana), closet, luz(antiga.getId(), null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(400));
        assertThatThrownBy(() -> luz.iluminar(de(kit.ana), closet, luz(UUID.randomUUID(), null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(400));
        assertThat(ambiente(closet).getTipoIluminacao()).isEqualTo(natural);   // a escolha anterior fica
    }

    @Test
    void clienteSoComKelvinNaoApagaOTipoELimparEExplicito() {
        TipoIluminacao fria = tipo("FRIA", "Luz fria", true);
        UUID closet = closetDaAna();
        luz.iluminar(de(kit.ana), closet, luz(fria.getId(), 5600));
        luz.iluminar(de(kit.ana), closet, luz(null, 3200));                      // cliente antigo: só kelvin
        assertThat(ambiente(closet).getTipoIluminacao()).isEqualTo(fria);
        assertThat(ambiente(closet).getTemperaturaKelvin()).isEqualTo(3200);
        luz.iluminar(de(kit.ana), closet, new AcervoIluminacaoService.LuzForm(null, null, true, false));
        assertThat(ambiente(closet).getTipoIluminacao()).isNull();
        assertThat(ambiente(closet).getTemperaturaKelvin()).isEqualTo(3200);
        luz.iluminar(de(kit.ana), closet, new AcervoIluminacaoService.LuzForm(null, null, false, true));
        assertThat(ambiente(closet).getTemperaturaKelvin()).isNull();
        assertThatThrownBy(() -> luz.iluminar(de(kit.ana), closet, new AcervoIluminacaoService.LuzForm(fria.getId(), null, true, false)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(400));
        assertThatThrownBy(() -> luz.iluminar(de(kit.ana), closet, new AcervoIluminacaoService.LuzForm(null, 3000, false, true)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(400));
    }

    @Test
    void outraPessoaNaoMudaALuzDoAmbienteDaAna() {
        TipoIluminacao quente = tipo("QUENTE", "Luz quente", true);
        UUID closet = closetDaAna();
        assertThatThrownBy(() -> luz.iluminar(de(kit.bia), closet, luz(quente.getId(), 3000)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThat(ambiente(closet).getTipoIluminacao()).isNull();
        assertThat(ambiente(closet).getTemperaturaKelvin()).isNull();
    }
}
