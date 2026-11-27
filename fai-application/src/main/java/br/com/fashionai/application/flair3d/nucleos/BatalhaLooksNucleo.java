package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dPercurso;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.List;
import java.util.Map;

/**
 * Núcleo 15 — rodada "Look Monocromático" em azul: 25 por peça da família azul; vence o adversário-padrão (75) com mais
 * de 75. Nos treinos e na batalha de 3 rodadas, o adversário da casa veste um look tirado da semente e é avaliado pelas
 * mesmas regras ({@link BatalhaLooksAdversario}).
 */
public class BatalhaLooksNucleo implements Flair3dNucleo {
    public static final double POR_PECA = 25;
    public static final int ADVERSARIO = 75;
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");

    @Override
    public String codigo() {
        return "BATALHA_LOOKS";
    }

    @Override
    public int numero() {
        return 15;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("MONOCROMATICO_AZUL", new Regra("FAMILIA_AZUL", POR_PECA)),
                List.of(Definicao.CARTAS), VAGAS,
                Deck.ate(8, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF"), Obrigatoria.uma("CAL")), true)
                .comAvatares(Avatares.solo(new Avatares.Online(1, 3, null), Avatares.figurante("ADVERSARIO", 1)))
                .comRodadas(BatalhaLooksRodadas.rodadas().toArray(Definicao.Rodada[]::new))
                .comRodadaNaFrente(BatalhaLooksRodadas.batalha());
    }

    /** Rodada de treino com o desafio sorteado (o convite ou o clima)? */
    private static boolean treino(Contexto contexto) {
        return BatalhaLooksRodadas.CONVITE.equals(contexto.rodada()) || BatalhaLooksRodadas.CLIMA.equals(contexto.rodada());
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        Flair3dPercurso.Etapas etapas = BatalhaLooksRodadas.etapas(contexto);
        if (etapas != null) {
            return Map.of("etapa", Flair3dPercurso.primeira(etapas));
        }
        return treino(contexto) ? Map.of("desafio", BatalhaLooksRodadas.treino(contexto).codigo()) : Map.of();
    }

    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Flair3dPercurso.Etapas etapas = BatalhaLooksRodadas.etapas(contexto);
        if (etapas != null) {
            return Flair3dPercurso.previa(entrega, contexto, etapas);
        }
        Resultado r = pontuar(entrega, contexto);
        return treino(contexto) ? new Resultado(r.pontos(), r.estrelas(), Resultado.EM_PREPARO, r.regras(), List.of(), r.cartas(), r.status()) : r;
    }

    /** Treino de um desafio só contra o adversário da casa, com a nota dele tirada da semente. */
    private static Resultado treinar(Map<String, CbcRules.Card> vestidas, Contexto contexto) {
        BatalhaLooksRodadas.Desafio desafio = BatalhaLooksRodadas.treino(contexto);
        BatalhaLooksPlacar.DaPessoa voce = BatalhaLooksPlacar.daPessoa(desafio, vestidas, vestidas, contexto.andamento().usos(), 1, contexto);
        double pontos = voce.nota().total();
        Map<String, Object> adversario = BatalhaLooksRodadas.adversarioNaTela(contexto, 1, desafio);
        int nota = (int) adversario.get("nota");
        Map<String, Object> conta = Map.of("voce", voce.nota().paraTela(), "adversario", adversario.get("conta"), "cansadas", voce.cansadas());
        return Resultado.of(pontos, pontos > nota ? "VITORIA" : "DERROTA", voce.regras(),
                List.of(new Evento("DESAFIO", desafio.codigo()), new Evento("ADVERSARIO", nota), new Evento("LOOK_DO_ADVERSARIO", adversario),
                        new Evento("CONTA_DA_BATALHA", conta), voce.aura().evento()))
                .comCartas(new Flair3dRateio(vestidas).cada(POR_PECA, desafio.naRegra()).lista());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Flair3dPercurso.Etapas etapas = BatalhaLooksRodadas.etapas(contexto);
        if (etapas != null) {
            return Flair3dPercurso.pontuar(entrega, contexto, etapas);
        }
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        if (treino(contexto)) {
            return treinar(vestidas, contexto);
        }
        List<RegraResultado> regras = Flair3dPecas.porVaga(VAGAS, vestidas, "FAMILIA_AZUL", POR_PECA, BatalhaLooksNucleo::azul);
        double pontos = regras.stream().mapToDouble(RegraResultado::pontos).sum();
        return Resultado.of(pontos, pontos > ADVERSARIO ? "VITORIA" : "DERROTA", regras, List.of(new Evento("ADVERSARIO", ADVERSARIO)))
                .comCartas(new Flair3dRateio(vestidas).cada(POR_PECA, BatalhaLooksNucleo::azul).lista());
    }

    /** A execução do desfile final entra na soma contra a casa e o desfecho manda na nota ({@link BatalhaLooksFecho}). */
    @Override
    public Resultado comExecucao(Resultado look, Resultado comNota, int execucao, Contexto contexto) {
        return BatalhaLooksFecho.comExecucao(look, comNota, execucao, contexto);
    }

    static boolean azul(CbcRules.Card c) {
        return Flair3dPecas.daFamilia(c, "Azul");
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        boolean sorteada = BatalhaLooksRodadas.BATALHA.equals(contexto.rodada()) || treino(contexto);
        if (sorteada && !contexto.emPartida()) {
            return List.of(Efeito.conformeAEtapa());
        }
        if (sorteada) {
            // dentro da partida o desafio da vez já foi revelado: o selo diz se a carta entra nele
            BatalhaLooksRodadas.Desafio d = BatalhaLooksRodadas.daVez(contexto);
            if (d.proibida().test(carta)) {
                return List.of(Efeito.motivo("PECA_PROIBIDA"));
            }
            return d.naRegra().test(carta) ? List.of(new Efeito("NA_REGRA", POR_PECA)) : List.of(Efeito.motivo("FORA_DA_REGRA"));
        }
        return azul(carta) ? List.of(new Efeito("FAMILIA_AZUL", POR_PECA)) : List.of(Efeito.motivo("FORA_DA_FAMILIA"));
    }
}
