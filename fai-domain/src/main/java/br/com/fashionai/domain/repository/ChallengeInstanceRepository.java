package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.ChallengeInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChallengeInstanceRepository extends JpaRepository<ChallengeInstance, UUID> {
    List<ChallengeInstance> findByStateIn(Collection<String> states);

    List<ChallengeInstance> findByIdIn(Collection<UUID> ids);
}
