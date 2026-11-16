package br.com.fashionai.application.flair3d.nucleos;

import java.util.List;
import java.util.Map;

/**
 * A tabela de golpes do Dress Fighter (auditoria dos jogos de 15/11, seção do Dress Fighter): cada cor da carta jogada é
 * um golpe, a mesma tabela de {@code Flair3dCores.DE_CENA} (preto guarda, verde esquiva, amarelo golpe rápido, azul
 * fôlego, vermelho golpe forte, branco foco). O dano sai dos atributos do look (ataque no forte, velocidade no rápido,
 * defesa na guarda) e de como o golpe encontra o do outro lado: a guarda segura o forte e deixa passar parte do rápido;
 * a esquiva evita o forte e só metade do rápido; o foco aguenta metade e devolve um contra-ataque. Puro.
 */
public final class DressFighterGolpes {
    public static final String FORTE = "GOLPE_FORTE";
    public static final String RAPIDO = "GOLPE_RAPIDO";
    public static final String GUARDA = "GUARDA";
    public static final String ESQUIVA = "ESQUIVA";
    public static final String FOLEGO = "FOLEGO";
    public static final String FOCO = "FOCO";
    /** sem carta (seguir sem jogar): uma guarda sem técnica */
    public static final String GUARDA_BASICA = "GUARDA_BASICA";
    /** carta sem cor com golpe: um golpe simples */
    public static final String GOLPE_BASICO = "GOLPE_BASICO";
    /** a carta Especial: um golpe que nenhuma defesa segura, uma vez por luta */
    public static final String ESPECIAL = "ESPECIAL";
    public static final int FOLEGO_CURA = 10;

    /** Os golpes da oponente e o peso de cada um por arena (soma 100): a veloz prefere o rápido; a blindada, a guarda. */
    static final List<String> DA_OPONENTE = List.of(FORTE, RAPIDO, GUARDA, ESQUIVA);
    static final Map<String, int[]> PESOS = Map.of(
            "BASE", new int[]{30, 30, 25, 15},
            DressFighterNucleo.ARENA_VELOZ, new int[]{20, 45, 15, 20},
            DressFighterNucleo.ARENA_BLINDADA, new int[]{30, 15, 40, 15});

    /** Atributos de quem luta: velocidade, ataque e defesa. */
    public record Lutador(int velocidade, int ataque, int defesa) {
    }

    private DressFighterGolpes() {
    }

    public static boolean ataca(String golpe) {
        return FORTE.equals(golpe) || RAPIDO.equals(golpe) || GOLPE_BASICO.equals(golpe) || ESPECIAL.equals(golpe);
    }

    /** O golpe da oponente no lance, pelo peso da arena e pelo número que a semente tirou (0 a 99). */
    public static String daOponente(String arena, int sorteado) {
        int[] pesos = PESOS.getOrDefault(arena, PESOS.get("BASE"));
        int soma = 0;
        for (int i = 0; i < pesos.length; i++) {
            soma += pesos[i];
            if (sorteado < soma) {
                return DA_OPONENTE.get(i);
            }
        }
        return GUARDA;
    }

    /** Quanto o golpe tira antes da defesa (o Especial já chega com o poder da carta em {@code poder}). */
    static int bruto(String golpe, Lutador quem, int poder) {
        return switch (golpe) {
            case FORTE -> 12 + quem.ataque() / 5;
            case RAPIDO -> 7 + quem.velocidade() / 6;
            case GOLPE_BASICO -> 5 + quem.velocidade() / 8;
            case ESPECIAL -> poder;
            default -> 0;
        };
    }

    /** Quanto (em %) do golpe passa pela defesa do outro lado. */
    static int passa(String golpe, String defesa, Lutador defensor) {
        if (ESPECIAL.equals(golpe)) {
            return 100;
        }
        boolean forte = FORTE.equals(golpe);
        return switch (defesa) {
            case GUARDA -> forte ? Math.max(10, 35 - defensor.defesa() / 5) : Math.max(30, 70 - defensor.defesa() / 5);
            case GUARDA_BASICA -> forte ? Math.max(30, 60 - defensor.defesa() / 5) : Math.max(50, 80 - defensor.defesa() / 5);
            case ESQUIVA -> forte ? 0 : 50;
            case FOCO -> 50;
            default -> 100;
        };
    }

    /** O dano do golpe contra a defesa; o contra-ataque do foco, quando o outro atacou. */
    static int dano(String golpe, Lutador atacante, int poder, String defesa, Lutador defensor) {
        return bruto(golpe, atacante, poder) * passa(golpe, defesa, defensor) / 100;
    }

    static int contraAtaque(Lutador quem) {
        return 6 + (quem.ataque() + quem.velocidade()) / 10;
    }
}
