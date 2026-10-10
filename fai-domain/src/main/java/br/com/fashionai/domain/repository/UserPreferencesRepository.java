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

/** Repositório Spring Data de UserPreferences (MySQL — fonte da verdade). */
public interface UserPreferencesRepository extends JpaRepository<UserPreferences, UUID> {
    Optional<UserPreferences> findByUserId(UUID userId);

    /** RF53 · P3-12 — quem pediu para não aparecer em "Criadores em alta" (ids das pessoas). */
    @Query("select p.user.id from UserPreferences p where p.hypeCreatorOptOut = true")
    List<UUID> findHypeCreatorOptOutUserIds();
}
