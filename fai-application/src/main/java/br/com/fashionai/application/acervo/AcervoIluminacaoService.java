package br.com.fashionai.application.acervo;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.acervo.AcervoAmbiente;
import br.com.fashionai.domain.repository.acervo.AcervoAmbienteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * ACERVO — luz do ambiente (exercício 07): só o dono muda (o ambiente é achado por id E dono em {@link AcervoAcesso}; o
 * corpo nunca traz usuário), com as mesmas permissões das outras mudanças do acervo. Devolve a luz confirmada, que a
 * tela relê no GET do acervo antes de redesenhar a cena.
 */
@Service
@Transactional
public class AcervoIluminacaoService {
    /** {@code limparTipo}/{@code limparTemperatura}: pedido explícito de apagar; campo nulo sem o pedido mantém o atual. */
    public record LuzForm(UUID tipoIluminacaoId, Integer temperaturaKelvin, Boolean limparTipo, Boolean limparTemperatura) { }

    private final AcervoAcesso acesso;
    private final AcervoAmbienteRepository ambientes;
    private final AcervoLightingWriter writer;

    public AcervoIluminacaoService(AcervoAcesso acesso, AcervoAmbienteRepository ambientes, AcervoLightingWriter writer) {
        this.acesso = acesso;
        this.ambientes = ambientes;
        this.writer = writer;
    }

    public Map<String, Object> iluminar(CurrentUser user, UUID ambienteId, LuzForm form) {
        AcervoAmbiente a = acesso.ambiente(user, ambienteId);
        writer.apply(a, form.tipoIluminacaoId(), Boolean.TRUE.equals(form.limparTipo()), form.temperaturaKelvin(),
                Boolean.TRUE.equals(form.limparTemperatura()));
        ambientes.save(a);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", a.getId());
        out.put("iluminacao", AcervoLightingWriter.view(a));
        return out;
    }
}
