package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FlairCbcSquadEdicao;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface FlairCbcSquadEdicaoRepository extends JpaRepository<FlairCbcSquadEdicao, String> {
    /** O contador do elenco com bloqueio de escrita (SELECT ... FOR UPDATE): quem chega depois espera o commit. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<FlairCbcSquadEdicao> findByElenco(String elenco);
}
