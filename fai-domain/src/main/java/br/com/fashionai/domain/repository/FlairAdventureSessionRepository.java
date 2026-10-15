package br.com.fashionai.domain.repository;
import br.com.fashionai.domain.model.FlairAdventureSession;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface FlairAdventureSessionRepository extends JpaRepository<FlairAdventureSession,UUID>{
 Optional<FlairAdventureSession> findFirstByOwnerIdAndStatusOrderByCreatedAtDesc(UUID owner,String status);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from FlairAdventureSession s where s.id=:id and s.ownerId=:owner") Optional<FlairAdventureSession> lockOwned(@Param("id") UUID id,@Param("owner") UUID owner);
}
