package br.com.fashionai.application.service;
import br.com.fashionai.application.catalog.image.CatalogImagePipelineService;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.ports.AnatomicalTryOnPort;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.application.security.*;
import org.springframework.stereotype.Service;
import java.util.*;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
@Service
public class AnatomicalTryOnService {
 private final AnatomicalTryOnPort worker;private final WardrobeService wardrobe;private final TryOnService legacy;private final MediaService media;private final Guard guard;
 private final CatalogProductRepository products;private final CatalogImageRepository catalogImages;
 public AnatomicalTryOnService(AnatomicalTryOnPort worker,WardrobeService wardrobe,TryOnService legacy,MediaService media,Guard guard,
                               CatalogProductRepository products,CatalogImageRepository catalogImages){
  this.worker=worker;this.wardrobe=wardrobe;this.legacy=legacy;this.media=media;this.guard=guard;this.products=products;this.catalogImages=catalogImages;
 }
 public record PersonRequest(String personMediaUrl,boolean processingConsent){}
 public Map<String,Object> probe(CurrentUser user,PersonRequest request){
  guard.requireCanCreate(user);
  if(request==null||!request.processingConsent())throw ApiException.badRequest("VTON_CONSENT_REQUIRED","Confirme o processamento da sua fotografia.");
  var owned=media.requireOwnedMedia(user.id(),request.personMediaUrl(),Set.of(MediaService.MediaScope.OWNER,MediaService.MediaScope.PRIVATE_TRY_ON),"personMediaUrl");
  if(!worker.available())throw new ApiException(503,"VTON_NOT_CONFIGURED","Worker anatômico não configurado.");
  byte[] person=media.read(owned.url()).orElseThrow(()->ApiException.notFound("Foto"));
  if(person.length==0||person.length>6_000_000)throw ApiException.badRequest("VTON_IMAGE_LIMIT","Use uma fotografia de até 6 MB.");
  return worker.probePerson(person);
 }
 public record Request(UUID pieceId,String personMediaUrl,Map<String,Object> bodyEvidence,boolean mirror,boolean processingConsent){}
 public Map<String,Object> render(CurrentUser user,Request request){
  guard.requireCanCreate(user);
  if(request==null||request.pieceId()==null||!request.processingConsent())throw ApiException.badRequest("VTON_CONSENT_REQUIRED","Escolha sua peça e confirme o processamento da sua fotografia.");
  var piece=wardrobe.owned(user,request.pieceId());
  return dress(user,"piece:"+piece.getId(),()->legacy.imageBytes(piece),piece.getCategory(),request.personMediaUrl(),request.bodyEvidence(),request.mirror());
 }
 /** Peça de loja do catálogo na foto da pessoa: só com a foto de produto liberada para a GPU (sem pessoa, com autorização). */
 public Map<String,Object> renderCatalog(CurrentUser user,UUID productId,String personMediaUrl){
  guard.requireCanCreate(user);
  var product=products.findById(productId).orElseThrow(()->ApiException.notFound("Produto"));
  var image=catalogImages.findByProductIdInAndCanonicalTrue(List.of(productId)).stream().filter(CatalogImagePipelineService::vtonGarment).findFirst()
          .orElseThrow(()->new ApiException(422,"VTON_CATALOG_IMAGE_UNAVAILABLE","Esta peça da loja ainda não tem foto de produto liberada para a prova com IA."));
  return dress(user,"catalog:"+productId,()->media.read(image.getStoredUrl()).orElseThrow(()->new ApiException(422,"VTON_CATALOG_IMAGE_UNAVAILABLE",
          "Esta peça da loja ainda não tem foto de produto liberada para a prova com IA.")),product.getCategory(),personMediaUrl,null,false);
 }
 private Map<String,Object> dress(CurrentUser user,String garmentId,java.util.function.Supplier<byte[]> garmentBytes,String category,String personMediaUrl,
                                  Map<String,Object> bodyEvidence,boolean mirror){
  var owned=media.requireOwnedMedia(user.id(),personMediaUrl,Set.of(MediaService.MediaScope.OWNER,MediaService.MediaScope.PRIVATE_TRY_ON),"personMediaUrl");
  if(!worker.available())throw new ApiException(503,"VTON_NOT_CONFIGURED","Worker anatômico não configurado. A prova 3D convencional continua disponível.");
  byte[] garment=garmentBytes.get();byte[] person=media.read(owned.url()).orElseThrow(()->ApiException.notFound("Foto"));
  if(garment==null||garment.length==0||garment.length>6_000_000||person.length>6_000_000)throw ApiException.badRequest("VTON_IMAGE_LIMIT","Use imagens de até 6 MB e 1536 px.");
  if(bodyEvidence!=null&&Json.write(bodyEvidence).length()>25_000_000)throw ApiException.badRequest("VTON_EVIDENCE_LIMIT","Máscaras anatômicas excederam o limite.");
  var result=worker.render(garmentId,garment,person,category,bodyEvidence,mirror);
  if(!"READY".equals(result.get("status")))return result;
  Object encoded=result.get("image_png");if(!(encoded instanceof String value)||value.length()>8_000_000)throw new ApiException(502,"VTON_INVALID_IMAGE","Imagem inválida retornada pelo worker.");
  byte[] png;try{png=Base64.getDecoder().decode((String)encoded);}catch(Exception e){throw new ApiException(502,"VTON_INVALID_IMAGE","Imagem inválida retornada pelo worker.");}
  validateOutput(png);
  var saved=media.put("users/"+user.id()+"/tryon/anatomical-"+UUID.randomUUID()+".png",png,"image/png");
  return Map.of("status","READY","url",saved.url(),"diagnostics",result.getOrDefault("diagnostics",Map.of()),"physicalFitCertified",false);
 }
 /**
  * Look inteiro na GPU (Meu Quarto e Provador): peça inteira, parte de baixo e parte de cima, nesta ordem. Aceita peças do
  * guarda-roupa ({@code pieceIds}) e peças das lojas do catálogo ({@code productIds}); com os dois no mesmo tipo, vale a
  * do guarda-roupa.
  */
 public record LookRequest(List<UUID> pieceIds,List<UUID> productIds,String personMediaUrl,boolean processingConsent){
  public LookRequest(List<UUID> pieceIds,String personMediaUrl,boolean processingConsent){this(pieceIds,null,personMediaUrl,processingConsent);}
 }
 private record LookItem(String source,UUID id){}
 private static final List<String> LOOK_ORDER=List.of("full_body_piece","lower_piece","upper_piece");
 /**
  * Veste o look na foto da pessoa, uma peça por vez: cada etapa usa a imagem da etapa anterior como pessoa (a parte de
  * cima por último cai sobre a cintura). Calçados e acessórios o modelo não veste: voltam em {@code skipped}. Uma
  * peça por tipo (a primeira da lista); a foto original nunca é trocada.
  */
 public Map<String,Object> renderLook(CurrentUser user,LookRequest request){
  guard.requireCanCreate(user);
  List<UUID> pieceIds=request==null||request.pieceIds()==null?List.of():request.pieceIds();
  List<UUID> productIds=request==null||request.productIds()==null?List.of():request.productIds();
  if(request==null||pieceIds.isEmpty()&&productIds.isEmpty()||!request.processingConsent())throw ApiException.badRequest("VTON_CONSENT_REQUIRED","Escolha as peças e confirme o processamento da sua fotografia.");
  if(pieceIds.size()+productIds.size()>8)throw ApiException.badRequest("VTON_LOOK_LIMIT","Um look tem no máximo 8 peças.");
  Map<String,LookItem> byCategory=new LinkedHashMap<>();List<String> skipped=new ArrayList<>();
  for(UUID id:new LinkedHashSet<>(pieceIds)){
   if(id==null)continue;
   var piece=wardrobe.owned(user,id);String category=piece.getCategory()==null?"":piece.getCategory();
   if(LOOK_ORDER.contains(category))byCategory.putIfAbsent(category,new LookItem("wardrobe",id));else skipped.add(id.toString());
  }
  for(UUID id:new LinkedHashSet<>(productIds)){
   if(id==null)continue;
   var product=products.findById(id).orElseThrow(()->ApiException.notFound("Produto"));String category=product.getCategory()==null?"":product.getCategory();
   if(LOOK_ORDER.contains(category))byCategory.putIfAbsent(category,new LookItem("catalog",id));else skipped.add(id.toString());
  }
  if(byCategory.isEmpty())throw new ApiException(422,"VTON_LOOK_WITHOUT_GARMENT","A prova com IA veste parte de cima, de baixo ou peça inteira; calçados e acessórios ficam de fora.");
  String person=request.personMediaUrl();Map<String,Object> last=Map.of();List<Map<String,Object>> steps=new ArrayList<>();
  for(String category:LOOK_ORDER){
   LookItem item=byCategory.get(category);if(item==null)continue;
   last="catalog".equals(item.source())?renderCatalog(user,item.id(),person):render(user,new Request(item.id(),person,null,false,true));
   if(!"READY".equals(last.get("status")))return Map.of("status",String.valueOf(last.get("status")),"steps",steps,"skipped",skipped,"failedPieceId",item.id().toString());
   person=String.valueOf(last.get("url"));
   steps.add(Map.of("pieceId",item.id().toString(),"source",item.source(),"category",category,"url",person));
  }
  return Map.of("status","READY","url",person,"steps",steps,"skipped",skipped,"diagnostics",last.getOrDefault("diagnostics",Map.of()),"physicalFitCertified",false);
 }
 private static void validateOutput(byte[] bytes) {
  byte[] signature={(byte)137,80,78,71,13,10,26,10};
  if(bytes.length<signature.length||!Arrays.equals(Arrays.copyOf(bytes,8),signature))throw invalidOutput();
  try(var input=new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))){
   var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw invalidOutput();
   var reader=readers.next();
   try{
    reader.setInput(input,true,true);
    int width=reader.getWidth(0),height=reader.getHeight(0);
    if(!"png".equalsIgnoreCase(reader.getFormatName())||width<16||height<16||width>1536||height>1536)throw invalidOutput();
    if(reader.read(0)==null)throw invalidOutput();
   }finally{reader.dispose();}
  }catch(ApiException error){throw error;}
  catch(Exception error){throw invalidOutput();}
 }
 private static ApiException invalidOutput(){return new ApiException(502,"VTON_INVALID_IMAGE","O worker deve retornar um PNG válido de até 1536 px.");}
}
