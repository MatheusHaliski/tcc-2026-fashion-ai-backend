package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoDesejo;
import br.com.fashionai.domain.model.acervo.AcervoMovel;
import br.com.fashionai.domain.model.acervo.AcervoPeca;
import br.com.fashionai.domain.repository.acervo.AcervoCompartimentoRepository;
import br.com.fashionai.domain.repository.acervo.AcervoDesejoRepository;
import br.com.fashionai.domain.repository.acervo.AcervoPecaRepository;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Compartimentos de um móvel: criar com nome padrão, apagar soltando o que estava dentro (as peças ficam sem lugar, os
 * desejos perdem o lugar simulado) e ajustar a quantidade de cada tipo quando a configuração do móvel muda.
 */
@Component
class AcervoCompartimentos {
    private final AcervoCompartimentoRepository compartimentos;
    private final AcervoPecaRepository linhas;
    private final AcervoDesejoRepository desejos;

    AcervoCompartimentos(AcervoCompartimentoRepository compartimentos, AcervoPecaRepository linhas, AcervoDesejoRepository desejos) {
        this.compartimentos = compartimentos;
        this.linhas = linhas;
        this.desejos = desejos;
    }

    long pecasEm(AcervoCompartimento c) {
        return linhas.findByCompartimentoIdIn(List.of(c.getId())).size();
    }

    AcervoCompartimento criar(AcervoMovel movel, String tipo, String nome) {
        List<AcervoCompartimento> atuais = compartimentos.findByMovelIdOrderByOrdem(movel.getId());
        long doTipo = atuais.stream().filter(c -> c.getTipo().equals(tipo)).count();
        AcervoRegras.limite(doTipo, AcervoRegras.MAX_POR_TIPO, "ACERVO_LIMITE_COMPARTIMENTOS", "acervo.erro.limite_compartimentos");
        AcervoCompartimento c = new AcervoCompartimento();
        c.setUserId(movel.getUserId());
        c.setMovelId(movel.getId());
        c.setTipo(tipo);
        c.setNome(nome != null ? nome : AcervoRegras.nomePadrao(tipo, (int) doTipo + 1));
        c.setOrdem(atuais.stream().mapToInt(AcervoCompartimento::getOrdem).max().orElse(-1) + 1);
        return compartimentos.saveAndFlush(c);
    }

    /** Nome padrão do compartimento pela posição entre os do mesmo tipo no móvel: a 2ª gaveta é "Gaveta 2". */
    String nomePadrao(AcervoCompartimento c) {
        List<AcervoCompartimento> doTipo = compartimentos.findByMovelIdOrderByOrdem(c.getMovelId()).stream()
                .filter(outro -> outro.getTipo().equals(c.getTipo()))
                .toList();
        int posicao = 0;
        while (posicao < doTipo.size() && !doTipo.get(posicao).getId().equals(c.getId())) {
            posicao++;
        }
        return AcervoRegras.nomePadrao(c.getTipo(), posicao + 1);
    }

    void apagar(AcervoCompartimento c) {
        for (AcervoPeca linha : linhas.findByCompartimentoIdIn(List.of(c.getId()))) {
            linha.setCompartimentoId(null);
            linhas.save(linha);
        }
        for (AcervoDesejo desejo : desejos.findByCompartimentoIdIn(List.of(c.getId()))) {
            desejo.setCompartimentoId(null);
            desejos.save(desejo);
        }
        compartimentos.delete(c);
    }

    /**
     * Deixa o móvel com {@code quantidade} compartimentos do tipo: cria os que faltam no fim; para reduzir, tira os
     * últimos, e só se estiverem vazios (com peça dentro, a pessoa precisa esvaziar antes).
     */
    void ajustar(AcervoMovel movel, String tipo, int quantidade) {
        List<AcervoCompartimento> doTipo = compartimentos.findByMovelIdOrderByOrdem(movel.getId()).stream()
                .filter(c -> c.getTipo().equals(tipo))
                .toList();
        for (int i = doTipo.size(); i < quantidade; i++) {
            criar(movel, tipo, null);
        }
        for (int i = doTipo.size() - 1; i >= quantidade; i--) {
            AcervoCompartimento ultimo = doTipo.get(i);
            if (pecasEm(ultimo) > 0) {
                throw ApiException.conflict("ACERVO_COMPARTIMENTO_OCUPADO", Msg.t("acervo.erro.compartimento_ocupado", ultimo.getNome()));
            }
            apagar(ultimo);
        }
    }
}
