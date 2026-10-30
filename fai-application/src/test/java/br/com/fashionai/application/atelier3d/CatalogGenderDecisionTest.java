package br.com.fashionai.application.atelier3d;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class CatalogGenderDecisionTest {
 CatalogProductRepository products=mock(CatalogProductRepository.class);TipoLookRepository tipos=mock(TipoLookRepository.class);CatalogGenderDecision service=new CatalogGenderDecision(products,tipos);
 UUID product(String gender){var p=new CatalogProduct();p.assignId(UUID.randomUUID());p.setProductName("Peça");p.setGender(gender);when(products.findById(p.getId())).thenReturn(Optional.of(p));return p.getId();}
 @BeforeEach void setup(){when(tipos.findAllByOrderByNomeAsc()).thenReturn(List.of());}
 @Test void compatibleUnisexItemsDoNotOverrideSpecificMerchandisingGender(){var e=service.evidence(List.of(product("UNISSEX"),product("FEMININO")));assertThat(e.suggestion()).isEqualTo("FEMININO");assertThat(e.status()).isEqualTo("READY");}
 @Test void missingAndConflictingValuesNeverBecomeUnisex(){assertThat(service.evidence(List.of(product(null))).suggestion()).isNull();assertThat(service.evidence(List.of()).status()).isEqualTo("INCOMPLETE");var e=service.evidence(List.of(product("MASCULINO"),product("FEMININO")));assertThat(e.status()).isEqualTo("CONFLICT");assertThat(e.suggestion()).isNull();}
 @Test void creatorMustConfirmARealTipoLookAgainstCurrentEvidence(){var option=new TipoLook();option.assignId(UUID.randomUUID());option.setCodigo("feminino");option.setNome("Feminino");when(tipos.findAllByOrderByNomeAsc()).thenReturn(List.of(option));var id=product("MASCULINO");var e=service.evidence(List.of(id));assertThatCode(()->service.confirm(e,null,null)).doesNotThrowAnyException();assertThatCode(()->service.confirm(e,option.getId(),e.hash())).doesNotThrowAnyException();assertThatThrownBy(()->service.confirm(e,UUID.randomUUID(),e.hash())).isInstanceOf(ApiException.class);assertThatThrownBy(()->service.confirm(e,option.getId(),"old")).isInstanceOf(ApiException.class);verify(products,never()).save(any());}
}
