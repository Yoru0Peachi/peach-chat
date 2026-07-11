// ==========================================================
// 🍑 屁桃星离线小屋 Service Worker · v7.4
// 策略：network-first —— 联网时永远拿最新版（成功后顺手更新缓存），
//       断网时从缓存开小屋；回忆本来就住在IndexedDB里，一条不少。
// API请求（openrouter.ai / tavily 等跨域）完全不拦截，直接走网络。
// ⚠️ 每次发新版请同步更新下面的 CACHE 版本号（与 index.html 的 APP_VERSION 对应）
// ==========================================================
const CACHE='peachstation-v7.4';
const SHELL=['./','./index.html'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(SHELL))
      .then(()=>self.skipWaiting()) // 新版立即接管，不等旧页面全关
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) // 清理旧版缓存
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  let url;try{url=new URL(req.url)}catch(x){return}
  // 只接管同源GET（小屋自己的文件）；API等跨域请求不碰
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  e.respondWith(
    fetch(req).then(res=>{
      if(res&&res.ok){
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
      }
      return res;
    }).catch(()=>
      caches.match(req).then(hit=>{
        if(hit)return hit;
        // 断网时的页面导航兜底：开小屋主页
        if(req.mode==='navigate')return caches.match('./index.html');
        return new Response('',{status:504,statusText:'offline'});
      })
    )
  );
});
