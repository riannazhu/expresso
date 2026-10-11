import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Game } from './game.js';
const publicDir=path.resolve(fileURLToPath(new URL('../public/',import.meta.url)));
export function createServer(game=new Game()) {
  return http.createServer(async(req,res)=>{
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/health')return json(200,{ok:true});
      if(url.pathname.startsWith('/api/')) {
        if(req.method==='GET'&&url.pathname==='/api/state')return json(200,game.state(url.searchParams.get('code'),req.headers.authorization?.replace(/^Bearer /,'')));
        if(req.method!=='POST')return json(405,{error:'Method not allowed.'});
        // Reject cross-site writes; same-origin browser and direct API clients are supported.
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'Cross-site requests are not allowed.'});
        let body='';for await(const chunk of req){body+=chunk;if(body.length>8192)return json(413,{error:'Request too large.'});}
        let data;try{data=JSON.parse(body);}catch{return json(400,{error:'Invalid JSON.'});}
        if(url.pathname==='/api/create')return json(200,game.create(data.name,data.practice));
        if(url.pathname==='/api/join')return json(200,game.join(data.code,data.name));
        if(url.pathname==='/api/action')return json(200,game.action(data.code,req.headers.authorization?.replace(/^Bearer /,''),data.action||{}));
        return json(404,{error:'Unknown endpoint.'});
      }
      if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Method not allowed.'});
      const filename=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
      const target=path.resolve(publicDir,filename);if(!target.startsWith(publicDir+path.sep))return json(403,{error:'Forbidden.'});
      const bytes=await readFile(target);const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'}[path.extname(target)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; script-src 'self'"});res.end(req.method==='HEAD'?undefined:bytes);
    } catch(e){json(e.status|| (e.code==='ENOENT'?404:500),{error:e.status?e.message:e.code==='ENOENT'?'Not found.':'Something went wrong. Try again.'});}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const game=new Game(); const timer=setInterval(()=>game.cleanup(),60000);timer.unref();
  createServer(game).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Expresso listening on port '+(process.env.PORT||3000)));
}
