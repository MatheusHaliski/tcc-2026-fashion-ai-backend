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
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
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
 * Núcleo 10 — Espelho 1, "3 peças da mesma família de cor". A pessoa apresenta o look ao espelho quantas vezes quiser:
 * quando não abre, o evento FALTAM_PECAS diz quantas peças faltaram na família mais perto de fechar e a partida segue
 * ABERTA; quando abre, vale 100 na 1ª apresentação, 80 na 2ª, 60 na 3ª e 0 daí em diante (a porta abre do mesmo jeito).
 */
public class LabirintoNucleo implements Flair3dNucleo {
    public static final int PECAS = 3;
    /** Pontos de quem abre o espelho, pela apresentação (1ª, 2ª, 3ª); depois disso, zero. */
    public static final List<Integer> PONTOS_POR_TENTATIVA = List.of(100, 80, 60);

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
                List.of(Definicao.CARTAS), Definicao.VAGAS, Deck.ate(8, new Obrigatoria(CbcRules.ANY, PECAS)), true);
    }

    /** Famílias de cor de uma carta (cada uma conta uma vez por carta), sem as "Especiais". */
    static Set<String> familias(CbcRules.Card c) {
        Set<String> out = new LinkedHashSet<>();
        c.colors().stream().map(Taxonomy.COLOR_FAMILY::get).filter(Objects::nonNull).filter(f -> !"Especiais".equals(f)).forEach(out::add);
        return out;
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, Integer> porFamilia = new TreeMap<>();
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        vestidas.values().forEach(c -> familias(c).forEach(f -> porFamilia.merge(f, 1, Integer::sum)));
        Map.Entry<String, Integer> melhor = porFamilia.entrySet().stream().max(Map.Entry.comparingByValue()).orElse(null);
        int maior = melhor == null ? 0 : melhor.getValue();
        boolean abre = maior >= PECAS;
        int tentativa = Math.max(1, contexto.andamento().tentativas());
        List<Evento> eventos = new ArrayList<>();
        if (melhor != null) {
            eventos.add(new Evento("FAMILIA", codigoFamilia(melhor.getKey())));
        }
        eventos.add(new Evento("TENTATIVA", tentativa));
        if (!abre) {
            eventos.add(new Evento("FALTAM_PECAS", PECAS - maior));
            return Resultado.parcial(Resultado.ABERTA, "NAO_ABRE", List.of(RegraResultado.de("MESMA_FAMILIA", false, 100)), eventos);
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
