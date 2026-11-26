package br.com.fashionai.application.seal;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;

import static br.com.fashionai.application.seal.SealPolicyBrandReference.CATALOG;
import static br.com.fashionai.application.seal.SealPolicyBrandReference.PROFILE;

/**
 * Exercício 13 — confere no banco a marca referenciada por uma regra da política ({@code brandReference}).
 * A política fica em JSON ({@code seals.background_config_json}), então não há FK no MySQL: quem garante que o ID
 * existe é esta classe, ao salvar. Na leitura, a referência cuja marca sumiu é devolvida com
 * {@code disponivel = false} em vez de ser tratada como válida.
 */
public final class SealPolicyBrandResolver {
    private final Supplier<BrandRepository> brands;
    private final BrandProfileRepository profiles;

    public SealPolicyBrandResolver(Supplier<BrandRepository> brands, BrandProfileRepository profiles) {
        this.brands = brands;
        this.profiles = profiles;
    }

    /** Opções para a tela: marcas do catálogo ou perfis de marca aprovados, filtrados pelo trecho do nome. */
    public List<ReferenceOptionView> options(String kind, String q) {
        String wanted = SealPolicyBrandReference.kind(kind == null || kind.isBlank() ? CATALOG : kind);
        if (wanted == null) {
            throw ApiException.badRequest("MARCA_POLITICA_INVALIDA", Msg.t("sealPolicy.marca_tipo_invalido"));
        }
        String term = q == null ? "" : q.trim();
        if (PROFILE.equals(wanted)) {
            return profiles.findTop50ByApprovalStatusAndBrandNameContainingIgnoreCaseOrderByBrandNameAsc(ApprovalStatus.APROVADO, term)
                    .stream().map(p -> new ReferenceOptionView(p.getId(), p.getSlug(), p.getBrandName())).toList();
        }
        return brands.get().findTop50ByNameContainingIgnoreCaseOrderByNameAsc(term)
                .stream().map(b -> new ReferenceOptionView(b.getId(), b.getSlug(), b.getName())).toList();
    }

    /**
     * Antes de gravar: cada {@code brandReference} das regras precisa existir na tabela do seu {@code kind}. O nome
     * gravado é o do banco. ID inexistente, ou de outra tabela, volta 400. A referência que já estava gravada no selo
     * ({@code previous}) e cuja marca sumiu continua aceita com o nome que tinha: editar outro campo do selo (pausar,
     * por exemplo) não pode travar por causa dela. Escolher uma marca que não existe é sempre recusado.
     */
    public void resolve(Map<String, Object> policy, Object previous) {
        List<SealPolicyBrandReference> saved = previous instanceof Map<?, ?> old
                ? references(SealViews.castMap(old)).stream().map(SealPolicyBrandReference::parse).filter(java.util.Objects::nonNull).toList()
                : List.of();
        for (Map<String, Object> reference : references(policy)) {
            SealPolicyBrandReference parsed = SealPolicyBrandReference.parse(reference);
            String nome = parsed == null ? null : name(parsed.kind(), parsed.id()).orElseGet(() -> saved.stream()
                    .filter(s -> s.kind().equals(parsed.kind()) && s.id().equals(parsed.id())).map(SealPolicyBrandReference::label).findFirst().orElse(null));
            if (nome == null) {
                throw ApiException.badRequest("MARCA_POLITICA_INVALIDA", Msg.t("sealPolicy.marca_referencia_inexistente"));
            }
            reference.put("nome", nome);
        }
    }

    /**
     * Na leitura: devolve uma cópia da política com o nome atual de cada marca referenciada e {@code disponivel}.
     * Marca que não existe mais fica com o nome gravado e {@code disponivel = false}.
     */
    public Object refresh(Object policy) {
        if (!(policy instanceof Map<?, ?> stored) || !(stored.get("rules") instanceof Collection<?> rules)) {
            return policy;
        }
        Map<String, Object> out = new LinkedHashMap<>(SealViews.castMap(stored));
        out.put("rules", rules.stream().map(this::refreshRule).toList());
        return out;
    }

    private Object refreshRule(Object rule) {
        if (!(rule instanceof Map<?, ?> r)) {
            return rule;
        }
        SealPolicyBrandReference parsed = SealPolicyBrandReference.parse(r.get("brandReference"));
        if (parsed == null) {
            return rule;
        }
        Optional<String> current = name(parsed.kind(), parsed.id());
        Map<String, Object> reference = new LinkedHashMap<>();
        reference.put("kind", parsed.kind());
        reference.put("id", parsed.id().toString());
        reference.put("nome", current.orElse(parsed.nome()));
        reference.put("disponivel", current.isPresent());
        Map<String, Object> copy = new LinkedHashMap<>(SealViews.castMap(r));
        copy.put("brandReference", reference);
        return copy;
    }

    private Optional<String> name(String kind, UUID id) {
        if (PROFILE.equals(kind)) {
            return profiles.findById(id).map(p -> p.getBrandName());
        }
        BrandRepository catalog = brands.get();
        return catalog == null ? Optional.empty() : catalog.findById(id).map(b -> b.getName());
    }

    private static List<Map<String, Object>> references(Map<String, Object> policy) {
        if (policy == null || !(policy.get("rules") instanceof Collection<?> rules)) {
            return List.of();
        }
        return rules.stream().filter(Map.class::isInstance).map(r -> ((Map<?, ?>) r).get("brandReference"))
                .filter(Map.class::isInstance).map(r -> SealViews.castMap((Map<?, ?>) r)).toList();
    }
}
