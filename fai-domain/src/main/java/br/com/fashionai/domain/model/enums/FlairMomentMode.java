package br.com.fashionai.domain.model.enums;

/** Modos de FLAIR dentro de um Momento (§30). COOPERATIVE não tem vencedor: a meta é do grupo (§31). */
public enum FlairMomentMode {
    BATTLE,
    TOURNAMENT,
    GROUP_CHALLENGE,
    COOPERATIVE,
    MOMENT,
    TEAM_VS_TEAM,
    LOOK_LEAGUE;

    public boolean competitive() {
        return this != COOPERATIVE && this != MOMENT;
    }
}
