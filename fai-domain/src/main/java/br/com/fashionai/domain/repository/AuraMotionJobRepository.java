package br.com.fashionai.domain.repository;
import br.com.fashionai.domain.model.AuraMotionJob;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import java.util.*;
public interface AuraMotionJobRepository extends JpaRepository<AuraMotionJob,UUID> {
 Optional<AuraMotionJob> findByOwnerIdAndRequestKey(UUID owner,UUID requestKey);
 List<AuraMotionJob> findByOwnerIdOrderByCreatedAtDesc(UUID owner,Pageable pageable);
 List<AuraMotionJob> findByStatusInOrderByCreatedAtAsc(Collection<AuraMotionJob.Status> statuses,Pageable pageable);
 long countByOwnerIdAndStatusIn(UUID owner,Collection<AuraMotionJob.Status> statuses);
 @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @Query("select j from AuraMotionJob j where j.id=:id")
 Optional<AuraMotionJob> findLocked(@Param("id") UUID id);
}
