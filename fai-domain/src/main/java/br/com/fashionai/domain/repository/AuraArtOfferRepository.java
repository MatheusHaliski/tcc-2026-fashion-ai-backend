package br.com.fashionai.domain.repository;
import br.com.fashionai.domain.model.AuraArtOffer;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface AuraArtOfferRepository extends JpaRepository<AuraArtOffer,String> {
 List<AuraArtOffer> findByActiveTrueOrderByPricePointsAsc();
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from AuraArtOffer a where a.code=:code") Optional<AuraArtOffer> lockByCode(@Param("code") String code);
}
