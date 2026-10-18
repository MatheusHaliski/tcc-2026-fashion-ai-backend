package br.com.fashionai.domain.repository;
import br.com.fashionai.domain.model.AuraHypeDrop;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface AuraHypeDropRepository extends JpaRepository<AuraHypeDrop,UUID> {
 List<AuraHypeDrop> findByEntityTypeAndEntityIdInAndActiveTrue(HypeEntityType type,Collection<UUID> ids);
 Optional<AuraHypeDrop> findByEntityTypeAndEntityId(HypeEntityType type,UUID id);
 List<AuraHypeDrop> findByIssuerIdAndSeriesCode(UUID issuer,String seriesCode);
}
