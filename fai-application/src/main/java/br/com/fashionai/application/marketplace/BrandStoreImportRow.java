package br.com.fashionai.application.marketplace;

public record BrandStoreImportRow(String externalId, String name, String address,
                                  String city, String region, String country) {}
