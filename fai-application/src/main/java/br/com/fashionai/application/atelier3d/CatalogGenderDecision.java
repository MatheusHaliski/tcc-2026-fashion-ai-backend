package br.com.fashionai.application.atelier3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.repository.*;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Catalog gender is merchandising evidence, never a declaration of the creator's identity. */
@Service
public class CatalogGenderDecision {
    public record Source(UUID id,String name,String gender,String normalized) {}
    public record Option(UUID id,String codigo,String nome) {}
    public record Evidence(List<Source> sources,String status,String suggestion,String hash,List<Option> options) {}
    private final CatalogProductRepository products;private final TipoLookRepository tipos;
    public CatalogGenderDecision(CatalogProductRepository products,TipoLookRepository tipos){this.products=products;this.tipos=tipos;}
    public Evidence evidence(List<UUID> ids){
        if(ids==null)ids=List.of();if(ids.size()>40)throw ApiException.badRequest("ATELIER_SOURCE_LIMIT","Selecione até 40 produtos.");
        var sources=ids.stream().distinct().sorted().map(id->{var p=products.findById(id).orElseThrow(()->ApiException.notFound("Produto"));return new Source(id,p.getProductName(),p.getGender(),normalize(p.getGender()));}).toList();
        var known=new HashSet<String>();boolean unknown=false;for(var s:sources){if(s.normalized()==null)unknown=true;else known.add(s.normalized());}
        String status="READY",suggestion=null;
        if(known.contains("MASCULINO")&&known.contains("FEMININO"))status="CONFLICT";
        else if(sources.isEmpty()||unknown)status="INCOMPLETE";
        else suggestion=known.contains("MASCULINO")?"MASCULINO":known.contains("FEMININO")?"FEMININO":"UNISEX";
        String value=sources.stream().map(s->s.id()+":"+String.valueOf(s.gender())).reduce("CATALOG_GENDER_V1",(a,b)->a+"|"+b);
        return new Evidence(sources,status,suggestion,hash(value),tipos.findAllByOrderByNomeAsc().stream().map(t->new Option(t.getId(),t.getCodigo(),t.getNome())).toList());
    }
    public void confirm(Evidence evidence,UUID tipoId,String hash){
        if(tipoId==null)return;
        if(!Objects.equals(evidence.hash(),hash))throw ApiException.conflict("ATELIER_GENDER_CHANGED","Os dados do catálogo mudaram. Revise e confirme novamente o TipoLook.");
        if(evidence.options().stream().noneMatch(t->t.id().equals(tipoId)))throw ApiException.badRequest("ATELIER_TIPO_LOOK_INVALID","Selecione um TipoLook cadastrado.");
    }
    public static String normalize(String raw){
        if(raw==null)return null;
        return switch(raw.trim().toUpperCase(Locale.ROOT)){
            case "MASCULINO","MALE","MEN","MASCULINE"->"MASCULINO";
            case "FEMININO","FEMALE","WOMEN","FEMININE"->"FEMININO";
            case "UNISEX","UNISSEX"->"UNISEX";
            default->null;
        };
    }
    static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
