package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;

import java.util.Map;

/**
 * HypeScore v2 — tudo o que o cálculo de UMA entidade precisa, já extraído do banco (a calculadora é pura e testável).
 * As séries diárias têm o índice 0 = hoje e comprimento = horizonte (12 semanas por padrão).
 *
 * @param dailyActivity        atividade ponderada por dia (todos os sinais, com o peso de cada sinal)
 * @param dailyInteractions    interações sociais ponderadas por dia (curtir, comentar, salvar, compartilhar, favoritar, remixar)
 * @param dailyViews           visualizações por dia (contagem)
 * @param windows              por sinal: [contagem na janela atual, contagem na janela anterior] — base das explicações
 * @param lifetimeInteractions interações ANTERIORES ao horizonte, do agregado filtrado pela integridade (nunca contadores brutos),
 *                             com o peso da integridade e o do tipo de sinal (mesma unidade de {@code dailyActivity})
 * @param lifetimeViews        visualizações aceitas anteriores ao horizonte, do mesmo agregado
 * @param totalEvents          eventos aceitos (contagem bruta) no horizonte mais as interações aceitas antes dele — define "dados insuficientes"
 * @param ageDays              idade da entidade em dias
 * @param cohortPresence       fração da população (donos/peças) com o mesmo "modelo" (catálogo ou categoria+marca); nulo = desconhecida
 * @param cohortGrowthPercent  crescimento recente das peças semelhantes (janela atual × anterior); nulo = desconhecido
 * @param surprise             raridade da combinação de atributos, em bits (originalidade); nulo = sem atributos
 * @param influenceRaw         remixes + looks derivados (só looks); nulo = não se aplica
 * @param limitedEdition       marcada como edição limitada/exclusiva
 */
public record HypeInputs(HypeEntityType type, double[] dailyActivity, double[] dailyInteractions, double[] dailyViews,
                         Map<HypeSignalType, double[]> windows, double lifetimeInteractions, double lifetimeViews, double totalEvents,
                         int ageDays, Double cohortPresence, Double cohortGrowthPercent, Double surprise, Double influenceRaw,
                         boolean limitedEdition) {
}
