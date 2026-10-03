package br.com.fashionai.domain.model.enums;

/** RF4 · Active learning — candidato a dataset: aprovado pelo admin, exportado, recusado ou revogado (consentimento retirado). */
public enum TrainingCandidateStatus {
    CANDIDATE,
    APPROVED,
    EXPORTED,
    REJECTED,
    REVOKED
}
