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

/** Repositório Spring Data de DnaScheme (MySQL — fonte da verdade). */
public interface DnaSchemeRepository extends JpaRepository<DnaScheme, UUID> {
    List<DnaScheme> findByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserId(UUID userId);

    @Query("select d from DnaScheme d where d.visibility = br.com.fashionai.domain.model.enums.Visibility.PUBLIC and d.status = br.com.fashionai.domain.model.enums.SchemeStatus.PUBLISHED and lower(d.title) like lower(concat('%', :term, '%'))") List<DnaScheme> searchPublic(@Param("term") String term, Pageable pageable);
}
