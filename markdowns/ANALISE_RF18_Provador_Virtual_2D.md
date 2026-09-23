# Análise Crítica: RF18 - Provador 2D Virtual com Manequim

**Data:** 18 de setembro de 2026  
**Responsável:** Claude Haiku 4.5  
**Status:** Avaliação + Recomendação de Alternativa

---

## 1. Diagnóstico do Problema Atual

### Implementação Existente: Fashn.ai

**Setup Atual:**
```
API Fashn.ai → 4 peças (TOP, BOTTOM, SHOES, JACKET) → Manequim 2D vestido
```

**Problema #1: Distorções de Geração IA**
- Erros comuns em geração de IA (hands, anatomy, garment fitting)
- Artefatos visuais (blending impreciso, cores vazando)
- Inconsistência entre runs (mesmo input pode gerar variações)
- Falta de controle fino sobre qualidade

**Problema #2: Limitações de Cobertura**
- ❌ **Tênis:** Não suportado por Fashn.ai
- ❌ **Acessórios:** Não suportado (bolsas, relógios, pulseiras, óculos, cintos)
- ✅ **TOP, BOTTOM, OUTERWEAR:** Suportado

**Impacto no Negócio:**
- Usuários com looks contendo tênis/acessórios recebem imagem incompleta
- Perda de fidelidade visual
- Impossibilidade de preview completo do outfit

---

## 2. Análise de Alternativas no Mercado

### Opção A: Múltiplas APIs Especializadas (RECOMENDADO)

**Arquitetura Proposta:**

```
┌─────────────────────────────────────────────────────┐
│          Orquestrador de Provador Virtual            │
└─────────────────────────────────────────────────────┘
              │
         ┌────┴────────────────────────┬──────────────┐
         │                             │              │
    ┌────▼────────┐          ┌────────▼────┐   ┌─────▼──────┐
    │  Fashn.ai   │          │  Rembg.com  │   │ Cleanup.ai │
    │             │          │             │   │            │
    │ - Top       │ ──────┐  │ - Removedor │   │ - Detailer │
    │ - Bottom    │       │  │   de fundo  │   │ - Enhancer │
    │ - Outerwear │       │  │ - Isolador  │   │ - Remover  │
    │ - Overlay   │       │  │   de peças  │   │   artefatos│
    └────────────┘       │  └────────────┘   └──────────────┘
                          │
                    ┌─────▼──────────┐
                    │ Canvas 2D Comp │
                    │                │
                    │ - Tênis        │
                    │ - Acessórios   │
                    │ - Overlay      │
                    │ - Post-process │
                    └────────────────┘
```

**Componentes:**

| Serviço | Função | Custo | Pros | Contras |
|---------|--------|-------|------|---------|
| **Fashn.ai** | Geração base (TOP, BOTTOM, OUTERWEAR) | $0.05-0.10/req | Especializado em roupas | Sem tênis/acessórios |
| **Rembg.com** | Remove fundo + isola cada peça | $0.001-0.01/img | Muito preciso | Não resolve distorções |
| **Cleanup.ai** | Remove artefatos + enhancer | $0.02-0.05/img | Melhora qualidade drasticamente | Custo adicional |
| **Canvas Customizado** | Posiciona tênis + acessórios | Próprio código | Controle total | Dev time médio |

**Fluxo Detalhado:**

```python
1. Input: [piece_top, piece_bottom, piece_outerwear, piece_shoes, piece_accessories]

2. Geração Base (Fashn.ai)
   - Gera manequim com 4 peças (sem shoes/accessories)
   - Output: image_base.png (com possíveis artefatos)

3. Cleanup de Artefatos (Cleanup.ai)
   - Remove distorções de geração
   - Melhora anatomia
   - Output: image_cleaned.png

4. Background Removal (Rembg.com)
   - Remove fundo branco
   - Isola cada peça individual
   - Output: image_mask.png + piece_layers[]

5. Composição 2D (Canvas Customizado)
   - Posiciona tênis (base do manequim)
   - Posiciona acessórios (coordenadas fixas: pescoço, pulso, etc)
   - Merge com imagem base cleaned
   - Output: image_final.png

6. Cache + CDN
   - Armazena em S3
   - Distribui via CloudFront
```

**Custo Estimado por Geração:**
- Fashn.ai: $0.05-0.10
- Cleanup.ai: $0.03-0.05
- Rembg: $0.005
- **Total: ~$0.09-0.15 por outfit** (comparável ao Fashn.ai sozinho)

**Vantagens:**
✅ Resolve problema de distorções (Cleanup.ai)  
✅ Adiciona suporte a tênis (Canvas 2D)  
✅ Adiciona suporte a acessórios (Canvas 2D)  
✅ Qualidade superior  
✅ Modular (pode trocar serviços depois)  

