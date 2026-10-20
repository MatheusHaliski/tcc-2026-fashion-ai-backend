const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const root=process.cwd();
const BASE=process.env.UI_AUDIT_BASE || 'http://localhost:3000';
const API=process.env.UI_AUDIT_API_BASE || 'http://localhost:8080';
const THEME=process.env.UI_AUDIT_THEME || 'LIGHT';
const ts=require('typescript-ast');
const fixtures={}; new Function('exports',ts.transpileModule(fs.readFileSync(root+'/test-utils/fixtures.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(fixtures);
const {PIECE,PIECE_2,SCHEME,page:pageData}=fixtures;
// Real public artwork makes fixture screenshots representative without downloading catalog images.
PIECE.imageUrl=PIECE.thumbnailUrl='/lab/cores/camiseta-branca.webp';
PIECE_2.imageUrl=PIECE_2.thumbnailUrl='/assets_pecas/02_Parte_inferior/01_jeans.png';
SCHEME.coverImageUrl=null;
const user={...PIECE.owner,avatarUrl:null};
const me={user,email:'test@example.invalid',emailVerified:true,status:'ACTIVE',role:'ADMIN',twoFactorEnabled:false};
const profile={user,layout:'PESSOAL',self:true,relation:'NENHUMA',visibility:'PUBLIC',contentVisible:true,counters:{followers:3,following:3,published:1,pieces:3,schemes:1}};
const tax={subcategories:{upper_piece:['t_shirt'],lower_piece:['jeans'],shoes_piece:['casual_sneakers'],accessory_piece:['cap']},colors:{white:'#ffffff',blue:'#1f4fa0'},materials:['COTTON'],sizes:['m'],sexes:['UNISSEX'],occasions:['casual','work'],styles:['basic'],allowedOccasionsByCategory:{upper_piece:['casual','work']},defaultImages:{}};
const out=process.env.UI_AUDIT_OUTPUT || '/tmp/fashionai-ux-audit';fs.mkdirSync(out,{recursive:true});
(async()=>{
 // All API writes and reads are intercepted; this audit never accesses production data.
 const browser=await chromium.launch({headless:true,executablePath:process.env.UI_AUDIT_CHROMIUM_PATH||undefined,args:['--no-sandbox']});const results=[];
 for(const [device,width,height] of [['mobile',390,844],['tablet',820,1180],['desktop',1440,900]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:device==='mobile',isMobile:device==='mobile'});
  await context.addCookies([{name:'fai_rt_h',value:'1',url:BASE}]);
  await context.addInitScript(()=>{localStorage.setItem('fai.guides.anon','{}');window.__cls=0;window.__clsSources=[];new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput){window.__cls+=e.value;window.__clsSources.push({value:e.value,sources:(e.sources||[]).map(s=>({tag:s.node?.tagName,id:s.node?.id,classes:s.node?.className,previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))});}}).observe({type:'layout-shift',buffered:true});});
  await context.route('**/bff/auth/refresh',r=>r.fulfill({json:{accessToken:'fixture-only'}}));
  await context.route(API+'/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;let body;
   if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':BASE,'access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   if(p==='/api/me')body=me;
   else if(p==='/api/me/preferences')body={theme:THEME,fontScale:100};
   else if(p==='/api/taxonomy')body=tax;
   else if(p==='/api/catalog/stores')body={stores:[{brandId:'b1',slug:'nike',name:'Nike',logoUrl:null,catalogProducts:21,categories:['upper_piece']},{brandId:'b2',slug:'adidas',name:'Adidas',logoUrl:null,catalogProducts:9,categories:['shoes_piece']},{brandId:'b3',slug:'armani',name:'Armani',logoUrl:null,catalogProducts:12,categories:['upper_piece']}]};
   else if(p==='/api/catalog/summary')body={products:42,brands:3};
   else if(p==='/api/catalog/brands')body={brands:[]};
   else if(p==='/api/me/guides')body={guides:{}};
   else if(p==='/api/schemes/builder')body={totalPieces:3,eligiblePieces:3,status:'OK',lists:{upper:[PIECE],lower:[PIECE_2]},defaultVisibility:'PRIVATE'};
   else if(p==='/api/feed')body={items:[SCHEME],nextCursor:null};
   else if(p==='/api/me/closet'||p==='/api/users/u1/closet')body=pageData([PIECE,PIECE_2]);
   else if(p.startsWith('/api/profiles/'))body=profile;
   else if(p==='/api/me/schemes'||p==='/api/users/u1/schemes')body=pageData([SCHEME]);
   else if(p==='/api/me/points')body={balance:120,lifetime:300,level:'ESTREIA',levels:[],rules:[]};
   else if(p==='/api/points/shop')body=[];
   else if(p==='/api/notifications')body={unread:0,items:[]};
   else if(p==='/api/notifications/unread-count')body={unread:0};
   else if(p==='/api/search')body={results:[],nextCursor:null};
   else return route.fulfill({status:404,json:{code:'FIXTURE_UNAVAILABLE',message:'Fixture unavailable'},headers:{'access-control-allow-origin':BASE}});
   return route.fulfill({json:body,headers:{'access-control-allow-origin':BASE}});
  });
  for(const path of (process.env.UI_AUDIT_PATHS || '/login,/register,/pieces/new,/schemes/new,/feed,/closet,/u/ana,/points,/design').split(',')){
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE+path,{waitUntil:'networkidle'});await page.waitForTimeout(400);
   if(await page.getByRole('dialog').count()){await page.keyboard.press('Escape');await page.waitForTimeout(200);}
   const measured=await page.evaluate(()=>{const nodes=[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));return {h1:document.querySelector('h1')?.textContent,titlePx:document.querySelector('h1')?getComputedStyle(document.querySelector('h1')).fontSize:null,overflow:document.documentElement.scrollWidth-innerWidth,smallText:nodes.filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).map(e=>({text:e.textContent.slice(0,60),size:getComputedStyle(e).fontSize})),cls:window.__cls,clsSources:window.__clsSources};});
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   const violations=axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
   await page.screenshot({path:out+'/'+device+'-'+path.replace(/\W+/g,'_')+'.png',fullPage:true});
   await page.screenshot({path:out+'/'+device+'-'+path.replace(/\W+/g,'_')+'-viewport.png'});
   results.push({device,path,...measured,errors,violations});await page.close();
  }
  await context.close();
 }
 await browser.close();
 if(results.some(r=>r.errors.length || r.overflow>0 || r.smallText.length || r.violations.length || r.cls>0.1))process.exitCode=1;fs.writeFileSync(out+'/audit.json',JSON.stringify({scope:'Production frontend with synthetic read-only API fixtures; not production backend or physical-device validation.',results},null,2));
 console.log(JSON.stringify(results.map(r=>({device:r.device,path:r.path,h1:r.h1,titlePx:r.titlePx,overflow:r.overflow,smallText:r.smallText.length,cls:r.cls,errors:r.errors.length,violations:r.violations.map(v=>v.id)})),null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
