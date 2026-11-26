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
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.recurso.Flair3dDesgaste;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Rodadas do AROUND_THE_WORLD além do Rio (docs/flair/flair-3d/JOGOS.md, jogo 12, e OBJETIVOS_POR_JOGO.md): a Volta ao
 * Mundo (8 regiões em rota fixa; cada uma pede clima, estética e paleta), o Elevador da Torre (4 andares, até 2 trocas
 * por andar), o Metrô de Moda (6 estações, exatamente 1 troca por estação) e o Shopping de 4 Andares (1 item por andar
 * para o pedido sorteado). As regiões são descritas pela moda contemporânea do lugar, nunca por roupa tradicional. Na
 * volta, no elevador e no metrô, cada tentativa reprovada gasta {@link Flair3dDesgaste#POR_FALHA} de ENERGIA (o
 * recurso-vida do jogo); zerada, a viagem acaba em derrota. O caminho não abre mais sem cumprir (reauditoria de 25/11).
 */
final class AroundTheWorldRodadas {
    static final String VOLTA = "VOLTA_AO_MUNDO";
    static final String ELEVADOR = "ELEVADOR_DA_TORRE";
    static final String METRO = "METRO_DE_MODA";
    static final String SHOPPING = "SHOPPING_DE_4_ANDARES";
    /** O que cada tentativa reprovada gasta: a energia da viagem. */
    static final Flair3dDesgaste.Falha FALHA = new Flair3dDesgaste.Falha(Flair3dDesgaste.vidaDo("AROUND_THE_WORLD"), Flair3dDesgaste.POR_FALHA,
            "TENTATIVA_REPROVADA");
    static final int APROVA = 60;

    /** Uma região: os materiais do clima dela, a estética e a paleta. */
    record Regiao(String codigo, Set<String> clima, Set<String> estilos, Set<String> familias) {
    }

    static final List<Regiao> REGIOES = List.of(
            new Regiao("REGIAO_RIO_DE_JANEIRO", Flair3dPecas.LEVES, Set.of("resort", "boho", "sporty", "basic"), Set.of("Amarelo", "Laranja", "Rosa", "Verde")),
            new Regiao("REGIAO_NOVA_YORK", Set.of("denim", "leather", "cotton"), Set.of("streetwear", "urban", "minimalist"), Set.of("Preto", "Cinza", "Azul")),
            new Regiao("REGIAO_PARIS", Set.of("wool", "silk", "cotton", "linen"), Set.of("chic", "classic", "romantic"), Set.of("Preto", "Branco", "Marrom", "Vermelho")),
            new Regiao("REGIAO_MILAO", Set.of("wool", "leather", "silk", "cashmere"), Set.of("tailored", "luxury", "classic"), Set.of("Marrom", "Preto", "Cinza", "Azul")),
            new Regiao("REGIAO_LAGOS", Set.of("cotton", "linen", "viscose", "silk"), Set.of("statement", "glam", "modern"), Set.of("Amarelo", "Laranja", "Verde", "Roxo", "Azul")),
            new Regiao("REGIAO_SEUL", Flair3dPecas.MATERIAIS_QUENTES, Set.of("minimalist", "modern", "streetwear", "preppy"), Set.of("Branco", "Cinza", "Rosa", "Azul")),
            new Regiao("REGIAO_TOQUIO", Set.of("nylon", "polyester", "cotton", "denim"), Set.of("streetwear", "techwear", "avant_garde", "futuristic"), Set.of("Preto", "Branco", "Vermelho", "Roxo")),
            new Regiao("REGIAO_SYDNEY", Flair3dPecas.LEVES, Set.of("sporty", "resort", "athleisure", "basic"), Set.of("Azul", "Branco", "Amarelo", "Verde")));

    /** Uma parada com dress code: o andar da torre, a estação do metrô. */
    record Parada(String codigo, Set<String> ocasioes) {
    }

    static final List<Parada> ANDARES = List.of(new Parada("ANDAR_ACADEMIA", Set.of("gym", "sport")), new Parada("ANDAR_ESCRITORIO", Set.of("work", "business")),
            new Parada("ANDAR_RESTAURANTE", Set.of("date", "night_out", "formal", "social")), new Parada("ANDAR_ROOFTOP", Set.of("party", "night_out", "festival")));

