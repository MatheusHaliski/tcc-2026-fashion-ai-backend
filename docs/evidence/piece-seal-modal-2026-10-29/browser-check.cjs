const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
const out=__dirname;
(async()=>{
 const browser=await chromium.launch({executablePath:'/workspace/.tooling/browsers/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
 const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'pt-BR'});
 await context.addCookies([{name:'fai_rt_h',value:'1',url:'http://127.0.0.1:3118'}]);
 const owner={id:'u1',username:'ana',displayName:'Ana Souza',profileType:'PESSOAL',verified:true,privateAccount:false,country:'BR'};
 let piece={id:'p1',owner,name:'Camisa azul — teste de selo',category:'upper_piece',subcategory:'shirt',sex:'UNISSEX',color:'blue',colorHex:'#3268a4',material:'COTTON',size:'m',style:['basic'],occasion:['casual'],seals:[],price:100,defaultImage:true,imageUrl:null,visibility:'PRIVATE',disponivel:true,availabilityStatus:'AVAILABLE',condition:'GOOD',favorite:false,forSale:false,wearCount:0,estadoConservacao:null,counters:{likes:0,comments:0,shares:0,remixes:0,views:0,saves:0,reactions:{}},viewer:{liked:false,reactions:[],saved:false,canEdit:true,following:false},createdAt:'2026-10-29T00:00:00Z',updatedAt:'2026-10-29T00:00:00Z'};
 const options=['NOVA','EXCELENTE','BOA','DESGASTADA','DANIFICADA'].map((codigo,i)=>({id:`00000000-0000-4000-8000-00000000000${i}`,codigo,nome:['Nova','Excelente','Boa','Desgastada','Danificada'][i]}));
 const requests=[]; const badge={tier:'PECA',owner:'marca-teste',premium:false,name:'Peça azul — selo de teste',linkedPieceIds:['p1'],design:{kind:'FASHIONAI',mode:'TEMPLATE',template:'fai/01'}};
 await context.route(/\/(api|bff)\//,async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;let result={};
  if(path==='/api/catalog/default-asset')return route.continue();
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(path==='/bff/auth/refresh') result={accessToken:'test-token'};
  else if(path==='/api/me')result={user:owner,email:'ana@example.com',emailVerified:true,status:'ACTIVE',role:'USER',twoFactorEnabled:false};
  else if(path==='/api/opcoes/estados-conservacao')result=options;
  else if(path==='/api/me/closet')result={items:[piece],page:0,size:24,total:1,hasMore:false};
  else if(path==='/api/pieces/seals'){requests.push({method:request.method(),path:new URL(request.url()).pathname+new URL(request.url()).search});result={items:{p1:[badge]}};}
  else if(path==='/api/pieces/p1'&&request.method()==='PUT') {const body=request.postDataJSON(); requests.push({method:'PUT',path,body}); piece={...piece,estadoConservacao:options.find(o=>o.id===body.estadoConservacaoId)||null};result=piece;}
  else if(path==='/api/pieces/p1')result={piece};
  else if(path==='/api/taxonomy')result={subcategories:{upper_piece:['shirt']},colors:{blue:'#3268a4'},materials:['COTTON'],sizes:['m'],sexes:['UNISSEX'],occasions:['casual'],styles:['basic'],allowedOccasionsByCategory:{}};
  else if(path==='/api/hype/summaries')result={type:'PIECE',items:{}};
  else if(path.includes('preferences'))result={};
  else if(path.includes('unread'))result={count:0};
  else if(path.includes('notifications'))result={items:[],total:0};
  else result=[];
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result),headers:{'access-control-allow-origin':'*'}});
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3118/closet',{waitUntil:'domcontentloaded',timeout:60000});
 const card=page.locator('article.piece-card').first();await card.waitFor({timeout:60000});
 const seal=card.locator('.card-seals .seal-medallion');await seal.waitFor();
 await card.locator('img').first().waitFor();
 await page.waitForFunction(()=>{const img=document.querySelector('article.piece-card img');return img&&img.complete&&img.naturalWidth>0});
 await card.scrollIntoViewIfNeeded();
 await page.screenshot({path:out+'/E1-peca-azul-selo-na-grade.png',fullPage:false});
 await card.getByRole('link',{name:'Camisa azul — teste de selo',exact:true}).click();
 const modal=page.getByRole('dialog',{name:/detalhe da peça/i});await modal.waitFor();
 const medal=modal.locator('.card-seals .seal-medallion');await medal.waitFor();
 await page.waitForFunction(()=>{const img=document.querySelector('.dialog-card .pd-media img');return img&&img.complete&&img.naturalWidth>0});
 await page.screenshot({path:out+'/E2-peca-azul-selo-no-modal.png',fullPage:false});
 await modal.screenshot({path:out+'/E2-modal-completo.png'});
 const approvedTitle=await medal.getAttribute('title');
 if(approvedTitle!=='Peça azul — selo de teste · @marca-teste · PECA')throw Error('Seal mismatch');
 await modal.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('article.piece-card').getByRole('link',{name:'Camisa azul — teste de selo',exact:true}).click();
 await page.getByRole('dialog',{name:/detalhe da peça/i}).locator('.card-seals .seal-medallion').waitFor();
 fs.writeFileSync(out+'/browser-evidence.json',JSON.stringify({scope:'Frontend real local da branch de PR; API e vínculo aprovado simulados. Não demonstra emissão/aprovação real nem gravação em MySQL. A peça usa o asset padrão azul local.',seal:badge,modalSealTitle:approvedTitle,verifiedReopenAfterReload:true,requests,pageErrors:errors},null,2));
 console.log(JSON.stringify({status:'passed',modalSealTitle:approvedTitle,pageErrors:errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
