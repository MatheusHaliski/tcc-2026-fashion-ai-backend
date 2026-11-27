package br.com.fashionai.domain.repository.acervo;

import br.com.fashionai.domain.model.acervo.AcervoDesejo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AcervoDesejoRepository extends JpaRepository<AcervoDesejo, UUID> {
    List<AcervoDesejo> findByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserId(UUID userId);

    List<AcervoDesejo> findByCompartimentoIdIn(Collection<UUID> compartimentoIds);
}
