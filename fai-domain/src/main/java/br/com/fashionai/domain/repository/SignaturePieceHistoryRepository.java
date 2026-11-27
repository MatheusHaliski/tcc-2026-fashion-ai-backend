package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.SignaturePieceHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Exercício 18 — histórico da Peça Assinatura (tabela signature_piece_history), da mudança mais recente para a mais antiga. */
public interface SignaturePieceHistoryRepository extends JpaRepository<SignaturePieceHistory, UUID> {
    Page<SignaturePieceHistory> findByUserIdOrderByChangedAtDescIdDesc(UUID userId, Pageable pageable);
}