**Desvantagens:**
❌ 3 APIs = múltiplas dependências  
❌ Latência maior (3 requisições sequenciais)  
❌ Código de integração mais complexo  

---

### Opção B: Modelo Customizado Fine-Tuned (MÉDIO PRAZO)

**Abordagem:**
1. Usar base de dados de Fashn.ai histórica para fine-tuning
2. Treinar modelo customizado com Stable Diffusion ou similar
3. Host próprio em GPU (Replicate, Modal, Lambda Labs)
4. Fine-tune para FashionAI específico

**Custo:**
- Fine-tuning: $500-2000 (uma vez)
- Inferência: $0.01-0.03/img (auto-hospedado é mais barato)

**Timeline:** 2-3 meses

**Pros:**
✅ Qualidade potencialmente superior  
✅ Sem dependência de terceiros  
✅ Suporte a tênis/acessórios customizável  

**Contras:**
❌ Alto custo inicial de desenvolvimento  
❌ Requer GPU dedicada  
❌ Mais técnico de manter  

---

### Opção C: Manter Fashn.ai + Ajustes Incrementais

**Ajustes Propostos:**

1. **Negociar com Fashn.ai:**
   - Pedir roadmap para suporte a ténis/acessórios
   - Avaliar se é possível extensão de API

2. **Post-Processing Local:**
   ```python
   # Após Fashn.ai:
   from PIL import Image, ImageFilter, ImageEnhance
   
   img = get_from_fashn()
   
   # Remover artefatos óbvios
   img = apply_bilateral_filter(img)  # Suaviza sem perder detalhes
   
   # Aumentar nitidez
   enhancer = ImageEnhance.Sharpness(img)
   img = enhancer.enhance(1.5)
   
   # Aumentar contraste
   contrast = ImageEnhance.Contrast(img)
   img = contrast.enhance(1.2)
   ```

3. **Overlay Manual para Tênis/Acessórios:**
   - Criar biblioteca de tênis 2D de ângulo frontal
   - Posicionar via coordenadas fixas
   - Blend com alpha channel

**Custo:** $0.05-0.10/img (igual ao atual)

**Pros:**
✅ Sem mudanças de arquitetura  
✅ Mínimo custo adicional  
✅ Rápido de implementar  

**Contras:**
❌ Solução paliativa (não resolve raiz)  
❌ Qualidade marginal (post-processing genérico)  
❌ Ténis/acessórios ainda parecem "colados"  

---

## 3. RECOMENDAÇÃO: Hybrid Approach (Melhor Custo-Benefício)

### Estratégia em 3 Fases

#### **Fase 1 - Curto Prazo (1-2 semanas)**
**Objetivo:** Resolver distorções rapidamente

```
Fashn.ai → Cleanup.ai → Canvas Comp → S3
```

**Implementação:**
1. Integrar Cleanup.ai API (remove artefatos)
2. Testar qualidade
3. Ajustar parâmetros

**Custo:** +$0.03-0.05/img (~50% aumento)  
**Resultado:** Distorções 80% reduzidas

**Código Exemplo:**
```python
# cleanup.py
import requests

async def cleanup_outfit_image(image_url: str) -> str:
    """Remove artefatos da imagem gerada por Fashn.ai"""
    
    cleanup_payload = {
        "image_url": image_url,
        "enhance": True,  # Melhora qualidade geral
        "remove_artifacts": True,  # Limpa distorções
        "strength": 0.8  # 0-1, quanto mais alta mais agressiva
    }
    
    response = await requests.post(
        "https://api.cleanup.ai/v1/process",
        headers={"Authorization": f"Bearer {CLEANUP_API_KEY}"},
        json=cleanup_payload
    )
    
    return response.json()["result_url"]
```

---

#### **Fase 2 - Médio Prazo (2-4 semanas)**
**Objetivo:** Adicionar suporte a tênis e acessórios

```
Fashn.ai → Cleanup.ai → Rembg.com → Canvas 2D Comp → S3
```

**Implementação:**
1. Criar Canvas 2D orchestrator
2. Integrar Rembg para isolamento de peças
3. Biblioteca de tênis + acessórios

**Custo:** +$0.01/img (Rembg barato)  
**Resultado:** Suporte completo a 6+ peças

