#!/usr/bin/env python3
"""Search modern-fashion references with Bing RSS; verify bounded public pages and export a linked moodboard.
No account, API key or image generation required. Run from the repository root.
"""
from __future__ import annotations
import argparse, concurrent.futures, datetime, html, json, re, time
import urllib.request, urllib.parse, urllib.robotparser, xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

QUERIES = [
 ('Metamorfose','Prisma e matéria digital','Iris van Herpen sculptural fashion collection official', ['irisvanherpen.com'], 'Volumes orgânicos, transparência e luz nas bordas; preservar a foto da roupa.'),
 ('Metamorfose','Transformação pela luz','ANREALAGE photochromic UV fashion collection', ['anrealage.com','lvmh.com','vogue.com','dezeen.com'], 'Cor que surge gradualmente, como uma reação à luz.'),
 ('Metamorfose','Superfície programável','Adobe Project Primrose interactive dress', ['adobe.com','research.adobe.com'], 'Padrões em movimento por zonas, com versão estática para redução de movimento.'),
 ('Metamorfose','Moda digital','The Fabricant digital couture iridescent fashion', ['thefabricant.com'], 'Reflexos iridescentes e materiais digitais com acabamento editorial.'),
 ('Metamorfose','Biomimética','Auroboros biomimicry digital couture fashion', ['auroboros.co.uk','dezeen.com','vogue.com'], 'Estruturas que crescem como nervuras, cristais ou fibras.'),
 ('Metamorfose','Costura escultórica','Gaurav Gupta couture sculptural metallic official', ['gauravguptastudio.com'], 'Linhas de costura como contornos escultóricos e transições de metal.'),
 ('ATELIER','Museu habitável','Gentle Monster HAUS DOSAN installation official', ['gentlemonster.com','dezeen.com'], 'Objetos expositivos de escala clara, luz e circulação para o quarto.'),
 ('ATELIER','Vitrine e memória','Louis Vuitton Asnieres atelier trunks savoir faire', ['louisvuitton.com'], 'Vitrines, baús e módulos que exibem histórias e conquistas.'),
 ('ATELIER','Acervo e identidade','La Galerie Dior scenography miniature dresses', ['galeriedior.com','dior.com','dezeen.com'], 'Coleções organizadas por cor e narrativa, com leitura de museu.'),
 ('ATELIER','Autoria têxtil','LOEWE FOUNDATION Craft Prize textile woven sculpture', ['craftprize.loewe.com','loewe.com','loewefoundation.org'], 'Objetos conquistados com textura e autoria, além de medalhas genéricas.'),
 ('ATELIER','Construção e ofício','Bottega Veneta atelier craftsmanship intrecciato', ['bottegaveneta.com'], 'Tramas, madeira, couro e detalhes de construção nos troféus funcionais.'),
 ('ATELIER','Espaço de criação','HOMO FABER exhibition weaving fashion craftsmanship scenography', ['homofaber.com','michelangelofoundation.org','dezeen.com'], 'Mesas, luminárias e instalações coletivas com aparência de ateliê contemporâneo.'),
 ('Hype','Sinal luminoso','Mugler digital fashion campaign chrome futuristic', ['mugler.com','vogue.com','showstudio.com'], 'Cromado e luz direcional concentrados na moldura, sem esconder a peça.'),
 ('Hype','Moda e comunidade','Moncler Genius immersive art fashion show official', ['moncler.com','monclergroup.com'], 'Entradas visuais e celebrações associadas a conquistas reais.'),
 ('Hype','Performance e movimento','Nike ISPA experimental design official', ['nike.com','about.nike.com'], 'Linhas técnicas, sinalização e ritmo visual inspirados em performance.'),
 ('Hype','Moda jogável','Balenciaga Fortnite digital fashion official', ['balenciaga.com','fortnite.com','unrealengine.com'], 'Identidade de moda legível em cartas e interfaces de jogo.'),
 ('Hype','Exposição digital','SHOWstudio fashion film motion graphics', ['showstudio.com'], 'Enquadramentos de editorial e animação curta para mostrar a peça.'),
 ('Hype','Experiência espacial','adidas Moncler The Art of Explorers immersive official', ['adidas.com','news.adidas.com','moncler.com'], 'Ambientes e efeitos de conquista com estética de moda esportiva contemporânea.'),
]
UA='FashionAI-VisualReferenceResearch/1.0 (+https://fai-network.com)'

