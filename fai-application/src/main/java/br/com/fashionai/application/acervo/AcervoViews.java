package br.com.fashionai.application.acervo;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.acervo.AcervoAmbiente;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoDesejo;
import br.com.fashionai.domain.model.acervo.AcervoMovel;
import br.com.fashionai.domain.model.acervo.AcervoPeca;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Projeções do ACERVO: a árvore (ambiente → móvel → compartimento, com contagens), a ficha da peça e o desejo. */
final class AcervoViews {
    /** Peça "em uso": vestida nos últimos 30 dias. */
    static final int DIAS_EM_USO = 30;

    private AcervoViews() {
    }

    static Map<String, Object> peca(WardrobeItem w, AcervoMapa mapa, LocalDate hoje) {
        UUID lugar = mapa.lugar(w.getId());
        AcervoPeca linha = mapa.linha(w.getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", w.getId());
        out.put("name", w.getName());
        out.put("category", w.getCategory());
        out.put("subcategory", w.getSubcategory());
        out.put("color", w.getColor());
        out.put("size", w.getSizeLabel());
        out.put("brand", w.getBrandName());
        out.put("price", AcervoFinanceiro.preco(w));
        out.put("currency", w.getPriceCurrency());
        out.put("condition", w.getCondition() == null ? null : w.getCondition().name());
        out.put("conservacao", w.getEstadoConservacao() == null ? null : w.getEstadoConservacao().getNome());
        out.put("thumbnailUrl", imagem(w));
        out.put("favorite", w.isFavorite());
        out.put("wearCount", w.getWearCount());
        out.put("lastWornDate", w.getLastWornDate());
        out.put("emUso", w.getLastWornDate() != null && !w.getLastWornDate().isBefore(hoje.minusDays(DIAS_EM_USO)));
        out.put("compartimentoId", lugar);
        out.put("caminho", mapa.caminho(lugar));
        out.put("medidas", medidas(linha));
        return out;
    }

    static String imagem(WardrobeItem w) {
        return w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl();
    }

    /**
     * Imagem e o que a tela precisa para pintar a ilustração de uma peça sem foto na cor do cadastro (a miniatura da
     * linha de arrumação e dos looks vinculados não fica azul para uma camiseta preta).
     */
    static void imagemComCor(Map<String, Object> linha, WardrobeItem w) {
        linha.put("thumbnailUrl", imagem(w));
        linha.put("category", w.getCategory());
        linha.put("subcategory", w.getSubcategory());
        linha.put("color", w.getColor());
    }

    static Map<String, Object> medidas(AcervoPeca linha) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("larguraCm", linha == null ? null : linha.getLarguraCm());
        out.put("comprimentoCm", linha == null ? null : linha.getComprimentoCm());
        out.put("nota", linha == null ? null : linha.getMedidasNota());
        return out;
    }

    /**
     * Onde a peça está guardada, para outras telas (detalhe da peça). {@code compartimentoId} é o endereço estável:
     * não muda quando o compartimento, o móvel ou o ambiente são renomeados; os nomes vêm sempre do cadastro atual.
     * Peça sem lugar devolve {@code guardada = false} e os demais campos nulos.
     */
    static Map<String, Object> lugar(UUID pieceId, AcervoMapa mapa) {
        AcervoCompartimento c = mapa.compartimento(mapa.lugar(pieceId));
        AcervoMovel m = mapa.movelDe(c);
        AcervoAmbiente a = mapa.ambienteDe(m);
        boolean guardada = a != null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pieceId", pieceId);
        out.put("guardada", guardada);
        out.put("compartimentoId", guardada ? c.getId() : null);
        out.put("movelId", guardada ? m.getId() : null);
        out.put("ambienteId", guardada ? a.getId() : null);
        out.put("tipo", guardada ? c.getTipo() : null);
        out.put("compartimento", guardada ? c.getNome() : null);
        out.put("movel", guardada ? m.getNome() : null);
        out.put("ambiente", guardada ? a.getNome() : null);
        out.put("caminho", guardada ? mapa.caminho(c.getId()) : null);
        return out;
    }

    static Map<String, Object> compartimento(AcervoCompartimento c, long pecas) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", c.getId());
        out.put("movelId", c.getMovelId());
        out.put("tipo", c.getTipo());
        out.put("nome", c.getNome());
        out.put("ordem", c.getOrdem());
        out.put("pecas", pecas);
        return out;
    }

    static Map<String, Object> movel(AcervoMovel m, List<Map<String, Object>> compartimentos, long pecas) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("ambienteId", m.getAmbienteId());
        out.put("nome", m.getNome());
        out.put("ordem", m.getOrdem());
        out.put("modo", m.getModo());
        out.put("larguraCm", m.getLarguraCm());
        out.put("alturaCm", m.getAlturaCm());
        out.put("profundidadeCm", m.getProfundidadeCm());
        out.put("material", m.getMaterial());
        out.put("cor", m.getCor());
        out.put("porta", m.getPorta());
        out.put("puxador", m.getPuxador());
        out.put("puxadorAcabamento", m.getPuxadorAcabamento());
        out.put("compartimentos", compartimentos);
        out.put("pecas", pecas);
        return out;
    }

    static Map<String, Object> ambiente(AcervoAmbiente a, List<Map<String, Object>> moveis, long pecas) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", a.getId());
        out.put("nome", a.getNome());
        out.put("ordem", a.getOrdem());
        out.put("iluminacao", AcervoLightingWriter.view(a));       // exercício 07: tipo de luz e kelvin (nulos no legado)
        out.put("moveis", moveis);
        out.put("pecas", pecas);
        return out;
    }

    /** Árvore completa; {@code porCompartimento} traz quantas peças há em cada compartimento. */
    static List<Map<String, Object>> arvore(AcervoMapa mapa, Map<UUID, Long> porCompartimento) {
        List<Map<String, Object>> ambientes = new ArrayList<>();
        for (AcervoAmbiente a : mapa.ambientes) {
            List<Map<String, Object>> moveis = new ArrayList<>();
            long noAmbiente = 0;
            for (AcervoMovel m : mapa.moveis) {
                if (!m.getAmbienteId().equals(a.getId())) {
                    continue;
                }
                List<Map<String, Object>> compartimentos = new ArrayList<>();
                long noMovel = 0;
                for (AcervoCompartimento c : mapa.compartimentos) {
                    if (!c.getMovelId().equals(m.getId())) {
                        continue;
                    }
                    long pecas = porCompartimento.getOrDefault(c.getId(), 0L);
                    compartimentos.add(compartimento(c, pecas));
                    noMovel += pecas;
                }
                moveis.add(movel(m, compartimentos, noMovel));
                noAmbiente += noMovel;
            }
            ambientes.add(ambiente(a, moveis, noAmbiente));
        }
        return ambientes;
    }

    static Map<String, Object> desejo(AcervoDesejo d, AcervoMapa mapa) {
        UUID lugar = mapa.compartimento(d.getCompartimentoId()) == null ? null : d.getCompartimentoId();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.getId());
        out.put("nome", d.getNome());
        out.put("categoria", d.getCategoria());
        out.put("cor", d.getCor());
        out.put("tamanho", d.getTamanho());
        out.put("marca", d.getMarca());
        out.put("precoEstimado", d.getPrecoEstimado());
        out.put("moeda", d.getMoeda());
        out.put("estimado", true);
        out.put("compartimentoId", lugar);
        out.put("caminho", mapa.caminho(lugar));
        return out;
    }
}
