package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoCalculo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * O look da gala na investigação (reauditoria de 25/11/2026: no caso "A Coleção Maré" o look não mudava nada). Os
 * atributos da regra peça-recurso mudam o corpo da detetive: RESISTÊNCIA alta dá uma marca de vida a mais;
 * FURTIVIDADE encurta o cone dos vigias (roupa escura e discreta passa despercebida); AGILIDADE muda o tempo de cada
 * passo (tênis anda rápido, salto alto gasta mais relógio). Tudo do servidor, a partir das peças vestidas. Puro.
 */
public record DetetiveDoLook(int vidaMaxima, double alcance, int segundosPorPasso) {
    public static final DetetiveDoLook NEUTRO = new DetetiveDoLook(DetetiveEstado.VIDA, DetetiveVigias.ALCANCE, DetetivePartida.SEGUNDOS_POR_PASSO);
    static final int ALTO = 65;
    static final int BAIXO = 35;

    public static DetetiveDoLook de(Map<String, CbcRules.Card> look) {
        if (look == null || look.isEmpty()) {
            return NEUTRO;
        }
        PecaRecurso.PerfilDoLook p = Flair3dRecursoCalculo.doLook(look);
        int vida = p.valor(Atributo.RESISTENCIA) >= ALTO ? DetetiveEstado.VIDA + 1 : DetetiveEstado.VIDA;
        // furtividade 0 → cone 15% maior; 50 → o de sempre; 100 → 15% menor
        double fator = 1.15 - 0.3 * Math.max(0, Math.min(100, p.valor(Atributo.FURTIVIDADE))) / 100.0;
        double alcance = Math.round(DetetiveVigias.ALCANCE * fator * 100) / 100.0;
        int agil = p.valor(Atributo.AGILIDADE);
        int segundos = agil >= ALTO ? DetetivePartida.SEGUNDOS_POR_PASSO - 2 : agil <= BAIXO ? DetetivePartida.SEGUNDOS_POR_PASSO + 2 : DetetivePartida.SEGUNDOS_POR_PASSO;
        return new DetetiveDoLook(vida, alcance, segundos);
    }

    Map<String, Object> paraTela() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vidaMaxima", vidaMaxima);
        m.put("alcance", alcance);
        m.put("segundosPorPasso", segundosPorPasso);
        return m;
    }
}
