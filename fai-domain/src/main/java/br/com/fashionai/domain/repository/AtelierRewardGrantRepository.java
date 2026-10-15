package br.com.fashionai.domain.repository;
import br.com.fashionai.domain.model.AtelierRewardGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface AtelierRewardGrantRepository extends JpaRepository<AtelierRewardGrant,UUID> {
 List<AtelierRewardGrant> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);
 Optional<AtelierRewardGrant> findByOwnerIdAndCategoryAndRewardCodeAndSourceTypeAndSourceReference(UUID ownerId,AtelierRewardGrant.Category category,String code,String source,String reference);
}
