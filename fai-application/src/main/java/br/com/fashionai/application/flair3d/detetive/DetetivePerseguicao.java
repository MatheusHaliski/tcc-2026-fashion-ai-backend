package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Ponto;
import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Vigia;

/**
 * Ronda, perseguição e volta dos vigias (pedido da dona: inimigos com movimento e mecânica de confronto, sem arma e sem
 * sangue). Em ronda, o vigia anda pela ronda dele e olha para a frente; quem entra no cone é visto e o vigia sai
 * atrás ({@code PERSEGUE}), um pouco mais devagar que a pessoa ({@link #PASSO_DO_VIGIA} metros por passo, contra
 * {@link DetetiveSala#PASSO}). Esconder-se, sair do alcance dele ou sair da sala quebra a linha de visão: o vigia para
 * onde a viu por um passo ({@code PROCURA}) e depois volta à ronda ({@code VOLTA}). Se ele chega a
 * {@link #ALCANCE_DA_PEGADA} metros, a pessoa é pega: uma marca de vida, 30 segundos e de volta à porta por onde entrou
 * na sala; o vigia volta à ronda. Quem foi convencido no confronto (carta azul) não persegue mais. Tudo sai do estado e
 * dos passos: refazer a partida dá sempre o mesmo caminho.
 */
final class DetetivePerseguicao {
    static final String PERSEGUE = "PERSEGUE";
    static final String PROCURA = "PROCURA";
    static final String VOLTA = "VOLTA";
    /** quanto o vigia anda por passo na perseguição (a pessoa anda até 3,6 m: correr dá para fugir) */
    static final double PASSO_DO_VIGIA = 2.6;
    /** até onde o vigia que persegue ainda enxerga a pessoa */
    /** quem persegue enxerga 1,5 vez o alcance do cone (o do look da detetive, DetetiveDoLook) */
    static final double FATOR_DA_PERSEGUICAO = 1.5;
    static final double ALCANCE_DA_PEGADA = 1.3;

    /** O que o vigia faz fora da ronda: o modo e onde ele está. */
    record Alerta(String modo, double x, double z) {
        Ponto ponto(String id) {
            return new Ponto(id + "@alerta", x, z, false);
        }
    }

    private DetetivePerseguicao() {
    }

    /** Onde o vigia está agora: na ronda, ou onde a perseguição o levou. */
    static Ponto onde(DetetiveEstado e, DetetiveSala s, Vigia v) {
        Alerta a = e.alertas.get(v.id());
        return a == null ? DetetiveVigias.onde(s, v, e.passo) : a.ponto(v.id());
    }

    /** Para onde ele olha: na ronda, para o próximo ponto; perseguindo, para a pessoa; voltando, para a ronda. */
    static double olhar(DetetiveEstado e, DetetiveSala s, Vigia v) {
        Alerta a = e.alertas.get(v.id());
        if (a == null) {
            return DetetiveVigias.olhar(s, v, e.passo);
        }
        Ponto alvo = VOLTA.equals(a.modo()) ? DetetiveVigias.onde(s, v, e.passo) : e.pontoAtual();
        return Math.toDegrees(Math.atan2(alvo.x() - a.x(), alvo.z() - a.z()));
    }

    /** O modo do vigia para a tela: RONDA, PERSEGUE, PROCURA ou VOLTA. */
    static String modo(DetetiveEstado e, Vigia v) {
        Alerta a = e.alertas.get(v.id());
        return a == null ? "RONDA" : a.modo();
    }

    /** A pessoa está a um passo do vigia (bolso, confronto)? */
    static boolean aoLado(DetetiveEstado e, DetetiveSala s, Vigia v) {
        return DetetiveSala.distancia(onde(e, s, v), e.pontoAtual()) <= DetetiveSala.PASSO;
    }

    /** O vigia nota a pessoa a um passo dele? Em ronda, só no cone; fora da ronda, ele já está atento. */
    static boolean nota(DetetiveEstado e, DetetiveSala s, Vigia v) {
        return e.alertas.containsKey(v.id()) || DetetiveVigias.noCone(s, v, e.passo, e.pontoAtual(), e.doLook.alcance());
    }

