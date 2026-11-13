package br.com.fashionai.application.flair3d.makeup.briefs;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpBrief;
import br.com.fashionai.application.flair3d.nucleos.RoadToGloryNucleo;

import java.util.List;

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
        return Resultado.somando(RoadToGloryNucleo.regras(contexto.vestidas(entrega).values(), entrega), List.of());
    }
}
