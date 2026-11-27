package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
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
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.recurso.Flair3dDesgaste;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

/**
 * Núcleo 10 — Espelho 1, "3 peças da mesma família de cor". Cada apresentação que não abre gasta
 * {@value Flair3dDesgaste#POR_FALHA} do Reflexo (a ENERGIA, recurso-vida do jogo) e o evento FALTAM_PECAS diz quantas
 * peças faltaram na família mais perto de fechar; com Reflexo, a partida segue ABERTA; sem ele, fecha em DERROTA. Usar
 * peça como recurso devolve Reflexo, e com ele mais apresentações. Quando abre, vale 100 na 1ª apresentação, 80 na 2ª,
 * 60 na 3ª, 40 na 4ª e 20 na 5ª. Não há mais pena (a peça achada na sala, o espelho que cedia): o espelho só abre com o
 * look certo (reauditoria de 25/11/2026). As outras rodadas estão em {@link LabirintoRodadas}.
 */
public class LabirintoNucleo implements Flair3dNucleo {
    public static final int PECAS = 3;
    /** Pontos de quem abre o espelho, pela apresentação (da 4ª em diante, só com Reflexo devolvido por peça usada). */
    public static final List<Integer> PONTOS_POR_TENTATIVA = List.of(100, 80, 60, 40, 20);

    @Override
    public String codigo() {
        return "LABIRINTO";
    }

    @Override
    public int numero() {
        return 10;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("ESPELHO_1", new Regra("MESMA_FAMILIA", 100)),
                List.of(Definicao.CARTAS), Definicao.VAGAS, Deck.ate(8, new Obrigatoria(CbcRules.ANY, PECAS)), true)
                .comRodadas(LabirintoRodadas.rodadas().toArray(Definicao.Rodada[]::new));
    }

    /** As etapas da rodada, quando ela anda em etapas. */
    private static Flair3dPercurso.Etapas etapas(String rodada) {
        if (LabirintoRodadas.ESCADA.equals(rodada)) {
            return LabirintoRodadas.ESCADA_ETAPAS;
        }
        return LabirintoRodadas.PORTAS.equals(rodada) ? LabirintoRodadas.PORTAS_ETAPAS : null;
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        Flair3dPercurso.Etapas etapas = etapas(contexto.rodada());
        return etapas == null ? Map.of() : Map.of("etapa", Flair3dPercurso.primeira(etapas));
    }

    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Flair3dPercurso.Etapas etapas = etapas(contexto.rodada());
        return etapas == null ? pontuar(entrega, contexto) : Flair3dPercurso.previa(entrega, contexto, etapas);
    }

    private static Resultado holofotes(Map<String, CbcRules.Card> look) {
        List<RegraResultado> regras = LabirintoRodadas.conferir(LabirintoRodadas.HOLOFOTES_REGRAS, look, 20);
        long acesos = regras.stream().filter(RegraResultado::ok).count();
        return Resultado.somando(regras, List.of(new Evento("HOLOFOTES", acesos)));
    }

    /** Famílias de cor de uma carta (cada uma conta uma vez por carta), sem as "Especiais". */
    static Set<String> familias(CbcRules.Card c) {
        Set<String> out = new LinkedHashSet<>();
        c.colors().stream().map(Taxonomy.COLOR_FAMILY::get).filter(Objects::nonNull).filter(f -> !"Especiais".equals(f)).forEach(out::add);
        return out;
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Flair3dPercurso.Etapas etapas = etapas(contexto.rodada());
        if (etapas != null) {
            return Flair3dPercurso.pontuar(entrega, contexto, etapas);
        }
        Map<String, Integer> porFamilia = new TreeMap<>();
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        if (LabirintoRodadas.HOLOFOTES.equals(contexto.rodada())) {
            return holofotes(vestidas);
        }
        vestidas.values().forEach(c -> familias(c).forEach(f -> porFamilia.merge(f, 1, Integer::sum)));
        Map.Entry<String, Integer> melhor = porFamilia.entrySet().stream().max(Map.Entry.comparingByValue()).orElse(null);
        int tentativa = Math.max(1, contexto.andamento().tentativas());
        int maior = melhor == null ? 0 : melhor.getValue();
        boolean abre = maior >= PECAS;
        List<Evento> eventos = new ArrayList<>();
        if (melhor != null) {
            eventos.add(new Evento("FAMILIA", codigoFamilia(melhor.getKey())));
        }
        eventos.add(new Evento("TENTATIVA", tentativa));
        // as apresentações anteriores não abriram (senão a partida já teria fechado); a de agora gasta se também não abrir
        Flair3dDesgaste reflexo = Flair3dDesgaste.de(Flair3dDesgaste.vidaDo(codigo()), contexto.andamento().usos())
                .com(LabirintoRodadas.APRESENTACAO_ERRADA, tentativa - (abre ? 1 : 0), Flair3dDesgaste.POR_FALHA);
        eventos.add(reflexo.evento());
        if (!abre) {
            eventos.add(new Evento("FALTAM_PECAS", PECAS - maior));
            List<RegraResultado> regras = List.of(RegraResultado.de("MESMA_FAMILIA", false, 100));
            return reflexo.esgotou() ? Resultado.of(0, Flair3dDesgaste.ESGOTOU, regras, eventos)
                    : Resultado.parcial(Resultado.ABERTA, "NAO_ABRE", regras, eventos);
        }
        int pontos = pontos(tentativa);
        Flair3dRateio rateio = new Flair3dRateio(vestidas).dividirEntre(pontos, c -> familias(c).contains(melhor.getKey()));
        return Resultado.of(pontos, "ABRE", List.of(RegraResultado.de("MESMA_FAMILIA", true, pontos)), eventos).comCartas(rateio.lista());
    }

    /** Pontos de quem abre na apresentação dada (1 = primeira). */
    public static int pontos(int tentativa) {
        return tentativa <= PONTOS_POR_TENTATIVA.size() ? PONTOS_POR_TENTATIVA.get(tentativa - 1) : 0;
    }

    static String codigoFamilia(String familia) {
        return "FAMILIA_" + familia.toUpperCase(Locale.ROOT);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        List<Efeito> out = familias(carta).stream().map(f -> new Efeito(codigoFamilia(f), 1)).toList();
        return out.isEmpty() ? List.of(Efeito.motivo("SEM_FAMILIA_DE_COR")) : out;
    }
}
