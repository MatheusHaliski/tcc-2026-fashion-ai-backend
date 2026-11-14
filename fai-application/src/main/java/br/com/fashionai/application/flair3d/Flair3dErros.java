package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.util.Map;

/** Erros do FLAIR 3D (núcleos, MAKE UP e elencos): código estável para o frontend e texto no idioma de quem lê. */
public final class Flair3dErros {
    private Flair3dErros() {
    }

    public static ApiException naoEncontrado(String codigo, String chave) {
        return new ApiException(404, codigo, Msg.t("flair3d.erro." + chave));
    }

    public static ApiException cartaAlheia(Object cartas) {
        return new ApiException(422, "CARTA_ALHEIA", Msg.t("flair3d.erro.carta_alheia"), Map.of("cartas", cartas));
    }

    public static ApiException invalido(String codigo, String chave) {
        return new ApiException(422, codigo, Msg.t("flair3d.erro." + chave));
    }

    public static ApiException invalido(String codigo, String chave, Map<String, Object> detalhes) {
        return new ApiException(422, codigo, Msg.t("flair3d.erro." + chave), detalhes);
    }
}
