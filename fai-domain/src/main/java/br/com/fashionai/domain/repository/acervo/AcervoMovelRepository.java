package br.com.fashionai.domain.repository.acervo;

import br.com.fashionai.domain.model.acervo.AcervoMovel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AcervoMovelRepository extends JpaRepository<AcervoMovel, UUID> {
    List<AcervoMovel> findByUserIdOrderByOrdem(UUID userId);

    List<AcervoMovel> findByAmbienteIdOrderByOrdem(UUID ambienteId);

    long countByAmbienteId(UUID ambienteId);
}
