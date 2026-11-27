package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento.Execucao;
import br.com.fashionai.application.flair3d.Acionamento.Toque;
import br.com.fashionai.application.flair3d.aura.Flair3dAuraNaExecucao;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.recurso.Flair3dDesgaste;
import br.com.fashionai.application.flair3d.recurso.Flair3dPecaVirtual;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoCalculo;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoEstado;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A execução (decisão da dona de 25/11/2026: a habilidade conta na nota). Nos jogos de ação jogável, depois do look
 * avaliado (e da jogada de cena, onde há), a partida fica EM_ACAO e o servidor pede, para cada uma das {@value #MARCAS}
 * marcas do percurso, um dos quatro botões (sorteado da semente), com uma janela de tempo que sai da AGILIDADE do look.
 * A pessoa anda até cada marca e aperta o botão; o acionamento traz os toques. Perfeito soma {@value #PERFEITO}, bom
 * {@value #BOM}, e errar, chegar tarde ou antecipar tira {@value #ERRO} e drena o recurso-vida do jogo; recurso zerado
 * fecha a partida como {@value #ESGOTADO}. O servidor confere o que dá para conferir (marca, botão, reação humana
 * mínima, um toque por marca) e limita o ganho; o tempo vem do navegador. Nos jogos de zonas a execução é a fase de uso
 * ({@link Flair3dFaseDeUso}): mais marcas, prazo e o lance ousado, que gasta o recurso. Decorator sobre o núcleo do jogo
 * (docs/refactoring/gof/R90-flair3d-nucleos.md).
 */
public final class Flair3dExecucao implements Flair3dNucleo {
    public static final int MARCAS = 3;
    public static final int PERFEITO = 5;
    public static final int BOM = 2;
    public static final int ERRO = 4;
    public static final int TETO = 15;
    /** Reação mais rápida que isto é antecipar o botão (ninguém reage a um sinal em menos de 150 ms). */
    public static final int REACAO_MINIMA_MS = 150;
    public static final String ESGOTADO = "ESGOTADO";
    /** Nota máxima de quem esgotou o recurso: perdeu a partida. */
    public static final int NOTA_DE_QUEM_ESGOTOU = 30;
    static final List<String> BOTOES = List.of("VESTIR", "TIRAR", "DESFILAR", "TROCAR_ABA");

    private final Flair3dNucleo jogo;

    public Flair3dExecucao(Flair3dNucleo jogo) {
        this.jogo = jogo;
    }

    @Override
    public String codigo() {
        return jogo.codigo();
    }

    @Override
    public int numero() {
        return jogo.numero();
    }

    @Override
    public Definicao definicao() {
        return jogo.definicao();
    }

    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        return jogo.previa(entrega, contexto);
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        return jogo.abertura(contexto);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return jogo.efeitos(carta, contexto);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Resultado look = jogo.pontuar(entrega, contexto);
        // o que as decisões já gastaram do recurso (Flair3dDesgaste); sem o evento, o jogo não gasta nada com elas
        int depoisDasDecisoes = Flair3dDesgaste.restanteEm(look);
        // nota zero (o look que não cumpriu nada) e a reserva zerada pelas decisões fecham como estão: não há o que apresentar
        if (!look.fecha() || look.pontos() <= 0 || depoisDasDecisoes == 0) {
            return look;
        }
        Recurso recurso = recursoDo(codigo());
        int reserva = depoisDasDecisoes > 0 ? depoisDasDecisoes : Flair3dRecursoEstado.de(contexto.andamento().usos()).get(recurso);
        List<String> botoes = botoes(contexto);
        int janela = Flair3dAuraNaExecucao.janela(codigo(), janelaMs(atributoDaJanela(entrega, contexto)), contexto.vestidas(entrega).values(), contexto);
        Pedido pedido = new Pedido(botoes, janela, recurso.name(), reserva, drenoDe(recurso), Flair3dFaseDeUso.riscoDe(codigo(), botoes, janela, contexto, entrega));
        List<Evento> eventos = new ArrayList<>(look.eventos());
        eventos.add(new Evento("EXECUCAO_PEDIDA", pedido.paraTela()));
        Execucao feita = daExecucao(entrega, contexto);
        if (feita == null) {
            return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, look.regras(), eventos);
        }
        Nota avaliada = pedido.risco() == null ? avaliar(pedido, feita) : Flair3dFaseDeUso.avaliar(pedido, feita, contexto.cartas());
        Nota nota = Flair3dAuraNaExecucao.reavaliar(codigo(), pedido, avaliada, contexto.vestidas(entrega).values(), contexto, eventos);
        eventos.add(new Evento("EXECUCAO", nota.paraTela()));
        List<RegraResultado> regras = new ArrayList<>(look.regras());
        regras.add(new RegraResultado("EXECUCAO", nota.pontos() > 0, nota.pontos()));
        double pontos = Math.max(0, look.pontos() + nota.pontos());
        if (nota.restante() <= 0) {
            return Resultado.of(Math.min(pontos, NOTA_DE_QUEM_ESGOTOU), ESGOTADO, regras, eventos).comCartas(look.cartas());
        }
        Resultado comNota = Resultado.of(pontos, Flair3dJogadaDeCena.rotulo(look.resultado(), pontos), regras, eventos).comCartas(look.cartas());
        return jogo.comExecucao(look, comNota, nota.pontos(), contexto);
    }

    /**
     * O acionamento da execução: o último, quando o núcleo já fechava sem ele (os de antes são do núcleo, como a jogada
     * de cena). Sem toques (seguir adiante), vale como execução vazia: as marcas contam como erro. Nulo enquanto não veio.
     */
    private Execucao daExecucao(Entrega entrega, Contexto contexto) {
        Andamento a = contexto.andamento();
        List<Acionamento> acs = a.acionamentos();
        if (acs.isEmpty()) {
            return null;
        }
        Andamento antes = new Andamento(a.tentativas(), acs.subList(0, acs.size() - 1), a.anteriores(), a.rodada(), a.rascunho(), a.usos(), a.hype());
        if (!jogo.pontuar(entrega, contexto.comAndamento(antes)).fecha()) {
            return null;
        }
        Execucao feita = acs.get(acs.size() - 1).execucao();
        return feita == null ? new Execucao(List.of()) : feita;
    }

    /** O que o servidor pede: um botão por marca, a janela, o recurso que o erro drena, quanto há e quanto cada erro tira. */
    public record Pedido(List<String> botoes, int janelaMs, String recurso, int reserva, int dreno, Flair3dFaseDeUso.Risco risco) {
        public Pedido(List<String> botoes, int janelaMs, String recurso, int reserva, int dreno) {
            this(botoes, janelaMs, recurso, reserva, dreno, null);
        }

        Map<String, Object> paraTela() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("botoes", botoes);
            m.put("janelaMs", janelaMs);
            m.put("recurso", recurso);
            m.put("reserva", reserva);
            m.put("dreno", dreno);
            if (risco != null) {
                risco.paraTela(m);
            }
            return m;
        }
    }

    /**
     * A nota da execução: o resultado de cada marca, os pontos (de -{@value #TETO} a +{@value #TETO}), o recurso que sobrou
     * e, na fase de uso, o detalhe (cartas jogadas, torcida, momento-chave) que a tela mostra.
     */
    public record Nota(List<String> marcas, int pontos, int restante, Map<String, Object> detalhe) {
        public Nota(List<String> marcas, int pontos, int restante) {
            this(marcas, pontos, restante, Map.of());
        }

        Map<String, Object> paraTela() {
            Map<String, Object> m = new LinkedHashMap<>(detalhe);
            m.put("marcas", marcas);
            m.put("pontos", pontos);
            m.put("restante", restante);
            return m;
        }
    }

    /** Avalia cada marca pelo primeiro toque nela: PERFEITO (até meia janela), BOM, ou ERROU (outro botão, tarde, antes da hora ou sem toque). */
    public static Nota avaliar(Pedido pedido, Execucao feita) {
        if (pedido.risco() != null) {
            return Flair3dFaseDeUso.avaliar(pedido, feita);
        }
        List<String> marcas = new ArrayList<>();
        int pontos = 0;
        int restante = pedido.reserva();
        for (int i = 0; i < pedido.botoes().size(); i++) {
            String r = nota(pedido, primeiro(feita.toques(), i), i);
            marcas.add(r);
            switch (r) {
                case "PERFEITO" -> pontos += PERFEITO;
                case "BOM" -> pontos += BOM;
                default -> {
                    pontos -= ERRO;
                    restante -= pedido.dreno();
                }
            }
        }
        return new Nota(marcas, Math.max(-TETO, Math.min(TETO, pontos)), Math.max(0, restante));
    }

    private static Toque primeiro(List<Toque> toques, int marca) {
        return toques.stream().filter(t -> t != null && t.marca() == marca).findFirst().orElse(null);
    }

    static String nota(Pedido pedido, Toque t, int i) {
        if (t == null || !pedido.botoes().get(i).equals(t.botao()) || t.ms() < REACAO_MINIMA_MS || t.ms() > pedido.janelaMs()) {
            return "ERROU";
        }
        return t.ms() <= pedido.janelaMs() / 2 ? "PERFEITO" : "BOM";
    }

    private List<String> botoes(Contexto contexto) {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < Flair3dFaseDeUso.marcasDo(codigo()); i++) {
            out.add(contexto.sortear("execucao-" + i, BOTOES));
        }
        return out;
    }

    /** Janela de 650 ms (atributo 0) a 1350 ms (atributo 100): o tênis dá mais tempo que o salto. */
    public static int janelaMs(int agilidade) {
        return 650 + 7 * Math.max(0, Math.min(100, agilidade));
    }

    /** O atributo do look que abre a janela: o carisma no show da cantora, a força na missão do herói; nos outros, a agilidade. */
    static final Map<String, Atributo> JANELA = Map.of("FAVORITE_SINGER", Atributo.CARISMA, "SUPER_HEROI", Atributo.FORCA);

    private int atributoDaJanela(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        if (vestidas.isEmpty()) {
            vestidas = Flair3dPecaVirtual.daZonas(codigo(), entrega.zonas());
        }
        return vestidas.isEmpty() ? 50 : Flair3dRecursoCalculo.doLook(vestidas).valor(JANELA.getOrDefault(codigo(), Atributo.AGILIDADE));
    }

    /** O recurso-vida do jogo (moedas não se perdem errando: onde a vida seria moeda, o erro tira o FOCO). */
    static Recurso recursoDo(String codigo) {
        return Flair3dDesgaste.vidaDo(codigo);
    }

    /** Cada erro tira pouco mais de um terço da reserva inicial: três erros esgotam, salvo quem usou peça como recurso. */
    static int drenoDe(Recurso r) {
        return Flair3dRecursoEstado.INICIAL.get(r) / 3 + 2;
    }
}
