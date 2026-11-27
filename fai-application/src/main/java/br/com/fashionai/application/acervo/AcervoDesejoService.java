package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoDesejo;
import br.com.fashionai.domain.repository.acervo.AcervoDesejoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ACERVO — lista de desejos: peças que a pessoa ainda não tem, separadas das compradas. O preço é uma estimativa
 * informada por ela; o compartimento (opcional) é onde a peça entraria na simulação de compra.
 */
@Service
@Transactional
public class AcervoDesejoService {
    public record DesejoForm(String nome, String categoria, String cor, String tamanho, String marca, BigDecimal precoEstimado,
                             UUID compartimentoId) { }

    static final List<String> CATEGORIAS = List.of("upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece");
    private static final BigDecimal PRECO_MAX = new BigDecimal("99999999.99");

    private final AcervoDesejoRepository desejos;
    private final AcervoAcesso acesso;

    public AcervoDesejoService(AcervoDesejoRepository desejos, AcervoAcesso acesso) {
        this.desejos = desejos;
        this.acesso = acesso;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> lista(CurrentUser user) {
        AcervoMapa mapa = acesso.mapa(user);
        return desejos.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .map(d -> AcervoViews.desejo(d, mapa))
                .toList();
    }

    public Map<String, Object> criar(CurrentUser user, DesejoForm form) {
        acesso.exigir(user);
        AcervoRegras.limite(desejos.countByUserId(user.id()), AcervoRegras.MAX_DESEJOS, "ACERVO_LIMITE_DESEJOS", "acervo.erro.limite_desejos");
        AcervoDesejo d = new AcervoDesejo();
        d.setUserId(user.id());
        d.setMoeda(AcervoFinanceiro.moeda(acesso.pecas(user)));
        preencher(user, d, form);
        desejos.saveAndFlush(d);
        return AcervoViews.desejo(d, acesso.mapa(user));
    }

    public Map<String, Object> atualizar(CurrentUser user, UUID id, DesejoForm form) {
        AcervoDesejo d = meu(user, id);
        preencher(user, d, form);
        desejos.save(d);
        return AcervoViews.desejo(d, acesso.mapa(user));
    }

    public void apagar(CurrentUser user, UUID id) {
        desejos.delete(meu(user, id));
    }

    private void preencher(CurrentUser user, AcervoDesejo d, DesejoForm form) {
        if (form == null) {
            throw ApiException.badRequest("ACERVO_NOME", Msg.t("acervo.erro.nome"));
        }
        AcervoCompartimento lugar = acesso.destino(user, form.compartimentoId());
        d.setNome(AcervoRegras.nome(form.nome(), 120));
        d.setCategoria(AcervoRegras.opcao("categoria", form.categoria(), CATEGORIAS, "upper_piece"));
        d.setCor(AcervoRegras.opcional(form.cor(), 80));
        d.setTamanho(AcervoRegras.opcional(form.tamanho(), 40));
        d.setMarca(AcervoRegras.opcional(form.marca(), 160));
        d.setPrecoEstimado(preco(form.precoEstimado()));
        d.setCompartimentoId(lugar == null ? null : lugar.getId());
    }

    private static BigDecimal preco(BigDecimal valor) {
        if (valor == null) {
            return null;
        }
        if (valor.signum() < 0 || valor.compareTo(PRECO_MAX) > 0) {
            String texto = Msg.t("acervo.erro.preco");
            throw ApiException.badRequest("ACERVO_PRECO", texto, Map.of("precoEstimado", texto));
        }
        return valor.setScale(2, RoundingMode.HALF_UP);
    }

    private AcervoDesejo meu(CurrentUser user, UUID id) {
        acesso.exigir(user);
        return desejos.findById(id)
                .filter(d -> d.getUserId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound(Msg.t("acervo.desejo")));
    }
}
