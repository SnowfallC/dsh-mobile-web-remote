function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function themeBoot(themePreference) {
  const preference = ['light', 'dark', 'system'].includes(themePreference) ? themePreference : 'system'
  return `<script>(function(){
    var preference=${JSON.stringify(preference)};
    var media=matchMedia('(prefers-color-scheme: dark)');
    function apply(){document.documentElement.dataset.theme=preference==='dark'||(preference==='system'&&media.matches)?'dark':'light'}
    apply();media.addEventListener('change',apply);
    if(location.pathname==='/__dsh_mobile')setInterval(function(){
      fetch('/__dsh_mobile/theme',{cache:'no-store'}).then(function(response){return response.json()}).then(function(data){
        if(data.preference==='light'||data.preference==='dark'||data.preference==='system'){preference=data.preference;apply()}
      }).catch(function(){});
    },2000);
  })()</script>`
}

const copies = {
  zh: {
    mobileRemote: '手机远程', connecting: '正在连接…', invalidPairing: '链接无效或配对信息已被移除，请在电脑端重新生成二维码。', pairedRedirect: '连接成功，正在进入 DSH…', pairingExpired: '配对链接已失效或已经使用', pairingFailed: '连接失败', connectionFailed: '连接失败', creatingTunnel: '正在创建隧道', revoked: '已撤销', connected: '已连接', waitingScan: '等待扫码', revokedMessage: '链接与远程会话已撤销', preparingQr: '正在准备二维码…', pairedMessage: '已完成一次性配对', regenerate: '重新生成', revokeLink: '撤销链接', expiry: '授权到期：', warning: '实验性功能 · 流量经 Cloudflare 中转，请勿处理敏感任务；用完后请撤销连接。', close: '关闭手机远程控制', open: '打开手机远程控制', frameTitle: '手机远程控制', pageTitle: 'DSH 手机远程控制', connectTitle: '连接 DeepSeek Harness', manageDialog: '手机远程控制',
  },
  en: {
    mobileRemote: 'Mobile remote', connecting: 'Connecting…', invalidPairing: 'This link is invalid or its pairing data was removed. Regenerate the QR code on your computer.', pairedRedirect: 'Connected. Opening DSH…', pairingExpired: 'This pairing link has expired or was already used', pairingFailed: 'Connection failed', connectionFailed: 'Connection failed', creatingTunnel: 'Creating tunnel', revoked: 'Revoked', connected: 'Connected', waitingScan: 'Waiting to scan', revokedMessage: 'The link and remote session have been revoked', preparingQr: 'Preparing QR code…', pairedMessage: 'One-time pairing completed', regenerate: 'Regenerate', revokeLink: 'Revoke link', expiry: 'Expires: ', warning: 'Experimental · Traffic is relayed through Cloudflare. Do not use for sensitive tasks; revoke the link when finished.', close: 'Close mobile remote', open: 'Open mobile remote', frameTitle: 'Mobile remote control', pageTitle: 'DSH Mobile Web Remote', connectTitle: 'Connect to DeepSeek Harness', manageDialog: 'Mobile remote control',
  },
}

function copyFor(locale) {
  return locale === 'en' ? copies.en : copies.zh
}

export function pairingBootstrapPage(themePreference = 'system', locale = 'zh') {
  const copy = copyFor(locale)
  return `<!doctype html>
<html lang="${locale === 'en' ? 'en' : 'zh-CN'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>${copy.connectTitle}</title>
  ${themeBoot(themePreference)}
  <style>
    *{box-sizing:border-box}:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:light;--text:#0f1115;--muted:#61666b;--surface:rgba(255,255,255,.92);--border:rgba(65,118,230,.16);--status:#edf3ff;--shadow:rgba(40,80,150,.13);--bg:#f9fafb;--glow:rgba(103,158,254,.28)}
    :root[data-theme="dark"]{color-scheme:dark;--text:#ebedf2;--muted:#adb2b8;--surface:rgba(35,35,36,.94);--border:rgba(183,200,254,.16);--status:#282f42;--shadow:rgba(0,0,0,.45);--bg:#151517;--glow:rgba(65,118,230,.42)}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;color:var(--text);background:radial-gradient(ellipse 78% 56% at 50% -8%,var(--glow),transparent 66%),var(--bg)}
    main{width:min(400px,100%);padding:28px;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:0 28px 80px var(--shadow);backdrop-filter:blur(18px)}
    h1{font-size:22px;letter-spacing:-.02em;margin:0}.status{margin-top:20px;padding:13px 15px;border-radius:10px;background:var(--status);color:var(--muted);font-size:14px;line-height:1.5}
  </style>
</head>
<body>
  <main>
    <h1>${copy.mobileRemote}</h1>
    <div class="status" id="status">${copy.connecting}</div>
  </main>
  <script>
    const statusElement = document.getElementById('status')
    const token = new URLSearchParams(location.hash.slice(1)).get('token')
    history.replaceState(null, '', location.pathname)
    if (!token) {
      statusElement.textContent = ${JSON.stringify(copy.invalidPairing)}
    } else {
      fetch('/__dsh_mobile/pair', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({token}),
        credentials: 'same-origin'
      }).then(response => {
        if (!response.ok) throw new Error(${JSON.stringify(copy.pairingExpired)})
        statusElement.textContent = ${JSON.stringify(copy.pairedRedirect)}
        location.replace('/')
      }).catch(error => {
        statusElement.textContent = error instanceof Error ? error.message : ${JSON.stringify(copy.pairingFailed)}
      })
    }
  </script>
</body>
</html>`
}

