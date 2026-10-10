const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const path = require('path');
let browser;
const root=path.resolve(__dirname, '../..');
const evidence=path.join(root, 'docs/cloth-layer-evidence');
const shape=JSON.parse(fs.readFileSync(root+'/lib/avatar3d/canonical-face.ts','utf8').match(/CANON_POS = new Float32Array\((\[[\s\S]*?\])\)/)[1]);
const user={id:'fixture-user',username:'validacao',displayName:'Avatar de teste',profileType:'PESSOAL',verified:false,privateAccount:false};
const model={v:1,shape,skin:'#c99a6e',sex:'MASCULINO',hair:{present:true,bottom:-6,cut:false,color:'#382519',top:14,side:8,fringe:0,length:'short',texture:'straight',volume:1},metrics:{},views:[],warnings:[]};
const avatar={model,adjust:{},textureUrl:null};
const makePiece=(id,name,category,subcategory,color,colorHex)=>({id,name,category,subcategory,color,colorHex,imageUrl:`http://localhost:8080/test-fixtures/${id}.svg`,photoProcessingStatus:'COMPLETED',defaultImage:false,model3dStatus:'NOT_STARTED',model3dUrl:null});
const shirt=makePiece('shirt','Blazer preto · teste','upper_piece','blazer','black','#161616');
const jeans=makePiece('jeans','Jeans · teste','lower_piece','jeans','blue','#234b78');
const shoes=makePiece('shoes','Tênis · teste','shoes_piece','casual_sneakers','black','#232323');
const pieces={upper_piece:[{piece:shirt,slot:'upper_piece',wear:'TOP'}],lower_piece:[{piece:jeans,slot:'lower_piece',wear:'BOTTOM'}],shoes_piece:[{piece:shoes,slot:'shoes_piece',wear:'SHOES'}],accessory_piece:[]};
const svgs={
shirt:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400"><rect width="320" height="400" fill="white"/><path d="M100 40 L135 28 L185 28 L220 40 L295 120 L260 150 L220 100 L220 365 L100 365 L100 100 L60 150 L25 120 Z" fill="#161616"/><path d="M140 30 L160 65 L180 30 M160 65 L160 365" fill="none" stroke="#264568" stroke-width="3"/></svg>',
jeans:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="500"><rect width="320" height="500" fill="white"/><path d="M95 25 L225 25 L235 175 L210 470 L165 470 L160 185 L155 470 L110 470 L85 175 Z" fill="#234b78"/><path d="M97 65 L223 65 M140 65 L150 145" fill="none" stroke="#a1a6af" stroke-width="3"/></svg>',
shoes:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="white"/><path d="M35 45 L110 80 L145 130 L270 125 L295 155 L20 155 Z" fill="#232323"/><path d="M20 155 L295 155 L295 172 L20 172 Z" fill="#dddddd"/></svg>'};
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1200},locale:'pt-BR',reducedMotion:'reduce'});
 await context.addCookies([{name:'fai_rt_h',value:'1',domain:'127.0.0.1',path:'/'}]);
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console', m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/bff/auth/refresh',r=>r.fulfill({json:{accessToken:'fixture-token'}}));
 await page.route('**/api/**',async r=>{
  const path=new URL(r.request().url()).pathname;
  const data={
   '/api/me':{user,email:'fixture@example.invalid',emailVerified:true,status:'ACTIVE',role:'USER',twoFactorEnabled:false,sex:'MASCULINO'},
   '/api/try-on':{mannequin:{sex:'MASCULINO',build:'MEDIUM'},sex:'MASCULINO',avatar,pieces},
   '/api/me/avatar3d':{exists:true,...avatar},
   '/api/catalog/stores':{stores:[]},
   '/api/taxonomy':{colors:{blue:'#234b78',black:'#232323'},subcategories:{upper_piece:['shirt'],lower_piece:['jeans'],shoes_piece:['casual_sneakers'],accessory_piece:[]},materials:[],sizes:[],sexes:[],styles:[],occasions:[],brands:[],allowedOccasionsByCategory:{}},
   '/api/me/preferences':{locale:'pt-BR',theme:'light',reduceMotion:true},
  }[path];
  await r.fulfill({json:data??{items:[],total:0,unread:0}});
 });
 await page.route('**/test-fixtures/*.svg',r=>{const id=new URL(r.request().url()).pathname.split('/').pop().split('.')[0];return r.fulfill({contentType:'image/svg+xml',body:svgs[id]});});
 await page.goto('http://127.0.0.1:3000/try-on',{waitUntil:'domcontentloaded'});
 await page.locator('button').filter({hasText:/Meu guarda-roupa/}).click();
 for(const name of ['Blazer preto · teste','Jeans · teste','Tênis · teste']) await page.getByRole('button',{name:new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();
 await page.waitForTimeout(2000);
 await page.waitForTimeout(2500);
 fs.mkdirSync(evidence,{recursive:true});
 for(const [view,label] of [['front','Frente'],['profile','Perfil'],['back','Costas']]){
  await page.locator('button').filter({hasText:new RegExp('^'+label+'$')}).click(); await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(evidence, `try-on-${view}.png`),fullPage:true});
 }
 const audit=await page.evaluate(()=>window.__faiAudit?.());
 if (!audit?.some(p=>p.shown&&p.dressed&&p.garments.includes('peca-w:shirt'))) throw new Error('Selected outer garment was not rendered');
 if (audit.some(p=>p.garments.some(g=>/^(punho|barra|gola)-fai-padrao-camiseta$/.test(g)))) throw new Error('Covered inner finishes still rendered');
 if (errors.length) throw new Error(errors.join('\n'));
 fs.writeFileSync(path.join(evidence, 'browser.json'),JSON.stringify({fixture:true,errors,audit},null,2));
 console.log(JSON.stringify({errors,audit}));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