def fetch(url, limit=1_000_000):
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.5'})
 with urllib.request.urlopen(req,timeout=12) as r:
  body=r.read(limit+1)
  if len(body)>limit: body=body[:limit]
  return r.status,r.geturl(),r.headers.get('Content-Type',''),body

def search(spec):
 theme,direction,query,preferred,note=spec
 url='https://www.bing.com/search?'+urllib.parse.urlencode({'format':'rss','q':query,'setlang':'en-US'})
 result={'theme':theme,'direction':direction,'query':query,'design_application':note,'preferred_domains':preferred,'candidates':[]}
 try:
  _,_,_,body=fetch(url)
  root=ET.fromstring(body)
  for item in root.findall('./channel/item'):
   link=item.findtext('link','');host=(urllib.parse.urlsplit(link).hostname or '').lower()
   if not host or not link.startswith('https://'):continue
   official=any(host==d or host.endswith('.'+d) for d in preferred)
   result['candidates'].append({'title':item.findtext('title',''),'url':link,'domain':host,'preferred_source':official})
  result['candidates'].sort(key=lambda r:not r['preferred_source'])
 except Exception as e:result['search_error']=type(e).__name__
 return result

class Meta(HTMLParser):
 def __init__(self):super().__init__();self.metadata={};self.in_title=False;self.title=''
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='meta':self.metadata[a.get('property') or a.get('name') or '']=a.get('content','')
  if tag=='title':self.in_title=True
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
 def handle_data(self,data):
  if self.in_title:self.title+=data

def verify(result):
 # Search output is evidence of discovery; a blocked page remains marked as unverified.
 selected=result.get('curated_source') or next((r for r in result['candidates'] if r['preferred_source']),None)
 if selected is None:
  result['verification']='NO_PREFERRED_SOURCE_IN_SEARCH';return result
 result['selected']=selected
 try:
  parts=urllib.parse.urlsplit(selected['url']);origin=parts.scheme+'://'+parts.netloc
  robots=urllib.robotparser.RobotFileParser();status,_,_,raw=fetch(origin+'/robots.txt',250_000)
  robots.parse(raw.decode('utf-8',errors='replace').splitlines())
  if not robots.can_fetch(UA,selected['url']):result['verification']='ROBOTS_DISALLOWED';return result
  status,final,kind,body=fetch(selected['url'])
  result.update(verification='FETCHED',http_status=status,final_url=final)
  if 'html' in kind:
   parser=Meta();parser.feed(body.decode('utf-8',errors='replace'))
   result['page_title']=(parser.metadata.get('og:title') or parser.title).strip()[:220]
   image=parser.metadata.get('og:image') or parser.metadata.get('twitter:image')
   if image and image.startswith(('https://','/')):result['preview_url']=urllib.parse.urljoin(final,image)
 except Exception as e:
  result['verification']=type(e).__name__
  if getattr(e,'code',None):result['http_status']=e.code
 return result

