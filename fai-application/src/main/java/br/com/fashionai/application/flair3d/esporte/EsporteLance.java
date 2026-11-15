package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.flair.CbcRules;

import java.util.Random;

/**
 * A resolução de uma jogada do FASHION_SPORTS: a carta jogada (ou nenhuma) contra o adversário, na situação da vez.
 *
 * <p><b>Com a bola</b>: vermelho passa e azul corre (avançam uma zona; a corrida com folga de {@link #FOLGA} avança
 * duas); amarelo dribla (avança uma zona e dá {@link #EMBALO} à jogada seguinte); verde finaliza de onde está, com o
 * desconto da distância ({@link #DISTANCIA}); preto, branco e a carta sem cor de ação só protegem a bola. Errar o
 * duelo entrega a bola. Sem carta, o time perde a bola.</p>
 *
 * <p><b>Sem a bola</b>: o adversário quer avançar ou, perto do gol, finalizar. Preto desarma (ganha a bola); azul
 * recompõe (segura o adversário onde ele está); branco prepara o goleiro ({@link #GOLEIRO_PRONTO} na próxima
 * finalização); as outras cartas só pressionam, com metade da força. Sem carta, ou com o duelo perdido, o adversário
 * faz o que queria.</p>
 *
 * <p>Todo duelo é: força da pessoa − força do adversário + sorte de −8 a +8 (da semente). Vence com zero ou mais.</p>
 */
final class EsporteLance {
    static final int FOLGA = 12;
    static final int EMBALO = 6;
    static final int GOLEIRO_PRONTO = 12;
    static final int GOLEIRO = 6;
    /** Desconto da finalização pela zona de onde ela sai (defesa, meio, ataque, área). */
    static final int[] DISTANCIA = {-18, -10, -3, 4};
    private static final int VELOCIDADE = 0;
    private static final int TECNICA = 1;
    private static final int DEFESA = 2;
    private static final int FISICO = 3;

    private final EsportePartida p;
    private final CbcRules.Card carta;
    private final String acao;
    private final Random sorteio;

    EsporteLance(EsportePartida partida, CbcRules.Card carta) {
        p = partida;
        this.carta = carta;
        acao = carta == null ? null : EsporteForcas.acao(carta);
        sorteio = partida.contexto.sorteio("jogada" + partida.jogada);
    }

    private int sorte() {
        return sorteio.nextInt(2 * EsportePartida.SORTE + 1) - EsportePartida.SORTE;
    }

    void resolver() {
        p.resumo.posse(p.nossa);
        if (carta != null) {
            p.resumo.carta();
        }
        if (p.nossa) {
            comABola();
        } else {
            semABola();
        }
    }

    /** O outro time fica com a bola, na zona espelhada. */
    private void trocaDePosse() {
        p.nossa = !p.nossa;
        p.zona = 3 - p.zona;
        p.bonus = 0;
    }

    private void comABola() {
        int z = p.zona;
        if (carta == null) {
            p.lance("SEM_CARTA", true, false, null, null, z, z);
            trocaDePosse();
            return;
        }
        int embalo = p.bonus;
        p.bonus = 0;
        switch (acao) {
            case EsporteForcas.PASSE -> avancar("PASSE", p.nossa(acao, carta) + embalo - p.rival(DEFESA) + sorte(), false);
            case EsporteForcas.CORRIDA -> avancar("CONDUCAO", p.nossa(acao, carta) + embalo - p.rival(VELOCIDADE) + sorte(), false);
            case EsporteForcas.DRIBLE -> avancar("DRIBLE", p.nossa(acao, carta) + embalo - (p.rival(DEFESA) + p.rival(FISICO)) / 2 + sorte(), true);
            case EsporteForcas.CHUTE -> finalizar(embalo);
            default -> p.lance("PROTEGE", true, true, carta, acao, z, z);
        }
    }

    private void avancar(String tipo, double margem, boolean drible) {
        int z = p.zona;
        boolean ok = margem >= 0;
        if ("PASSE".equals(tipo)) {
            p.resumo.passe(ok);
        }
        if (!ok) {
            p.lance(tipo + "_PERDIDO", true, false, carta, acao, z, z);
            p.resumo.desarme(false);
            trocaDePosse();
            return;
        }
        int destino = Math.min(3, z + ("CONDUCAO".equals(tipo) && margem >= FOLGA ? 2 : 1));
        p.lance(tipo, true, true, carta, acao, z, destino);
        p.zona = destino;
        p.bonus = drible ? EMBALO : 0;
    }

