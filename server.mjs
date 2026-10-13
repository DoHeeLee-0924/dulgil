import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([['/', ['index.html','text/html']], ['/app.js',['app.js','text/javascript']], ['/domain.js',['domain.js','text/javascript']], ['/style.css',['style.css','text/css']]]);
export function createServer() {
  return http.createServer(async (req,res) => {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const entry=files.get(new URL(req.url,'http://localhost').pathname);
    if (!entry) { res.writeHead(404); return res.end('Not found'); }
    try {
      const data=await readFile(new URL(`./public/${entry[0]}`,import.meta.url));
      res.writeHead(200,{'Content-Type':`${entry[1]}; charset=utf-8`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      res.end(req.method==='HEAD'?undefined:data);
    } catch {res.writeHead(500);res.end('Server error');}
  });
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  const port=Number(process.env.PORT||3000);
  createServer().listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`둘길: http://localhost:${port}`));
}
