import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createPlaceSearch,searchConfigured} from './place-search.mjs';
const files = new Map([['/', ['index.html','text/html']], ['/app.js',['app.js','text/javascript']], ['/domain.js',['domain.js','text/javascript']], ['/style.css',['style.css','text/css']]]);
files.set('/fonts/ongeulip-park-dahyun.ttf',['fonts/ongeulip-park-dahyun.ttf','font/ttf']);
files.set('/course-builder.js',['course-builder.js','text/javascript']);
files.set('/place-media.js',['place-media.js','text/javascript']);
files.set('/vendor/leaflet.js',['vendor/leaflet.js','text/javascript']);
files.set('/vendor/leaflet.css',['vendor/leaflet.css','text/css']);
export function createServer({env=process.env,fetchImpl=fetch}={}) {
  const search=createPlaceSearch({env,fetchImpl});
  return http.createServer(async (req,res) => {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/place-search'||url.pathname==='/api/place-search/status'){
      const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:JSON.stringify(body));};
      if(url.pathname.endsWith('/status'))return json(200,{configured:searchConfigured(env)});
      if(req.method==='HEAD')return json(405,{error:'GET 요청으로 검색해주세요.'});
      try{return json(200,{items:await search(url.searchParams.get('q')),provider:'naver'});}catch(error){return json(error.status||500,{error:error.message,code:error.code||'SEARCH_ERROR'});}
    }
    const entry=files.get(url.pathname);
    if (!entry) { res.writeHead(404); return res.end('Not found'); }
    try {
      const data=await readFile(new URL(`./public/${entry[0]}`,import.meta.url));
      res.writeHead(200,{'Content-Type':entry[1]==='font/ttf'?entry[1]:`${entry[1]}; charset=utf-8`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; font-src 'self'; img-src 'self' data: blob: https://tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      res.end(req.method==='HEAD'?undefined:data);
    } catch {res.writeHead(500);res.end('Server error');}
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const envPath=fileURLToPath(new URL('./.env',import.meta.url));
  if(existsSync(envPath))loadEnvFile(envPath);
  const port=Number(process.env.PORT||3000);
  const server=createServer();
  server.on('error',error=>{
    console.error(error.code==='EADDRINUSE' ? `포트 ${port}가 이미 사용 중입니다. 기존 서버를 종료하거나 PORT를 변경해주세요.` : error.message);
    process.exitCode=1;
  });
  server.listen(port,process.env.HOST||'127.0.0.1',()=>{
    const url=`http://localhost:${server.address().port}`;
    console.log(`둘길: ${url}\n종료하려면 Ctrl+C를 누르세요.`);
    if(process.argv.includes('--open') && process.platform==='win32') {
      const browser=spawn('explorer.exe',[url],{stdio:'ignore'});
      browser.on('error',()=>console.log(`브라우저에서 ${url}을 열어주세요.`));
      browser.unref();
    }
  });
}
