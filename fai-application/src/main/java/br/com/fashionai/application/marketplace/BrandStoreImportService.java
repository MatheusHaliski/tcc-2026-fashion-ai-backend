package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.repository.BrandRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class BrandStoreImportService {
    private final BrandRepository brands;
    private final EntityManager entities;
    private final Guard guard;

    public BrandStoreImportService(BrandRepository brands, EntityManager entities, Guard guard) {
        this.brands = brands;
        this.entities = entities;
        this.guard = guard;
    }

    public int apply(CurrentUser user, List<BrandStoreImportRow> rows) {
        guard.requireCanCreate(user);
        if (rows == null || rows.isEmpty() || rows.size() > 2000) throw invalid();
        Brand brand = brands.findByBrandProfile_Owner_Id(user.id())
                .orElseThrow(() -> ApiException.forbidden("O perfil precisa estar vinculado a uma marca verificada."));
        entities.lock(brand, LockModeType.PESSIMISTIC_WRITE);
        var profile = brand.getBrandProfile();
        if (profile.getApprovalStatus() != ApprovalStatus.APROVADO || !profile.getOwner().isVerified()
                || user.status() != AccountStatus.ACTIVE) {
            throw ApiException.forbidden("A marca precisa ser verificada.");
        }
        String website = profile.getStoreUrl();
        URI source = URI.create(Objects.toString(website, ""));
        if (!"https".equalsIgnoreCase(source.getScheme()) || source.getHost() == null || source.getUserInfo() != null) {
            throw ApiException.badRequest("STORE_SOURCE_INVALID", "O perfil precisa de um site oficial HTTPS.");
        }
        var keys = new HashSet<String>();
        for (BrandStoreImportRow row : rows) {
            if (row == null) throw invalid();
            String key = value(row.externalId(), 160).toLowerCase(Locale.ROOT);
            if (!keys.add(key)) throw invalid();
            String country = value(row.country(), 2).toUpperCase(Locale.ROOT);
            if (!country.matches("[A-Z]{2}")) throw invalid();
            entities.createNativeQuery("""
                    INSERT INTO physical_stores
                        (id, brand_id, name, address, city, region, country, source_url, source_key, verified_at)
                    VALUES (:id, :brand, :name, :address, :city, :region, :country, :url, SHA2(:key, 256), UTC_TIMESTAMP(6)) AS input
                    ON DUPLICATE KEY UPDATE name=input.name, address=input.address, city=input.city,
                        region=input.region, country=input.country, source_url=input.source_url, verified_at=input.verified_at
                    """)
                    .setParameter("id", UUID.randomUUID().toString()).setParameter("brand", brand.getId().toString())
                    .setParameter("name", value(row.name(), 160)).setParameter("address", value(row.address(), 512))
                    .setParameter("city", value(row.city(), 120)).setParameter("region", value(row.region(), 120))
                    .setParameter("country", country).setParameter("url", website).setParameter("key", key).executeUpdate();
        }
        return rows.size();
    }

    private static String value(String raw, int max) {
        if (raw == null || raw.isBlank() || raw.strip().length() > max) throw invalid();
        return raw.strip();
    }

    private static ApiException invalid() {
        return ApiException.badRequest("STORES_IMPORT_INVALID", "Use até 2.000 linhas válidas e identificadores de loja distintos.");
    }
}
