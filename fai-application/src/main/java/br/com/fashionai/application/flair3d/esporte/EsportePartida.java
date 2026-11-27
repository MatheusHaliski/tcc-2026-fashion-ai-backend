package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoNoMotor;
import br.com.fashionai.application.flair3d.Resultado.Evento;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Uma partida do FASHION_SPORTS jogada por cartas (definição da dona de 15/11/2026): a partida é uma sequência de
 * jogadas no relógio, e em cada uma a pessoa joga uma carta da mão. A cor da carta decide a ação e o poder dela decide o
 * duelo contra o adversário, que é jogado pelo servidor. Sem carta, o time não faz nada de útil na jogada: perde a bola
 * se a tinha, ou deixa o adversário seguir. Tudo sai da semente, do uniforme e das cartas jogadas, na ordem: a mesma
 * partida refeita dá sempre os mesmos lances.
 *
 * <p>O campo tem quatro zonas na visão de quem tem a bola: defesa (0), meio (1), ataque (2) e área (3). Perder a bola
 * na zona z entrega a bola ao outro time na zona 3 − z. Cada lance vira um evento JOGADA com quem agiu, de onde para
 * onde a bola foi (campo de 100 × 60, o gol da pessoa em x = 0) e o placar; o evento SITUACAO diz a jogada seguinte e a
 * mão. A resolução de cada jogada está em {@link EsporteLance}.</p>
 */
public final class EsportePartida {
    static final int SORTE = 8;
    /** O que o adversário soma à força de base dele em todo duelo (ele também "joga uma carta"). */
    static final int CARTA_DO_RIVAL = 8;
    static final int[] X_DA_ZONA = {18, 45, 70, 88};
    /** "Zona" de destino de uma finalização: o gol de quem defende. */
    static final int GOL = 4;

    final EsporteRegras regras;
    final EsporteForcas.Time time;
    final Contexto contexto;
    final EsporteMao mao;
    final int[] rival = new int[4];
    final List<Evento> eventos = new ArrayList<>();
    final int[][] pontos = new int[2][EsporteRegras.TEMPOS];
    final EsporteResumo resumo = new EsporteResumo();
    boolean nossa = true;
    int zona = 1;
    int jogada;
    int bonus;
    /** o ajuste do duelo da jogada pela posição da capitã (EsportePosicao) */
    int posicionamento;
    /** o acerto na barra de tempo do chute ou do desarme desta jogada (EsporteTempo), ou SEM */
    int tempo = EsporteTempo.SEM;
    boolean goleiroPronto;
    int lances;
    /** O reinício que o último lance deixou para depois (saída de bola, tiro de meta, escanteio, lateral). */
    Runnable reinicio;

    public EsportePartida(EsporteRegras regras, Map<String, CbcRules.Card> uniforme, Contexto contexto) {
        this.regras = regras;
        this.contexto = contexto;
        // a peça usada como recurso (ENERGIA) devolve o fôlego ao time a partir da jogada em que foi usada
        time = EsporteForcas.time(uniforme.values()).comRecargas(Flair3dRecursoNoMotor.lances(contexto.andamento().usos(), "ENERGIA"));
        mao = new EsporteMao(contexto, uniforme.values().stream().map(CbcRules.Card::id).toList());
        Random r = contexto.sorteio("rival");
        for (int i = 0; i < rival.length; i++) {
            rival[i] = 20 + r.nextInt(11);
        }
        EsporteReinicio.saida(this, true);
    }

    /** Força do adversário num atributo (0 velocidade, 1 técnica, 2 defesa, 3 físico), já com o cansaço da jogada. */
    double rival(int atributo) {
        return (rival[atributo] + CARTA_DO_RIVAL) * Math.max(0.5, 1 - jogada * EsporteForcas.CANSACO_DO_RIVAL);
    }

    /** A força da pessoa na ação: a base do time com o fôlego da jogada mais o poder da carta. */
    double nossa(String acao, CbcRules.Card carta) {
        return time.base(acao) * time.folego(jogada) + (carta == null ? 0 : EsporteForcas.poder(carta, acao));
    }

    int tempo() {
        return regras.tempoDa(Math.min(jogada, regras.jogadas() - 1));
    }

    String placar() {
        return regras.placar(pontos[0], pontos[1]);
    }

    /** Onde a bola está no campo: x cresce para o gol do adversário; a zona é a de quem tem a bola. */
    int x(boolean doNosso, int z) {
        int base = z >= GOL ? 100 : X_DA_ZONA[Math.max(0, z)];
        return doNosso ? base : 100 - base;
    }

    /** Registra um lance pelas zonas: quem agiu, de que zona para que zona, com que carta, e o placar depois dele. */
    Map<String, Object> lance(String tipo, boolean doNosso, boolean ok, CbcRules.Card carta, String acao, int deZona, int paraZona) {
        Random r = contexto.sorteio("lance" + lances);
        int jogador = "GOLEIRO_PRONTO".equals(tipo) && regras.comTrave() ? 1 : jogadorDa(deZona, r);
        int alvo = jogadorDa(Math.min(3, deZona + 1), r);
        double[] de = {x(doNosso, deZona), 12 + r.nextInt(37)};
        double[] para = {x(doNosso, paraZona), paraZona >= GOL ? 26 + r.nextInt(9) : 12 + r.nextInt(37)};
        return registrar(tipo, doNosso, ok, carta, acao, new int[]{jogador, alvo}, de, para);
    }

