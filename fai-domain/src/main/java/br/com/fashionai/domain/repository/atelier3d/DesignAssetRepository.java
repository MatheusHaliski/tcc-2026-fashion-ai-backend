package br.com.fashionai.domain.repository.atelier3d;
import br.com.fashionai.domain.model.atelier3d.DesignAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface DesignAssetRepository extends JpaRepository<DesignAsset,UUID> {
    Optional<DesignAsset> findFirstByProjectIdAndSha256(UUID project,String sha256);
    interface Metadata { UUID getId(); UUID getProjectId(); String getFilename(); String getSha256(); int getBytes(); String getInspectionJson(); }
    Optional<Metadata> findProjectedById(UUID id);
    long countByProjectId(UUID project);
}
