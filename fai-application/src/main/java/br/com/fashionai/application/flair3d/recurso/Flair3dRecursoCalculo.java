package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.AcaoDestravada;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.PerfilDaPeca;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.PerfilDoLook;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;

/** O perfil de uma peça e o do look, a partir da {@link Flair3dRecursoTabela}. Puro e determinístico. */
public final class Flair3dRecursoCalculo {
    private Flair3dRecursoCalculo() {
    }

    public static PerfilDaPeca daCarta(CbcRules.Card c, String vaga) {
        Flair3dRecursoTabela.Soma s = Flair3dRecursoTabela.somar(c, vaga);
        double fator = Flair3dRecursoTabela.fatorDoOvr(c.ovr());
        Map<Atributo, Integer> atributos = new LinkedHashMap<>();
        Atributo dominante = null;
        for (Atributo a : Atributo.values()) {
            int bruto = s.atributos.getOrDefault(a, 0);
            int delta = limitar((int) Math.round(bruto * fator), -PecaRecurso.DELTA_MAXIMO, PecaRecurso.DELTA_MAXIMO);
            if (delta == 0) continue;
            atributos.put(a, delta);
            if (dominante == null || Math.abs(delta) > Math.abs(atributos.get(dominante))) dominante = a;
        }
        int quantidade = (int) Math.round(s.base * Flair3dRecursoTabela.multiplicador(c.tier())) + s.extra;
        String v = vaga != null ? vaga : c.position();
        return new PerfilDaPeca(v, atributos, s.recurso, quantidade, Flair3dRecursoTabela.usos(c.tier()), s.acoes, dominante);
    }

    /** O look: neutro mais a média dos deltas das peças vestidas em cada atributo, de 0 a 100; as ações de todas. */
    public static PerfilDoLook doLook(Map<String, CbcRules.Card> vestidas) {
        EnumMap<Atributo, Integer> soma = new EnumMap<>(Atributo.class);
        EnumSet<AcaoDestravada> acoes = EnumSet.noneOf(AcaoDestravada.class);
        int n = 0;
        for (Map.Entry<String, CbcRules.Card> e : vestidas.entrySet()) {
            if (e.getValue() == null) continue;
            PerfilDaPeca p = daCarta(e.getValue(), e.getKey());
            p.atributos().forEach((a, d) -> soma.merge(a, d, Integer::sum));
            acoes.addAll(p.acoes());
            n++;
        }
        EnumMap<Atributo, Integer> atributos = new EnumMap<>(Atributo.class);
        for (Atributo a : Atributo.values()) {
            int media = n == 0 ? 0 : (int) Math.round(soma.getOrDefault(a, 0) / (double) n);
            atributos.put(a, limitar(PecaRecurso.NEUTRO + media, 0, 100));
        }
        return new PerfilDoLook(atributos, acoes);
    }

    static int limitar(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
