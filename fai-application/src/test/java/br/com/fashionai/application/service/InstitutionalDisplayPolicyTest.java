package br.com.fashionai.application.service;

import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Política de exibição no perfil de marca/celebridade (RF14/RF22 × RF20/RF21/RF50): só aparece o que passou pela
 * política do selo (vínculo APPROVED), com destaque vigente, histórico de consagrados e privacidade do autor.
 */
class InstitutionalDisplayPolicyTest extends InstitutionalDisplayPolicyFixture {
    @Test
    void perfilAdicionaItensElegiveisSemInventarSelosConquistados() {
        Scheme look = look("Elegível", tenis);
        when(sealPolicies.hasProfilePolicies(brand.getId(), SealTier.LOOK)).thenReturn(true);
        when(sealPolicies.hasProfilePolicies(brand.getId(), SealTier.PECA)).thenReturn(true);
        when(sealPolicies.profileSchemes(eq(brand.getId()), any(), eq(60))).thenReturn(List.of(look));
        when(sealPolicies.profilePieces(eq(brand.getId()), any(), eq(60))).thenReturn(List.of(tenis));
        List<Map<String, Object>> looks = service.highlightedSchemes(visitor, brand, null, null);
        assertThat(ids(looks)).containsExactly(look.getId());
        assertThat(looks.get(0).get("seals")).isEqualTo(List.of());
        assertThat(service.highlightedPieces(visitor, brand, "RECENTES", null))
                .extracting(e -> ((Views.PieceView) e.get("piece")).id()).containsExactly(tenis.getId());
        assertThat(allBonds).isEmpty();
    }

    @Test
    void perfilComPoliticaAtivaFiltraDestaquesAntigosQueNaoAtendemMais() {
        Scheme old = look("Antigo", jeans); approved(old);
        when(sealPolicies.hasProfilePolicies(brand.getId(), SealTier.LOOK)).thenReturn(true);
        when(sealPolicies.hasProfilePolicies(brand.getId(), SealTier.PECA)).thenReturn(true);
        assertThat(service.highlightedSchemes(visitor, brand, null, null)).isEmpty();
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
    }

    @Test
    void politicaPerfilSoDePecasNaoApagaOsLooksEmDestaque() {
        Scheme premiado = look("Premiado", jeans); approved(premiado);
        when(sealPolicies.hasProfilePolicies(brand.getId(), SealTier.PECA)).thenReturn(true);   // só peças
        assertThat(ids(service.highlightedSchemes(visitor, brand, null, null))).containsExactly(premiado.getId());
        // e o contrário: política só de looks não apaga o selo que a peça ganhou direto
        direct(tenis, now.plus(10, ChronoUnit.DAYS));
        when(sealPolicies.hasProfilePolicies(brand.getId(), SealTier.PECA)).thenReturn(false);
        when(sealPolicies.hasProfilePolicies(brand.getId(), SealTier.LOOK)).thenReturn(true);
        assertThat(service.highlightedPieces(visitor, brand, null, null))
                .extracting(e -> ((Views.PieceView) e.get("piece")).id()).containsExactly(tenis.getId());
    }

    @Test
    void seloHypeDiretoNaPecaApareceNasPecasEmDestaqueEnquantoVigente() {
        SealBond hype = direct(tenis, now.plus(10, ChronoUnit.DAYS));
        List<Map<String, Object>> pieces = service.highlightedPieces(visitor, brand, null, null);
        assertThat(pieces).extracting(e -> ((Views.PieceView) e.get("piece")).id()).containsExactly(tenis.getId());
        assertThat(pieces.get(0)).containsEntry("schemeId", null);
        assertThat((List<?>) pieces.get(0).get("seals")).hasSize(1);
        assertThat(service.highlighted(visitor, brand, null, null).get("pieces")).asList().hasSize(1);
        assertThat(service.highlightedPieces(visitor, brand, null, java.util.UUID.randomUUID())).isEmpty();   // agrupamento é de look
        hype.setExpiresAt(now.minus(1, ChronoUnit.DAYS));
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
    }

    // ------------------------------------------------------------------ looks

