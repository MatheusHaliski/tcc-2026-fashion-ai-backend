package br.com.fashionai.domain.repository.acervo;

import br.com.fashionai.domain.model.acervo.TipoIluminacao;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Opções de tipo de iluminação (tabela tipos_iluminacao). A escolha lista só as ativas; findById (herdado) acha também a
 * inativa, para o ambiente antigo continuar lendo o tipo dele e o serviço recusar uma opção inativa nova.
 */
public interface TipoIluminacaoRepository extends JpaRepository<TipoIluminacao, UUID> {
    List<TipoIluminacao> findAllByAtivoTrueOrderByNomeAsc();
}
