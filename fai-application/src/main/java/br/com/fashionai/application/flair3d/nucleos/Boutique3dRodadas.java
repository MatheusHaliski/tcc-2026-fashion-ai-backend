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

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Rodadas da BOUTIQUE_3D além da cliente da base (docs/flair/flair-3d/OBJETIVOS_POR_JOGO.md, jogo 7): Personal Stylist (3
 * clientes sorteadas, um look para cada, 1 estrela por pedido), Vitrine que Vende (3 manequins para o gosto do dia) e
 * Provador Lotado (5 clientes devolvem uma peça com um motivo). As clientes, o gosto e os motivos saem da semente. Cada
 * cliente recebe um look só: não há segunda tentativa nem relógio.
 */
final class Boutique3dRodadas {
    static final String STYLIST = "PERSONAL_STYLIST";
    static final String VITRINE = "VITRINE_QUE_VENDE";
    static final String PROVADOR = "PROVADOR_LOTADO";
    static final int CLIENTES = 3;
    static final int MANEQUINS = 3;
    static final int DEVOLUCOES = 5;

    /** O pedido de uma cliente: ocasião, cor e estilo. */
    record Cliente(String codigo, Set<String> ocasioes, String familia, Set<String> estilos) {
    }

    static final List<Cliente> CLIENTELA = List.of(
            new Cliente("CLIENTE_JANTAR", Set.of("date", "night_out", "party"), "Vermelho", Set.of("chic", "glam", "romantic")),
            new Cliente("CLIENTE_ENTREVISTA", Flair3dPecas.TRABALHO, "Azul", Set.of("classic", "tailored", "minimalist")),
            new Cliente("CLIENTE_VIAGEM", Set.of("travel", "vacation", "casual"), "Branco", Set.of("basic", "resort", "boho")),
            new Cliente("CLIENTE_FESTIVAL", Set.of("festival", "party"), "Rosa", Set.of("streetwear", "boho", "y2k")),
            new Cliente("CLIENTE_CASAMENTO", Set.of("wedding", "ceremony", "formal"), "Verde", Set.of("chic", "romantic", "classic", "luxury")),
            new Cliente("CLIENTE_ACADEMIA", Set.of("gym", "sport"), "Preto", Set.of("sporty", "athleisure")));

    /** O gosto do público do dia: estilo e cor. */
    record Gosto(String codigo, Set<String> estilos, String familia) {
    }

    static final List<Gosto> GOSTOS = List.of(new Gosto("GOSTO_CLASSICO_AZUL", Set.of("classic", "tailored", "preppy"), "Azul"),
            new Gosto("GOSTO_URBANO_PRETO", Set.of("streetwear", "urban", "edgy"), "Preto"),
            new Gosto("GOSTO_ROMANTICO_ROSA", Set.of("romantic", "chic", "glam"), "Rosa"),
            new Gosto("GOSTO_ESPORTIVO_BRANCO", Set.of("sporty", "athleisure", "basic"), "Branco"));

    /** O motivo de uma devolução e a peça que resolve. */
    record Motivo(String codigo, Predicate<CbcRules.Card> resolve) {
    }

    static final List<Motivo> MOTIVOS = List.of(new Motivo("QUERO_EM_AZUL", c -> Flair3dPecas.daFamilia(c, "Azul")),
            new Motivo("QUERO_EM_PRETO", c -> Flair3dPecas.daFamilia(c, "Preto")),
            new Motivo("QUERO_EM_COR_CLARA", c -> Flair3dPecas.daFamilia(c, "Branco")),
            new Motivo("QUERO_PARA_FRIO", c -> Flair3dPecas.temMaterial(c, Flair3dPecas.MATERIAIS_QUENTES)),
            new Motivo("QUERO_PARA_CALOR", Flair3dPecas::leve),
            new Motivo("QUERO_PARA_FESTA", c -> Flair3dPecas.temOcasiao(c, Flair3dPecas.FESTA)),
            new Motivo("QUERO_PARA_TRABALHO", c -> Flair3dPecas.temOcasiao(c, Flair3dPecas.TRABALHO)),
            new Motivo("QUERO_PARA_O_DIA_A_DIA", c -> Flair3dPecas.temOcasiao(c, Flair3dPecas.CASUAL)));

    private Boutique3dRodadas() {
    }

    static List<Rodada> rodadas() {
        return List.of(
                Rodada.de(STYLIST, new Regra("PEDIDO_OCASIAO", 1), new Regra("PEDIDO_COR", 1), new Regra("PEDIDO_ESTILO", 1)).emEtapas(CLIENTES),
                Rodada.de(VITRINE, new Regra("VITRINE_ESTILO", 5), new Regra("VITRINE_COR", 5), new Regra("MANEQUIM_DIFERENTE", 0)).emEtapas(MANEQUINS),
                Rodada.de(PROVADOR, new Regra("UMA_PECA", 0), new Regra("RESOLVE_O_MOTIVO", 20)).emEtapas(DEVOLUCOES));
    }