def export(results,out):
 out.mkdir(parents=True,exist_ok=True)
 payload={'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'purpose':'Referências de arte de moda contemporânea; sugestões de aplicação são interpretações de design do FashionAI. Não são funcionalidades implementadas.','results':results}
 (out/'references.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 lines=['# Referências visuais — seis famílias AURA e ATELIER','',payload['purpose'],'','Pesquisa executada por Python com Bing RSS e fontes selecionadas após busca web e revisão de relevância. Links descobertos e páginas acessadas têm estados separados. Miniaturas são referências remotas das fontes, não assets incorporados ao app.','']
 sections=[]
 for theme in ['Metamorfose','ATELIER','Hype','Electro','AURA comum','Splash']:
  lines+=['## '+theme,''];cards=[]
  for result in [r for r in results if r['theme']==theme]:
   chosen=result.get('selected');lines+=['### '+result['direction'],'',result['design_application'],'']
   link=chosen
   if link:
    title=link['title'].replace('[','').replace(']','');lines+=[f"- [{title}]({link['url']})",f"- Verificação: `{result.get('verification','SEARCH_ONLY')}`.",'']
    pic=f'<img loading="lazy" referrerpolicy="no-referrer" src="{html.escape(result["preview_url"],quote=True)}" alt="Referência da fonte" onerror="this.hidden=true">' if result.get('preview_url') else ''
    cards.append(f'<article>{pic}<small>{html.escape(theme)}</small><h3>{html.escape(result["direction"])}</h3><p>{html.escape(result["design_application"])}</p><a href="{html.escape(link["url"],quote=True)}" target="_blank" rel="noopener noreferrer">{html.escape(link["title"])}</a><p class="state">{html.escape(result.get("verification","SEARCH_ONLY"))}</p></article>')
   else:lines+=['Nenhuma fonte encontrada nesta execução.','']
  sections.append(f'<section><h2>{theme}</h2><div class="grid">'+''.join(cards)+'</div></section>')
 (out/'README.md').write_text('\n'.join(lines),encoding='utf-8')
 markup='''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FashionAI · referências de arte</title><style>body{margin:0;background:#f4f1eb;color:#201e25;font:16px/1.55 system-ui}main{max-width:1250px;margin:auto;padding:36px}h1{font-size:clamp(30px,5vw,58px);line-height:1.1}h2{margin-top:48px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}article{padding:20px;border:1px solid #d7d1c8;border-radius:18px;background:#fff}img{width:100%;height:240px;object-fit:cover;border-radius:10px;background:#ebe7ef}a{color:#543286}small,.state{font-size:12px;text-transform:uppercase;letter-spacing:.08em}.state{color:#665e70}p{max-width:78ch}</style><main><p>FASHIONAI / DIREÇÃO DE ARTE</p><h1>Moda, transformação<br>e identidade jogável.</h1><p>Referências pesquisadas na internet para Metamorfose, ATELIER, Hype, Electro, AURA comum e Splash. Cada cartão liga à fonte. As aplicações propostas são interpretações para o FashionAI; as imagens não foram incorporadas ao produto.</p>'''+''.join(sections)+'</main></html>'
 (out/'moodboard.html').write_text(markup,encoding='utf-8')
 print(json.dumps({'queries':len(results),'candidates':sum(len(r['candidates']) for r in results),'selected':sum('selected' in r for r in results),'fetched':sum(r.get('verification')=='FETCHED' for r in results),'previews':sum('preview_url' in r for r in results),'output':str(out)},ensure_ascii=False))

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=Path('docs/design/referencias-aura'));parser.add_argument('--sources',type=Path,default=Path('docs/design/referencias-aura/sources.json'));args=parser.parse_args()
 curated=json.loads(args.sources.read_text(encoding='utf-8')) if args.sources.exists() else []
 specs=[(r['theme'],r['direction'],r['title']+' fashion design',[urllib.parse.urlsplit(r['url']).hostname],r['application']) for r in curated] if curated else QUERIES
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(search,specs))
 for result,source in zip(results,curated):
  result['curated_source']={'title':source['title'],'url':source['url'],'domain':urllib.parse.urlsplit(source['url']).hostname,'preferred_source':True,'discovered_via':'web search and manual relevance review'}
 # One bounded request chain per reference; sequential verification avoids overloading repeated sites.
 for index,result in enumerate(results,1):
  verify(result);print(f'[{index}/{len(results)}] {result["theme"]}: {result["direction"]} — {result.get("verification")}',flush=True)
 export(results,args.output)
if __name__=='__main__':main()
