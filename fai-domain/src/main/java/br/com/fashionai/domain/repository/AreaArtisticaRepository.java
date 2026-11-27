package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.AreaArtistica;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Opções de área artística (tabela areas_artisticas). A escolha lista só as ativas; findById (herdado) acha também a
 * inativa, para o perfil antigo continuar lendo a dele e o serviço recusar uma opção inativa nova.
 */
public interface AreaArtisticaRepository extends JpaRepository<AreaArtistica, UUID> {
    List<AreaArtistica> findAllByAtivoTrueOrderByNomeAsc();
}
