package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Flair3dSala;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Salas multiplayer do FLAIR 3D (V133): convites recebidos e enviados, salas ativas e o histórico entre duas pessoas. */
public interface Flair3dSalaRepository extends JpaRepository<Flair3dSala, UUID> {
    /** A sala travada para escrever (aceite, lance, fechamento): dois lances ao mesmo tempo esperam um pelo outro. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Flair3dSala> findForUpdateById(UUID id);

    List<Flair3dSala> findByParaUserIdAndEstadoInOrderByCreatedAtDesc(UUID paraUserId, Collection<String> estados);

    List<Flair3dSala> findByDeUserIdAndEstadoInOrderByCreatedAtDesc(UUID deUserId, Collection<String> estados);

    List<Flair3dSala> findTop40ByDeUserIdOrderByCreatedAtDesc(UUID deUserId);

    List<Flair3dSala> findTop40ByParaUserIdOrderByCreatedAtDesc(UUID paraUserId);

    /** Salas de uma pessoa com outras (para o status "em sala" e "convite pendente" na busca). */
    List<Flair3dSala> findByDeUserIdAndParaUserIdInAndEstadoIn(UUID deUserId, Collection<UUID> paraUserIds, Collection<String> estados);

    List<Flair3dSala> findByParaUserIdAndDeUserIdInAndEstadoIn(UUID paraUserId, Collection<UUID> deUserIds, Collection<String> estados);

    /** O histórico entre as duas pessoas, num sentido (a outra consulta inverte os lados). */
    List<Flair3dSala> findByDeUserIdAndParaUserIdOrderByCreatedAtDesc(UUID deUserId, UUID paraUserId);
}
