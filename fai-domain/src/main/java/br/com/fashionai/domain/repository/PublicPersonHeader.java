package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;

import java.util.UUID;

/** Closed projection for public discovery: never hydrate account credentials or private contact attributes. */
public interface PublicPersonHeader {
    UUID getId();
    String getUsername();
    String getDisplayName();
    String getAvatarUrl();
    ProfileType getProfileType();
    boolean isVerified();
    String getCountry();
    boolean isPrivateAccount();
    String getCoverUrl();
    String getBio();
    String getPronouns();
    String getLinksJson();
    Visibility getProfileVisibility();
}
