package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.UserSignaturePiece;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/** Exercício 18 — Peça Assinatura atual de cada pessoa (tabela user_signature_pieces; a chave é o usuário). */
public interface UserSignaturePieceRepository extends JpaRepository<UserSignaturePiece, UUID> {
    /** Quem tem esta peça como assinatura (no máximo o dono dela): usado quando a peça é excluída. */
    Optional<UserSignaturePiece> findByPieceId(UUID pieceId);
}
