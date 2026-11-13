package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FlairMakeUpLook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FlairMakeUpLookRepository extends JpaRepository<FlairMakeUpLook, UUID> {
    List<FlairMakeUpLook> findByUserId(UUID userId);

    List<FlairMakeUpLook> findByUserIdAndBrief(UUID userId, String brief);
}