    /** A finalização da pessoa: gol, defesa do goleiro, espalmada (a bola sobra na área) ou para fora. */
    private void finalizar(int embalo) {
        int z = p.zona;
        double margem = p.nossa(acao, carta) + embalo + DISTANCIA[z] - (p.rival(DEFESA) + GOLEIRO) + sorte();
        p.resumo.chute(true, margem >= -12);
        if (margem >= 0) {
            p.pontos[0][p.tempo() - 1] += p.regras.pontosDaZona()[z];
            p.lance("CHUTE_GOL", true, true, carta, acao, z, EsportePartida.GOL);
            p.nossa = false;
            p.zona = 1;
            return;
        }
        if (margem >= -6) {
            p.resumo.defesa(false);
            p.lance("CHUTE_DEFENDIDO", true, false, carta, acao, z, EsportePartida.GOL);
        } else if (margem >= -12) {
            p.resumo.defesa(false);
            p.lance("CHUTE_ESPALMADO", true, false, carta, acao, z, EsportePartida.GOL);
            p.zona = 3;
            return;
        } else {
            p.lance("CHUTE_FORA", true, false, carta, acao, z, EsportePartida.GOL);
        }
        p.nossa = false;
        p.zona = 0;
    }

    private void semABola() {
        int z = p.zona;
        boolean querFinalizar = z == 3 || (z == 2 && sorteio.nextBoolean());
        boolean parou = false;
        if (carta != null) {
            switch (acao) {
                case EsporteForcas.DEFESA -> {
                    boolean ok = p.nossa(acao, carta) - p.rival(TECNICA) + sorte() >= 0;
                    if (ok) {
                        p.resumo.desarme(true);
                    }
                    p.lance(ok ? "DESARME" : "DESARME_FALHO", true, ok, carta, acao, 3 - z, 3 - z);
                    if (ok) {
                        trocaDePosse();
                        return;
                    }
                }
                case EsporteForcas.CORRIDA -> {
                    parou = p.nossa(acao, carta) - p.rival(VELOCIDADE) + sorte() >= 0;
                    p.lance(parou ? "RECOMPOE" : "RECOMPOE_FALHO", true, parou, carta, acao, 3 - z, 3 - z);
                }
                case EsporteForcas.GOLEIRO -> {
                    p.goleiroPronto = true;
                    p.lance("GOLEIRO_PRONTO", true, true, carta, acao, 0, 0);
                }
                default -> {
                    parou = (p.time.fisico() * p.time.folego(p.jogada) + EsporteForcas.poder(carta, acao)) / 2 - p.rival(FISICO) / 2 + sorte() >= 0;
                    p.lance(parou ? "PRESSAO" : "PRESSAO_FALHA", true, parou, carta, acao, 3 - z, 3 - z);
                }
            }
        }
        if (parou) {
            return;
        }
        if (querFinalizar) {
            rivalFinaliza();
        } else {
            p.lance("RIVAL_AVANCA", false, true, null, null, z, z + 1);
            p.zona = z + 1;
        }
    }

    /** A finalização do adversário contra o goleiro da pessoa (mais forte quando uma carta branca o preparou). */
    private void rivalFinaliza() {
        int z = p.zona;
        double goleiro = p.time.defesa() * p.time.folego(p.jogada) + (p.goleiroPronto ? GOLEIRO_PRONTO : 0);
        double margem = (p.rival(TECNICA) + p.rival(FISICO)) / 2 + DISTANCIA[z] - goleiro + sorte();
        p.goleiroPronto = false;
        p.resumo.chute(false, margem >= -12);
        if (margem >= 0) {
            p.pontos[1][p.tempo() - 1] += p.regras.pontosDaZona()[z];
            p.lance("RIVAL_GOL", false, true, null, null, z, EsportePartida.GOL);
            p.nossa = true;
            p.zona = 1;
            return;
        }
        if (margem >= -6) {
            p.resumo.defesa(true);
            p.lance("RIVAL_DEFENDIDO", false, false, null, null, z, EsportePartida.GOL);
        } else if (margem >= -12) {
            p.resumo.defesa(true);
            p.lance("RIVAL_ESPALMADO", false, false, null, null, z, EsportePartida.GOL);
            p.zona = 3;
            return;
        } else {
            p.lance("RIVAL_FORA", false, false, null, null, z, EsportePartida.GOL);
        }
        p.nossa = true;
        p.zona = 0;
    }
}
