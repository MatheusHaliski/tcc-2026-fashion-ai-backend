package br.com.fashionai.domain.repository.atelier3d;
import br.com.fashionai.domain.model.atelier3d.DesignSceneVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface DesignSceneVersionRepository extends JpaRepository<DesignSceneVersion,UUID> {
    Optional<DesignSceneVersion> findFirstByProjectIdOrderBySequenceNumberDesc(UUID project);
    Optional<DesignSceneVersion> findByProjectIdAndRequestId(UUID project,String request);
    interface Metadata { UUID getId(); long getSequenceNumber(); UUID getAssetId(); String getAuthor(); java.time.Instant getCreatedAt(); }
    List<Metadata> findTop30ByProjectIdOrderBySequenceNumberDesc(UUID project);
}
