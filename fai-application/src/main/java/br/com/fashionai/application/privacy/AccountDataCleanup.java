package br.com.fashionai.application.privacy;

import java.util.UUID;

/** Module-owned private data is removed in the same transaction as final account anonymization. */
public interface AccountDataCleanup {
    void purge(UUID ownerId);
}