    static final List<Parada> ESTACOES = List.of(new Parada("ESTACAO_TRABALHO", Set.of("work", "business")), new Parada("ESTACAO_ALMOCO", Set.of("casual", "social")),
            new Parada("ESTACAO_ACADEMIA", Set.of("gym", "sport")), new Parada("ESTACAO_VERNISSAGE", Set.of("formal", "social", "ceremony")),
            new Parada("ESTACAO_SHOW", Set.of("festival", "party")), new Parada("ESTACAO_JANTAR", Set.of("date", "night_out")));

    static final List<Parada> PEDIDOS = List.of(new Parada("PEDIDO_FESTA", Flair3dPecas.FESTA), new Parada("PEDIDO_TRABALHO", Flair3dPecas.TRABALHO),
            new Parada("PEDIDO_PASSEIO", Flair3dPecas.CASUAL), new Parada("PEDIDO_ESPORTE", Flair3dPecas.ESPORTE));

    private AroundTheWorldRodadas() {
    }

    static List<Rodada> rodadas() {
        return List.of(
                Rodada.de(VOLTA, new Regra("CLIMA", 25), new Regra("ESTETICA", 25), new Regra("PALETA", 25), new Regra("LOOK_COMPLETO", 25)).emEtapas(REGIOES.size()),
                Rodada.de(ELEVADOR, new Regra("DRESS_CODE", 25), new Regra("ATE_2_TROCAS", 0)).emEtapas(ANDARES.size()),
                Rodada.de(METRO, new Regra("EVENTO_DA_ESTACAO", 17), new Regra("UMA_TROCA", 0)).emEtapas(ESTACOES.size()),
                Rodada.de(SHOPPING, new Regra("ANDAR_CAL", 25), new Regra("ANDAR_ACE", 25), new Regra("ANDAR_SUP", 25), new Regra("ANDAR_INF", 25)));
    }

    static Flair3dPercurso.Etapas etapas(String rodada) {
        if (VOLTA.equals(rodada)) {
            return VOLTA_ETAPAS;
        }
        if (ELEVADOR.equals(rodada)) {
            return paradas(ANDARES, "DRESS_CODE", "ATE_2_TROCAS", 2, 0, 2);
        }
        return METRO.equals(rodada) ? paradas(ESTACOES, "EVENTO_DA_ESTACAO", "UMA_TROCA", 1, 1, 1) : null;
    }

    /** Vagas em que o look mudou em relação ao anterior (peça posta, tirada ou trocada). */
    static int trocas(Map<String, CbcRules.Card> antes, Map<String, CbcRules.Card> depois) {
        Set<String> vagas = new HashSet<>(antes.keySet());
        vagas.addAll(depois.keySet());
        return (int) vagas.stream().filter(v -> !Objects.equals(antes.get(v), depois.get(v))).count();
    }

    /** Volta ao Mundo: 25 por regra da região; com 60 a região abre a próxima (de 1 a 3 estrelas pelo que cumpriu). */
    static final Flair3dPercurso.Etapas VOLTA_ETAPAS = new Flair3dPercurso.Etapas() {
        @Override
        public int total() {
            return REGIOES.size();
        }

        @Override
        public String codigo(int etapa) {
            return REGIOES.get(etapa - 1).codigo();
        }

        @Override
        public Avaliacao avaliar(Look look) {
            Regiao r = REGIOES.get(look.etapa() - 1);
            Map<String, CbcRules.Card> l = look.pecas();
            CbcRules.Card cima = l.containsKey("VES") ? l.get("VES") : l.get("SUP");
            List<RegraResultado> regras = List.of(RegraResultado.de("CLIMA", Flair3dPecas.temMaterial(cima, r.clima()), 25),
                    RegraResultado.de("ESTETICA", l.values().stream().anyMatch(c -> Flair3dPecas.temEstilo(c, r.estilos())), 25),
                    RegraResultado.de("PALETA", l.values().stream().anyMatch(c -> Flair3dPecas.daFamilia(c, r.familias())), 25),
                    RegraResultado.de("LOOK_COMPLETO", Flair3dPecas.temBase(l) && l.containsKey("CAL"), 25));
            double pontos = regras.stream().mapToDouble(RegraResultado::pontos).sum();
            boolean cumpre = pontos >= APROVA;
            List<Evento> eventos = List.of(new Evento("ESTRELAS_DA_REGIAO", Resultado.estrelas((int) Math.round(pontos))));
            return new Avaliacao(cumpre, pontos, regras, eventos);
        }

        @Override
        public Flair3dDesgaste.Falha falha() {
            return FALHA;
        }

        @Override
        public List<Evento> fecho(List<Passo> passos) {
            int estrelas = passos.stream().mapToInt(p -> Resultado.estrelas((int) Math.round(p.avaliacao().pontos()))).sum();
            return List.of(new Evento("ESTRELAS_DA_VOLTA", Map.of("estrelas", estrelas, "total", 3 * passos.size())));
        }
    };

