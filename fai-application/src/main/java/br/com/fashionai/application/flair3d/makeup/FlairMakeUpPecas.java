package br.com.fashionai.application.flair3d.makeup;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Resultado.CartaPontos;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

/**
 * A conta das regras de roupa de um brief, explicada: as regras "todas as peças" (ocasião, material leve) caem inteiras
 * por causa de uma peça só, então o resultado diz qual vaga derrubou a regra ({@link #fora}) ou que não havia peça
 * vestida ({@link #semPecas}), e quanto cada carta rendeu ({@link #rateio}).
 */
public final class FlairMakeUpPecas {
    public static final String SEM_PECAS = "SEM_PECAS";
    public static final String FORA_DA_OCASIAO = "PECA_FORA_DA_OCASIAO";
    public static final String NAO_LEVE = "PECA_NAO_LEVE";

    private FlairMakeUpPecas() {
    }

    /** Sem nenhuma peça vestida as regras de roupa não pontuam: o evento diz isso. */
    public static List<Evento> semPecas(Map<String, CbcRules.Card> vestidas) {
        return vestidas.isEmpty() ? List.of(new Evento(SEM_PECAS, 0)) : List.of();
    }

    /** Um evento por peça vestida que não passa no teste, com a vaga dela. */
    public static List<Evento> fora(Map<String, CbcRules.Card> vestidas, String evento, Predicate<CbcRules.Card> teste) {
        List<Evento> out = new ArrayList<>();
        vestidas.forEach((vaga, carta) -> {
            if (!teste.test(carta)) {
                out.add(new Evento(evento, Map.of("vaga", vaga)));
            }
        });
        return out;
    }

    /**
     * Quanto cada carta vestida rendeu: as regras de todas as peças (OCASIAO, MATERIAL_LEVE) são divididas por igual; o
     * calçado fechado é do calçado e o acessório, do acessório. As regras de maquiagem não são de carta nenhuma.
     */
    public static List<CartaPontos> rateio(Map<String, CbcRules.Card> vestidas, List<RegraResultado> regras) {
        Flair3dRateio rateio = new Flair3dRateio(vestidas);
        for (RegraResultado r : regras) {
            switch (r.codigo()) {
                case "OCASIAO", "MATERIAL_LEVE" -> rateio.dividirEntre(r.pontos(), c -> true);
                case "CALCADO_FECHADO" -> rateio.vaga("CAL", r.pontos());
                case "ACESSORIO" -> rateio.vaga("ACE", r.pontos());
                default -> {
                }
            }
        }
        return rateio.lista();
    }
}