    @Test
    void lookPromovidoPorPoliticaAceitaApareceEmDestaqueEConsagrados() {
        Scheme s = look("Clube", tenis, jeans);
        approved(s);
        assertThat(destaque(null)).containsExactly(s.getId());
        assertThat(destaque(visitor)).containsExactly(s.getId());
        assertThat(consagrados(visitor)).containsExactly(s.getId());
        Map<String, Object> e = service.highlightedSchemes(visitor, brand, null, null).get(0);
        assertThat(promotion(e)).containsEntry("expired", false).containsEntry("revalidationPending", false);
        assertThat(promotion(e).get("issuedAt")).isNotNull();
        assertThat((List<?>) e.get("seals")).hasSize(1);
    }

    @Test
    void vinculoQueNaoFoiAprovadoNuncaApareceNoPerfil() {
        for (SealBondStatus st : List.of(SealBondStatus.SUGGESTED, SealBondStatus.ACCEPTED, SealBondStatus.EDITED, SealBondStatus.PENDING_REVIEW,
                SealBondStatus.REFUSED, SealBondStatus.REJECTED, SealBondStatus.REVOKED)) {
            bond(look("Look " + st, tenis), st, SealTier.LOOK, null, null);
        }
        assertThat(destaque(visitor)).isEmpty();
        assertThat(consagrados(visitor)).isEmpty();
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
    }

    @Test
    void seloExpiradoSaiDoDestaqueMasFicaNoHistoricoDeConsagrados() {
        Scheme s = look("Verão passado", tenis);
        bond(s, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(400, ChronoUnit.DAYS), now.minus(1, ChronoUnit.DAYS));
        assertThat(destaque(visitor)).isEmpty();
        assertThat(service.highlightedPieces(visitor, brand, null, null)).isEmpty();
        List<Map<String, Object>> hall = service.consecrated(visitor, brand, null, null, false);
        assertThat(ids(hall)).containsExactly(s.getId());
        assertThat(promotion(hall.get(0))).containsEntry("expired", true);
    }

    @Test
    void lookComUmVinculoExpiradoEOutroVigenteApareceUmaVezComOVigente() {
        Scheme s = look("Renovado", tenis);
        bond(s, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(400, ChronoUnit.DAYS), now.minus(10, ChronoUnit.DAYS));
        SealBond vigente = approved(s);
        List<Map<String, Object>> list = service.highlightedSchemes(visitor, brand, null, null);
        assertThat(ids(list)).containsExactly(s.getId());
        assertThat((List<?>) list.get(0).get("seals")).hasSize(1);
        assertThat(promotion(list.get(0)).get("expiresAt")).isEqualTo(vigente.getExpiresAt());
    }

    @Test
    void revalidacaoPendenteTiraDoDestaqueEMarcaNosConsagrados() {
        Scheme s = look("Editado", tenis, jeans);
        approved(s);
        s.setRevalidationPending(true);
        assertThat(destaque(visitor)).isEmpty();
        List<Map<String, Object>> hall = service.consecrated(visitor, brand, null, null, false);
        assertThat(ids(hall)).containsExactly(s.getId());
        assertThat(promotion(hall.get(0))).containsEntry("revalidationPending", true).containsEntry("expired", false);
    }

    @Test
    void lookPrivadoRascunhoOuArquivadoNaoAparece() {
        Scheme privado = look("Privado", tenis);
        privado.setVisibility(Visibility.PRIVATE);
        Scheme rascunho = look("Rascunho", tenis);
        rascunho.setStatus(SchemeStatus.DRAFT);
        Scheme arquivado = look("Arquivado", tenis);
        arquivado.setStatus(SchemeStatus.ARCHIVED);
        approved(privado);
        approved(rascunho);
        approved(arquivado);
        assertThat(destaque(visitor)).isEmpty();
        assertThat(consagrados(visitor)).isEmpty();
    }

    @Test
    void perfilPrivadoDoAutorEscondeOLookPublico() {
        Scheme s = look("Público em perfil privado", tenis);
        approved(s);
        ana.setProfileVisibility(Visibility.PRIVATE);
        assertThat(destaque(visitor)).isEmpty();
        assertThat(destaque(null)).isEmpty();
    }

