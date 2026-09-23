package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** RF19.CA04-CA07 — comentário (modal ancorado) com respostas aninhadas; conteúdo cifrado (RNF3). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "comments")
public class Comment extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_user_id", nullable = false)
    private User author;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false, length = 36)
    private UUID targetId;

    @Column(name = "parent_comment_id", length = 36)
    private UUID parentCommentId;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "content_ciphertext", nullable = false, length = 2048)
    private String content;

    @Column(name = "active", nullable = false)
    private boolean active = true;
}
