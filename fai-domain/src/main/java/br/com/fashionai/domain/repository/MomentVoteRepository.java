package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MomentVoteRepository extends JpaRepository<MomentVote, UUID> {
    Optional<MomentVote> findBySubmissionIdAndVoterIdAndDimension(UUID submissionId, UUID voterId, MomentVoteDimension dimension);

    List<MomentVote> findByMomentId(UUID momentId);

    List<MomentVote> findByMomentIdAndVoterId(UUID momentId, UUID voterId);

    long countByMomentIdAndVoterId(UUID momentId, UUID voterId);
}
