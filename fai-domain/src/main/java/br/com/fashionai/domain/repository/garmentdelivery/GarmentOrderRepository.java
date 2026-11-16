package br.com.fashionai.domain.repository.garmentdelivery;

import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GarmentOrderRepository extends JpaRepository<GarmentOrder, UUID> {
    List<GarmentOrder> findTop50ByOwnerIdOrderByPlacedAtDesc(UUID ownerId);

    Optional<GarmentOrder> findByOwnerIdAndRequestId(UUID ownerId, String requestId);

    boolean existsBySerialNumber(String serialNumber);

    /** Varredura: encomendas que ainda têm etapas do plano por gravar. */
    List<GarmentOrder> findTop200ByStatusInOrderByPlacedAtAsc(Collection<String> statuses);

    @Query("select o.id from GarmentOrder o where o.ownerId = :ownerId")
    List<UUID> findIdsByOwnerId(@Param("ownerId") UUID ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from GarmentOrder o where o.id = :id")
    Optional<GarmentOrder> lockById(@Param("id") UUID id);

    /** Atualiza só o índice de estado, sem mudar a versão que a tela usa para cancelar ou confirmar. */
    @Modifying
    @Query("update GarmentOrder o set o.status = :status where o.id = :id")
    int markStatus(@Param("id") UUID id, @Param("status") String status);

    @Modifying
    @Query("delete from GarmentOrder o where o.ownerId = :ownerId")
    int purgeByOwnerId(@Param("ownerId") UUID ownerId);
}
