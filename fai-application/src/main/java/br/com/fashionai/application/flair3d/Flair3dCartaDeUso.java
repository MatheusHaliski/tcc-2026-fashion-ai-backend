package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.Flair3dHype;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * A carta do guarda-roupa jogada numa marca da fase de uso dos jogos de zonas (rodada zonas, 27/11/2026): a cor da carta
 * aciona o lance do gênero (CORES_E_ACOES.md). Cada família de cor dá um de três efeitos, com o nome do jogo: EMBALO
 * (+{@value #EMBALO} no lance que acerta), FOLEGO (a janela da marca {@value #FOLEGO_PCT}% maior) ou ESCUDO (o erro da
 * marca não tira ponto nem drena o recurso). A carta da mesma família de uma zona pintada é "da cor do uniforme" e soma
 * {@value #COR_DO_UNIFORME} quando acerta. A faixa de Hype da carta (Circuito Aura: só leitura, nunca escrita) é a
 * torcida que empurra: de HOT para cima a janela abre mais. A carta Especial é a Metamorfose, o poder do traje: vale
 * folego, escudo e embalo juntos e volta depois de {@value #RECARGA} marcas de recarga; as outras cartas valem uma vez por
 * fase, até {@value #MAXIMO} por fase. Puro.
 */
public final class Flair3dCartaDeUso {
    public static final int MAXIMO = 3;
    public static final int EMBALO = 2;
    public static final int FOLEGO_PCT = 30;
    public static final int COR_DO_UNIFORME = 1;
    public static final int RECARGA = 2;
    public static final String METAMORFOSE = "METAMORFOSE";
    public static final String ESPECIAL = "ESPECIAL";
    /** O efeito de cada família de cor, na ordem de {@link Flair3dCores#FAMILIAS} (Preto, Verde, Amarelo, Azul, Vermelho, Branco). */
    static final List<String> EFEITOS = List.of("ESCUDO", "FOLEGO", "EMBALO", "FOLEGO", "EMBALO", "ESCUDO");
    /** O nome do lance que a cor aciona em cada jogo, na mesma ordem das famílias. */
    static final Map<String, List<String>> LANCES = Map.of(
            "CLUBE_CORACAO", List.of("CARRINHO", "ARRANCADA", "DRIBLE", "TABELA", "CHUTE", "GOLEIRO"),
            "FAVORITE_SINGER", List.of("SILHUETA", "COREOGRAFIA", "HOLOFOTE", "GRAVE", "AGUDO", "FUMACA"),
            "PILOTO_FAVORITO", List.of("FREIO", "PISTA_LIVRE", "VACUO", "ADERENCIA", "TURBO", "BANDEIRA"),
            "SUPER_HEROI", List.of("SOMBRA", "CURA", "LUZ", "VOO", "RAIO", "CAMPO_DE_FORCA"));

    private Flair3dCartaDeUso() {
    }

    /** O que a carta faz numa marca: o lance, o efeito, se é da cor do uniforme, a faixa de Hype e o quanto abre a janela. */
    public record Efeito(String lance, String efeito, boolean doUniforme, String faixa, int janelaPct) {
        boolean escudo() {
            return "ESCUDO".equals(efeito) || METAMORFOSE.equals(efeito);
        }

        /** O bônus do lance que acerta. */
        int bonus() {
            int b = "EMBALO".equals(efeito) || METAMORFOSE.equals(efeito) ? EMBALO : 0;
            return b + (doUniforme ? COR_DO_UNIFORME : 0);
        }

        Map<String, Object> paraTela() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("lance", lance);
            m.put("efeito", efeito);
            m.put("doUniforme", doUniforme);
            m.put("faixa", faixa);
            m.put("janelaPct", janelaPct);
            return m;
        }
    }

    /**
     * O efeito da carta no jogo: nulo quando a carta não tem família de cor com lance (e não é Especial). {@code doUniforme}:
     * as famílias das zonas pintadas.
     */
    public static Efeito de(String jogo, CbcRules.Card carta, Set<String> doUniforme) {
        List<String> lances = jogo == null ? null : LANCES.get(jogo);
        if (carta == null || lances == null) {
            return null;
        }
        Flair3dHype.Band faixa = Flair3dHype.bandOf(carta);
        String familia = familia(carta);
        boolean daCor = familia != null && doUniforme.contains(familia);
        int torcida = torcidaPct(faixa);
        if (ESPECIAL.equals(carta.tier())) {
            return new Efeito(METAMORFOSE, METAMORFOSE, daCor, faixa.name(), FOLEGO_PCT + torcida);
        }
        if (familia == null) {
            return null;
        }
        int i = Flair3dCores.FAMILIAS.indexOf(familia);
        String efeito = EFEITOS.get(i);
        return new Efeito(lances.get(i), efeito, daCor, faixa.name(), ("FOLEGO".equals(efeito) ? FOLEGO_PCT : 0) + torcida);
    }

    /** A torcida empurra pela faixa de Hype da carta: HOT abre a janela 15%, TRENDING 20%, VIRAL 25%; abaixo, nada. */
    public static int torcidaPct(Flair3dHype.Band faixa) {
        return switch (faixa) {
            case HOT -> 15;
            case TRENDING -> 20;
            case VIRAL -> 25;
            default -> 0;
        };
    }

    /** A família de cor da carta: a primeira das seis (em ordem alfabética do código, como em {@link Flair3dCores}). */
    static String familia(CbcRules.Card carta) {
        for (String cor : new TreeSet<>(carta.colors())) {
            String familia = Taxonomy.COLOR_FAMILY.get(cor);
            if (familia != null && Flair3dCores.FAMILIAS.contains(familia)) {
                return familia;
            }
        }
        return null;
    }
}
