package br.com.fashionai.domain.model;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
/** Catalog entry for an issuer license, not an entitlement to every participant card. */
@Getter @Setter @Entity @Table(name="aura_art_offers")
public class AuraArtOffer {
 @Id @Column(length=80) private String code;
 @Column(nullable=false,length=160) private String name;
 @Column(nullable=false,length=20) private String family;
 @Column(name="config_json",nullable=false,columnDefinition="json") private String configJson;
 @Column(name="price_points",nullable=false) private int pricePoints;
 @Column(nullable=false) private boolean active;
 @Version private long version;
}
