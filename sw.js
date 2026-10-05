// sw.js — Abanico abre sin internet: guarda la app (index.html), los íconos y las librerías.
// Los datos de la tienda no pasan por aquí: siguen en el equipo (IndexedDB) y en la nube (Supabase).
const CACHE='abanico-app-v2';
const CORE=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
// librerías que se guardan desde el principio (PDF, copia .mn, QR, lector de códigos): así también sirven sin internet la primera vez
const LIBS_PRE=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js','https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js','https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js','https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm','https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js','https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js','https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js'];
const LIBS=/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all([...CORE.map(u=>fetch(u,{cache:'reload'}).then(r=>{if(r&&r.ok)return c.put(u,r);}).catch(()=>{})),...LIBS_PRE.map(u=>c.match(u).then(m=>m||fetch(u).then(r=>{if(r&&r.ok)return c.put(u,r);})).catch(()=>{}))])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{const nw=await caches.open(CACHE);for(const k of await caches.keys()){if(k===CACHE||k.indexOf('abanico-app-')!==0)continue;const old=await caches.open(k);for(const r of await old.keys()){if(!(await nw.match(r))){const v=await old.match(r);if(v)await nw.put(r,v);}}await caches.delete(k);}await self.clients.claim();})());   // lo guardado en la versión anterior pasa a la nueva
});
const wait=ms=>new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms));

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  // La app: primero la red (así llegan las actualizaciones); sin red o si tarda más de 6 s, la que está guardada
  if(req.mode==='navigate'||(url.origin===location.origin&&/\/(index\.html)?$/.test(url.pathname))){
    e.respondWith((async()=>{const c=await caches.open(CACHE);
      try{const r=await Promise.race([fetch(req,{cache:'no-cache'}),wait(6000)]);if(r&&r.ok)c.put('./index.html',r.clone());return r;}
      catch(_){const m=(await c.match('./index.html'))||(await c.match('./'));if(m)return m;return new Response('<meta name="viewport" content="width=device-width"><p style="font-family:sans-serif;padding:24px">Abanico necesita internet la primera vez que se abre.</p>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});}})());
    return;
  }
  if(url.origin===location.origin){
    if(/version\.txt$/.test(url.pathname))return;   // el aviso de versión nueva siempre va a la red
    if(/\.(png|json|svg|ico|webp)$/.test(url.pathname)){   // íconos y manifiesto: lo guardado ya, y se actualiza por detrás
      e.respondWith(caches.open(CACHE).then(async c=>{const m=await c.match(req);const net=fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone());return r;}).catch(()=>m);return m||net;}));
    }
    return;
  }
  // Librerías (versiones fijas en la dirección): se guardan la primera vez y después salen del equipo
  if(LIBS.test(req.url)){
    e.respondWith(caches.open(CACHE).then(async c=>{const m=await c.match(req);if(m)return m;try{const r=await fetch(req);if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r;}catch(err){return m||Response.error();}}));
  }
  // Todo lo demás (Supabase, etc.) va directo a la red
});
