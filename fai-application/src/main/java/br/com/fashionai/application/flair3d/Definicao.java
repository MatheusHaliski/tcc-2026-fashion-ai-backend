package br.com.fashionai.application.flair3d;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Definição pública de um núcleo do FLAIR 3D (GET /api/flair/3d/nucleos/{codigo}): só códigos; os textos ficam nos
 * catálogos de i18n do frontend ({@code flair3d.nucleo.<CODIGO>.*}).
 */
public record Definicao(String codigo, int numero, Objetivo objetivo, List<String> recursos, List<String> vagas,
                        List<String> zonas, List<String> areas, List<String> opcoes, List<String> acoes, Deck deck,
                        Avatares avatares, List<Rodada> rodadas) {
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
        rodadas = rodadas == null || rodadas.isEmpty() ? List.of(new Rodada(objetivo.codigo(), objetivo, zonas, opcoes)) : List.copyOf(rodadas);
    }

    public Definicao(String codigo, int numero, Objetivo objetivo, List<String> recursos, List<String> vagas, List<String> zonas,
                     List<String> areas, List<String> opcoes, List<String> acoes, Deck deck, Avatares avatares) {
        this(codigo, numero, objetivo, recursos, vagas, zonas, areas, opcoes, acoes, deck, avatares, null);
    }

    /** Núcleo de cartas: recursos (CARTAS e o que mais vier), vagas, deck e se a pessoa desfila. */
    public static Definicao cartas(String codigo, int numero, Objetivo objetivo, List<String> recursos, List<String> vagas,
                                   Deck deck, boolean desfile) {
        return new Definicao(codigo, numero, objetivo, recursos, vagas, List.of(), List.of(), List.of(),
                desfile ? acoesComDesfile() : ACOES, deck.semDeck() || !deck.posicoes().isEmpty() ? deck : deck.so(vagas), Avatares.solo(null));
    }

    /** Núcleo do editor: zonas com cor e acabamento, sem deck; {@code opcoes} quando há resposta (emblema). */
    public static Definicao zonas(String codigo, int numero, Objetivo objetivo, List<String> zonas, List<String> opcoes) {
        List<String> recursos = opcoes.isEmpty() ? List.of(ZONAS) : List.of(ZONAS, RESPOSTA);
        Avatares avatares = new Avatares(List.of(Avatares.figurante("MANEQUIM", 1), new Avatares.Solo(Avatares.PROPRIO, "OPCIONAL", 1)), null);
        return new Definicao(codigo, numero, objetivo, recursos, List.of(), zonas, List.of(), opcoes, ACOES_ZONAS, Deck.SEM_DECK, avatares);
    }

    public Definicao comOpcoes(List<String> novas) {
        return new Definicao(codigo, numero, objetivo, recursos, vagas, zonas, areas, novas, acoes, deck, avatares, rodadas);
    }

    public Definicao comAreas(List<String> novas) {
        return new Definicao(codigo, numero, objetivo, recursos, vagas, zonas, novas, opcoes, acoes, deck, avatares, rodadas);
    }

    public Definicao comAvatares(Avatares novos) {
        return new Definicao(codigo, numero, objetivo, recursos, vagas, zonas, areas, opcoes, acoes, deck, novos, rodadas);
    }

    /** As rodadas do jogo, depois da primeira (o objetivo mais simples, que continua sendo a rodada padrão). */
    public Definicao comRodadas(Rodada... outras) {
        List<Rodada> todas = new ArrayList<>(rodadas);
        todas.addAll(List.of(outras));
        return new Definicao(codigo, numero, objetivo, recursos, vagas, zonas, areas, opcoes, acoes, deck, avatares, todas);
    }

    /** As rodadas com a dada na frente: ela passa a ser a primeira da tela (o objetivo mais simples continua na lista). */
    public Definicao comRodadaNaFrente(Rodada primeira) {
        List<Rodada> todas = new ArrayList<>(List.of(primeira));
        todas.addAll(rodadas);
        return new Definicao(codigo, numero, objetivo, recursos, vagas, zonas, areas, opcoes, acoes, deck, avatares, todas);
    }

    /**
     * A definição vista pela rodada da partida: o objetivo dela e, quando a rodada tem as suas, as zonas que se pintam e
     * as opções de resposta. Rodada nula ou desconhecida devolve a definição como está.
     */
    public Definicao naRodada(String codigoDaRodada) {
        Rodada r = rodada(codigoDaRodada).orElse(null);
        if (r == null) {
            return this;
        }
        return new Definicao(codigo, numero, r.objetivo(), recursos, vagas, r.zonas().isEmpty() ? zonas : r.zonas(), areas,
                r.opcoes().isEmpty() ? opcoes : r.opcoes(), acoes, deck, avatares, rodadas);
    }

    /** A rodada pelo código; nulo ou desconhecido devolve vazio. */
    public Optional<Rodada> rodada(String codigoDaRodada) {
        return rodadas.stream().filter(r -> r.codigo().equals(codigoDaRodada)).findFirst();
    }

    public static Objetivo objetivo(String codigo, Regra... regras) {
        return new Objetivo(codigo, List.of(regras));
    }

    /** Ações dos núcleos de cartas, com "desfilar ou caminhar" onde o contrato manda. */
    public static List<String> acoesComDesfile() {
        List<String> out = new ArrayList<>(ACOES);
        out.add(out.indexOf("ENTREGAR"), "DESFILAR");
        return List.copyOf(out);
    }

    /** Objetivo mais simples do núcleo e as regras que pontuam. */
    public record Objetivo(String codigo, List<Regra> regras) {
        public Objetivo {
            regras = List.copyOf(regras);
        }
    }

    /**
     * Uma rodada do jogo: o objetivo com as regras dela e, quando mudam, as zonas que se pintam e as opções de resposta.
     * {@code etapas} maior que 1 diz que a rodada pede um look por etapa (a partida segue aberta entre elas).
     */
    public record Rodada(String codigo, Objetivo objetivo, List<String> zonas, List<String> opcoes, int etapas) {
        public Rodada {
            zonas = zonas == null ? List.of() : List.copyOf(zonas);
            opcoes = opcoes == null ? List.of() : List.copyOf(opcoes);
            etapas = Math.max(1, etapas);
        }

        public Rodada(String codigo, Objetivo objetivo, List<String> zonas, List<String> opcoes) {
            this(codigo, objetivo, zonas, opcoes, 1);
        }

        /** Rodada de um look só, com as regras dadas. */
        public static Rodada de(String codigo, Regra... regras) {
            return new Rodada(codigo, new Objetivo(codigo, List.of(regras)), List.of(), List.of(), 1);
        }

        public Rodada emEtapas(int quantas) {
            return new Rodada(codigo, objetivo, zonas, opcoes, quantas);
        }

        public Rodada comZonas(List<String> novas) {
            return new Rodada(codigo, objetivo, novas, opcoes, etapas);
        }

        public Rodada comOpcoes(List<String> novas) {
            return new Rodada(codigo, objetivo, zonas, novas, etapas);
        }
    }

    /** Uma regra do objetivo e quanto ela vale (12,5 no figurino do PERSONAGEM_FILME, por isso double). */
    public record Regra(String codigo, double pontos) {
    }

    /**
     * O deck da partida: tamanho máximo, posições obrigatórias, se o núcleo dispensa deck e as posições de carta que o
     * jogo usa ({@code posicoes}; vazio = qualquer uma). Num núcleo de cartas são as vagas do look: a carta de outra
     * posição não teria onde entrar, e o deck a recusa.
     */
    public record Deck(Integer tamanhoMax, List<Obrigatoria> obrigatorias, boolean semDeck, List<String> posicoes) {
        public static final Deck SEM_DECK = new Deck(null, List.of(), true);

        public Deck {
            obrigatorias = List.copyOf(obrigatorias);
            posicoes = posicoes == null ? List.of() : List.copyOf(posicoes);
        }

        public Deck(Integer tamanhoMax, List<Obrigatoria> obrigatorias, boolean semDeck) {
            this(tamanhoMax, obrigatorias, semDeck, List.of());
        }

        public static Deck ate(int tamanhoMax, Obrigatoria... obrigatorias) {
            return new Deck(tamanhoMax, List.of(obrigatorias), false);
        }

        /** O mesmo deck, aceitando só as cartas destas posições. */
        public Deck so(List<String> novas) {
            return new Deck(tamanhoMax, obrigatorias, semDeck, novas);
        }

        /** A carta desta posição entra no deck? */
        public boolean aceita(String posicao) {
            return posicoes.isEmpty() || posicoes.contains(posicao);
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
