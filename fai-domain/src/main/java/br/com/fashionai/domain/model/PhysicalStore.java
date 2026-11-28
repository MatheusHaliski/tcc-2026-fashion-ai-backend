package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Entity
@Table(name = "physical_stores")
public class PhysicalStore {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "brand_id")
    private Brand brand;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "map_id")
    private MarketplaceMap map;

    private String name;
    @Column(nullable = false, length = 512)
    private String address;
    private String city;
    private String region;
    private String country;

    @Column(name = "source_url")
    private String sourceUrl;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "floor_label")
    private String floorLabel;

    @Column(name = "map_x")
    private BigDecimal mapX;

    @Column(name = "map_y")
    private BigDecimal mapY;

}
