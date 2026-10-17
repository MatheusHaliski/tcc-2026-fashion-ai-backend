package br.com.fashionai.domain.repository;
import br.com.fashionai.domain.model.AuraIssuerLicense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface AuraIssuerLicenseRepository extends JpaRepository<AuraIssuerLicense,UUID> {
 Optional<AuraIssuerLicense> findByOwnerIdAndPresetCode(UUID ownerId,String presetCode);
 List<AuraIssuerLicense> findByOwnerIdOrderByPurchasedAtDesc(UUID ownerId);
}
