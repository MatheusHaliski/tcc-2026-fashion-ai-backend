package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * FLAIR Card Building Challenge (V101) — contador da edição de um elenco: a última edição dada. A entrega lê esta linha
 * com bloqueio de escrita antes de numerar, então duas primeiras conclusões simultâneas não repetem número.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_cbc_squad_edicoes")
public class FlairCbcSquadEdicao {
    @Id
    @Column(length = 32)
    private String elenco;

    @Column(nullable = false)
    private int ultima;

    public FlairCbcSquadEdicao(String elenco) {
        this.elenco = elenco;
    }

    /** Avança o contador e devolve a edição nova. */
    public int proxima() {
        ultima += 1;
        return ultima;
    }
}
