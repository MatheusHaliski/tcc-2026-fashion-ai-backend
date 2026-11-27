package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Definicao.Rodada;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Flair3dPercurso;
import br.com.fashionai.application.flair3d.Flair3dPercurso.Avaliacao;
import br.com.fashionai.application.flair3d.Flair3dPercurso.Look;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.recurso.Flair3dDesgaste;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Rodadas do LABIRINTO além do Espelho 1 (docs/flair/flair-3d/OBJETIVOS_POR_JOGO.md, jogo 10): a Escada de Espelhos (5
 * espelhos, cada um soma uma regra às anteriores), as Três Portas (3 salas, a pessoa escolhe a porta fácil, média ou
 * difícil) e o Corredor de Holofotes (um look para 5 condições). Na escada e nas portas, cada apresentação que não passa
 * gasta Reflexo (a ENERGIA do jogo, {@link Flair3dDesgaste#POR_FALHA}); zerado, a partida fecha em derrota. O espelho e a
 * porta não cedem mais por pena: só passa quem acerta (reauditoria de 25/11/2026).
 */
final class LabirintoRodadas {
    static final String ESCADA = "ESCADA_DE_ESPELHOS";
    static final String PORTAS = "TRES_PORTAS";
    static final String HOLOFOTES = "CORREDOR_DE_HOLOFOTES";
    /** O motivo do gasto de Reflexo: a apresentação que não abriu o espelho ou a porta. */
    static final String APRESENTACAO_ERRADA = "APRESENTACAO_ERRADA";
    static final Flair3dDesgaste.Falha FALHA = new Flair3dDesgaste.Falha(Flair3dDesgaste.vidaDo("LABIRINTO"), Flair3dDesgaste.POR_FALHA, APRESENTACAO_ERRADA);
    static final List<String> PORTAS_OPCOES = List.of("PORTA_FACIL", "PORTA_MEDIA", "PORTA_DIFICIL");

    /** Uma condição sobre o look inteiro. */
    record Condicao(String codigo, Predicate<Map<String, CbcRules.Card>> teste) {
    }

    private static boolean grupo(Collection<CbcRules.Card> pecas, int quantas, java.util.function.Function<CbcRules.Card, Set<String>> chaves) {
        return Flair3dPecas.maiorGrupo(pecas, chaves).getValue() >= quantas;
    }

    /** As 5 regras da escada, na ordem em que os espelhos as somam. */
    static final List<Condicao> ESCADA_REGRAS = List.of(
            new Condicao("PAR_DE_COR", l -> grupo(l.values(), 2, Flair3dPecas::familias)),
            new Condicao("OCASIAO_EM_COMUM", l -> grupo(l.values(), 2, CbcRules.Card::occasions)),
            new Condicao("LOOK_COMPLETO", l -> Flair3dPecas.temBase(l) && l.containsKey("CAL")),
            new Condicao("ESTILO_EM_COMUM", l -> grupo(l.values(), 2, CbcRules.Card::styles)),
            new Condicao("TRIO_DE_COR", l -> grupo(l.values(), 3, Flair3dPecas::familias)));

    /** As 5 condições do corredor: cada uma acende um holofote. */
    static final List<Condicao> HOLOFOTES_REGRAS = List.of(
            new Condicao("HOLOFOTE_COURO_OU_JEANS", l -> l.values().stream().anyMatch(c -> Flair3dPecas.temMaterial(c, Set.of("leather", "denim")))),
            new Condicao("HOLOFOTE_COR_QUENTE", l -> l.values().stream().anyMatch(c -> Flair3dPecas.daFamilia(c, Flair3dPecas.QUENTES))),
            new Condicao("HOLOFOTE_PRETO_OU_BRANCO", l -> l.values().stream().anyMatch(c -> Flair3dPecas.daFamilia(c, Set.of("Preto", "Branco")))),
            new Condicao("HOLOFOTE_FESTA", l -> l.values().stream().anyMatch(c -> Flair3dPecas.temOcasiao(c, Flair3dPecas.FESTA))),
            new Condicao("HOLOFOTE_CASUAL", l -> l.values().stream().anyMatch(c -> Flair3dPecas.temOcasiao(c, Flair3dPecas.CASUAL))));

    /** As 3 salas das portas: o tema de cada uma (ocasiões que valem). */
    record Sala(String codigo, Set<String> ocasioes) {
    }

    static final List<Sala> SALAS = List.of(new Sala("SALA_DA_FESTA", Flair3dPecas.FESTA), new Sala("SALA_DO_TRABALHO", Flair3dPecas.TRABALHO),
            new Sala("SALA_DO_PASSEIO", Flair3dPecas.CASUAL));

    private LabirintoRodadas() {
    }

    static List<Rodada> rodadas() {
        Regra[] escada = ESCADA_REGRAS.stream().map(c -> new Regra(c.codigo(), 20)).toArray(Regra[]::new);
        Regra[] holofotes = HOLOFOTES_REGRAS.stream().map(c -> new Regra(c.codigo(), 20)).toArray(Regra[]::new);
        return List.of(Rodada.de(ESCADA, escada).emEtapas(ESCADA_REGRAS.size()),
                Rodada.de(PORTAS, new Regra("PORTA_FACIL", 1), new Regra("PORTA_MEDIA", 2), new Regra("PORTA_DIFICIL", 3))
                        .emEtapas(SALAS.size()).comOpcoes(PORTAS_OPCOES),
                Rodada.de(HOLOFOTES, holofotes));
    }

    static List<RegraResultado> conferir(List<Condicao> condicoes, Map<String, CbcRules.Card> look, double valor) {
        List<RegraResultado> out = new ArrayList<>();
        condicoes.forEach(c -> out.add(RegraResultado.de(c.codigo(), c.teste().test(look), valor)));
        return out;
    }

    /** Escada de Espelhos: o espelho k pede as regras 1 a k; passar de primeira vale a etapa inteira. */
    static final Flair3dPercurso.Etapas ESCADA_ETAPAS = new Flair3dPercurso.Etapas() {
        @Override
        public int total() {
            return ESCADA_REGRAS.size();
        }

        @Override
        public String codigo(int etapa) {
            return "ESPELHO_" + etapa;
        }

        @Override
        public Avaliacao avaliar(Look look) {
            List<Condicao> pedidas = ESCADA_REGRAS.subList(0, look.etapa());
            List<RegraResultado> regras = conferir(pedidas, look.pecas(), 100.0 / pedidas.size());
            boolean abre = regras.stream().allMatch(RegraResultado::ok);
            List<Evento> eventos = new ArrayList<>(List.of(new Evento("TENTATIVA", look.tentativa())));
            double pontos = abre ? (look.tentativa() == 1 ? 100 : 0) : regras.stream().mapToDouble(RegraResultado::pontos).sum();
            return new Avaliacao(abre, pontos, regras, eventos);
        }

        @Override
        public Flair3dDesgaste.Falha falha() {
            return FALHA;
        }
    };

    /** Três Portas: a porta fácil pede 1 peça do tema da sala, a média 2 e a difícil 3; valem 1, 2 e 3 estrelas. */
    static final Flair3dPercurso.Etapas PORTAS_ETAPAS = new Flair3dPercurso.Etapas() {
        @Override
        public int total() {
            return SALAS.size();
        }

        @Override
        public String codigo(int etapa) {
            return SALAS.get(etapa - 1).codigo();
        }

        @Override
        public Avaliacao avaliar(Look look) {
            Sala sala = SALAS.get(look.etapa() - 1);
            int porta = Math.max(0, PORTAS_OPCOES.indexOf(look.resposta())) + 1;
            int noTema = Flair3dPecas.quantas(look.pecas().values(), c -> Flair3dPecas.temOcasiao(c, sala.ocasioes()));
            boolean abre = noTema >= porta;
            List<Evento> eventos = new ArrayList<>(List.of(new Evento("PECAS_NO_TEMA", noTema), new Evento("PORTA", Map.of("estrelas", abre ? porta : 0))));
            if (!abre) {
                eventos.add(new Evento("FALTAM_NO_TEMA", porta - noTema));
            }
            // 6 estrelas nas 3 salas valem 100: cada estrela soma 50 à média das salas
            double pontos = abre ? porta * 50.0 : 0;
            return new Avaliacao(abre, pontos, List.of(RegraResultado.de(PORTAS_OPCOES.get(porta - 1), abre, porta)), eventos);
        }

        @Override
        public Flair3dDesgaste.Falha falha() {
            return FALHA;
        }
    };
}
