package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;

import java.util.UUID;

@Getter
@Entity
@Table(name = "marketplace_maps")
public class MarketplaceMap {
    @Id
    private UUID id;

    private String slug;
    private String name;
    private String kind;
    private String city;
    private String region;
    private String country;

    @Column(name = "image_url")
    private String imageUrl;
}
