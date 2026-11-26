package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.acervo.AcervoAmbiente;
import br.com.fashionai.domain.model.acervo.TipoIluminacao;
import br.com.fashionai.domain.repository.acervo.TipoIluminacaoRepository;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Exercício 07 (no lugar do RoomLightingWriter do quarto, que saiu do app): grava a luz do ambiente do acervo. Os campos
 * relacionais (tipo de iluminação e temperatura em kelvin) são a única fonte — não há JSON paralelo para divergir; a cena
 * recebe a luz derivada deles por {@link #view(AcervoAmbiente)}.
 * <ul>
 *   <li>tipo: ID nulo mantém o atual; {@code limparTipo} deixa sem classificação; ID novo precisa existir e estar ativo; o
 *   tipo que o ambiente já tem continua valendo mesmo depois de desativado;</li>
 *   <li>temperatura: nula mantém a atual (cliente que manda só o tipo, ou só o kelvin, não apaga o outro campo);
 *   {@code limparTemperatura} apaga; fora de 2700–6500 K é recusada com 400 — não há "clamp" silencioso.</li>
 * </ul>
 * Chamado pelo {@link AcervoIluminacaoService} depois da autorização, dentro da transação.
 */
@Component
public class AcervoLightingWriter {
    public static final int KELVIN_MIN = 2700;
    public static final int KELVIN_MAX = 6500;

    private final TipoIluminacaoRepository tipos;

    public AcervoLightingWriter(TipoIluminacaoRepository tipos) {
        this.tipos = tipos;
    }

    public void apply(AcervoAmbiente ambiente, UUID tipoIluminacaoId, boolean limparTipo, Integer kelvin, boolean limparTemperatura) {
        if (tipoIluminacaoId != null && limparTipo) {
            throw invalid("TIPO_ILUMINACAO_INVALIDO", "tipoIluminacaoId", Msg.t("acervoLuz.tipo_ou_limpar"));
        }
        if (kelvin != null && limparTemperatura) {
            throw invalid("TEMPERATURA_INVALIDA", "temperaturaKelvin", Msg.t("acervoLuz.temperatura_ou_limpar"));
        }
        if (kelvin != null && (kelvin < KELVIN_MIN || kelvin > KELVIN_MAX)) {
            throw invalid("TEMPERATURA_FORA_DA_FAIXA", "temperaturaKelvin",
                    Msg.t("acervoLuz.temperatura_fora_da_faixa", String.valueOf(KELVIN_MIN), String.valueOf(KELVIN_MAX)));
        }
        if (limparTipo) {
            ambiente.setTipoIluminacao(null);
        } else if (tipoIluminacaoId != null) {
            TipoIluminacao atual = ambiente.getTipoIluminacao();
            if (atual == null || !tipoIluminacaoId.equals(atual.getId())) {
                ambiente.setTipoIluminacao(ativo(tipoIluminacaoId));
            }
        }
        if (limparTemperatura) {
            ambiente.setTemperaturaKelvin(null);
        } else if (kelvin != null) {
            ambiente.setTemperaturaKelvin(kelvin);
        }
    }

    /** A luz do ambiente como a cena lê: o tipo (id, código, nome) e o kelvin; ambiente legado devolve os dois nulos. */
    public static Map<String, Object> view(AcervoAmbiente ambiente) {
        TipoIluminacao t = ambiente.getTipoIluminacao();
        Map<String, Object> tipo = null;
        if (t != null) {
            tipo = new LinkedHashMap<>();
            tipo.put("id", t.getId());
            tipo.put("codigo", t.getCodigo());
            tipo.put("nome", t.getNome());
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tipo", tipo);
        out.put("temperaturaKelvin", ambiente.getTemperaturaKelvin());
        return out;
    }

    private TipoIluminacao ativo(UUID id) {
        TipoIluminacao t = tipos.findById(id).orElseThrow(() -> invalid("TIPO_ILUMINACAO_INVALIDO", "tipoIluminacaoId", Msg.t("acervoLuz.tipo_invalido")));
        if (!t.isAtivo()) {
            throw invalid("TIPO_ILUMINACAO_INATIVO", "tipoIluminacaoId", Msg.t("acervoLuz.tipo_inativo"));
        }
        return t;
    }

    private static ApiException invalid(String code, String field, String message) {
        return ApiException.badRequest(code, message, Map.of(field, message));
    }
}
