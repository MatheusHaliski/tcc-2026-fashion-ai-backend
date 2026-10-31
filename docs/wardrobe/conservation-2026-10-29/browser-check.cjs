const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
const out=__dirname;
(async()=>{
 const browser=await chromium.launch({executablePath:'/workspace/.tooling/browsers/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
 const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'pt-BR'});
 await context.addCookies([{name:'fai_rt_h',value:'1',url:'http://127.0.0.1:3117'}]);
 const owner={id:'u1',username:'ana',displayName:'Ana Souza',profileType:'PESSOAL',verified:true,privateAccount:false,country:'BR'};
 let piece={id:'p1',owner,name:'Camisa de algodão',category:'upper_piece',subcategory:'shirt',sex:'UNISSEX',color:'blue',colorHex:'#3268a4',material:'COTTON',size:'m',style:['basic'],occasion:['casual'],seals:[],price:100,defaultImage:true,imageUrl:null,visibility:'PRIVATE',disponivel:true,availabilityStatus:'AVAILABLE',condition:'GOOD',favorite:false,forSale:false,wearCount:0,estadoConservacao:null,counters:{likes:0,comments:0,shares:0,remixes:0,views:0,saves:0,reactions:{}},viewer:{liked:false,reactions:[],saved:false,canEdit:true,following:false},createdAt:'2026-10-29T00:00:00Z',updatedAt:'2026-10-29T00:00:00Z'};
 const options=['NOVA','EXCELENTE','BOA','DESGASTADA','DANIFICADA'].map((codigo,i)=>({id:`00000000-0000-4000-8000-00000000000${i}`,codigo,nome:['Nova','Excelente','Boa','Desgastada','Danificada'][i]}));
 const requests=[];
 await context.route(/\/(api|bff)\//,async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;let result={};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(path==='/bff/auth/refresh') result={accessToken:'test-token'};
  else if(path==='/api/me')result={user:owner,email:'ana@example.com',emailVerified:true,status:'ACTIVE',role:'USER',twoFactorEnabled:false};
  else if(path==='/api/opcoes/estados-conservacao')result=options;
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
 await page.goto('http://127.0.0.1:3117/pieces/p1?edit=1');
 const dialog=page.getByRole('dialog',{name:'Editar dados'});await dialog.waitFor({timeout:60000});
 const field=dialog.getByLabel('Estado de conservação',{exact:true});await field.waitFor();
 await page.waitForFunction(()=>{const e=document.getElementById('estadoConservacaoId');return e&&!e.disabled;});
 await field.scrollIntoViewIfNeeded();await field.click();
 await page.getByRole('option',{name:'Excelente',exact:true}).waitFor();
 await page.screenshot({path:out+'/E1-editar-peca.png',fullPage:false});
 await page.getByRole('option',{name:'Excelente',exact:true}).click();
 await dialog.getByRole('button',{name:'Salvar',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.goto('http://127.0.0.1:3117/pieces/p1');
 const value=page.locator('.c-facts dd').filter({hasText:'Excelente'});await value.waitFor({timeout:30000});await value.scrollIntoViewIfNeeded();
 await page.screenshot({path:out+'/E2-card-recarregado.png',fullPage:false});
 if(requests[0]?.body.estadoConservacaoId!==options[1].id)throw Error('UUID not submitted');
 fs.writeFileSync(out+'/browser-evidence.json',JSON.stringify({scope:'Frontend real em Next dev; API simulada no navegador. Não testa MySQL ou produção.',saved:requests,rendered:value?await value.innerText():null,pageErrors:errors},null,2));
 console.log(JSON.stringify({status:'passed',savedId:requests[0].body.estadoConservacaoId,pageErrors:errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
