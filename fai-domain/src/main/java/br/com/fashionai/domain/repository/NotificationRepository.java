package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de Notification (MySQL — fonte da verdade). */
public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findTop100ByRecipientIdAndDeliveredTrueOrderByCreatedAtDesc(UUID recipientId);

    /** Caixa de entrada: o extrato dos FAI Points (categoria POINTS) tem cota própria e não empurra o resto para fora. */
    List<Notification> findTop100ByRecipientIdAndDeliveredTrueAndCategoryNotOrderByCreatedAtDesc(UUID recipientId, NotificationCategory category);

    List<Notification> findTop100ByRecipientIdAndDeliveredTrueAndCategoryOrderByCreatedAtDesc(UUID recipientId, NotificationCategory category);

    long countByRecipientIdAndReadFalseAndDeliveredTrue(UUID recipientId);

    List<Notification> findByRecipientIdAndReadFalse(UUID recipientId);

    List<Notification> findByCreatedAtBefore(Instant cutoff);
}
