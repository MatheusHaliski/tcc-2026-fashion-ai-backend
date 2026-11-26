package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Definicao.Rodada;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Flair3dPercurso;
import br.com.fashionai.application.flair3d.Flair3dPercurso.Avaliacao;
import br.com.fashionai.application.flair3d.Flair3dPercurso.Look;
import br.com.fashionai.application.flair3d.Flair3dPercurso.Passo;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Rodadas da BATALHA_LOOKS (docs/flair/flair-3d/JOGOS.md, jogo 15): a Batalha de 3 rodadas, cada uma com um objetivo de
 * regra clara sorteado, e os treinos de um objetivo só (Dress Code do Convite e Vista o Clima). O objetivo de cada
 * rodada, o look do adversário da casa ({@link BatalhaLooksAdversario}, avaliado pelas mesmas regras) e o voto da
 * plateia no empate saem da semente. A nota do adversário só aparece depois da entrega da rodada.
 */
final class BatalhaLooksRodadas {
    static final String BATALHA = "BATALHA_DE_3_RODADAS";
    static final String CONVITE = "DRESS_CODE_DO_CONVITE";
    static final String CLIMA = "VISTA_O_CLIMA";
    static final int RODADAS = 3;
    static final double POR_PECA = 25;
    static final double PROIBIDA = -25;
    static final List<String> VAGAS = BatalhaLooksNucleo.VAGAS;

    /** Um objetivo de regra clara: a peça que entra na regra e a que o convite proíbe. */
    record Desafio(String codigo, Predicate<CbcRules.Card> naRegra, Predicate<CbcRules.Card> proibida) {
        Desafio(String codigo, Predicate<CbcRules.Card> naRegra) {
            this(codigo, naRegra, c -> false);
        }
    }

    static final List<Desafio> MONOCROMATICOS = List.of("Azul", "Preto", "Branco", "Vermelho", "Verde", "Rosa").stream()
            .map(f -> new Desafio("MONO_" + f.toUpperCase(Locale.ROOT), c -> Flair3dPecas.daFamilia(c, f))).toList();

    static final List<Desafio> CONVITES = List.of(
            new Desafio("CONVITE_BLACK_TIE", c -> Flair3dPecas.temOcasiao(c, Set.of("formal", "ceremony", "wedding", "party")), Flair3dPecas::tenis),
            new Desafio("CONVITE_CASUAL_CHIQUE", c -> Flair3dPecas.temOcasiao(c, Set.of("casual", "social", "date")),
                    c -> Flair3dPecas.subcategoria(c, Set.of("flip_flops"))),
            new Desafio("CONVITE_ESPORTE_FINO", c -> Flair3dPecas.temOcasiao(c, Set.of("business", "work", "social")),
                    c -> Flair3dPecas.subcategoria(c, Set.of("shorts", "denim_shorts", "sweatpants"))));

    static final List<Desafio> CLIMAS = List.of(new Desafio("CLIMA_CALOR", Flair3dPecas::leve),
            new Desafio("CLIMA_FRIO", c -> Flair3dPecas.temMaterial(c, Flair3dPecas.MATERIAIS_QUENTES)),
            new Desafio("CLIMA_CHUVA", c -> Flair3dPecas.temMaterial(c, Flair3dPecas.IMPERMEAVEIS)));

    static final List<List<Desafio>> TIPOS = List.of(MONOCROMATICOS, CONVITES, CLIMAS);

    private BatalhaLooksRodadas() {
    }

    static List<Rodada> rodadas() {
        Regra naRegra = new Regra("NA_REGRA", POR_PECA);
        Regra proibida = new Regra("SEM_PECA_PROIBIDA", PROIBIDA);
        return List.of(Rodada.de(CONVITE, naRegra, proibida), Rodada.de(CLIMA, naRegra));
    }

    static Rodada batalha() {
        return Rodada.de(BATALHA, new Regra("NA_REGRA", POR_PECA), new Regra("SEM_PECA_PROIBIDA", PROIBIDA)).emEtapas(RODADAS);
    }

    /** As regras de um desafio sobre o look: 25 por vaga na regra e −25 se há peça proibida. */
    static List<RegraResultado> regras(Desafio d, Map<String, CbcRules.Card> look) {
        List<RegraResultado> out = new ArrayList<>(Flair3dPecas.porVaga(VAGAS, look, "NA_REGRA", POR_PECA, d.naRegra()));
        boolean tem = look.values().stream().anyMatch(d.proibida());
        out.add(new RegraResultado("SEM_PECA_PROIBIDA", !tem, tem ? PROIBIDA : 0));
        return out;
    }