    static Flair3dPercurso.Etapas etapas(Contexto contexto) {
        String rodada = contexto.rodada();
        if (STYLIST.equals(rodada)) {
            return stylist(contexto.sortear("clientes", CLIENTELA, CLIENTES));
        }
        if (VITRINE.equals(rodada)) {
            return vitrine(contexto.sortear("gosto", GOSTOS));
        }
        return PROVADOR.equals(rodada) ? provador(contexto.sortear("motivos", MOTIVOS, DEVOLUCOES)) : null;
    }

    private static boolean alguma(Collection<CbcRules.Card> pecas, Predicate<CbcRules.Card> teste) {
        return pecas.stream().anyMatch(teste);
    }

    /** Personal Stylist: 1 estrela por pedido cumprido (2 peças na ocasião, 1 na cor, 1 no estilo); 9 estrelas valem 100. */
    static Flair3dPercurso.Etapas stylist(List<Cliente> clientes) {
        return new Flair3dPercurso.Etapas() {
            @Override
            public int total() {
                return clientes.size();
            }

            @Override
            public String codigo(int etapa) {
                return clientes.get(etapa - 1).codigo();
            }

            @Override
            public Avaliacao avaliar(Look look) {
                Cliente c = clientes.get(look.etapa() - 1);
                Collection<CbcRules.Card> pecas = look.pecas().values();
                double valor = 100.0 / 3;
                List<RegraResultado> regras = List.of(
                        RegraResultado.de("PEDIDO_OCASIAO", Flair3dPecas.quantas(pecas, p -> Flair3dPecas.temOcasiao(p, c.ocasioes())) >= 2, valor),
                        RegraResultado.de("PEDIDO_COR", alguma(pecas, p -> Flair3dPecas.daFamilia(p, c.familia())), valor),
                        RegraResultado.de("PEDIDO_ESTILO", alguma(pecas, p -> Flair3dPecas.temEstilo(p, c.estilos())), valor));
                long estrelas = regras.stream().filter(RegraResultado::ok).count();
                return new Avaliacao(true, regras.stream().mapToDouble(RegraResultado::pontos).sum(), regras,
                        List.of(new Evento("ESTRELAS_DA_CLIENTE", estrelas)));
            }

            @Override
            public List<Evento> fecho(List<Passo> passos) {
                long estrelas = passos.stream().mapToLong(p -> p.avaliacao().regras().stream().filter(RegraResultado::ok).count()).sum();
                return List.of(new Evento("ESTRELAS_DAS_CLIENTES", estrelas));
            }
        };
    }

    /** Vitrine que Vende: o manequim no gosto do dia (estilo e cor) atrai 10 clientes; repetir o manequim anterior não vale. */
    static Flair3dPercurso.Etapas vitrine(Gosto gosto) {
        return new Flair3dPercurso.Etapas() {
            @Override
            public int total() {
                return MANEQUINS;
            }

            @Override
            public String codigo(int etapa) {
                return "MANEQUIM_" + etapa;
            }

            @Override
            public Avaliacao avaliar(Look look) {
                Collection<CbcRules.Card> pecas = look.pecas().values();
                boolean novo = look.anterior() == null || !look.anterior().equals(look.pecas());
                List<RegraResultado> regras = List.of(
                        RegraResultado.de("VITRINE_ESTILO", novo && alguma(pecas, p -> Flair3dPecas.temEstilo(p, gosto.estilos())), 50),
                        RegraResultado.de("VITRINE_COR", novo && alguma(pecas, p -> Flair3dPecas.daFamilia(p, gosto.familia())), 50),
                        RegraResultado.de("MANEQUIM_DIFERENTE", novo, 0));
                double pontos = regras.stream().mapToDouble(RegraResultado::pontos).sum();
                return new Avaliacao(true, pontos, regras, List.of(new Evento("GOSTO_DO_DIA", gosto.codigo()), new Evento("CLIENTES_DO_MANEQUIM", Math.round(pontos / 10))));
            }

            @Override
            public List<Evento> fecho(List<Passo> passos) {
                return List.of(new Evento("CLIENTES_ATRAIDOS", Math.round(passos.stream().mapToDouble(p -> p.avaliacao().pontos()).sum() / 10)));
            }
        };
    }

    /** Provador Lotado: uma peça só, que resolve o motivo da devolução. */
    static Flair3dPercurso.Etapas provador(List<Motivo> motivos) {
        return new Flair3dPercurso.Etapas() {
            @Override
            public int total() {
                return motivos.size();
            }

            @Override
            public String codigo(int etapa) {
                return motivos.get(etapa - 1).codigo();
            }

            @Override
            public Avaliacao avaliar(Look look) {
                Motivo m = motivos.get(look.etapa() - 1);
                boolean uma = look.pecas().size() == 1;
                boolean resolve = uma && alguma(look.pecas().values(), m.resolve());
                return new Avaliacao(true, resolve ? 100 : 0,
                        List.of(RegraResultado.de("UMA_PECA", uma, 0), RegraResultado.de("RESOLVE_O_MOTIVO", resolve, 100)), List.of());
            }

            @Override
            public List<Evento> fecho(List<Passo> passos) {
                return List.of(new Evento("CLIENTES_ATENDIDAS", passos.stream().filter(p -> p.avaliacao().pontos() >= 100).count()));
            }
        };
    }
}
