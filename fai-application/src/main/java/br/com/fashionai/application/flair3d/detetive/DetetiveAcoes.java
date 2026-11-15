package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Armario;
import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Ponto;
import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Vigia;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveAcusacao;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveMundo;

import java.util.Set;

/**
 * As ações da investigação ({@link DetetivePartida}): que cor de carta cada uma pede e o que ela faz no estado. Ação que
 * não vale ali (ponto longe, porta trancada sem chave, armário já aberto) é recusada inteira (422 ACAO_INVALIDA) e nada
 * é gravado. {@link #fazer} diz se os vigias andam depois dela.
 */
final class DetetiveAcoes {
    static final int SEGUNDOS_DA_AJUDA = 60;
    static final Set<String> COMPRAVEIS = Set.of("ABRIR", "FURTIVIDADE", "VIDA", "DANO", "PISTA");

    private DetetiveAcoes() {
    }

    /** A ação de cor que o passo pede (a da tabela DETETIVE de Flair3dCores), ou nula quando não gasta carta. */
    static String corPedida(String verbo, DetetiveEstado e, String arg) {
        return switch (verbo) {
            case "ABRIR" -> "ABRIR";
            case "PORTA" -> trancada(e, arg) ? "ABRIR" : null;
            case "ESCONDER", "BOLSO" -> "FURTIVIDADE";
            case "CONFRONTO" -> "DANO";
            case "VIDA" -> "VIDA";
            case "COMPLETAR" -> "PISTA";
            case "MERCADO" -> "MOEDA";
            case "IR", "ESPERAR", "AJUDA", "ENIGMA", "ACUSAR" -> null;
            default -> throw DetetivePartida.invalida();
        };
    }

    private static boolean trancada(DetetiveEstado e, String para) {
        var p = FashionDetectiveMundo.porta(e.sala, para);
        return p.isPresent() && p.get().chave() != null && !e.portasAbertas.contains(DetetiveEstado.porta(e.sala, para));
    }

    private static boolean barrada(DetetiveEstado e, String para) {
        return e.salaAtual().vigias().stream().anyMatch(v -> para.equals(v.barra()) && !e.convencidos.contains(v.id()));
    }

    private static void naSaida(DetetiveEstado e, String para) {
        DetetivePartida.conferir(FashionDetectiveMundo.porta(e.sala, para).isPresent()
                && e.salaAtual().saidaPara(para).map(s -> s.ponto().equals(e.ponto)).orElse(false));
    }

    static boolean fazer(String verbo, String arg, DetetiveEstado e, DetetiveMao mao) {
        DetetiveSala s = e.salaAtual();
        switch (verbo) {
            case "IR" -> {
                Ponto destino = s.ponto(arg);
                DetetivePartida.conferir(destino != null && !destino.id().equals(e.ponto) && DetetiveSala.distancia(destino, e.pontoAtual()) <= DetetiveSala.PASSO);
                e.ponto = destino.id();
                e.escondido = false;
                e.tempo += DetetivePartida.SEGUNDOS_POR_PASSO;
                return true;
            }
            case "ESPERAR" -> {
                e.tempo += DetetivePartida.SEGUNDOS_POR_PASSO;
                return true;
            }
            case "PORTA" -> {
                naSaida(e, arg);
                DetetivePartida.conferir(!barrada(e, arg));
                if (trancada(e, arg)) {
                    DetetivePartida.conferir(e.chaves.contains(FashionDetectiveMundo.porta(e.sala, arg).orElseThrow().chave()));
                    e.portasAbertas.add(DetetiveEstado.porta(e.sala, arg));
                }
                e.tempo += DetetivePartida.SEGUNDOS_POR_ACAO;
                entrar(e, arg);
                return false;
            }
            case "AJUDA" -> {
                naSaida(e, arg);
                DetetivePartida.conferir(trancada(e, arg) || barrada(e, arg));
                e.portasAbertas.add(DetetiveEstado.porta(e.sala, arg));
                s.vigias().stream().filter(v -> arg.equals(v.barra())).forEach(v -> e.convencidos.add(v.id()));
                e.tempo += SEGUNDOS_DA_AJUDA;
                e.avisos.add("AJUDA:" + FashionDetectiveMundo.porta(e.sala, arg).orElseThrow().ajuda());
                entrar(e, arg);
                return false;
            }
            case "ABRIR" -> {
                Armario a = s.armario(arg).orElse(null);
                DetetivePartida.conferir(a != null && a.ponto().equals(e.ponto) && e.abertos.add(s.id() + ":" + a.id()));
                if (a.chave() != null && e.chaves.add(a.chave())) {
                    e.avisos.add("CHAVE:" + a.chave());
                }
                achar(e, a.pista());
                e.tempo += DetetivePartida.SEGUNDOS_POR_ACAO;
                return true;
            }
            case "ESCONDER" -> {
                DetetivePartida.conferir(e.pontoAtual().esconderijo());
                e.escondido = true;
                e.ultimaCobertura = e.ponto;
                e.tempo += DetetivePartida.SEGUNDOS_POR_ACAO;
                return true;
            }
            case "BOLSO" -> {
                return bolso(e, s, arg);
            }
            case "CONFRONTO" -> {
                Vigia v = s.vigia(arg).orElse(null);
                DetetivePartida.conferir(v != null && !e.convencidos.contains(v.id()) && DetetiveVigias.aoLado(s, v, e.passo, e.pontoAtual()));
                e.convencidos.add(v.id());
                e.avisos.add("CONFRONTO_OK:" + v.id());
                e.tempo += DetetivePartida.SEGUNDOS_POR_ACAO;
                return true;
            }
            case "VIDA" -> {
                DetetivePartida.conferir(e.vida < DetetiveEstado.VIDA);
                e.vida++;
                return true;
            }
            case "COMPLETAR" -> {
                DetetivePartida.conferir(Boolean.FALSE.equals(e.pistas.get(arg)));
                e.pistas.put(arg, true);
                e.avisos.add("PISTA_COMPLETA:" + arg);
                return false;
            }
            case "MERCADO" -> {
                DetetivePartida.conferir(DetetiveSalas.SALA_DO_MERCADO.equals(e.sala) && DetetiveSalas.PONTO_DO_MERCADO.equals(e.ponto) && COMPRAVEIS.contains(arg));
                e.avisos.add(mao.comprar(arg) ? "COMPRA:" + arg : "COMPRA_SEM_CARTA:" + arg);
                return true;
            }
            case "ENIGMA" -> {
                return enigma(e, s, arg);
            }
            default -> {
                return acusar(e, arg);
            }
        }
    }

