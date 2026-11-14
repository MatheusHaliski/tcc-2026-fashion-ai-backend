package br.com.fashionai.domain.repository.acervo;

import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AcervoCompartimentoRepository extends JpaRepository<AcervoCompartimento, UUID> {
    List<AcervoCompartimento> findByUserIdOrderByOrdem(UUID userId);

    List<AcervoCompartimento> findByMovelIdOrderByOrdem(UUID movelId);
}
