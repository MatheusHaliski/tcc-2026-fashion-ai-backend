package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "fai_digital_offers")
@Getter
@Setter
public class FaiDigitalOffer {
    @Id
    private String code;

    private String name;
    private String kind;

    @Column(name = "product_id")
    private UUID productId;

    @Column(name = "design_json", columnDefinition = "json")
    private String designJson;

    private int points;
    private Integer stock;
    private boolean active;
}
