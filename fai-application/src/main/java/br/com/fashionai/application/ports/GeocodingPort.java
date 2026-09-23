package br.com.fashionai.application.ports;

import java.util.Optional;

/** Open-Meteo Geocoding (sem chave) — cidade → coordenadas para o clima do Autopiloto/Copilot (HU17 C3). */
public interface GeocodingPort {
    Optional<Place> geocode(String city);

    record Place(String name, String country, double latitude, double longitude) {
    }
}