    /** Depois de cada passo da pessoa: cada vigia da sala vê, persegue, procura ou volta; no máximo uma pegada. */
    static void depoisDoPasso(DetetiveEstado e) {
        DetetiveSala s = e.salaAtual();
        if (!s.id().equals(e.salaDosAlertas)) {
            e.alertas.clear();
            e.salaDosAlertas = s.id();
        }
        Ponto p = e.pontoAtual();
        if (p.esconderijo() && e.escondido) {
            e.ultimaCobertura = p.id();
        }
        for (Vigia v : s.vigias()) {
            if (v.barra() != null || e.convencidos.contains(v.id())) {
                e.alertas.remove(v.id());
            } else if (vigiar(e, s, v, p)) {
                return;
            }
        }
    }

    /** Um vigia neste passo; devolve true quando ele pegou a pessoa. */
    private static boolean vigiar(DetetiveEstado e, DetetiveSala s, Vigia v, Ponto p) {
        Alerta a = e.alertas.get(v.id());
        boolean livre = !e.escondido;
        if (a == null) {
            if (DetetiveVigias.ve(s, v, e.passo, p, e.escondido, e.doLook.alcance())) {
                Ponto g = DetetiveVigias.onde(s, v, e.passo);
                e.alertas.put(v.id(), new Alerta(PERSEGUE, g.x(), g.z()));
                e.avisos.add("VISTO:" + v.id());
            }
            return false;
        }
        Ponto aqui = a.ponto(v.id());
        switch (a.modo()) {
            case PERSEGUE -> {
                if (!livre || DetetiveSala.distancia(aqui, p) > e.doLook.alcance() * FATOR_DA_PERSEGUICAO) {
                    e.alertas.put(v.id(), new Alerta(PROCURA, a.x(), a.z()));
                    e.avisos.add("ESCAPOU:" + v.id());
                    return false;
                }
                Ponto novo = andar(aqui, p, PASSO_DO_VIGIA);
                if (DetetiveSala.distancia(novo, p) <= ALCANCE_DA_PEGADA) {
                    e.alertas.put(v.id(), new Alerta(VOLTA, novo.x(), novo.z()));
                    pegar(e, v.id());
                    return true;
                }
                e.alertas.put(v.id(), new Alerta(PERSEGUE, novo.x(), novo.z()));
            }
            case PROCURA -> {
                boolean reaparece = livre && DetetiveSala.distancia(aqui, p) <= e.doLook.alcance();
                e.alertas.put(v.id(), new Alerta(reaparece ? PERSEGUE : VOLTA, a.x(), a.z()));
                if (reaparece) {
                    e.avisos.add("VISTO:" + v.id());
                }
            }
            default -> {
                Ponto rota = DetetiveVigias.onde(s, v, e.passo);
                Ponto novo = andar(aqui, rota, DetetiveSala.PASSO);
                if (DetetiveSala.distancia(novo, rota) < 0.05) {
                    e.alertas.remove(v.id());
                } else {
                    e.alertas.put(v.id(), new Alerta(VOLTA, novo.x(), novo.z()));
                }
            }
        }
        return false;
    }

    /** Anda de `de` para `para` no máximo `passo` metros, em linha reta. */
    static Ponto andar(Ponto de, Ponto para, double passo) {
        double d = DetetiveSala.distancia(de, para);
        if (d <= passo) {
            return new Ponto(de.id(), para.x(), para.z(), false);
        }
        double k = passo / d;
        return new Ponto(de.id(), de.x() + (para.x() - de.x()) * k, de.z() + (para.z() - de.z()) * k, false);
    }

    /** Pega: uma marca de vida, 30 segundos e de volta à porta da sala; sem vida, o fôlego volta com mais tempo perdido. */
    static void pegar(DetetiveEstado e, String quem) {
        e.penalidades++;
        e.tempo += DetetivePartida.SEGUNDOS_DE_PENALIDADE;
        e.vida--;
        e.avisos.add("PEGO:" + quem);
        e.ponto = e.chegada;
        e.escondido = false;
        if (e.vida <= 0) {
            e.vida = e.doLook.vidaMaxima();
            e.tempo += 2 * DetetivePartida.SEGUNDOS_DE_PENALIDADE;
            e.avisos.add("SEM_VIDA");
        }
    }
}
