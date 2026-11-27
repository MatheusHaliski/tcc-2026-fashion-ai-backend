package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.Flair3dHype;
import br.com.fashionai.application.flair3d.Andamento.TrunfoDeHype;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Resultado.Evento;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * O que a Aura fez com um look, para a nota e para a tela (evento AURA_NA_PARTIDA): a faixa que a plateia leu e os
 * pontos dela, as famílias vestidas (Splash, Electro, Comum, Metamorfose) e o trunfo chamado, com a faixa e o bônus.
 */
public record Flair3dAuraEvento(Flair3dHype.Band faixa, int plateia, boolean splash, int electroMs, boolean comum, boolean metamorfose,
                                CbcRules.Card trunfo, int etapaDoTrunfo) {
    public static final String CODIGO = "AURA_NA_PARTIDA";

    public static Flair3dAuraEvento de(Collection<CbcRules.Card> look, Contexto contexto) {
        TrunfoDeHype t = contexto.andamento().hype();
        CbcRules.Card trunfo = t == null ? null : contexto.deck().getOrDefault(t.carta(), contexto.cartas().get(t.carta()));
        return new Flair3dAuraEvento(Flair3dAuraRegras.faixaDaPlateia(look, contexto), Flair3dAuraRegras.plateia(look, contexto),
                Flair3dAuraRegras.quantas(look, contexto, Flair3dAuraRegras.SPLASH) > 0, Flair3dAuraRegras.electroMs(look, contexto),
                Flair3dAuraRegras.quantas(look, contexto, Flair3dAuraRegras.COMMON) > 0, Flair3dAuraRegras.temMetamorfose(look, contexto),
                trunfo, t == null ? -1 : t.etapa());
    }

    public int bonusDoTrunfo() {
        return Flair3dAuraRegras.trunfo(trunfo);
    }

    public Evento evento() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("faixa", faixa.name());
        m.put("plateia", plateia);
        m.put("splash", splash);
        m.put("electroMs", electroMs);
        m.put("comum", comum);
        m.put("metamorfose", metamorfose);
        if (trunfo != null) {
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("carta", trunfo.id());
            t.put("faixa", Flair3dHype.bandOf(trunfo).name());
            t.put("bonus", bonusDoTrunfo());
            t.put("etapa", etapaDoTrunfo);
            m.put("trunfo", t);
        }
        return new Evento(CODIGO, m);
    }
}