    /**
     * Paradas com dress code e limite de trocas (o elevador e o metrô): a parada pede {@code pecas} peças da ocasião e
     * entre {@code trocasMin} e {@code trocasMax} trocas em relação ao look anterior (a primeira parada é livre). Passar
     * de primeira vale a parada inteira; depois, ela abre sem pontos; cada tentativa reprovada gasta energia.
     */
    static Flair3dPercurso.Etapas paradas(List<Parada> lista, String regraDoCodigo, String regraDasTrocas, int pecas, int trocasMin, int trocasMax) {
        return new Flair3dPercurso.Etapas() {
            @Override
            public int total() {
                return lista.size();
            }

            @Override
            public String codigo(int etapa) {
                return lista.get(etapa - 1).codigo();
            }

            @Override
            public Avaliacao avaliar(Look look) {
                Parada p = lista.get(look.etapa() - 1);
                int noCodigo = Flair3dPecas.quantas(look.pecas().values(), c -> Flair3dPecas.temOcasiao(c, p.ocasioes()));
                int trocas = look.anterior() == null ? trocasMin : trocas(look.anterior(), look.pecas());
                boolean codigoOk = noCodigo >= pecas;
                boolean trocasOk = trocas >= trocasMin && trocas <= trocasMax;
                boolean abre = codigoOk && trocasOk;
                List<Evento> eventos = new ArrayList<>(List.of(new Evento("PECAS_NO_CODIGO", noCodigo)));
                if (look.anterior() != null) {
                    eventos.add(new Evento("TROCAS_FEITAS", trocas));
                }
                double pontos = abre ? (look.tentativa() == 1 ? 100 : 0) : (codigoOk ? 50 : 0) + (trocasOk ? 50 : 0);
                return new Avaliacao(abre, pontos,
                        List.of(RegraResultado.de(regraDoCodigo, codigoOk, 50), RegraResultado.de(regraDasTrocas, trocasOk, 50)), eventos);
            }

            @Override
            public Flair3dDesgaste.Falha falha() {
                return FALHA;
            }
        };
    }

    /** O pedido do shopping, tirado da semente. */
    static Parada pedido(Contexto contexto) {
        return contexto.sortear("pedido", PEDIDOS);
    }

    /** Shopping de 4 Andares: 25 por item (calçado, acessório, parte de cima, parte de baixo) na ocasião do pedido. */
    static Resultado shopping(Map<String, CbcRules.Card> look, Contexto contexto) {
        Parada pedido = pedido(contexto);
        CbcRules.Card inteira = look.get("VES");
        List<RegraResultado> regras = new ArrayList<>();
        for (String vaga : List.of("CAL", "ACE", "SUP", "INF")) {
            CbcRules.Card c = look.containsKey(vaga) || "CAL".equals(vaga) || "ACE".equals(vaga) ? look.get(vaga) : inteira;
            regras.add(RegraResultado.de("ANDAR_" + vaga, Flair3dPecas.temOcasiao(c, pedido.ocasioes()), 25));
        }
        return Resultado.somando(regras, List.of(new Evento("PEDIDO_DO_SHOPPING", pedido.codigo())));
    }
}
