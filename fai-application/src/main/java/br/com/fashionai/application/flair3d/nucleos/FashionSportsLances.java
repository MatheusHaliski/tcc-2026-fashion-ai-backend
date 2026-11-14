package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dCores;
import br.com.fashionai.application.flair3d.Resultado.Evento;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Lances do segundo tempo do FASHION_SPORTS: cada acionamento troca uma peça do uniforme, e a peça que entra dispara na
 * hora a ação da cor dela ({@link Flair3dCores#ESPORTE}). Verde chuta (gol se a técnica do uniforme mais 5 alcança a força
 * do adversário); preto e branco tiram um gol do adversário no segundo tempo; amarelo, azul e vermelho somam força ao
 * time (6, 4 e 3). São no máximo {@link #MAX} lances; a troca de peça sem cor de ação, ou seguir sem trocar, apita o fim.
 */
final class FashionSportsLances {
    static final int MAX = 3;
    static final int MARGEM_DO_CHUTE = 5;
    private static final Map<String, Integer> FORCA = Map.of("DRIBLE", 6, "CORRIDA", 4, "PASSE", 3);

    private Map<String, CbcRules.Card> uniforme;
    private final List<Evento> eventos = new ArrayList<>();
    private int bonus;
    private int chutes;
    private int desarmes;
    private boolean aberto = true;

    private final String modalidade;

    FashionSportsLances(Map<String, CbcRules.Card> uniforme, String modalidade) {
        this.uniforme = uniforme;
        this.modalidade = modalidade;
    }

    /** Joga os acionamentos na ordem; para no primeiro que não dispara ação ou no último lance. */
    FashionSportsLances jogar(List<Acionamento> acionamentos, int adversario, Contexto contexto) {
        int lances = 0;
        for (Acionamento a : acionamentos) {
            Acionamento.Troca troca = a.troca();
            String acao = null;
            if (troca != null) {
                uniforme = FashionSportsNucleo.comTroca(uniforme, troca, contexto);
                eventos.add(new Evento("TROCA", Map.of("vaga", troca.vaga(), "carta", troca.carta())));
                acao = Flair3dCores.acao(Flair3dCores.ESPORTE, uniforme.get(troca.vaga()));
            }
            if (acao == null) {
                aberto = false;
                break;
            }
            lances++;
            eventos.add(new Evento("LANCE", Map.of("lance", lances, "acao", acao, "modalidade", modalidade,
                    "carta", troca.carta(), "venceu", aplicar(acao, adversario))));
            if (lances == MAX) {
                aberto = false;
            }
        }
        return this;
    }

    /** Aplica a ação e diz se ela deu certo (só o chute pode falhar). */
    private boolean aplicar(String acao, int adversario) {
        if ("CHUTE".equals(acao)) {
            boolean gol = Flair3dAtributos.soma(uniforme.values()).tecnica() + MARGEM_DO_CHUTE >= adversario;
            chutes += gol ? 1 : 0;
            return gol;
        }
        if ("DEFESA".equals(acao) || "GOLEIRO".equals(acao)) {
            desarmes++;
            return true;
        }
        bonus += FORCA.getOrDefault(acao, 0);
        return true;
    }

    Map<String, CbcRules.Card> uniforme() {
        return uniforme;
    }

    List<Evento> eventos() {
        return eventos;
    }

    int bonus() {
        return bonus;
    }

    int chutes() {
        return chutes;
    }

    int desarmes() {
        return desarmes;
    }

    /** A partida ainda espera outro lance. */
    boolean aberto() {
        return aberto;
    }
}
