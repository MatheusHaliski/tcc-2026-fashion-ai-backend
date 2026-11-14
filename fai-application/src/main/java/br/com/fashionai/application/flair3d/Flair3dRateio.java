package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.function.ToDoubleFunction;

/**
 * Quanto cada carta vestida rendeu na nota (o {@code cartas} do resultado): o núcleo soma aqui o que cada regra dá a cada
 * peça, inteiro ({@link #cada}) ou dividido entre as peças que cumprem a regra ({@link #dividir}, {@link #dividirEntre}).
 */
public final class Flair3dRateio {
    private final Map<String, CbcRules.Card> vestidas;
    private final Map<String, Double> pontos = new LinkedHashMap<>();

    public Flair3dRateio(Map<String, CbcRules.Card> vestidas) {
        this.vestidas = vestidas;
        vestidas.keySet().forEach(vaga -> pontos.put(vaga, 0.0));
    }

    /** O valor inteiro para cada carta que passa no teste. */
    public Flair3dRateio cada(double valor, Predicate<CbcRules.Card> teste) {
        vestidas.forEach((vaga, c) -> pontos.merge(vaga, teste.test(c) ? valor : 0, Double::sum));
        return this;
    }

    /** O valor para a carta da vaga (nada quando a vaga está vazia). */
    public Flair3dRateio vaga(String vaga, double valor) {
        pontos.computeIfPresent(vaga, (k, v) -> v + valor);
        return this;
    }

    /** O total dividido entre as cartas na proporção do peso de cada uma (peso negativo conta zero). */
    public Flair3dRateio dividir(double total, ToDoubleFunction<CbcRules.Card> peso) {
        double soma = vestidas.values().stream().mapToDouble(c -> Math.max(0, peso.applyAsDouble(c))).sum();
        if (soma > 0) {
            vestidas.forEach((vaga, c) -> pontos.merge(vaga, total * Math.max(0, peso.applyAsDouble(c)) / soma, Double::sum));
        }
        return this;
    }

    /** O total dividido por igual entre as cartas que passam no teste. */
    public Flair3dRateio dividirEntre(double total, Predicate<CbcRules.Card> teste) {
        return dividir(total, c -> teste.test(c) ? 1 : 0);
    }

    /** [{vaga, cardId, pontos}] na ordem das vagas entregues, com duas casas. */
    public List<Resultado.CartaPontos> lista() {
        List<Resultado.CartaPontos> out = new ArrayList<>();
        vestidas.forEach((vaga, c) -> out.add(new Resultado.CartaPontos(vaga, c.id(), Math.round(pontos.get(vaga) * 100) / 100.0)));
        return out;
    }
}
