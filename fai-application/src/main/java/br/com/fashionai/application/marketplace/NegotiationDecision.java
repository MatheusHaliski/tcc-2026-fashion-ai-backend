package br.com.fashionai.application.marketplace;

public record NegotiationDecision(long version, boolean accept, boolean reject, boolean archiveOnExpiry) {}
