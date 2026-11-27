package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CategoriaMarca;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Opções de categoria principal da marca (tabela categorias_marca). A escolha lista só as ativas; findById (herdado)
 * acha também a inativa, para o perfil antigo continuar lendo a dele e o serviço recusar uma opção inativa nova.
 */
public interface CategoriaMarcaRepository extends JpaRepository<CategoriaMarca, UUID> {
    List<CategoriaMarca> findAllByAtivoTrueOrderByNomeAsc();
}
