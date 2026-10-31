package br.com.fashionai.application.atelier3d;

import br.com.fashionai.application.common.ApiException;
import tools.jackson.databind.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Bounded GLB container inspection. Never fetches an asset URI or executes content. */
public final class GlbInspector {
    public static final int MAX_BYTES=8*1024*1024;
    private static final Set<String> EXTENSIONS=Set.of("KHR_materials_unlit","KHR_texture_transform","KHR_materials_clearcoat","KHR_materials_transmission","KHR_materials_ior","KHR_materials_sheen","KHR_materials_specular","KHR_materials_volume","KHR_materials_iridescence","KHR_materials_anisotropy");
    public record Inspection(int nodes,int meshes,int materials,long vertices,boolean skinned,boolean morphs,boolean animated,Map<String,Integer> primitives,List<String> extensions) {}
    public static Inspection inspect(byte[] bytes,ObjectMapper mapper) {
        if(bytes==null||bytes.length<20||bytes.length>MAX_BYTES)throw invalid("GLB deve ter até 8 MiB.");
        var b=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        if(b.getInt()!=0x46546c67||b.getInt()!=2||b.getInt()!=bytes.length)throw invalid("Contêiner GLB 2.0 inválido.");
        JsonNode root=null;int binSize=0,binStart=0,chunks=0;
        while(b.remaining()>0){
            if(b.remaining()<8)throw invalid("Chunk GLB incompleto.");
            int size=b.getInt(),type=b.getInt();
            if(size<0||size>b.remaining()||size%4!=0)throw invalid("Comprimento de chunk inválido.");
            byte[] value=new byte[size];b.get(value);
            if(type==0x4e4f534a&&chunks==0&&size<=2*1024*1024){
                try{root=mapper.readTree(new String(value,StandardCharsets.UTF_8).trim());}catch(Exception e){throw invalid("JSON do GLB inválido.");}
            }else if(type==0x004e4942&&chunks==1){binSize=size;binStart=b.position()-size;}else throw invalid("Chunks GLB não suportados.");
            chunks++;
        }
        if(root==null||root.path("scenes").size()!=1||!"2.0".equals(root.path("asset").path("version").asText()))throw invalid("Versão glTF não suportada.");
        var extensions=new ArrayList<String>();
        for(String field:List.of("extensionsUsed","extensionsRequired"))for(var ext:root.path(field)){
            if(!EXTENSIONS.contains(ext.asText()))throw invalid("Extensão não editável nesta versão: "+ext.asText());
            if(!extensions.contains(ext.asText()))extensions.add(ext.asText());
        }
        var allNodes=root.path("nodes");int totalNodes=allNodes.size();int[] parents=new int[totalNodes];
        for(var n:allNodes)for(var child:n.path("children")){
            int c=child.asInt(-1);if(c<0||c>=totalNodes||++parents[c]>1)throw invalid("Hierarquia de objetos inválida.");
        }
        var queue=new ArrayDeque<Integer>();for(int i=0;i<totalNodes;i++)if(parents[i]==0)queue.add(i);
        int visited=0;while(!queue.isEmpty()){int id=queue.remove();visited++;for(var child:allNodes.get(id).path("children"))if(--parents[child.asInt()]==0)queue.add(child.asInt());}
        if(visited!=totalNodes)throw invalid("Hierarquia de objetos cíclica.");
        if(root.path("buffers").size()!=1||root.path("buffers").get(0).has("uri")||(root.path("buffers").get(0).path("byteLength").asLong(-1)<0||root.path("buffers").get(0).path("byteLength").asLong(-1)>binSize))throw invalid("Use buffers incorporados ao GLB.");
        for(var image:root.path("images"))if(image.has("uri")||!image.has("bufferView"))throw invalid("Use imagens incorporadas ao GLB.");
        for(var view:root.path("bufferViews")){
            long start=view.path("byteOffset").asLong(0),length=view.path("byteLength").asLong(-1);
            if(view.path("buffer").asInt(-1)!=0||start<0||length<0||start+length>binSize)throw invalid("Buffer view fora dos limites.");
        }
        long pixels=0;
        for(var image:root.path("images")){
            int index=image.path("bufferView").asInt(-1);if(index<0||index>=root.path("bufferViews").size())throw invalid("Imagem sem buffer view válido.");
            String mime=image.path("mimeType").asText();if(!Set.of("image/png","image/jpeg").contains(mime))throw invalid("Use texturas PNG ou JPEG incorporadas.");
            var view=root.path("bufferViews").get(index);int offset=view.path("byteOffset").asInt(0),size=view.path("byteLength").asInt();
            try(var stream=javax.imageio.ImageIO.createImageInputStream(new java.io.ByteArrayInputStream(bytes,binStart+offset,size))){
                var readers=javax.imageio.ImageIO.getImageReaders(stream);if(!readers.hasNext())throw invalid("Textura inválida.");var reader=readers.next();
                try{reader.setInput(stream);int width=reader.getWidth(0),height=reader.getHeight(0);pixels+=(long)width*height;
                    if(width<1||height<1||width>4096||height>4096||pixels>32_000_000)throw invalid("Limite de texturas: 4096 px por lado e 32 milhões de pixels no total.");
                }finally{reader.dispose();}
            }catch(ApiException e){throw e;}catch(Exception e){throw invalid("Não foi possível inspecionar a textura.");}
        }
        for(var accessor:root.path("accessors")){
            long count=accessor.path("count").asLong(-1);if(count<1||count>500_000)throw invalid("Accessor excede o limite de elementos.");
        }
        int nodes=root.path("nodes").size(),meshes=root.path("meshes").size(),materials=root.path("materials").size();
        if(nodes>2000||meshes>2000)throw invalid("Este arquivo excede o limite de objetos do editor.");
        var counts=new LinkedHashMap<String,Integer>();long vertices=0;boolean skinned=false,morphs=false;
        for(int n=0;n<nodes;n++){
            var node=root.path("nodes").get(n);skinned|=node.has("skin");
            if(node.has("mesh")){
                int m=node.path("mesh").asInt(-1);if(m<0||m>=meshes)throw invalid("Referência de malha inválida.");
                var parts=root.path("meshes").get(m).path("primitives");
                for(int p=0;p<parts.size();p++){
                    var primitive=parts.get(p);if(primitive.path("mode").asInt(4)!=4)throw invalid("Use malhas trianguladas.");int a=primitive.path("attributes").path("POSITION").asInt(-1);
                    if(a<0||a>=root.path("accessors").size())throw invalid("Malha sem accessor de posição válido.");
                    var accessor=root.path("accessors").get(a);int count=accessor.path("count").asInt(-1);
                    if(count<1||!"VEC3".equals(accessor.path("type").asText())||accessor.path("componentType").asInt()!=5126)throw invalid("Posições de vértice incompatíveis.");
                    counts.put("n"+n+".p"+p,count);vertices+=count;morphs|=primitive.path("targets").size()>0;
                    if(vertices>500_000)throw invalid("Este arquivo excede o limite de vértices do editor.");
                }
            }
        }
        if(counts.isEmpty())throw invalid("O GLB não contém malhas editáveis.");
        return new Inspection(nodes,meshes,materials,vertices,skinned,morphs,root.path("animations").size()>0,counts,List.copyOf(extensions));
    }
    static ApiException invalid(String message){return ApiException.badRequest("ATELIER_GLB_INVALID",message);}
}
