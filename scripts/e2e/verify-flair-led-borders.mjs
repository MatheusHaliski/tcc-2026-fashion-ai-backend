import { fixtures } from './cards/fixtures.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT??'playwright');
import {mkdirSync,writeFileSync,mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const output=process.argv[2];
if(!output||!process.env.FAI_TEST_PHOTO)throw new Error('Uso: FAI_TEST_PHOTO=/foto.jpg BASE=http://localhost:3102 node scripts/e2e/verify-flair-led-borders.mjs pasta-saida');
mkdirSync(output,{recursive:true});
const media=mkdtempSync(join(tmpdir(),'fai-flair-led-'));
copyFileSync(process.env.FAI_TEST_PHOTO,join(media,'columbia.jpg'));
writeFileSync(join(media,'report.json'),JSON.stringify({tee_camiseta_vermelha_the_best_plan:{}}));
const base=process.env.BASE??'http://localhost:3102';
let liveScore=84, metamorphose='PRISMA';
const tiers=['BRONZE','PRATA','OURO'];
const cards=tiers.map((tier,i)=>({id:`f${i}`,originType:'PIECE',originId:'p1',season:'SPRING',tier,ovr:[62,74,88][i],rare:false,position:'SUP',name:'Camisa Columbia',brandName:'Columbia',imageUrl:'/media/fx/columbia.jpg',hype:{POP:64,RAR:51,ENG:76,LON:43,TRD:83,NOV:59,ORI:71,HYP:72},stats:{EDGE:68,RANGE:72,CLOUT:75,GLOW:80,ART:64,SYNC:70},priceVerified:true,state:'AVAILABLE',tradeable:true,acquiredVia:'GENERATED'}));
const fx=fixtures({MEDIA:media});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
try {
 const {page,ctx,errors}=await fx.context(browser,'owner',{width:1440,height:1050},{pieces:ps=>ps.map(p=>({...p,name:'Camisa Columbia',brandName:'Columbia',subcategory:'shirt',color:'black',colorHex:'#111111',studioFeedUrl:null,studioThumbUrl:null,studioImageUrl:null,thumbnailUrl:'/media/fx/columbia.jpg',imageUrl:'/media/fx/columbia.jpg',background:{auraHype:'SCANNER'},model3dStatus:null,model3dUrl:null})),api:(route,url,request,context)=>{
  if(url.pathname==='/api/pieces/p1') context.pieces[0].background.auraMetamorphose=metamorphose;
  if(url.pathname==='/api/me/flair/cards')return route.fulfill({json:{season:'SPRING',counts:{BRONZE:1,PRATA:1,OURO:1,ESPECIAL:0},total:3,cards}});
  if(url.pathname==='/api/hype/summaries'){ console.log('HYPE_RESPONSE',liveScore);return route.fulfill({json:{items:{p1:{status:'AVAILABLE',score:liveScore,level:'TRENDING',stale:false}}}});}
  if(url.pathname==='/api/me/guides')return route.fulfill({json:{guides:{}}});
  return null;
 }});
 await ctx.route('**/bff/auth/refresh',route=>route.fulfill({json:{accessToken:'test-led-token'}}));
 await page.goto(`${base}/u/matheus?tab=flair`,{waitUntil:'domcontentloaded'});
 await page.locator('.fgc').first().waitFor({timeout:60000});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.fgc-metal-light')).animationName==='fgc-metal-reflection',null,{timeout:30000});
 await page.waitForFunction(()=>[...document.querySelectorAll('.fgc-photo img')].every(img=>img.naturalWidth>0),null,{timeout:30000});
 for(const tier of tiers) await page.locator(`.fgc.tier-${tier.toLowerCase()}`).screenshot({path:`${output}/${tier.toLowerCase()}.png`});
 const normalMotion=await page.locator('.fgc-metal-light').first().evaluate(el=>getComputedStyle(el).animationName);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.fgc-metal-light')).animationName==='none');
 const reducedMotion=await page.locator('.fgc-metal-light').first().evaluate(el=>getComputedStyle(el).animationName);
 if(normalMotion==='none'||reducedMotion!=='none')throw new Error('Motion preferences failed');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.clock.install();
 await page.goto(`${base}/pieces/p1`,{waitUntil:'domcontentloaded'});
 await page.locator('.aura-hype-total .led-number').waitFor({timeout:60000});
 await page.locator('.pd-media').screenshot({path:`${output}/hype-foto-score-global.png`});
 const score=await page.locator('.aura-hype-total .led-number').textContent();
 if(score!=='84')throw new Error('Unexpected score');
 const refresh=async(next)=>{
   liveScore=next;
   const response=page.waitForResponse(r=>r.url().includes('/api/hype/summaries'));
   await page.clock.fastForward(30_010);await response;
   await page.clock.runFor(20);
 };
 const border=page.locator('.piece-detail > .card-border');
 await border.evaluate(el=>{window.__borderSignals=[];new MutationObserver(()=>window.__borderSignals.push({pulse:el.dataset.pulse??null,score:document.querySelector('.aura-hype-total .led-number')?.textContent})).observe(el,{attributes:true,attributeFilter:['data-pulse']});});
 if(await border.getAttribute('data-pulse')!==null)throw new Error('Unexpected initial pulse');
 await refresh(89);
 console.log('AFTER_GAIN',await border.getAttribute('data-pulse'),await page.evaluate(()=>window.__borderSignals));
 await page.waitForFunction(()=>document.querySelector('.piece-detail > .card-border')?.dataset.pulse==='up');
 await page.clock.resume();await page.screenshot({path:`${output}/borda-ganho.png`,fullPage:true,animations:'disabled'});
 await page.clock.fastForward(2500);
 if(await border.getAttribute('data-pulse')!==null)throw new Error('Gain pulse did not expire');
 await refresh(82);
 await page.waitForFunction(()=>document.querySelector('.piece-detail > .card-border')?.dataset.pulse==='down');
 await page.clock.resume();await page.screenshot({path:`${output}/borda-perda.png`,fullPage:true,animations:'disabled'});
 await page.clock.fastForward(2500);
 if(await border.getAttribute('data-pulse')!==null)throw new Error('Loss pulse did not expire');
 const metaModes=['PRISMA','CONSTELACAO','FIO_VIVO','HOLOGRAFIA'];
 for(const mode of metaModes){
   metamorphose=mode;await page.reload({waitUntil:'domcontentloaded'});
   await page.locator(`.aura-metamorphose[data-effect="${mode}"]`).waitFor({timeout:30000});
   await page.locator('.pd-media').screenshot({path:`${output}/metamorfose-${mode.toLowerCase()}.png`,animations:'disabled'});
 }
 const summary={mode:'API simulada com scores explícitos de teste, foto oficial real; não comprova concessão ou dados de produção',tiers:cards.map(({tier,ovr})=>({tier,ovr})),globalHype:84,normalMotion,reducedMotion,borderSequence:[84,89,82],pulseExpires:true,metamorphoseModes:metaModes,pageErrors:errors};
 writeFileSync(`${output}/browser-result.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
} finally {await browser.close();rmSync(media,{recursive:true,force:true});}
