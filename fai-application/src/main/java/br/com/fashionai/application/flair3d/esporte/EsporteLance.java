package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.flair.CbcRules;

import java.util.List;
import java.util.Map;
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
 * <p>Todo duelo é: força da pessoa − força do adversário + sorte de −8 a +8 (da semente; no chute e no desarme, a barra
 * de tempo aperta para ±5 ou ±3, {@link EsporteTempo}). Vence com zero ou mais. A
 * finalização, dos dois lados, é resolvida em {@link EsporteFinalizacao}; no futebol, o passe que perde por mais de
 * {@link #LATERAL} sai pela lateral e o adversário repõe a bola dali ({@link EsporteReinicio}).</p>
 */
final class EsporteLance {
    static final int FOLGA = 12;
    static final int EMBALO = 6;
    static final int GOLEIRO_PRONTO = 12;
    static final int GOLEIRO = 6;
    /** Desconto da finalização pela zona de onde ela sai (defesa, meio, ataque, área). */
    static final int[] DISTANCIA = {-18, -10, -3, 4};
    /** O passe que perde por mais que isto sai pela lateral (só no futebol). */
    static final int LATERAL = 10;
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

    /** A sorte de um duelo da pessoa, com o ajuste da posição da capitã (EsportePosicao). */
    private int jogo() {
        return sorte() + p.posicionamento;
    }

    /** O duelo do chute e do desarme: a barra de tempo aperta a sorte (EsporteTempo). */
    private int jogoComTempo() {
        return EsporteTempo.sorte(sorte(), p.tempo) + p.posicionamento;
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
            case EsporteForcas.PASSE -> avancar("PASSE", p.nossa(acao, carta) + embalo - p.rival(DEFESA) + jogo(), false);
            case EsporteForcas.CORRIDA -> avancar("CONDUCAO", p.nossa(acao, carta) + embalo - p.rival(VELOCIDADE) + jogo(), false);
            case EsporteForcas.DRIBLE -> avancar("DRIBLE", p.nossa(acao, carta) + embalo - (p.rival(DEFESA) + p.rival(FISICO)) / 2 + jogo(), true);
            case EsporteForcas.CHUTE -> {
                double margem = p.nossa(acao, carta) + embalo + DISTANCIA[p.zona] - (p.rival(DEFESA) + GOLEIRO) + jogoComTempo();
                new EsporteFinalizacao(p, sorteio).resolver(true, carta, acao, margem);
            }
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
            Map<String, Object> lance = p.lance(tipo + "_PERDIDO", true, false, carta, acao, z, z);
            p.resumo.desarme(false);
            trocaDePosse();
            if ("PASSE".equals(tipo) && margem < -LATERAL && p.regras.comTrave()) {
                paraFora(lance);
            }
            return;
        }
        int destino = Math.min(3, z + ("CONDUCAO".equals(tipo) && margem >= FOLGA ? 2 : 1));
        p.lance(tipo, true, true, carta, acao, z, destino);
        p.zona = destino;
        p.bonus = drible ? EMBALO : 0;
    }

    /** O passe errado que sai pela lateral: a bola vai até a linha e o adversário cobra o lateral dali. */
    private void paraFora(Map<String, Object> lance) {
        boolean emCima = sorteio.nextBoolean();
        double x = ((Number) ((List<?>) lance.get("de")).get(0)).doubleValue() + 8;
        lance.put("para", EsporteCampo.ponto(new double[]{x, emCima ? 0 : 60}));
        lance.put("saiu", true);
        p.reinicio = () -> EsporteReinicio.lateral(p, false, x, emCima);
    }

    private void semABola() {
        int z = p.zona;
        boolean querFinalizar = z == 3 || (z == 2 && sorteio.nextBoolean());
        boolean parou = false;
        if (carta != null) {
            switch (acao) {
                case EsporteForcas.DEFESA -> {
                    boolean ok = p.nossa(acao, carta) - p.rival(TECNICA) + jogoComTempo() >= 0;
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
                    parou = p.nossa(acao, carta) - p.rival(VELOCIDADE) + jogo() >= 0;
                    p.lance(parou ? "RECOMPOE" : "RECOMPOE_FALHO", true, parou, carta, acao, 3 - z, 3 - z);
                }
                case EsporteForcas.GOLEIRO -> {
                    p.goleiroPronto = true;
                    p.lance("GOLEIRO_PRONTO", true, true, carta, acao, 0, 0);
                }
                default -> {
                    parou = (p.time.fisico() * p.time.folego(p.jogada) + EsporteForcas.poder(carta, acao)) / 2 - p.rival(FISICO) / 2 + jogo() >= 0;
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
        double goleiro = p.time.defesa() * p.time.folego(p.jogada) + (p.goleiroPronto ? GOLEIRO_PRONTO : 0);
        double margem = (p.rival(TECNICA) + p.rival(FISICO)) / 2 + DISTANCIA[p.zona] - goleiro + sorte();
        p.goleiroPronto = false;
        new EsporteFinalizacao(p, sorteio).resolver(false, null, null, margem);
    }
}
