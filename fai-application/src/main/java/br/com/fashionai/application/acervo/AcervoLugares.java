package br.com.fashionai.application.acervo;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoMovel;
import br.com.fashionai.domain.model.acervo.AcervoPeca;
import br.com.fashionai.domain.repository.acervo.AcervoAmbienteRepository;
import br.com.fashionai.domain.repository.acervo.AcervoCompartimentoRepository;
import br.com.fashionai.domain.repository.acervo.AcervoMovelRepository;
import br.com.fashionai.domain.repository.acervo.AcervoPecaRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Onde cada peça da pessoa está guardada no ACERVO, para as outras funcionalidades (Espelho, Copilot, Inventory Score).
 * Só leitura e só das peças da própria pessoa (quem chama já tem o usuário autenticado). Substitui o endereço do Meu
 * Quarto, retirado em 15/11/2026 (docs/quarto/RETIRADA_DO_QUARTO_3D.md). Peça sem lugar não aparece no mapa.
 */
@Component
public class AcervoLugares {
    /**
     * Lugar de uma peça: o compartimento, o móvel, o caminho legível ("Closet / Armário 01 / Gaveta 1"), o tipo do
     * compartimento (cabideiro, prateleira ou gaveta) e se o móvel é do guarda-roupa real ("Meu espaço").
     */
    public record Lugar(UUID compartimentoId, UUID movelId, String caminho, String tipo, boolean meuEspaco) {
    }

    private final AcervoAmbienteRepository ambientes;
    private final AcervoMovelRepository moveis;
    private final AcervoCompartimentoRepository compartimentos;
    private final AcervoPecaRepository linhas;

    public AcervoLugares(AcervoAmbienteRepository ambientes, AcervoMovelRepository moveis, AcervoCompartimentoRepository compartimentos,
                         AcervoPecaRepository linhas) {
        this.ambientes = ambientes;
        this.moveis = moveis;
        this.compartimentos = compartimentos;
        this.linhas = linhas;
    }

    /** Lugar de cada peça da pessoa que tem lugar no ACERVO (a chave é o id da peça). */
    @Transactional(readOnly = true)
    public Map<UUID, Lugar> deUsuario(UUID userId) {
        List<AcervoPeca> pecas = linhas.findByUserId(userId);
        Map<UUID, Lugar> out = new HashMap<>();
        if (pecas.isEmpty()) {
            return out;
        }
        AcervoMapa mapa = new AcervoMapa(ambientes.findByUserIdOrderByOrdem(userId), moveis.findByUserIdOrderByOrdem(userId),
                compartimentos.findByUserIdOrderByOrdem(userId), pecas);
        for (AcervoPeca linha : pecas) {
            UUID onde = mapa.lugar(linha.getPieceId());
            String caminho = onde == null ? null : mapa.caminho(onde);
            if (caminho == null) {
                continue;
            }
            AcervoCompartimento c = mapa.compartimento(onde);
            AcervoMovel m = mapa.movelDe(c);
            out.put(linha.getPieceId(), new Lugar(onde, m.getId(), caminho, c.getTipo(), AcervoMovel.MEU_ESPACO.equals(m.getModo())));
        }
        return out;
    }

    /** Tipo de compartimento que combina com a peça (a mesma regra do modo arrumação do ACERVO). */
    public static String tipoEsperado(WardrobeItem peca) {
        return AcervoArrumacao.tipoPara(peca);
    }
}