    /**
     * Registra um lance pelos pontos do campo (os reinícios saem de um ponto certo: o centro, o canto, a linha lateral).
     * Nas modalidades de invasão o lance leva o estado e o destino de cada jogador ({@link EsporteCampo}); quem ataca é
     * quem tem a bola na hora do lance.
     */
    Map<String, Object> registrar(String tipo, boolean doNosso, boolean ok, CbcRules.Card carta, String acao, int[] quem, double[] de, double[] para) {
        lances++;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("n", lances);
        m.put("jogada", Math.min(jogada + 1, regras.jogadas()));
        m.put("tempo", tempo());
        m.put("relogio", Math.min(jogada, regras.jogadas()) * regras.segundosPorJogada());
        m.put("minuto", Math.min(jogada, regras.jogadas()) * regras.segundosPorJogada() / 60);
        m.put("tipo", tipo);
        m.put("time", doNosso ? "NOS" : "ELES");
        m.put("ok", ok);
        m.put("jogador", quem[0]);
        m.put("alvo", quem[1]);
        m.put("de", EsporteCampo.ponto(de));
        m.put("para", EsporteCampo.ponto(para));
        m.put("placar", placar());
        if (regras.sets()) {
            // o placar em sets só muda no fim do set: os pontos do set da vez vão à parte
            m.put("parcial", pontos[0][tempo() - 1] + "-" + pontos[1][tempo() - 1]);
        }
        if (carta != null) {
            m.put("carta", carta.id());
            m.put("acao", acao);
        }
        if (regras.deInvasao()) {
            m.put("jogadores", new EsporteCampo(regras, nossa).jogadores(tipo, doNosso, ok, quem, de, para));
        }
        eventos.add(new Evento("JOGADA", m));
        return m;
    }

    /** O jogador que age numa zona: 1 é o goleiro; os de trás agem na defesa, os da frente no ataque. */
    int jogadorDa(int z, Random r) {
        int n = regras.jogadores();
        if (n <= 2) {
            return 1 + r.nextInt(n);
        }
        int linha = n - 1;
        int faixa = Math.min(linha - 1, z * linha / 4);
        return 2 + Math.min(linha - 1, faixa + r.nextInt(2));
    }

    /** Joga os acionamentos na ordem (cada um é uma jogada: a carta jogada, ou nenhuma) e fecha no fim do segundo tempo. */
    public EsportePartida jogar(List<Acionamento> acionamentos) {
        for (Acionamento a : acionamentos) {
            if (encerrada()) {
                break;
            }
            UUID id = a == null ? null : a.carta();
            CbcRules.Card carta = null;
            if (id != null) {
                mao.jogar(id);
                carta = contexto.deck().get(id);
            }
            posicionamento = EsportePosicao.ajuste(a == null ? null : a.alvo(), nossa);
            if (posicionamento != 0) {
                eventos.add(new Evento("POSICIONAMENTO", posicionamento));
            }
            tempo = EsporteTempo.faixa(a == null ? null : a.alvo());
            new EsporteLance(this, carta).resolver();
            posicionamento = 0;
            tempo = EsporteTempo.SEM;
            jogada++;
            Runnable pendente = reinicio;
            reinicio = null;
            if (jogada == regras.jogadasPorTempo()) {
                eventos.add(new Evento("INTERVALO", placar()));
                nossa = false;
                zona = 1;
                bonus = 0;
                EsporteReinicio.saida(this, false);
            } else if (pendente != null && !encerrada()) {
                pendente.run();
            }
        }
        if (encerrada()) {
            eventos.add(new Evento("RESUMO", resumo.mapa()));
            eventos.add(new Evento("PLACAR", placar()));
        } else {
            eventos.add(new Evento("SITUACAO", situacao()));
        }
        return this;
    }

    public boolean encerrada() {
        return jogada >= regras.jogadas();
    }

    /** A jogada da vez: quem tem a bola, em que zona, a mão e o que resta do baralho. */
    Map<String, Object> situacao() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("jogada", jogada + 1);
        m.put("total", regras.jogadas());
        m.put("tempo", tempo());
        m.put("relogio", jogada * regras.segundosPorJogada());
        m.put("posse", nossa ? "NOS" : "ELES");
        m.put("zona", zona);
        m.put("goleiroPronto", goleiroPronto);
        m.put("mao", mao.cartas());
        m.put("baralho", mao.noBaralho());
        m.put("placar", placar());
        return m;
    }

    public List<Evento> eventos() {
        return eventos;
    }

    /** Positivo = a pessoa venceu; zero = empate; negativo = derrota. */
    public int saldo() {
        return regras.saldo(pontos[0], pontos[1]);
    }

    public EsporteForcas.Time time() {
        return time;
    }
}
