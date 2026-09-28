package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.ChallengeVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChallengeVoteRepository extends JpaRepository<ChallengeVote, UUID> {
    List<ChallengeVote> findByInstanceId(UUID instanceId);

    boolean existsByInstanceIdAndVoterUserIdAndEntrySchemeId(UUID i, UUID v, UUID e);

    /** Um voto por pessoa em cada batalha (garantido também por uq_ch_vote_voter). */
    boolean existsByInstanceIdAndVoterUserId(UUID i, UUID v);
}
