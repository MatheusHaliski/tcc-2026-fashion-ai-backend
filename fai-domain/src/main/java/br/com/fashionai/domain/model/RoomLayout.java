package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF32/RF35 — layout do quarto: nível, módulos aplicados e rótulos das gavetas. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "room_layouts")
public class RoomLayout extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false, length = 20)
    private String level = "ESTREIA";

    @Column(name = "modules_json", columnDefinition = "json")
    private String modulesJson;

    @Column(name = "drawer_labels_json", columnDefinition = "json")
    private String drawerLabelsJson;

    @Column(name = "previous_map_json", columnDefinition = "json")
    private String previousMapJson;
}
