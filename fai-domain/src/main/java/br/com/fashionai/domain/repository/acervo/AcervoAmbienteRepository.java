package br.com.fashionai.domain.repository.acervo;

import br.com.fashionai.domain.model.acervo.AcervoAmbiente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AcervoAmbienteRepository extends JpaRepository<AcervoAmbiente, UUID> {
    List<AcervoAmbiente> findByUserIdOrderByOrdem(UUID userId);

    long countByUserId(UUID userId);
}
