package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Núcleo 14 — futebol de 5: um uniforme (camisa, calção e chuteira) para os 4 de linha contra o time-padrão. Coesão 100%
 * (uniforme único). A força do time é a média de velocidade, técnica, resistência e defesa do uniforme; a do time-padrão
 * sai do sorteio da partida (20 a 30). Em cada tempo, mais de 1 ponto de força acima vale um gol do time e mais de 1
 * abaixo, um gol do adversário. Mais gols = vitória (100); iguais = empate (60); menos = derrota (0).
 *
 * <p>A partida anda em duas etapas: a entrega joga o primeiro tempo e para no INTERVALO (EM_ACAO); o acionamento, com no
 * máximo uma troca de peça (carta do deck, na vaga da posição dela), joga o segundo tempo e fecha a partida.</p>
 */
public class FashionSportsNucleo implements Flair3dNucleo {
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL");
    public static final int PADRAO_MIN = 20;
    public static final int PADRAO_FAIXA = 11;

    @Override
    public String codigo() {
        return "FASHION_SPORTS";
    }

    @Override
    public int numero() {
        return 14;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("FUTEBOL_DE_5", new Regra("VITORIA", 100),
                new Regra("EMPATE", 60), new Regra("COESAO", 0)), List.of(Definicao.CARTAS), VAGAS,
                Deck.ate(6, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF"), Obrigatoria.uma("CAL")), false)
                .comAvatares(Avatares.solo(new Avatares.Online(2, 10, 5), Avatares.figurante("COLEGA", 4), Avatares.figurante("ADVERSARIO", 5)));
    }

    public static int forca(Flair3dAtributos a) {
        return Math.round((a.velocidade() + a.tecnica() + a.resistencia() + a.defesa()) / 4f);
    }

    static int forca(Map<String, CbcRules.Card> uniforme) {
        return forca(Flair3dAtributos.soma(uniforme.values()));
    }

    /** Gols de um tempo pela diferença de força: {time, adversário}. */
    static int[] gols(int diferenca) {
        return new int[]{diferenca > 1 ? 1 : 0, diferenca < -1 ? 1 : 0};
    }

    /** O uniforme do segundo tempo: o da entrega com a troca aplicada (422 se a carta não cabe na vaga). */
    static Map<String, CbcRules.Card> comTroca(Map<String, CbcRules.Card> uniforme, Acionamento.Troca troca, Contexto contexto) {
        CbcRules.Card entra = troca.carta() == null ? null : contexto.cartas().get(troca.carta());
        if (entra == null || !VAGAS.contains(troca.vaga()) || !troca.vaga().equals(entra.position())) {
            throw Flair3dErros.invalido("TROCA_INVALIDA", "troca_invalida");
        }
        Map<String, CbcRules.Card> out = new LinkedHashMap<>(uniforme);
        out.put(troca.vaga(), entra);
        return out;
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> uniforme = contexto.vestidas(entrega);
        int nos = forca(uniforme);
        int eles = PADRAO_MIN + contexto.sorteio().nextInt(PADRAO_FAIXA);
        int[] primeiro = gols(nos - eles);
        List<Evento> eventos = new ArrayList<>(List.of(new Evento("FORCA_TIME", nos), new Evento("FORCA_ADVERSARIO", eles),
                new Evento("COESAO", 100), new Evento("INTERVALO", primeiro[0] + "-" + primeiro[1])));
        List<Acionamento> acionamentos = contexto.andamento().acionamentos();
        if (acionamentos.isEmpty()) {
            return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, List.of(), eventos);
        }
        Acionamento.Troca troca = acionamentos.get(0).troca();
        if (troca != null) {
            uniforme = comTroca(uniforme, troca, contexto);
            eventos.add(new Evento("TROCA", Map.of("vaga", troca.vaga(), "carta", troca.carta())));
        }
        int segundoTempo = forca(uniforme);
        int[] segundo = gols(segundoTempo - eles);
        int golsNos = primeiro[0] + segundo[0];
        int golsEles = primeiro[1] + segundo[1];
        boolean vitoria = golsNos > golsEles;
        boolean empate = golsNos == golsEles;
        eventos.add(new Evento("FORCA_SEGUNDO_TEMPO", segundoTempo));
        eventos.add(new Evento("PLACAR", golsNos + "-" + golsEles));
        List<RegraResultado> regras = List.of(RegraResultado.de("VITORIA", vitoria, 100), RegraResultado.de("EMPATE", empate, 60),
                RegraResultado.de("COESAO", true, 0));
        double pontos = vitoria ? 100 : empate ? 60 : 0;
        return Resultado.of(pontos, vitoria ? "VITORIA" : empate ? "EMPATE" : "DERROTA", regras, eventos)
                .comCartas(new Flair3dRateio(uniforme).dividir(pontos, FashionSportsNucleo::peso).lista());
    }

    /** Peso da carta no jogo: o que ela soma de velocidade, técnica, resistência e defesa (o que tira não conta). */
    static double peso(CbcRules.Card c) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(c);
        return Math.max(0, a.velocidade()) + Math.max(0, a.tecnica()) + Math.max(0, a.resistencia()) + Math.max(0, a.defesa());
    }

    /** Só os atributos do uniforme (a partida não roda na prévia nem gasta o sorteio). */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Flair3dAtributos a = Flair3dAtributos.soma(contexto.vestidas(entrega).values());
        return Resultado.parcial(null, "PREVIA", List.of(), List.of(new Evento("VELOCIDADE", a.velocidade()),
                new Evento("TECNICA", a.tecnica()), new Evento("RESISTENCIA", a.resistencia()), new Evento("DEFESA", a.defesa()),
                new Evento("FORCA_TIME", forca(a)), new Evento("COESAO", 100)));
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(carta);
        return List.of(new Efeito("VELOCIDADE", a.velocidade()), new Efeito("TECNICA", a.tecnica()),
                new Efeito("RESISTENCIA", a.resistencia()), new Efeito("DEFESA", a.defesa()));
    }
}
