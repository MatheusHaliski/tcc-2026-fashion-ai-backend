package br.com.fashionai.application.flair3d;

import java.util.List;

/**
 * Definição pública de um núcleo do FLAIR 3D (GET /api/flair/3d/nucleos/{codigo}): só códigos; os textos ficam nos
 * catálogos de i18n do frontend ({@code flair3d.nucleo.<CODIGO>.*}).
 */
public record Definicao(String codigo, int numero, Objetivo objetivo, List<String> recursos, List<String> vagas,
                        List<String> zonas, List<String> areas, List<String> opcoes, List<String> acoes, Deck deck) {
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