    static double pontos(List<RegraResultado> regras) {
        return Math.max(0, Math.min(100, regras.stream().mapToDouble(RegraResultado::pontos).sum()));
    }

    /** O desafio do treino (convite ou clima), tirado da semente. */
    static Desafio treino(Contexto contexto) {
        return contexto.sortear("desafio", CONVITE.equals(contexto.rodada()) ? CONVITES : CLIMAS);
    }

    /** A nota do adversário da casa na rodada: o look dele, tirado da semente, pelas regras do desafio. */
    static int adversario(Contexto contexto, int rodada, Desafio desafio) {
        return BatalhaLooksAdversario.nota(desafio, BatalhaLooksAdversario.look(contexto, rodada));
    }

    /** O que a tela mostra do adversário depois da entrega da rodada: a nota, a família dominante e as peças. */
    static Map<String, Object> adversarioNaTela(Contexto contexto, int rodada, Desafio desafio) {
        Map<String, CbcRules.Card> look = BatalhaLooksAdversario.look(contexto, rodada);
        return BatalhaLooksAdversario.paraTela(look, BatalhaLooksAdversario.nota(desafio, look));
    }

    /** Os 3 desafios da batalha: um de cada tipo, em ordem sorteada, cada um com a variação sorteada. */
    static List<Desafio> desafios(Contexto contexto) {
        List<Desafio> out = new ArrayList<>();
        List<List<Desafio>> ordem = contexto.sortear("tipos", TIPOS, RODADAS);
        for (int i = 0; i < ordem.size(); i++) {
            out.add(contexto.sortear("desafio" + i, ordem.get(i)));
        }
        return out;
    }

    static Flair3dPercurso.Etapas etapas(Contexto contexto) {
        if (!BATALHA.equals(contexto.rodada())) {
            return null;
        }
        List<Desafio> desafios = desafios(contexto);
        return new Flair3dPercurso.Etapas() {
            @Override
            public int total() {
                return RODADAS;
            }

            @Override
            public String codigo(int etapa) {
                return desafios.get(etapa - 1).codigo();
            }

            @Override
            public Avaliacao avaliar(Look look) {
                Desafio desafio = desafios.get(look.etapa() - 1);
                List<RegraResultado> regras = regras(desafio, look.pecas());
                Map<String, Object> adversario = adversarioNaTela(contexto, look.etapa(), desafio);
                Map<String, Object> placar = new LinkedHashMap<>();
                placar.put("rodada", look.etapa());
                placar.put("voce", Math.round(pontos(regras)));
                placar.put("adversario", adversario.get("nota"));
                placar.put("familia", adversario.get("familia"));
                placar.put("look", adversario.get("look"));
                return new Avaliacao(true, pontos(regras), regras, List.of(new Evento("RODADA_DA_BATALHA", placar)));
            }

            private int soma(List<Passo> passos) {
                return (int) Math.round(passos.stream().mapToDouble(p -> p.avaliacao().pontos()).sum());
            }

            private int somaDoAdversario(List<Passo> passos) {
                return passos.stream().mapToInt(p -> adversario(contexto, p.etapa(), desafios.get(p.etapa() - 1))).sum();
            }

            /** No empate, o voto da plateia (da semente) decide. */
            private boolean venceu(List<Passo> passos) {
                int voce = soma(passos);
                int outro = somaDoAdversario(passos);
                return voce > outro || (voce == outro && contexto.sorteio("plateia").nextBoolean());
            }

            @Override
            public String resultado(double pontos, List<Passo> passos) {
                return venceu(passos) ? "VITORIA" : "DERROTA";
            }

            @Override
            public List<Evento> fecho(List<Passo> passos) {
                List<Evento> out = new ArrayList<>();
                Map<String, Object> soma = new LinkedHashMap<>();
                soma.put("voce", soma(passos));
                soma.put("adversario", somaDoAdversario(passos));
                out.add(new Evento("SOMA_DA_BATALHA", soma));
                if (soma(passos) == somaDoAdversario(passos)) {
                    out.add(new Evento("VOTO_DA_PLATEIA", venceu(passos) ? "VOCE" : "ADVERSARIO"));
                }
                return out;
            }
        };
    }
}
