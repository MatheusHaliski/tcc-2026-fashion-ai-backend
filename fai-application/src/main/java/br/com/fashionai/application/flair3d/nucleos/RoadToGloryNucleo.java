package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dBeleza;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Núcleo 5 — brief "Ensaio de Verão", 25 por regra: todas as peças de ocasião casual ou praia; todas de material leve;
 * batom da família coral; acabamento do batom gloss ou cetim. Sem deck (guarda-roupa liberado). As mesmas regras valem
 * no brief ENSAIO_VERAO do MAKE UP ({@link #regras}).
 */
public class RoadToGloryNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final Set<String> OCASIOES = Set.of("casual", "beach");

    @Override
    public String codigo() {
        return "ROAD_TO_GLORY";
    }

    @Override
    public int numero() {
        return 5;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(),
                Definicao.objetivo("ENSAIO_VERAO", new Regra("OCASIAO", POR_REGRA), new Regra("MATERIAL_LEVE", POR_REGRA),
                        new Regra("BATOM_CORAL", POR_REGRA), new Regra("ACABAMENTO_BATOM", POR_REGRA)),
                List.of(Definicao.CARTAS, Definicao.MAQUIAGEM), Definicao.VAGAS, Deck.SEM_DECK, false)
                .comAreas(Definicao.AREAS)
                .comAvatares(new Avatares(List.of(new Avatares.Solo(Avatares.PROPRIO, Avatares.PROTAGONISTA, 1),
                        new Avatares.Solo(Avatares.MODELO_CASA, Avatares.PROTAGONISTA, 1)), null));
    }

    /** As 4 regras do Ensaio de Verão sobre as peças vestidas e a maquiagem. */
    public static List<RegraResultado> regras(Collection<CbcRules.Card> pecas, Entrega entrega) {
        List<RegraResultado> out = new ArrayList<>();
        out.add(RegraResultado.de("OCASIAO", Flair3dPecas.todas(pecas, c -> Flair3dPecas.temOcasiao(c, OCASIOES)), POR_REGRA));
        out.add(RegraResultado.de("MATERIAL_LEVE", Flair3dPecas.todas(pecas, Flair3dPecas::leve), POR_REGRA));
        out.add(RegraResultado.de("BATOM_CORAL", Flair3dBeleza.familia(entrega, Flair3dBeleza.LABIOS, "CORAL"), POR_REGRA));
        out.add(RegraResultado.de("ACABAMENTO_BATOM", Flair3dBeleza.acabamento(entrega, Flair3dBeleza.LABIOS, "GLOSS", "CETIM"), POR_REGRA));
        return out;
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        List<RegraResultado> regras = regras(vestidas.values(), entrega);
        Flair3dRateio rateio = new Flair3dRateio(vestidas).dividirEntre(regras.get(0).pontos(), c -> true)
                .dividirEntre(regras.get(1).pontos(), c -> true);
        return Resultado.somando(regras, List.of()).comCartas(rateio.lista());
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        List<Efeito> out = new ArrayList<>();
        if (Flair3dPecas.temOcasiao(carta, OCASIOES)) {
            out.add(new Efeito("OCASIAO", POR_REGRA));
        }
        if (Flair3dPecas.leve(carta)) {
            out.add(new Efeito("MATERIAL_LEVE", POR_REGRA));
        }
        return out;
    }
}
