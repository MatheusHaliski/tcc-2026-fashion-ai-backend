package br.com.fashionai.application.flair3d.makeup.briefs;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpBrief;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpPecas;
import br.com.fashionai.application.flair3d.nucleos.RoadToGloryNucleo;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Nível 1 — "Ensaio de Verão": as mesmas 4 regras do núcleo ROAD_TO_GLORY ({@link RoadToGloryNucleo#regras}). */
public class EnsaioVeraoBrief implements FlairMakeUpBrief {
    @Override
    public String codigo() {
        return "ENSAIO_VERAO";
    }

    @Override
    public int nivelMin() {
        return 1;
    }

    @Override
    public List<Regra> regras() {
        return List.of(new Regra("OCASIAO", POR_REGRA), new Regra("MATERIAL_LEVE", POR_REGRA), new Regra("BATOM_CORAL", POR_REGRA),
                new Regra("ACABAMENTO_BATOM", POR_REGRA));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> v = contexto.vestidas(entrega);
        List<RegraResultado> regras = RoadToGloryNucleo.regras(v.values(), entrega);
        List<Evento> eventos = new ArrayList<>(FlairMakeUpPecas.semPecas(v));
        eventos.addAll(FlairMakeUpPecas.fora(v, FlairMakeUpPecas.FORA_DA_OCASIAO, c -> Flair3dPecas.temOcasiao(c, RoadToGloryNucleo.OCASIOES)));
        eventos.addAll(FlairMakeUpPecas.fora(v, FlairMakeUpPecas.NAO_LEVE, Flair3dPecas::leve));
        return Resultado.somando(regras, eventos).comCartas(FlairMakeUpPecas.rateio(v, regras));
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta) {
        List<Efeito> out = new ArrayList<>();
        if (Flair3dPecas.temOcasiao(carta, RoadToGloryNucleo.OCASIOES)) {
            out.add(new Efeito("OCASIAO", POR_REGRA));
        }
        if (Flair3dPecas.leve(carta)) {
            out.add(new Efeito("MATERIAL_LEVE", POR_REGRA));
        }
        return out;
    }
}