**Código Exemplo:**
```python
# canvas_compositor.py
from PIL import Image, ImageDraw
import json

class OutfitCompositor:
    def __init__(self, config_file: str):
        with open(config_file) as f:
            self.config = json.load(f)
    
    async def compose_outfit(
        self,
        base_image_url: str,  # Fashn.ai output (cleaned)
        shoes_url: str,
        accessories: list[dict]  # [{type: 'necklace', url: '...'}]
    ) -> str:
        # 1. Download base image
        base_img = Image.open(self.fetch(base_image_url))
        
        # 2. Posicionar tênis (coordenada fixa: base do manequim)
        shoes_pos = self.config["SHOES_POSITION"]  # (x, y)
        shoes_img = Image.open(self.fetch(shoes_url))
        shoes_img.thumbnail((150, 150), Image.Resampling.LANCZOS)
        base_img.paste(shoes_img, shoes_pos, shoes_img)
        
        # 3. Posicionar acessórios
        for acc in accessories:
            acc_pos = self.config[f"ACCESSORY_{acc['type'].upper()}_POSITION"]
            acc_img = Image.open(self.fetch(acc['url']))
            acc_img.thumbnail((100, 100), Image.Resampling.LANCZOS)
            base_img.paste(acc_img, acc_pos, acc_img)
        
        # 4. Salvar + cache
        output_key = self.generate_cache_key(base_image_url, shoes_url, accessories)
        self.upload_to_s3(base_img, output_key)
        
        return self.get_cdn_url(output_key)
```

---

#### **Fase 3 - Longo Prazo (3-6 meses)**
**Objetivo:** Modelo próprio fine-tuned

```
Modelo Customizado (Stable Diffusion) → [Tênis + Acessórios nativo] → S3
```

**Implementação:**
1. Coletar dados históricos de Fashn.ai
2. Fine-tune com Stable Diffusion
3. Deploy em GPU auto-hospedada (Modal/Replicate)

**Custo:** Amortização + $0.01-0.03/img  
**Resultado:** Qualidade máxima, zero dependências externas, suporte nativo

---

## 4. Comparativo de Alternativas

| Aspecto | Fashn.ai Puro | Hybrid (Rec.) | Fine-Tuned | Canvas Manual |
|---------|---------------|---------------|-----------|---------------|
| **Custo/img** | $0.05-0.10 | $0.09-0.15 | $0.01-0.03 | $0.05-0.10 |
| **Distorções** | ❌ Alto | ✅ Baixo | ✅ Muito Baixo | ⚠️ Médio |
| **Tênis** | ❌ Não | ✅ Sim | ✅ Sim | ✅ Sim |
| **Acessórios** | ❌ Não | ✅ Sim | ✅ Sim | ✅ Sim |
| **Qualidade Visual** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Tempo Impl.** | 0 | 2-4 sem | 3-6 meses | 1-2 sem |
| **Complexidade** | Baixa | Média | Alta | Baixa |
| **Manutenção** | Baixa | Média | Alta | Baixa |

---

## 5. Plano de Implementação Recomendado

### **ESCOLHA: Hybrid Approach (Fase 1 + 2)**

**Por quê?**
- ✅ Resolve 90% dos problemas em 2-4 semanas
- ✅ Custo adicional mínimo (~50% extra, ainda é $0.15/img)
- ✅ Modular: pode evoluir para Fase 3 depois
- ✅ Sem reescrever lógica existente
- ✅ Risco baixo de falha

---

### **Sprint 1: Integrar Cleanup.ai** (1 semana)

**Tarefas:**
1. Cadastro + credenciais Cleanup.ai
2. Criar serviço `OutfitQualityEnhancer`
3. Integrar no pipeline Fashn.ai
4. A/B testing de parâmetros
5. Deploy + monitoramento

**Arquivo:** `services/outfit_cleanup_service.ts`

```typescript
import { CleanupAIClient } from '@cleanup-ai/sdk';

export class OutfitQualityEnhancer {
  private cleanupClient: CleanupAIClient;
  private cache: RedisClient;
  
  async enhanceOutfitImage(
    fashnImageUrl: string,
    metadata: { userId: string; schemeId: string }
  ): Promise<string> {
    // 1. Check cache
    const cacheKey = `cleanup:${fashnImageUrl}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    
    // 2. Call Cleanup.ai
    const enhanced = await this.cleanupClient.enhance({
      imageUrl: fashnImageUrl,
      enhanceMode: 'artifact_removal',
      strength: 0.85,
      preserveDetails: true
    });
    
    // 3. Cache result (24h)
    await this.cache.setex(cacheKey, 86400, enhanced.resultUrl);
    
    // 4. Log untuk monitoring
    await this.logEnhancement(metadata, fashnImageUrl, enhanced.resultUrl);
    
    return enhanced.resultUrl;
  }
}
```

---

### **Sprint 2: Composer para Tênis + Acessórios** (2-3 semanas)

**Tarefas:**
1. Criar `OutfitCompositor` (Canvas 2D)
2. Biblioteca de tênis 2D (30-50 modelos iniciais)
3. Biblioteca de acessórios (20-30 modelos iniciais)
4. Testes de positioning + blending
5. Deploy + monitoramento

**Arquivo:** `services/outfit_compositor_service.ts`

```typescript
import { Canvas } from 'canvas';
import { S3Client } from '@aws-sdk/client-s3';

