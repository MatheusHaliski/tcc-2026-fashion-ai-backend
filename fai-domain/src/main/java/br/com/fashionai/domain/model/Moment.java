package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.Season;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * FashionAI Momentos — unidade temporal da moda dentro do FashionAI (docs/momentos/MOMENTOS.md). Um Momento é DADO,
 * nunca uma página específica: temporadas, datas culturais, eventos reais, desafios oficiais, Momentos privados de
 * grupos FLAIR e missões pessoais usam a mesma entidade, com tema visual (theme_json), regras e conteúdo configuráveis
 * pela administração (sem deploy para o Halloween do ano seguinte).
 *
 * <p>Tempo: {@code startAt}/{@code endAt} são instantes UTC; {@code timezone} (IANA) diz em que fuso o Momento foi
 * definido, para o calendário (dia/mês) e as contagens regressivas. O status gravado é a fonte da verdade do job;
 * as consultas ainda calculam o status efetivo pelo relógio do servidor (nunca pela data local do cliente).</p>
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "moments")
public class Moment extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    @Column(nullable = false, length = 120)
    private String name;

    /** Nomes por idioma ({"pt-BR": …, "en": …, "es": …}); o campo {@code name} é o padrão. */
    @Column(name = "names_json", columnDefinition = "json")
    private String namesJson;

    @Column(length = 1000)
    private String description;

    @Column(name = "descriptions_json", columnDefinition = "json")
    private String descriptionsJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MomentType type = MomentType.COMMUNITY;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MomentNature nature = MomentNature.FASHIONAI;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MomentStatus status = MomentStatus.DRAFT;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(nullable = false, length = 50)
    private String timezone = "America/Sao_Paulo";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MomentScope scope = MomentScope.GLOBAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MomentVisibility visibility = MomentVisibility.PUBLIC;

    /** ISO-3166 alpha-2 quando scope = COUNTRY/REGION; nulo = sem restrição. */
    @Column(length = 2)
    private String country;

    @Column(length = 60)
    private String region;

    @Column(length = 10)
    private String locale;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Season season;

    /** MomentTheme (§51): {background, gradient, accent, icon, cover, animation} — camada sobre a identidade FashionAI. */
    @Column(name = "theme_json", columnDefinition = "json")
    private String themeJson;

    @Column(name = "cover_url", length = 500)
    private String coverUrl;

    @Column(name = "banner_url", length = 500)
    private String bannerUrl;

    @Column(name = "created_by_user_id", length = 36)
    private UUID createdByUserId;

    @Column(nullable = false)
    private boolean official;

    @Column(nullable = false)
    private boolean featured;

    /** §47 — conteúdo patrocinado aparece sempre como PATROCINADO; nunca se confunde com Hype orgânico. */
    @Column(nullable = false)
    private boolean sponsored;

    @Column(name = "sponsor_name", length = 120)
    private String sponsorName;

    /** §21 — eventos externos precisam de fonte/verificação ou configuração administrativa. */
    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    @Column(name = "source_note", length = 300)
    private String sourceNote;

    @Column(name = "points_enabled", nullable = false)
    private boolean pointsEnabled = true;

    @Column(name = "base_points", nullable = false)
    private int basePoints = 20;

    /** Multiplicador sazonal dos FAI Points de participação (x1.5 = "+50% FAI Points"). */
    @Column(name = "points_multiplier", nullable = false, precision = 4, scale = 2)
    private BigDecimal pointsMultiplier = BigDecimal.ONE;

    /** Bônus de reutilização ligados (§11): {"wardrobe":25,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}. */
    @Column(name = "bonus_rules_json", columnDefinition = "json")
    private String bonusRulesJson;

    @Column(name = "style_tags", length = 300)
    private String styleTags;

    @Column(name = "occasion_tags", length = 300)
    private String occasionTags;

    @Column(name = "color_tags", length = 300)
    private String colorTags;

    /** Interpretações possíveis (§2): [{"key":"dark","label":{"pt-BR":…},"styleTags":[…],"colorTags":[…]}]. */
    @Column(name = "interpretations_json", columnDefinition = "json")
    private String interpretationsJson;

    @Column(name = "required_items_json", columnDefinition = "json")
    private String requiredItemsJson;

    @Column(name = "suggested_items_json", columnDefinition = "json")
    private String suggestedItemsJson;

    @Column(name = "rules_json", columnDefinition = "json")
    private String rulesJson;

    /** Grupo FLAIR dono do Momento privado (flair_teams.id) quando scope = GROUP. */
    @Column(name = "group_id", length = 36)
    private UUID groupId;

    @Enumerated(EnumType.STRING)
    @Column(name = "flair_mode", length = 20)
    private FlairMomentMode flairMode;

    /** Configurações do Momento privado (§27): looksPerUser, allowRemix, allowVoting, allowComments, allowAi, allowExternalPieces, anonymousVoting, prizes. */
    @Column(name = "settings_json", columnDefinition = "json")
    private String settingsJson;

    /** Meta coletiva (§31): número de looks que o grupo precisa alcançar; nulo = sem meta. */
    @Column(name = "cooperative_goal")
    private Integer cooperativeGoal;

    /** Contador desnormalizado para a home ("14,2 mil participantes"); a verdade está em moment_participations. */
    @Column(name = "participant_count", nullable = false)
    private int participantCount;

    /** Memória do Momento (§34): calculada quando termina, nunca apagada. */
    @Column(name = "memory_json", columnDefinition = "json")
    private String memoryJson;

    /** Badge concedida a quem conclui (§40): código curto; nulo = sem badge. */
    @Column(name = "badge_code", length = 40)
    private String badgeCode;

    @Version
    @Column(nullable = false)
    private long version;
}
