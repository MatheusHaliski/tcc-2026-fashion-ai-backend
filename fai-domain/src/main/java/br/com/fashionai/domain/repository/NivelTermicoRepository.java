package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.NivelTermico;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Opções de nível térmico do look (tabela niveis_termicos). A escolha lista só as ativas; findById (herdado) acha também
 * a inativa, para o look antigo continuar lendo o nível dele e o serviço recusar uma opção inativa nova.
 */
public interface NivelTermicoRepository extends JpaRepository<NivelTermico, UUID> {
    List<NivelTermico> findAllByAtivoTrueOrderByNomeAsc();
}