    @Test
    void lookSoParaSeguidoresApareceSoParaQuemSegue() {
        Scheme s = look("Seguidores", tenis);
        s.setVisibility(Visibility.FOLLOWERS);
        approved(s);
        assertThat(destaque(null)).isEmpty();
        assertThat(destaque(visitor)).isEmpty();
        Follow f = new Follow();
        f.setStatus(FollowStatus.ACEITO);
        when(follows.findByFollowerIdAndFollowingId(visitor.id(), ana.getId())).thenReturn(Optional.of(f));
        assertThat(destaque(visitor)).containsExactly(s.getId());
    }

    @Test
    void bloqueioEntreVisitanteEAutorEscondeOLook() {
        Scheme s = look("Bloqueado", tenis);
        approved(s);
        Follow block = new Follow();
        block.setStatus(FollowStatus.BLOQUEADO);
        when(follows.findByFollowerIdAndFollowingId(ana.getId(), visitor.id())).thenReturn(Optional.of(block));
        assertThat(destaque(visitor)).isEmpty();
        assertThat(destaque(null)).containsExactly(s.getId());
    }

    @Test
    void autorSuspensoOuEmExclusaoSomeDoPerfil() {
        Scheme s = look("Autor suspenso", tenis);
        approved(s);
        ana.setStatus(AccountStatus.SUSPENDED);
        assertThat(destaque(visitor)).isEmpty();
        ana.setStatus(AccountStatus.DELETION_SCHEDULED);
        assertThat(consagrados(visitor)).isEmpty();
        ana.setStatus(AccountStatus.ACTIVE);
        assertThat(destaque(visitor)).containsExactly(s.getId());
    }

    @Test
    void destaqueOrdenaPeloHypeV2EDepoisPelaEmissaoMaisRecente() {
        Scheme frio = look("Frio", tenis);
        Scheme quente = look("Quente", jeans);
        Scheme semScoreNovo = look("Sem score, novo", camiseta);
        Scheme semScoreAntigo = look("Sem score, antigo", camiseta);
        bond(frio, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(1, ChronoUnit.DAYS), null);
        bond(quente, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(9, ChronoUnit.DAYS), null);
        bond(semScoreNovo, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(2, ChronoUnit.DAYS), null);
        bond(semScoreAntigo, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(20, ChronoUnit.DAYS), null);
        hype(frio, 31);
        hype(quente, 88);
        assertThat(destaque(visitor)).containsExactly(quente.getId(), frio.getId(), semScoreNovo.getId(), semScoreAntigo.getId());
        // consagrados: histórico pela emissão mais recente
        assertThat(consagrados(visitor)).containsExactly(frio.getId(), semScoreNovo.getId(), quente.getId(), semScoreAntigo.getId());
    }

    @Test
    void filtroDestaquesUsaOHypeV2ESoLooksComScore() {
        Scheme a = look("A", tenis);
        Scheme b = look("B", jeans);
        Scheme c = look("C", camiseta);
        approved(a);
        approved(b);
        approved(c);
        hype(a, 40);
        hype(b, 75);
        HypeScoreCurrent insuficiente = new HypeScoreCurrent();
        insuficiente.setStatus(HypeStatus.INSUFFICIENT_DATA);
        hypeRows.put(c.getId(), insuficiente);
        assertThat(ids(service.highlightedSchemes(visitor, brand, "DESTAQUES", null))).containsExactly(b.getId(), a.getId());
    }

    @Test
    void hypeQueNaoEhPublicoNaoOrdenaODestaqueDeTerceiros() {
        Scheme seguidores = look("Só seguidores (Hype pessoal)", tenis);
        Scheme publico = look("Público", jeans);
        bond(seguidores, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(1, ChronoUnit.DAYS), null);
        bond(publico, SealBondStatus.APPROVED, SealTier.LOOK, now.minus(5, ChronoUnit.DAYS), null);
        hype(seguidores, 95).setPublicEligible(false);
        hype(publico, 40);
        assertThat(destaque(visitor)).containsExactly(publico.getId(), seguidores.getId());   // o 95 pessoal não conta: vai para o fim
        assertThat(ids(service.highlightedSchemes(visitor, brand, "DESTAQUES", null))).containsExactly(publico.getId());
    }
}
