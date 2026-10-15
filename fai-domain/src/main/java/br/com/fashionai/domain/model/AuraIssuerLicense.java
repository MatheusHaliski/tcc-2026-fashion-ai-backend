package br.com.fashionai.domain.model;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;
/** Purchased permission for a brand/celebrity to use a preset in promotions. */
@Getter @Setter @Entity @Table(name="aura_issuer_licenses",uniqueConstraints=@UniqueConstraint(columnNames={"owner_id","preset_code"}))
public class AuraIssuerLicense extends AuditableEntity {
 @Column(name="owner_id",nullable=false,length=36) private UUID ownerId;
 @Column(name="preset_code",nullable=false,length=80) private String presetCode;
 @Column(name="price_paid",nullable=false) private int pricePaid;
 @Column(name="purchased_at",nullable=false) private Instant purchasedAt;
}
