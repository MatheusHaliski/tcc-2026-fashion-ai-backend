package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoMovel;

import java.util.List;
import java.util.Map;

/** Regras puras do ACERVO: opções aceitas na configuração do móvel, limites de medidas e de quantidade. */
final class AcervoRegras {
    static final List<String> MODOS = List.of(AcervoMovel.MEU_ESPACO, AcervoMovel.DREAM_SPACE);
    static final List<String> MATERIAIS = List.of("MADEIRA", "LACA", "VIDRO", "METAL");
    static final List<String> CORES = List.of("NOGUEIRA", "CARVALHO", "FREIJO", "EBANO", "MARFIM", "AREIA", "GRAFITE", "BRANCO");
    static final List<String> PORTAS = List.of("SEM_PORTA", "ABRIR", "CORRER", "VIDRO");
    static final List<String> PUXADORES = List.of("BARRA", "BOTAO", "CAVA", "SEM_PUXADOR");
    static final List<String> ACABAMENTOS = List.of("LATAO", "GRAFITE", "CROMADO", "PRETO");
    static final List<String> TIPOS = List.of(AcervoCompartimento.CABIDEIRO, AcervoCompartimento.PRATELEIRA, AcervoCompartimento.GAVETA);

    static final int MAX_AMBIENTES = 12;
    static final int MAX_MOVEIS_POR_AMBIENTE = 12;
    static final int MAX_POR_TIPO = 8;
    static final int MAX_DESEJOS = 200;
    static final int MAX_PECAS_POR_PEDIDO = 500;

    /** Limites em centímetros: [mínimo, máximo]. */
    static final int[] LARGURA = {40, 400};
    static final int[] ALTURA = {40, 300};
    static final int[] PROFUNDIDADE = {20, 100};

    private AcervoRegras() {
    }

    static String nome(String valor, int max) {
        String limpo = InputSanitizer.clean(valor, max);
        if (limpo == null || limpo.isBlank()) {
            throw ApiException.badRequest("ACERVO_NOME", Msg.t("acervo.erro.nome"), Map.of("nome", Msg.t("acervo.erro.nome")));
        }
        return limpo;
    }

    static String opcional(String valor, int max) {
        String limpo = InputSanitizer.clean(valor, max);
        return limpo == null || limpo.isBlank() ? null : limpo;
    }

    /** Valor escolhido entre as opções; nulo usa o padrão. */
    static String opcao(String campo, String valor, List<String> opcoes, String padrao) {
        if (valor == null || valor.isBlank()) {
            return padrao;
        }
        if (!opcoes.contains(valor)) {
            throw ApiException.badRequest("ACERVO_OPCAO", Msg.t("acervo.erro.opcao"), Map.of(campo, Msg.t("acervo.erro.opcao")));
        }
        return valor;
    }

    static int medida(String campo, Integer valor, int[] limites, int padrao) {
        if (valor == null) {
            return padrao;
        }
        if (valor < limites[0] || valor > limites[1]) {
            String texto = Msg.t("acervo.erro.medida", limites[0], limites[1]);
            throw ApiException.badRequest("ACERVO_MEDIDA", texto, Map.of(campo, texto));
        }
        return valor;
    }

    static int quantidade(String campo, Integer valor, int padrao) {
        if (valor == null) {
            return padrao;
        }
        if (valor < 0 || valor > MAX_POR_TIPO) {
            String texto = Msg.t("acervo.erro.quantidade", MAX_POR_TIPO);
            throw ApiException.badRequest("ACERVO_QUANTIDADE", texto, Map.of(campo, texto));
        }
        return valor;
    }

    static void limite(long atual, int max, String codigo, String chave) {
        if (atual >= max) {
            throw ApiException.conflict(codigo, Msg.t(chave, max));
        }
    }

    static String tipo(String valor) {
        if (valor == null || !TIPOS.contains(valor)) {
            throw ApiException.badRequest("ACERVO_TIPO", Msg.t("acervo.erro.tipo"), Map.of("tipo", Msg.t("acervo.erro.tipo")));
        }
        return valor;
    }

    /** Nome padrão de um compartimento novo: "Gaveta 2". */
    static String nomePadrao(String tipo, int numero) {
        return Msg.t("acervo.nome." + tipo.toLowerCase(java.util.Locale.ROOT), numero);
    }
}
