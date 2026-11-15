package br.com.fashionai.application.laundry;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.events.SideEffectRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.UUID;

/**
 * Liga o uso da peça à Lavanderia (RF-PESQ-03): registrar o Look do Dia ou marcar "usei hoje" numa peça deixa a peça
 * em "Peças usadas". Antes a tela pedia "marque as peças usadas a partir do look do dia ou da peça", mas nenhum dos
 * dois caminhos mudava o estado, e não havia como montar um lote de lavagem.
 */
@Component
public class LaundryWearListener {
    private final LaundryService laundry;
    private final SideEffectRunner sideEffects;

    public LaundryWearListener(LaundryService laundry, SideEffectRunner sideEffects) {
        this.laundry = laundry;
        this.sideEffects = sideEffects;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDailyLook(DomainEvents.DailyLookRegistered ev) {
        if (ev.pieceIds() == null) {
            return;
        }
        for (UUID pieceId : ev.pieceIds()) {
            sideEffects.run("Laundry:DailyLook", () -> laundry.noteWorn(ev.userId(), pieceId));
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceWorn(DomainEvents.PieceWorn ev) {
        sideEffects.run("Laundry:PieceWorn", () -> laundry.noteWorn(ev.userId(), ev.pieceId()));
    }
}
