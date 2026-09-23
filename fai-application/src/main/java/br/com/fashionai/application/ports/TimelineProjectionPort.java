package br.com.fashionai.application.ports;

import java.util.UUID;

public interface TimelineProjectionPort {
    void appendSchemePublished(UUID ownerUserId, UUID schemeId);
}
