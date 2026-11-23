package br.com.fashionai.application.flair3d.makeup.briefs;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dBeleza;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpBrief;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpPecas;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Nível 2 — "Primeiro Encontro": todas as peças de ocasião festa ou noite; 1 acessório; lábios vermelho ou vinho; bochechas rosa. */
public class PrimeiroEncontroBrief implements FlairMakeUpBrief {
    public static final Set<String> OCASIOES = Set.of("party", "night_out", "date");

    @Override
    public String codigo() {
        return "PRIMEIRO_ENCONTRO";
    }

    @Override
    public int nivelMin() {
        return 2;
    }

    @Override
    public List<Regra> regras() {
        return List.of(new Regra("OCASIAO", POR_REGRA), new Regra("ACESSORIO", POR_REGRA), new Regra("LABIOS_VERMELHO_OU_VINHO", POR_REGRA),
                new Regra("BOCHECHAS_ROSA", POR_REGRA));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> v = contexto.vestidas(entrega);
        List<RegraResultado> regras = List.of(
                RegraResultado.de("OCASIAO", Flair3dPecas.todas(v.values(), c -> Flair3dPecas.temOcasiao(c, OCASIOES)), POR_REGRA),
                RegraResultado.de("ACESSORIO", v.containsKey("ACE"), POR_REGRA),
                RegraResultado.de("LABIOS_VERMELHO_OU_VINHO", Flair3dBeleza.familia(entrega, Flair3dBeleza.LABIOS, "VERMELHO", "VINHO"), POR_REGRA),
                RegraResultado.de("BOCHECHAS_ROSA", Flair3dBeleza.familia(entrega, Flair3dBeleza.BOCHECHAS, "ROSA"), POR_REGRA));
        List<Evento> eventos = new ArrayList<>(FlairMakeUpPecas.semPecas(v));
        eventos.addAll(FlairMakeUpPecas.fora(v, FlairMakeUpPecas.FORA_DA_OCASIAO, c -> Flair3dPecas.temOcasiao(c, OCASIOES)));
        return Resultado.somando(regras, eventos).comCartas(FlairMakeUpPecas.rateio(v, regras));
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta) {
        List<Efeito> out = new ArrayList<>();
        if (Flair3dPecas.temOcasiao(carta, OCASIOES)) {
            out.add(new Efeito("OCASIAO", POR_REGRA));
        }
        if ("ACE".equals(carta.position())) {
            out.add(new Efeito("ACESSORIO", POR_REGRA));
        }
        return out;
    }
}
