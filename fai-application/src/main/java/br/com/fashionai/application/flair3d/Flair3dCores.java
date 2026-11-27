package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * A cor da peça decide a ação (docs/flair/flair-3d/CORES_E_ACOES.md): no FASHION_SPORTS a peça que entra em campo dispara
 * na hora a ação da família de cor dela; no FASHION_DETECTIVE cada família de cor é uma ação do detetive. As famílias são
 * as da taxonomia ("Preto", "Verde"...). Nos outros jogos de cartas a cor dá um efeito de cena ao entrar. Peça sem
 * família mapeada não tem ação. Nada aqui olha pele, corpo ou rosto.
 */
public final class Flair3dCores {
    /** Esportes: preto defende (desarme e carrinho), verde chuta, amarelo dribla, azul corre, vermelho passa, branco é o goleiro. */
    public static final Map<String, String> ESPORTE = Map.of("Preto", "DEFESA", "Verde", "CHUTE", "Amarelo", "DRIBLE",
            "Azul", "CORRIDA", "Vermelho", "PASSE", "Branco", "GOLEIRO");
    /** Detetive: verde abre gavetas e armários, preto é furtividade, amarelo é vida, azul é dano, branco é pista, vermelho é moeda. */
    public static final Map<String, String> DETETIVE = Map.of("Verde", "ABRIR", "Preto", "FURTIVIDADE", "Amarelo", "VIDA",
            "Azul", "DANO", "Branco", "PISTA", "Vermelho", "MOEDA");

    /** A ordem das famílias em todas as tabelas; o efeito da cor leva a posição da família (1 a 6) para a tela pintar. */
    public static final List<String> FAMILIAS = List.of("Preto", "Verde", "Amarelo", "Azul", "Vermelho", "Branco");

    /**
     * Os outros jogos de cartas: a cor da peça dá um efeito de cena ao entrar (luz, plateia, cenário), sem mudar a nota.
     * Um nome por família, na ordem de {@link #FAMILIAS}.
     */
    public static final Map<String, Map<String, String>> DE_CENA = Map.of(
            "PASSARELA", tabela("SILHUETA", "BRISA", "HOLOFOTE", "FLASHES", "APLAUSOS", "PASSARELA_ACESA"),
            "DRESS_FIGHTER", tabela("GUARDA", "ESQUIVA", "GOLPE_RAPIDO", "FOLEGO", "GOLPE_FORTE", "FOCO"),
            "DRESS_THE_STAR", tabela("ELEGANCIA", "FRESCOR", "BRILHO", "SERENIDADE", "TAPETE_VERMELHO", "FLASH_FOTOGRAFOS"),
            "PERSONAGEM_FILME", tabela("SUSPENSE", "AVENTURA", "COMEDIA", "FICCAO", "ROMANCE", "CLAQUETE"),
            "ROAD_TO_GLORY", tabela("CONTRASTE", "NATURAL", "LUZ_DOURADA", "LUZ_FRIA", "DESTAQUE", "REBATEDOR"),
            "BOUTIQUE_3D", tabela("VITRINE_NOITE", "ETIQUETA", "PLACA_DESTAQUE", "CLIENTE_OLHA", "CLIENTE_SORRI", "VITRINE_ACESA"),
            "LABIRINTO", tabela("SOMBRA", "TRILHA", "LANTERNA", "REFLEXO", "ALERTA", "CLARAO"),
            "AROUND_THE_WORLD", tabela("NOITE_NA_CIDADE", "PARQUE", "SOL", "MAR", "FESTA_DE_RUA", "INVERNO"),
            "BATALHA_LOOKS", tabela("IMPACTO", "VIBRACAO", "FAISCAS", "ONDA", "CHAMAS", "ESTROBO"));

    private Flair3dCores() {
    }

    private static Map<String, String> tabela(String... acoes) {
        Map<String, String> out = new LinkedHashMap<>();
        for (int i = 0; i < FAMILIAS.size(); i++) {
            out.put(FAMILIAS.get(i), acoes[i]);
        }
        return out;
    }

    /** A tabela de cores do jogo: a de regra (esporte, detetive) ou a de cena; nula nos jogos sem cartas. */
    public static Map<String, String> tabelaDe(String nucleo) {
        if ("FASHION_SPORTS".equals(nucleo)) {
            return ESPORTE;
        }
        return "FASHION_DETECTIVE".equals(nucleo) ? DETETIVE : DE_CENA.get(nucleo);
    }

    /** A família de cor da carta que tem ação na tabela (a mesma escolha de {@link #acao}), ou nula. */
    public static String familia(Map<String, String> tabela, CbcRules.Card carta) {
        if (carta == null || tabela == null) {
            return null;
        }
        for (String cor : new TreeSet<>(carta.colors())) {
            String familia = Taxonomy.COLOR_FAMILY.get(cor);
            if (familia != null && tabela.containsKey(familia)) {
                return familia;
            }
        }
        return null;
    }

    /**
     * O efeito da cor da carta no jogo: código "COR_" + ação (no esporte, "ACAO_" + ação) e, como valor, a posição da
     * família em {@link #FAMILIAS}. Nulo quando a carta não tem cor com efeito ou o jogo não tem tabela.
     */
    public static Efeito efeitoDaCor(String nucleo, CbcRules.Card carta) {
        Map<String, String> tabela = tabelaDe(nucleo);
        String familia = familia(tabela, carta);
        if (familia == null) {
            return null;
        }
        String prefixo = "FASHION_SPORTS".equals(nucleo) ? "ACAO_" : "COR_";
        return new Efeito(prefixo + tabela.get(familia), FAMILIAS.indexOf(familia) + 1);
    }

    /** A ação da carta na tabela: a da primeira cor (em ordem alfabética, para ser sempre a mesma) com família mapeada. */
    public static String acao(Map<String, String> tabela, CbcRules.Card carta) {
        if (carta == null) {
            return null;
        }
        for (String cor : new TreeSet<>(carta.colors())) {
            String familia = Taxonomy.COLOR_FAMILY.get(cor);
            if (familia != null && tabela.containsKey(familia)) {
                return tabela.get(familia);
            }
        }
        return null;
    }

    /** Quantas peças da coleção têm a ação dada. */
    public static long quantas(Map<String, String> tabela, Iterable<CbcRules.Card> pecas, String acao) {
        long n = 0;
        for (CbcRules.Card c : pecas) {
            if (acao.equals(acao(tabela, c))) {
                n++;
            }
        }
        return n;
    }
}
