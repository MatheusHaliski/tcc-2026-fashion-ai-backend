package br.com.fashionai.application.acervo;

import br.com.fashionai.domain.model.acervo.AcervoAmbiente;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoMovel;
import br.com.fashionai.domain.model.acervo.AcervoPeca;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Retrato da estrutura do acervo de uma pessoa (ambientes, móveis, compartimentos e o lugar de cada peça), já indexado
 * para as consultas: onde está a peça, o caminho de um compartimento e quantas peças há em cada um.
 */
final class AcervoMapa {
    final List<AcervoAmbiente> ambientes;
    final List<AcervoMovel> moveis;
    final List<AcervoCompartimento> compartimentos;
    private final Map<UUID, AcervoAmbiente> ambientePorId = new LinkedHashMap<>();
    private final Map<UUID, AcervoMovel> movelPorId = new LinkedHashMap<>();
    private final Map<UUID, AcervoCompartimento> compartimentoPorId = new LinkedHashMap<>();
    private final Map<UUID, AcervoPeca> linhaPorPeca = new LinkedHashMap<>();

    AcervoMapa(List<AcervoAmbiente> ambientes, List<AcervoMovel> moveis, List<AcervoCompartimento> compartimentos, List<AcervoPeca> linhas) {
        this.ambientes = ambientes;
        this.moveis = moveis;
        this.compartimentos = compartimentos;
        ambientes.forEach(a -> ambientePorId.put(a.getId(), a));
        moveis.forEach(m -> movelPorId.put(m.getId(), m));
        compartimentos.forEach(c -> compartimentoPorId.put(c.getId(), c));
        linhas.forEach(l -> linhaPorPeca.put(l.getPieceId(), l));
    }

    AcervoPeca linha(UUID pieceId) {
        return linhaPorPeca.get(pieceId);
    }

    AcervoCompartimento compartimento(UUID id) {
        return id == null ? null : compartimentoPorId.get(id);
    }

    AcervoMovel movelDe(AcervoCompartimento compartimento) {
        return compartimento == null ? null : movelPorId.get(compartimento.getMovelId());
    }

    AcervoAmbiente ambienteDe(AcervoMovel movel) {
        return movel == null ? null : ambientePorId.get(movel.getAmbienteId());
    }

    /** Compartimento onde a peça está, ou nulo (sem lugar, ou o compartimento já não existe). */
    UUID lugar(UUID pieceId) {
        AcervoPeca linha = linhaPorPeca.get(pieceId);
        if (linha == null || linha.getCompartimentoId() == null) {
            return null;
        }
        return compartimentoPorId.containsKey(linha.getCompartimentoId()) ? linha.getCompartimentoId() : null;
    }

    /** "Closet / Armário 01 / Gaveta 1"; nulo quando o compartimento não existe. */
    String caminho(UUID compartimentoId) {
        AcervoCompartimento c = compartimento(compartimentoId);
        AcervoMovel m = movelDe(c);
        AcervoAmbiente a = m == null ? null : ambientePorId.get(m.getAmbienteId());
        if (a == null) {
            return null;
        }
        return a.getNome() + " / " + m.getNome() + " / " + c.getNome();
    }
}