    private static boolean bolso(DetetiveEstado e, DetetiveSala s, String arg) {
        Vigia v = s.vigia(arg).orElse(null);
        DetetivePartida.conferir(v != null && v.bolso() != null && !e.furtados.contains(v.id()));
        e.tempo += DetetivePartida.SEGUNDOS_POR_ACAO;
        boolean perto = DetetiveVigias.aoLado(s, v, e.passo, e.pontoAtual());
        if (perto && !DetetiveVigias.noCone(s, v, e.passo, e.pontoAtual())) {
            e.furtados.add(v.id());
            e.avisos.add("BOLSO_OK:" + v.id());
            achar(e, v.bolso());
            return true;
        }
        e.avisos.add("BOLSO_FALHOU:" + v.id());
        visto(e, v.id());
        return false;
    }

    private static boolean enigma(DetetiveEstado e, DetetiveSala s, String arg) {
        DetetivePartida.conferir(s.enigma() != null && !e.resolvidas.contains(s.id()));
        int escolha;
        try {
            escolha = Integer.parseInt(arg);
        } catch (NumberFormatException ex) {
            throw DetetivePartida.invalida();
        }
        DetetivePartida.conferir(escolha >= 0 && escolha < s.enigma().opcoes().size());
        e.tempo += DetetivePartida.SEGUNDOS_POR_ACAO;
        if (escolha == s.enigma().certa()) {
            e.resolvidas.add(s.id());
            e.cutscene = "RESOLUCAO:" + s.id();
            e.avisos.add("ENIGMA_CERTO");
            achar(e, s.pistaDaResolucao());
        } else {
            e.erros.merge(s.id(), 1, Integer::sum);
            e.avisos.add("ENIGMA_ERRADO");
        }
        return false;
    }

    private static boolean acusar(DetetiveEstado e, String arg) {
        DetetivePartida.conferir(FashionDetectiveMundo.FINAL.equals(e.sala));
        int suspeito;
        try {
            suspeito = Integer.parseInt(arg);
        } catch (NumberFormatException ex) {
            throw DetetivePartida.invalida();
        }
        DetetivePartida.conferir(suspeito >= FashionDetectiveAcusacao.PRIMEIRO_SUSPEITO && suspeito <= FashionDetectiveAcusacao.ULTIMO_SUSPEITO);
        FashionDetectiveAcusacao.Final f = FashionDetectiveAcusacao.decidir(suspeito, e.pistasCompletas(), e.tentativas + 1);
        e.tentativas++;
        if (FashionDetectiveAcusacao.encerra(f)) {
            e.fim = f;
            e.cutscene = "FINAL:" + f.name();
        } else {
            e.cutscene = "ALIBI:" + suspeito;
        }
        return false;
    }

    /** A pista achada: as rasgadas chegam pela metade (a carta branca completa). */
    static void achar(DetetiveEstado e, String pista) {
        if (pista != null && !e.pistas.containsKey(pista)) {
            e.pistas.put(pista, !DetetiveSalas.PISTAS_PELA_METADE.contains(pista));
            e.avisos.add("PISTA:" + pista);
        }
    }

    /** Entra na sala vizinha pela porta que liga as duas (ou pelo começo dela); a primeira vez abre a cutscene. */
    static void entrar(DetetiveEstado e, String para) {
        String de = e.sala;
        DetetiveSala nova = DetetiveSalas.sala(para);
        e.sala = para;
        e.ponto = nova.saidaPara(de).map(DetetiveSala.Saida::ponto).orElse(nova.entrada().id());
        e.chegada = e.ponto;
        e.ultimaCobertura = null;
        e.escondido = false;
        if (e.visitadas.add(para)) {
            e.cutscene = "ABERTURA:" + para;
        }
        if (FashionDetectiveMundo.FINAL.equals(para)) {
            achar(e, DetetiveSalas.PISTA_DA_PASSARELA);
        }
    }

    /** Visto: uma marca de vida, 30 segundos e de volta ao último esconderijo (ou à porta da sala, sem vida). */
    static void visto(DetetiveEstado e, String quem) {
        e.penalidades++;
        e.tempo += DetetivePartida.SEGUNDOS_DE_PENALIDADE;
        e.vida--;
        e.avisos.add("VISTO:" + quem);
        if (e.vida <= 0) {
            e.vida = DetetiveEstado.VIDA;
            e.tempo += 2 * DetetivePartida.SEGUNDOS_DE_PENALIDADE;
            e.ponto = e.chegada;
            e.escondido = false;
            e.avisos.add("SEM_VIDA");
            return;
        }
        e.ponto = e.ultimaCobertura != null ? e.ultimaCobertura : e.chegada;
        e.escondido = e.ultimaCobertura != null;
    }
}
