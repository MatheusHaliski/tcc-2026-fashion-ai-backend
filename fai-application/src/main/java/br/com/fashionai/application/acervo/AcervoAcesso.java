package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.acervo.AcervoAmbiente;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoMovel;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.acervo.AcervoAmbienteRepository;
import br.com.fashionai.domain.repository.acervo.AcervoCompartimentoRepository;
import br.com.fashionai.domain.repository.acervo.AcervoMovelRepository;
import br.com.fashionai.domain.repository.acervo.AcervoPecaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Porta de entrada de tudo o que o ACERVO lê ou altera: só a dona enxerga os seus ambientes, móveis, compartimentos e
 * peças. O que é de outra pessoa responde "não encontrado", como se não existisse.
 */
@Component
class AcervoAcesso {
    private final AcervoAmbienteRepository ambientes;
    private final AcervoMovelRepository moveis;
    private final AcervoCompartimentoRepository compartimentos;
    private final AcervoPecaRepository linhas;
    private final WardrobeItemRepository pecas;
    private final Guard guard;

    AcervoAcesso(AcervoAmbienteRepository ambientes, AcervoMovelRepository moveis, AcervoCompartimentoRepository compartimentos,
                 AcervoPecaRepository linhas, WardrobeItemRepository pecas, Guard guard) {
        this.ambientes = ambientes;
        this.moveis = moveis;
        this.compartimentos = compartimentos;
        this.linhas = linhas;
        this.pecas = pecas;
        this.guard = guard;
    }

    void exigir(CurrentUser user) {
        guard.requireCanCreate(user);
    }

    /** Estrutura inteira do acervo da pessoa, com o lugar de cada peça. */
    AcervoMapa mapa(CurrentUser user) {
        exigir(user);
        return new AcervoMapa(ambientes.findByUserIdOrderByOrdem(user.id()), moveis.findByUserIdOrderByOrdem(user.id()),
                compartimentos.findByUserIdOrderByOrdem(user.id()), linhas.findByUserId(user.id()));
    }

    AcervoAmbiente ambiente(CurrentUser user, UUID id) {
        exigir(user);
        return ambientes.findById(id)
                .filter(a -> a.getUserId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound(Msg.t("acervo.ambiente")));
    }

    AcervoMovel movel(CurrentUser user, UUID id) {
        exigir(user);
        return moveis.findById(id)
                .filter(m -> m.getUserId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound(Msg.t("acervo.movel")));
    }

    AcervoCompartimento compartimento(CurrentUser user, UUID id) {
        exigir(user);
        return compartimentos.findById(id)
                .filter(c -> c.getUserId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound(Msg.t("acervo.compartimento")));
    }

    /** Compartimento de destino: nulo quer dizer "sem lugar". */
    AcervoCompartimento destino(CurrentUser user, UUID id) {
        return id == null ? null : compartimento(user, id);
    }

    WardrobeItem peca(CurrentUser user, UUID id) {
        exigir(user);
        return pecas.findById(id)
                .filter(w -> w.getUser().getId().equals(user.id()))
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
    }

    /** Peças do guarda-roupa da pessoa, sem as arquivadas. */
    List<WardrobeItem> pecas(CurrentUser user) {
        exigir(user);
        return pecas.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .toList();
    }
}