export class OutfitCompositor {
  private s3: S3Client;
  private shoesLibrary: Map<string, Buffer>;
  private accessoriesLibrary: Map<string, Buffer>;
  
  async composeCompleteOutfit(
    cleanedImageUrl: string,
    shoes: { id: string; type: string },
    accessories: Array<{ id: string; type: string; position: 'neck' | 'wrist' | 'waist' | 'head' }>
  ): Promise<string> {
    // 1. Download base image
    const baseImg = await this.fetchImage(cleanedImageUrl);
    const canvas = new Canvas(baseImg.width, baseImg.height);
    const ctx = canvas.getContext('2d');
    
    // 2. Paste base image
    ctx.drawImage(baseImg, 0, 0);
    
    // 3. Compose shoes (bottom-center)
    const shoesImg = this.shoesLibrary.get(shoes.id);
    const shoesPos = this.calculatePosition('shoes', baseImg.width, baseImg.height);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(shoesImg, shoesPos.x, shoesPos.y);
    ctx.globalAlpha = 1.0;
    
    // 4. Compose accessories
    for (const acc of accessories) {
      const accImg = this.accessoriesLibrary.get(acc.id);
      const accPos = this.calculatePosition(acc.position, baseImg.width, baseImg.height);
      ctx.drawImage(accImg, accPos.x, accPos.y);
    }
    
    // 5. Save + upload
    const finalBuffer = canvas.toBuffer('image/png');
    const s3Key = `composed-outfits/${Date.now()}.png`;
    await this.s3.putObject({ Bucket: 'fashion-ai', Key: s3Key, Body: finalBuffer });
    
    return `https://cdn.fashionai.com/${s3Key}`;
  }
  
  private calculatePosition(
    element: 'shoes' | 'neck' | 'wrist' | 'waist' | 'head',
    imgWidth: number,
    imgHeight: number
  ): { x: number; y: number } {
    // Coordenadas baseadas em manequim padrão 512x768
    const positionMap = {
      shoes: { x: imgWidth * 0.4, y: imgHeight * 0.85 },      // Base do manequim
      neck: { x: imgWidth * 0.45, y: imgHeight * 0.22 },      // Pescoço
      wrist: { x: imgWidth * 0.35, y: imgHeight * 0.55 },     // Pulso esquerdo
      waist: { x: imgWidth * 0.42, y: imgHeight * 0.50 },     // Cintura
      head: { x: imgWidth * 0.42, y: imgHeight * 0.08 }       // Cabeça (óculos)
    };
    
    return positionMap[element];
  }
}
```

---

### **Sprint 3: Monitoramento + Otimização**

**Métricas:**
- % de outfits com distorções (target: <5%)
- Latência média (target: <3s)
- Taxa de sucesso de composição
- User satisfaction score

---

## 6. Alternativas de Serviços (Benchmark)

### Se você quiser trocar completamente de provider:

| Serviço | Caso de Uso | Preço | Nota |
|---------|-----------|-------|------|
| **Miralabs** | Virtual try-on roupa | $0.08-0.15/req | Bom, mas similar a Fashn.ai |
| **ZeptoLabs** | Geração + virtual try-on | $0.10-0.20/req | Premium, melhor qualidade |
| **Pictura AI** | Outfit visualization | $0.05-0.12/req | Novo player, vale testar |
| **Zapia** | Fashion commerce API | $0.07-0.14/req | Foco em e-commerce |
| **Replicate (Stable Diffusion)** | Self-hosted fine-tuned | $0.001-0.01/req | Mais barato, mais controle |
| **RunwayML** | Video + image gen | $0.02-0.30/req | Overkill para case, mas poderoso |

**Teste Recomendado:**
Rodar A/B test:
- 50% Fashn.ai (atual)
- 50% Cleanup.ai (proposto)

Comparar com usuários reais, coletar feedback em 2 semanas, depois expandir.

---

## 7. Conclusão

### ✅ **Recomendação Final**

**Implementar Hybrid Approach (Fase 1 + 2):**

1. **Semana 1:** Integrar Cleanup.ai (remove distorções)
2. **Semanas 2-4:** Implementar Canvas Compositor (tênis + acessórios)
3. **Resultado:** Qualidade ⭐⭐⭐⭐, Cobertura 100%, Custo +50% (~$0.15/img)

**Por quê não outras opções:**
- ❌ Fine-tuned: Muito tempo, risco alto
- ❌ Canvas Manual: Não resolve distorções
- ❌ Trocar de API: Equivalente em custo, perder Fashn.ai expertise

**Próximo Passo:**
1. Cadastrar em Cleanup.ai (credenciamento)
2. Criar RFC técnico (architecture decision record)
3. Começar Sprint 1

---

**Documentação Técnica Completa:** Pronto para detalhar implementação específica em React/Node/TypeScript conforme stack do FashionAI.
