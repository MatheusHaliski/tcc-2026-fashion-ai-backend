package br.com.fashionai.application.service;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
/** Issuer licenses use the same wallet lock and ledger as the existing FAI Points store. */
@Service
public class AuraCommerceService {
 private final AuraArtOfferRepository offers;
 private final AuraIssuerLicenseRepository licenses;
 private final FaiPointsLedgerEntryRepository ledger;
 private final Guard guard;
 public AuraCommerceService(AuraArtOfferRepository offers,AuraIssuerLicenseRepository licenses,FaiPointsLedgerEntryRepository ledger,Guard guard){this.offers=offers;this.licenses=licenses;this.ledger=ledger;this.guard=guard;}
 public record OfferForm(String code,String name,String family,Integer pricePoints,Boolean active,Map<String,Object> config){}
 @Transactional(readOnly=true) public List<Map<String,Object>> catalog(){return offers.findByActiveTrueOrderByPricePointsAsc().stream().map(this::view).toList();}
 @Transactional(readOnly=true) public List<Map<String,Object>> adminCatalog(CurrentUser user){guard.requireAdmin(user);return offers.findAll().stream().map(this::view).toList();}
 @Transactional public Map<String,Object> save(CurrentUser user,OfferForm form){
  guard.requireAdmin(user);
  if(form==null||form.code()==null||!form.code().matches("[A-Z0-9_]{1,80}")||form.name()==null||form.name().isBlank()||form.name().length()>160||form.pricePoints()==null||form.pricePoints()<0||form.pricePoints()>1000000)throw ApiException.badRequest("AURA_OFFER_INVALID","Oferta AURA inválida.");
  if(form.family()==null||!List.of("HYPE","METAMORPHOSE").contains(form.family())||form.config()==null)throw ApiException.badRequest("AURA_OFFER_INVALID","Informe família e configuração da arte.");
  BackgroundStudioService.validateArtwork(form.config());
  Object mode=form.config().get("auraMetamorphose"),hype=form.config().get("auraHype");
  if("METAMORPHOSE".equals(form.family())&&(mode==null||"OFF".equals(mode))||"HYPE".equals(form.family())&&(hype==null||"OFF".equals(hype)))throw ApiException.badRequest("AURA_OFFER_INVALID","Informe um modo ativo da família escolhida.");
  AuraArtOffer offer=offers.lockByCode(form.code()).orElseGet(AuraArtOffer::new);
  // Cards guardam a config da arte e a reedição compara campo a campo: depois da venda a config fica congelada (nova versão = novo código).
  if(offer.getCode()!=null&&!Json.map(offer.getConfigJson()).equals(form.config())&&licenses.existsByPresetCode(form.code()))
   throw new ApiException(409,"AURA_OFFER_LOCKED",Msg.t("auraCommerce.offerLocked"));
  offer.setCode(form.code());offer.setName(form.name().trim());offer.setFamily(form.family());offer.setPricePoints(form.pricePoints());offer.setActive(Boolean.TRUE.equals(form.active()));offer.setConfigJson(Json.write(form.config()));offers.save(offer);return view(offer);
 }
 @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED) public Map<String,Object> purchase(CurrentUser user,String code){
  guard.requireApprovedInstitutional(user,"aura-store:purchase","Somente marcas e celebridades aprovadas podem comprar licença de arte AURA.");
  ledger.lockOwner(user.id()).orElseThrow(()->ApiException.notFound("Usuário"));
  AuraArtOffer offer=offers.lockByCode(code).orElseThrow(()->ApiException.notFound("Preset"));
  Optional<AuraIssuerLicense> existing=licenses.findByOwnerIdAndPresetCode(user.id(),code);
  if(existing.isPresent())return licenseView(existing.get());
  if(!offer.isActive())throw ApiException.badRequest("AURA_UNAVAILABLE","Este preset não está à venda.");
  if(ledger.balance(user.id())<offer.getPricePoints())throw new ApiException(409,"SALDO_INSUFICIENTE","Saldo de FAI Points insuficiente.");
  if(offer.getPricePoints()>0){FaiPointsLedgerEntry entry=new FaiPointsLedgerEntry();entry.setUserId(user.id());entry.setDelta(-offer.getPricePoints());entry.setActionCode("AURA_LICENSE_PURCHASE");entry.setRefType("AURA_PRESET");entry.setRefId(code);entry.setIdempotencyKey(user.id()+":AURA_LICENSE:"+code);entry.setCountsLifetime(false);ledger.save(entry);}
  AuraIssuerLicense license=new AuraIssuerLicense();license.setOwnerId(user.id());license.setPresetCode(code);license.setPricePaid(offer.getPricePoints());license.setPurchasedAt(Instant.now());licenses.save(license);return licenseView(license);
 }
 @Transactional(readOnly=true) public List<Map<String,Object>> mine(CurrentUser user){guard.requireCanCreate(user);return licenses.findByOwnerIdOrderByPurchasedAtDesc(user.id()).stream().map(this::licenseView).toList();}
 private Map<String,Object> view(AuraArtOffer offer){return Map.of("code",offer.getCode(),"name",offer.getName(),"family",offer.getFamily(),"pricePoints",offer.getPricePoints(),"active",offer.isActive(),"config",Json.map(offer.getConfigJson()));}
 private Map<String,Object> licenseView(AuraIssuerLicense license){Map<String,Object> out=new LinkedHashMap<>();out.put("id",license.getId());out.put("presetCode",license.getPresetCode());out.put("pricePaid",license.getPricePaid());out.put("purchasedAt",license.getPurchasedAt());out.put("kind","ISSUER_LICENSE");offers.findById(license.getPresetCode()).ifPresent(o->out.put("preset",view(o)));return out;}
}
