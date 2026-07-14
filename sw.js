// ==========================================================
// 🍑 屁桃星离线小屋 Service Worker · v7.6
// 策略：network-first —— 联网时永远拿最新版（成功后可靠更新缓存），
//       断网或服务器出错(5xx等)时从缓存开小屋；回忆本来就住在IndexedDB里，一条不少。
// API请求（openrouter.ai / tavily 等跨域）完全不拦截，直接走网络。
// ⚠️ 每次发新版请同步更新下面的 CACHE 版本号（与 index.html 的 APP_VERSION 对应）
// v7.6: 吃醋桃系统 + S主桃模式（纯前端，无需SW改动，仅版本号同步）
// v7.4.2: 回退只查当前CACHE（不误取同域其他应用缓存内容）
// v7.4.1 修复（GPT验收三连）：
//   1. activate只清理屁桃星自己的旧缓存（peachstation-前缀），不误伤同域其他小应用
//   2. 服务器返回非2xx（如503/500）时也优先用缓存开门，没缓存才原样返回错误
//   3. 缓存更新纳入event.waitUntil()保护，SW不会在写入完成前被终止
// ==========================================================
const CACHE='peachstation-v7.6';
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
      // v7.4.1: 只删屁桃星自己的旧版本缓存，同域其他应用的缓存不碰
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('peachstation-')&&k!==CACHE).map(k=>caches.delete(k))))
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
        // v7.4.1: 缓存更新放进waitUntil保护，确保写入完成后SW才允许休眠
        const copy=res.clone();
        e.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));
        return res;
      }
      // v7.4.1: 服务器返回错误(5xx/4xx)时优先用缓存开小屋；没缓存才把错误原样交回
      // v7.4.2: 回退限定当前CACHE，绝不从同域其他应用的缓存里取内容
      return caches.open(CACHE).then(c=>c.match(req)).then(hit=>hit||res);
    }).catch(()=>
      caches.open(CACHE).then(c=>
        c.match(req).then(hit=>{
          if(hit)return hit;
          // 断网时的页面导航兜底：开小屋主页
          if(req.mode==='navigate')return c.match('./index.html');
          return new Response('',{status:504,statusText:'offline'});
        })
      )
    )
  );
});
