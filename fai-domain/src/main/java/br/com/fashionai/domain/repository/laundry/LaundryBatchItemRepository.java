package br.com.fashionai.domain.repository.laundry;

import br.com.fashionai.domain.model.laundry.LaundryBatchItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LaundryBatchItemRepository extends JpaRepository<LaundryBatchItem, UUID> {
    List<LaundryBatchItem> findByBatchId(UUID batchId);
}
