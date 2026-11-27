package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Construtor;

import java.util.List;

/**
 * As nove salas do caso "A Coleção Maré" (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md, seções 3, 5 e 7): os pontos,
 * os esconderijos, os armários com as cinco chaves de {@code FashionDetectiveMundo} e as pistas P1 a P12, os vigias e o
 * enigma de cada sala. As portas e as chaves que as abrem estão em {@code FashionDetectiveMundo}.
 */
public final class DetetiveSalas {
    /** Pistas que chegam rasgadas (meia folha): a carta branca completa o texto. */
    public static final List<String> PISTAS_PELA_METADE = List.of("P4", "P8", "P11");
    public static final List<String> PISTAS = List.of("P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12");
    /** A pista que Iolanda entrega ao entrar na passarela. */
    public static final String PISTA_DA_PASSARELA = "P12";
    /** Onde fica o balcão do mercado (carta vermelha). */
    public static final String SALA_DO_MERCADO = "CLUBE";
    public static final String PONTO_DO_MERCADO = "bar";

    public static final List<DetetiveSala> SALAS = List.of(
            new Construtor("ENTRADA")
                    .ponto("tapete", 0, 2.4).ponto("meio", 0, 0).ponto("recepcao", -3, 1.5).ponto("casacos", -3, -1.5)
                    .esconderijo("coluna", 3, 1.5).ponto("rua", 3, -1.5).ponto("portaSalao", 0, -2.2)
                    .armario("MESA_DA_RECEPCAO", "recepcao", null, "P1").armario("ARMARIO_DE_CASACOS", "casacos", "K1", null)
                    .saida("portaSalao", "SALAO").saida("rua", "CLUBE")
                    .vigia("SEG_ENTRADA", "SEGURANCA", 0, null, null, -3.5, -2.9, -1.2, -2.9, 1.2, -2.9, 3.5, -2.9, 1.2, -2.9, -1.2, -2.9)
                    .enigma("LISTA_DE_CONVIDADOS", 1, "MARINA_SOLER", "DORA_VILAR", "OTAVIO_REIS").montar(),
            new Construtor("SALAO")
                    .ponto("portaEntrada", 0, 2.4).ponto("meio", 0, 0).esconderijo("mesas", -3, 1).ponto("palco", 3, 1)
                    .ponto("portaCamarim", 3, -1.8).ponto("portaSeguranca", -3, -1.8).ponto("portaEscritorio", 0, -2.4)
                    .saida("portaEntrada", "ENTRADA").saida("portaCamarim", "CAMARIM").saida("portaSeguranca", "SEGURANCA")
                    .saida("portaEscritorio", "ESCRITORIO")
                    .vigia("SEG_SALAO", "SEGURANCA", 0, "P2", null, 1.5, 2, 1.5, 0, 1.5, -2, 1.5, 0)
                    .vigia("SEG_PORTA", "SEGURANCA", 90, null, "SEGURANCA", -3.6, -1.2)
                    .enigma("MAPA_DE_MESAS", 2, "MESA_3", "MESA_5", "MESA_7").montar(),
            new Construtor("SEGURANCA")
                    .ponto("portaSalao", 0, 2.4).ponto("meio", 0, 0).ponto("painel", -3, -1).ponto("livro", 3, -1)
                    .esconderijo("arquivoMorto", -3, 1.5).ponto("monitores", 3, 1.5)
                    .armario("PAINEL_DE_CHAVES", "painel", "K3", null).armario("LIVRO_DE_PONTO", "livro", null, "P3")
                    .saida("portaSalao", "SALAO")
                    .vigia("VIGIA_SEG", "VIGIA", 0, null, null, -3.5, -2.6, 0, -2.6, 3.5, -2.6, 0, -2.6)
                    .enigma("LINHA_DO_TEMPO", 0, "CORREDOR_COFRE_CAMARIM", "COFRE_CORREDOR_CAMARIM", "CAMARIM_CORREDOR_COFRE").montar(),
            new Construtor("CAMARIM")
                    .ponto("portaSalao", 0, 2.4).ponto("meio", 0, 0).esconderijo("araras", -3, 1.5).ponto("penteadeira", 3, 1.5)
                    .ponto("kit", 3, -1.2).ponto("portaCorredor", -3, -1.5)
                    .armario("GAVETA_DA_PENTEADEIRA", "penteadeira", "K2", null).armario("KIT_DE_COSTURA", "kit", null, "P4")
                    .saida("portaSalao", "SALAO").saida("portaCorredor", "ATELIE")
                    .vigia("ASSIST_CAMARIM", "ASSISTENTE", 0, null, null, -3.5, -2.6, 0, -2.6, 3.5, -2.6, 0, -2.6)
                    .enigma("AMOSTRAS", 1, "POLIESTER_BRILHANTE", "SEDA_MARFIM", "LINHO_CRU").resolucaoDa("P5").montar(),
            new Construtor("CLUBE")
                    .ponto("rua", 0, 2.4).ponto("pista", 0, 0).ponto("bar", -3, 1.5).ponto("cabine", 3, 1.5)
                    .esconderijo("deposito", -3, -1.5).ponto("caixas", 3, -1.5).ponto("escada", 0, -2.4)
                    .armario("ARMARIO_DE_FERRAMENTAS", "caixas", "K4", null)
                    .saida("rua", "ENTRADA").saida("escada", "ATELIE")
                    .vigia("PORTEIRO", "PORTEIRO", 270, null, "ATELIE", 0.9, -2.7)
                    .vigia("RAFA", "RAFA", 0, "P6", null, 3.3, 2.2)
                    .enigma("SETLIST", 2, "MAIS_RAPIDA_PRIMEIRO", "EM_ORDEM_ALFABETICA", "MAIS_LENTA_PRIMEIRO").montar(),
            new Construtor("ATELIE")
                    .ponto("escada", -3, 2).ponto("corredor", 3, 2).ponto("meio", 0, 0.5).esconderijo("mesaCorte", -3, -1)
                    .ponto("caixaChapeu", 3, -1).ponto("portaArquivo", -1.5, -2.5).ponto("portaPassarela", 1.5, -2.5)
                    .armario("CAIXA_DE_CHAPEU", "caixaChapeu", null, "P7")
                    .saida("escada", "CLUBE").saida("corredor", "CAMARIM").saida("portaArquivo", "ARQUIVO").saida("portaPassarela", "PASSARELA")
                    .vigia("ASSIST_ATELIE", "ASSISTENTE", 0, null, null, -3.5, -2.0, 0, -2.0, 3.5, -2.0, 0, -2.0)
                    .enigma("MOLDE", 0, "PENCE_PARA_O_BUSTO", "PENCE_PARA_A_CINTURA", "SEM_PENCE").montar(),
            new Construtor("ARQUIVO")
                    .ponto("porta", 0, 2.4).ponto("corredor", 0, 0).esconderijo("estanteA", -3, 1).esconderijo("estanteB", 3, 1)
                    .ponto("cofre", -3, -1.5).ponto("mapoteca", 3, -1.5)
                    .armario("REGISTRO_DO_COFRE", "cofre", null, "P8")
                    .saida("porta", "ATELIE")
                    .vigia("VIGIA_ARQ", "VIGIA", 0, null, null, -3.5, -0.5, 0, -0.5, 3.5, -0.5, 0, -0.5)
                    .vigia("TEO", "TEO", 90, "P9", null, 3.4, -2.2)
                    .enigma("CODIGO_DO_COFRE", 1, "2019_2015_2023", "2015_2019_2023", "2023_2019_2015").montar(),
            new Construtor("ESCRITORIO")
                    .ponto("porta", 0, 2.4).ponto("meio", 0, 0).ponto("mesa", 3, -1).esconderijo("trofeus", -3, -1)
                    .ponto("sofa", -3, 1.5).ponto("janela", 3, 1.5)
                    .armario("GAVETA_DA_MESA", "mesa", "K5", "P11")
                    .saida("porta", "SALAO")
                    .vigia("ASSIST_BENTO", "ASSISTENTE", 0, "P10", null, -3.5, 0.5, 0, 0.5, 3.5, 0.5, 0, 0.5)
                    .enigma("TINTAS", 0, "AZUL_REAL", "PRETA", "VERMELHA").montar(),
            new Construtor("PASSARELA")
                    .ponto("bastidor", 0, 2.4).ponto("passarela", 0, 0).ponto("palco", 0, -2.4)
                    .saida("bastidor", "ATELIE").montar());

    private DetetiveSalas() {
    }

    public static DetetiveSala sala(String id) {
        return SALAS.stream().filter(s -> s.id().equals(id)).findFirst().orElseThrow();
    }
}
