package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.enums.ConsentPurpose;

import java.util.LinkedHashMap;
import java.util.Map;

/** Tabela das finalidades de consentimento (LGPD): título, descrição, base legal e artigo de cada controle. */
final class AccountConsentPurposes {
    private AccountConsentPurposes() {
    }

    /** Finalidades, base legal e artigo exibidos em cada controle da seção Privacidade (artefato #6). */
    static final Map<ConsentPurpose, String[]> PURPOSES = new LinkedHashMap<>();

    static {
        PURPOSES.put(ConsentPurpose.AI_RECOMMENDATION, new String[]{Msg.k("account.recomendacoes_por_ia"),
                Msg.k("account.enviar_metadados_do_seu_acervo"),
                "Consentimento", Msg.k("account.art_7_i")});
        PURPOSES.put(ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, new String[]{Msg.k("account.processamento_de_fotos_por_terceiros"),
                Msg.k("account.enviar_fotos_das_pecas_a"),
                "Consentimento", Msg.k("account.art_7_i")});
        PURPOSES.put(ConsentPurpose.HISTORY_FOR_RECOMMENDATION, new String[]{Msg.k("account.historico_para_personalizacao"),
                Msg.k("account.usar_seu_historico_de_interacoes"), "Consentimento", Msg.k("account.art_7_i")});
        PURPOSES.put(ConsentPurpose.PERSONALIZED_ADS, new String[]{Msg.k("account.anuncios_personalizados"),
                Msg.k("account.mostrar_promocoes_de_marcas_conforme"), "Consentimento", Msg.k("account.art_7_i")});
        PURPOSES.put(ConsentPurpose.PARTNER_SHARING, new String[]{Msg.k("account.compartilhamento_com_parceiros"),
                Msg.k("account.compartilhar_dados_agregados_com_marcas"), "Consentimento", Msg.k("account.art_7_i")});
        PURPOSES.put(ConsentPurpose.BODY_MEASUREMENTS, new String[]{Msg.k("account.medidas_corporais_dado_sensivel"),
                Msg.k("account.usar_porte_e_tom_de"), Msg.k("account.consentimento_especifico_e_destacado"),
                Msg.k("account.art_11_i")});
        PURPOSES.put(ConsentPurpose.FACIAL_RECOGNITION, new String[]{Msg.k("account.reconhecimento_facial_dado_sensivel"),
                Msg.k("account.nao_utilizado_pelo_fashion_ai"), Msg.k("account.consentimento_especifico_e_destacado"), Msg.k("account.art_11_i")});
        PURPOSES.put(ConsentPurpose.LOCATION_HISTORY, new String[]{Msg.k("account.localizacao_para_clima"),
                Msg.k("account.usar_sua_localizacao_aproximada_para"), "Consentimento", Msg.k("account.art_7_i")});
        PURPOSES.put(ConsentPurpose.AI_MODEL_TRAINING, new String[]{Msg.k("account.treino_dos_modelos_de_visao"),
                Msg.k("account.usar_fotos_e_correcoes_das_pecas"), "Consentimento", Msg.k("account.art_7_i")});
    }
}
