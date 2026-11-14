package br.com.fashionai.application.flair3d;

import java.util.List;

/**
 * Definição pública de um núcleo do FLAIR 3D (GET /api/flair/3d/nucleos/{codigo}): só códigos; os textos ficam nos
 * catálogos de i18n do frontend ({@code flair3d.nucleo.<CODIGO>.*}).
 */
public record Definicao(String codigo, int numero, Objetivo objetivo, List<String> recursos, List<String> vagas,
                        List<String> zonas, List<String> areas, List<String> opcoes, List<String> acoes, Deck deck,
                        Avatares avatares) {
    public static final String CARTAS = "CARTAS";
    public static final String ZONAS = "ZONAS";
    public static final String MAQUIAGEM = "MAQUIAGEM";
    public static final String RESPOSTA = "RESPOSTA";
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE", "VES");
    public static final List<String> AREAS = List.of("LABIOS", "OLHOS", "BOCHECHAS");
    public static final List<String> ACOES = List.of("NAVEGAR", "TROCAR_ABA", "VESTIR", "TIRAR", "GIRAR", "ZOOM", "POSAR",
            "ENTREGAR", "VER_OBJETIVO");
    public static final List<String> ACOES_ZONAS = List.of("NAVEGAR", "TROCAR_ABA", "VESTIR", "GIRAR", "ZOOM", "POSAR",
            "ENTREGAR", "VER_OBJETIVO");

    public Definicao {
        recursos = List.copyOf(recursos);
        vagas = List.copyOf(vagas);
        zonas = List.copyOf(zonas);
        areas = List.copyOf(areas);
        opcoes = List.copyOf(opcoes);
        acoes = List.copyOf(acoes);
    }

    /** Núcleo de cartas: recursos (CARTAS e o que mais vier), vagas, deck e se a pessoa desfila. */
    public static Definicao cartas(String codigo, int numero, Objetivo objetivo, List<String> recursos, List<String> vagas,
                                   Deck deck, boolean desfile) {
        return new Definicao(codigo, numero, objetivo, recursos, vagas, List.of(), List.of(), List.of(),
                desfile ? acoesComDesfile() : ACOES, deck, Avatares.solo(null));
    }

    /** Núcleo do editor: zonas com cor e acabamento, sem deck; {@code opcoes} quando há resposta (emblema). */
    public static Definicao zonas(String codigo, int numero, Objetivo objetivo, List<String> zonas, List<String> opcoes) {
        List<String> recursos = opcoes.isEmpty() ? List.of(ZONAS) : List.of(ZONAS, RESPOSTA);
        Avatares avatares = new Avatares(List.of(Avatares.figurante("MANEQUIM", 1), new Avatares.Solo(Avatares.PROPRIO, "OPCIONAL", 1)), null);
        return new Definicao(codigo, numero, objetivo, recursos, List.of(), zonas, List.of(), opcoes, ACOES_ZONAS, Deck.SEM_DECK, avatares);
    }

    public Definicao comOpcoes(List<String> novas) {
        return new Definicao(codigo, numero, objetivo, recursos, vagas, zonas, areas, novas, acoes, deck, avatares);
    }

    public Definicao comAreas(List<String> novas) {
        return new Definicao(codigo, numero, objetivo, recursos, vagas, zonas, novas, opcoes, acoes, deck, avatares);
    }

    public Definicao comAvatares(Avatares novos) {
        return new Definicao(codigo, numero, objetivo, recursos, vagas, zonas, areas, opcoes, acoes, deck, novos);
    }

    public static Objetivo objetivo(String codigo, Regra... regras) {
        return new Objetivo(codigo, List.of(regras));
    }

    /** Ações dos núcleos de cartas, com "desfilar ou caminhar" onde o contrato manda. */
    public static List<String> acoesComDesfile() {
        List<String> out = new java.util.ArrayList<>(ACOES);
        out.add(out.indexOf("ENTREGAR"), "DESFILAR");
        return List.copyOf(out);
    }

    /** Objetivo mais simples do núcleo e as regras que pontuam. */
    public record Objetivo(String codigo, List<Regra> regras) {
        public Objetivo {
            regras = List.copyOf(regras);
        }
    }

    /** Uma regra do objetivo e quanto ela vale (12,5 no figurino do PERSONAGEM_FILME, por isso double). */
    public record Regra(String codigo, double pontos) {
    }

    /** O deck da partida: tamanho máximo, posições obrigatórias e se o núcleo dispensa deck. */
    public record Deck(Integer tamanhoMax, List<Obrigatoria> obrigatorias, boolean semDeck) {
        public static final Deck SEM_DECK = new Deck(null, List.of(), true);

        public Deck {
            obrigatorias = List.copyOf(obrigatorias);
        }

        public static Deck ate(int tamanhoMax, Obrigatoria... obrigatorias) {
            return new Deck(tamanhoMax, List.of(obrigatorias), false);
        }
    }

    /**
     * Cartas obrigatórias no deck: {@code posicao} é uma posição de carta, alternativas separadas por "|" (SUP|VES), ou
     * ANY para qualquer carta.
     */
    public record Obrigatoria(String posicao, int quantidade) {
        public static Obrigatoria uma(String posicao) {
            return new Obrigatoria(posicao, 1);
        }
    }
}