export function managementPage({ publicUrl, pairingUrl, paired, revoked = false, expiresAt, qrSvg, error, themePreference = 'system', locale = 'zh' }) {
  const copy = copyFor(locale)
  const stateLabel = error
    ? copy.connectionFailed
    : publicUrl === undefined
      ? copy.creatingTunnel
      : revoked
        ? copy.revoked
      : paired
        ? copy.connected
        : copy.waitingScan
  const qrBlock = revoked
    ? `<div class="placeholder">${copy.revokedMessage}</div>`
    : pairingUrl === undefined
      ? `<div class="placeholder">${copy.preparingQr}</div>`
    : paired
      ? `<div class="placeholder success">${copy.pairedMessage}</div>`
      : `<div class="qr">${qrSvg}</div>`
  const refreshMeta = publicUrl === undefined && error === undefined
    ? '<meta http-equiv="refresh" content="2">'
    : ''
  return `<!doctype html>
<html lang="${locale === 'en' ? 'en' : 'zh-CN'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  ${refreshMeta}
  <title>${copy.pageTitle}</title>
  ${themeBoot(themePreference)}
  <script>if(window.self!==window.top)document.documentElement.dataset.embed='true'</script>
  <style>
    *{box-sizing:border-box}:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:light;--text:#0f1115;--muted:#61666b;--caption:#9299a6;--surface:rgba(255,255,255,.92);--border:rgba(65,118,230,.16);--status:#edf3ff;--placeholder:#f5f8ff;--shadow:rgba(40,80,150,.13);--bg:#f9fafb;--glow:rgba(103,158,254,.28);--accent:#4176e6;--accent2:#679efe}
    :root[data-theme="dark"]{color-scheme:dark;--text:#ebedf2;--muted:#adb2b8;--caption:#6e737d;--surface:rgba(35,35,36,.94);--border:rgba(183,200,254,.16);--status:#282f42;--placeholder:#1b1d24;--shadow:rgba(0,0,0,.45);--bg:#151517;--glow:rgba(65,118,230,.42);--accent:#5686fe;--accent2:#679efe}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;color:var(--text);background:radial-gradient(ellipse 78% 56% at 50% -8%,var(--glow),transparent 66%),var(--bg)}
    .panel{width:min(440px,100%);padding:28px;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:0 28px 80px var(--shadow);backdrop-filter:blur(18px)}
    :root[data-embed="true"] body{display:block;min-height:0;padding:0;overflow:hidden;background:transparent}:root[data-embed="true"] .panel{width:100%;padding:12px 28px 24px;border:0;border-radius:0;box-shadow:none;background:transparent}
    .head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 16px}h1{font-size:23px;letter-spacing:-.02em;margin:0;white-space:nowrap}.status{font-size:12px;color:var(--muted);background:var(--status);border-radius:999px;padding:6px 10px;white-space:nowrap}
    .qr{width:min(280px,100%);margin:24px auto 20px;padding:12px;background:#fff!important;border:1px solid var(--border);border-radius:14px;box-shadow:0 12px 34px rgba(65,118,230,.13);color-scheme:light}.qr svg{display:block;width:100%;height:auto;background:#fff!important}.qr svg path:first-child{fill:#fff!important;stroke:none!important}.qr svg path:not(:first-child){fill:none!important;stroke:#000!important}
    .placeholder{min-height:260px;display:grid;place-items:center;margin:24px 0 20px;background:var(--placeholder);border:1px dashed var(--border);border-radius:14px;color:var(--muted)}.success{color:var(--accent)}
    .actions{display:flex;align-items:center;gap:8px;margin-top:8px}.actions form{margin:0}.button{min-height:36px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--border);border-radius:10px;background:transparent;color:var(--text);padding:7px 12px;font-weight:500;font-size:13px;white-space:nowrap;cursor:pointer}.button:before{font-size:16px;font-weight:400;line-height:1}.button-refresh:before{content:"↻"}.button-revoke:before{content:"×"}.button:hover{background:var(--status)}.button-revoke{color:var(--muted)}.meta{margin-left:auto;text-align:right;font-size:12px;color:var(--caption)}.warning{text-align:center;font-size:12px;color:var(--caption);margin:12px 0 0;line-height:1.5}@media(max-width:420px){.actions{align-items:stretch;flex-wrap:wrap}.meta{width:100%;margin-left:0;text-align:left}}
  </style>
</head>
<body>
  <main class="panel">
    <div class="head"><h1>${copy.mobileRemote}</h1><div class="status">${stateLabel}</div></div>
    ${qrBlock}
    <div class="actions">
      <form method="post" action="/__dsh_mobile/rotate"><button class="button button-refresh" type="submit">${copy.regenerate}</button></form>
      <form method="post" action="/__dsh_mobile/revoke"><button class="button button-revoke" type="submit">${copy.revokeLink}</button></form>
      <div class="meta">${expiresAt === undefined ? '' : `${copy.expiry}${escapeHtml(new Date(expiresAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN'))}`}</div>
    </div>
    <p class="warning">${copy.warning}</p>
  </main>
  <script>(function(){
    if(window.self===window.top)return;
    function reportSize(){var panel=document.querySelector('.panel');if(panel)parent.postMessage({type:'dsh-mobile-size',height:Math.ceil(panel.scrollHeight)},location.origin)}
    addEventListener('load',reportSize);
    reportSize();
    var panel=document.querySelector('.panel');if(panel&&typeof ResizeObserver==='function')new ResizeObserver(reportSize).observe(panel);
  })()</script>
</body>
</html>`
}

export function injectMobileControlButton(html) {
  if (html.includes('data-dsh-mobile-control')) return html
  const script = `<script data-dsh-mobile-control>(function(){
    var host=location.hostname;
    if(host!=="127.0.0.1"&&host!=="localhost"&&host!=="::1")return;
    var button=document.createElement("button");
    button.type="button";
    button.setAttribute("data-dsh-mobile-control","");
    button.innerHTML='<span data-mobile-locale="zh">手机远程</span><span data-mobile-locale="en">Mobile remote</span>';
    button.setAttribute("aria-label","Mobile remote / 手机远程");
    var localeStyle=document.createElement("style");
    localeStyle.textContent='[data-dsh-mobile-control] [data-mobile-locale="en"]{display:none}body:has(button[aria-label="New session"],button[aria-label="Add workspace"]) [data-dsh-mobile-control] [data-mobile-locale="zh"]{display:none}body:has(button[aria-label="New session"],button[aria-label="Add workspace"]) [data-dsh-mobile-control] [data-mobile-locale="en"]{display:inline}';
    button.style.cssText="position:fixed;right:18px;bottom:18px;z-index:2147483645;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:12px;padding:10px 16px;background:var(--dsw-alias-button-floating-fill,#fff);color:var(--dsw-alias-label-primary,#151515);font:500 14px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.16);cursor:pointer";
    var mask=document.createElement("div");
    mask.hidden=true;
    mask.style.cssText="position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.48);backdrop-filter:blur(5px)";
    var dialog=document.createElement("section");
    dialog.setAttribute("role","dialog");
    dialog.setAttribute("aria-modal","true");
    dialog.setAttribute("aria-label","Mobile remote / 手机远程");
    dialog.style.cssText="width:min(500px,100%);height:min(560px,calc(100vh - 40px));display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:18px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:0 24px 80px rgba(0,0,0,.28);transition:height .16s ease";
    var toolbar=document.createElement("div");
    toolbar.style.cssText="box-sizing:border-box;height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:flex-end;padding:5px 8px";
    var close=document.createElement("button");
    close.type="button";
    close.textContent="×";
    close.setAttribute("aria-label","Close / 关闭");
    close.style.cssText="width:34px;height:34px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font:24px/1 system-ui;cursor:pointer";
    var frame=document.createElement("iframe");
    frame.title="Mobile remote / 手机远程";
    frame.src="/__dsh_mobile";
    frame.style.cssText="width:100%;min-height:0;flex:1;border:0;background:transparent";
    toolbar.append(close);dialog.append(toolbar,frame);mask.append(dialog);
    function open(){mask.hidden=false;mask.style.display="flex";frame.src="/__dsh_mobile";close.focus()}
    function shut(){mask.hidden=true;mask.style.display="none";button.focus()}
    button.onclick=open;close.onclick=shut;
    mask.onclick=function(event){if(event.target===mask)shut()};
    document.addEventListener("keydown",function(event){if(event.key==="Escape"&&!mask.hidden)shut()});
    addEventListener('message',function(event){if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='dsh-mobile-size')return;var contentHeight=Number(event.data.height);if(!Number.isFinite(contentHeight))return;var maxHeight=innerHeight-40;dialog.style.height=Math.min(Math.max(contentHeight+44,320),maxHeight)+'px'});
    document.addEventListener("DOMContentLoaded",function(){document.head.append(localeStyle);document.body.append(button,mask)},{once:true});
  })()</script>`
  return html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`
}
