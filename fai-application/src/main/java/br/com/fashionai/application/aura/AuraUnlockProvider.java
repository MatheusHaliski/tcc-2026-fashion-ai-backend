package br.com.fashionai.application.aura;

import java.util.List;
import java.util.UUID;

import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.aura.AuraUnlocks.State;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.enums.HypeEntityType;

/**
 * Circuito Aura — fonte de itens de "O que este card destrava" que precisa de dados próprios (cupons com Hype mínimo,
 * pontos de marco e, na fase 2, recompensas de Aura de cada família). Cada fonte é um bean; o
 * {@link AuraUnlocksService} junta todas. Uma fonte só lê.
 */
public interface AuraUnlockProvider {
    List<Item> items(CurrentUser viewer, HypeEntityType type, UUID id, State state);
}
