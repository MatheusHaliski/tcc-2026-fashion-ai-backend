package br.com.fashionai.domain.repository.fit;

import br.com.fashionai.domain.model.fit.ProductSizeChart;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ProductSizeChartRepository extends JpaRepository<ProductSizeChart, UUID> {
    Optional<ProductSizeChart> findByProductId(UUID productId);
}
