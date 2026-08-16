const driveShortcutScript = String.raw`<script data-dsh-drive-shortcuts>(function(){
  var overlay;
  function setReactInput(input,value){
    var setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function navigate(path){
    var dialog=document.querySelector('[role="dialog"][aria-label="选择工作区目录"]');
    if(!dialog)return;
    var edit=dialog.querySelector('button[aria-label="编辑路径"]');
    if(edit)edit.click();
    requestAnimationFrame(function(){
      var input=dialog.querySelector('input[aria-label="编辑路径"]');
      if(!input)return;
      setReactInput(input,path);
      setTimeout(function(){
        input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
      },150);
    });
  }
  function close(){if(overlay)overlay.remove();overlay=undefined;}
  async function open(){
    close();
    overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML='<section role="dialog" aria-modal="true" aria-label="我的电脑" style="box-sizing:border-box;width:min(420px,100%);max-height:80dvh;overflow:auto;padding:20px;border:1px solid var(--dsw-alias-border-l2,#555);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#181818);color:var(--dsw-alias-label-primary,#fff);font:14px system-ui"><h2 style="margin:0 0 14px;font-size:18px">我的电脑</h2><div data-roots>正在读取磁盘…</div><button data-close style="margin-top:16px;padding:9px 14px;border:1px solid var(--dsw-alias-border-l2,#555);border-radius:8px;background:transparent;color:inherit">取消</button></section>';
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close]').onclick=close;
    overlay.addEventListener('click',function(event){if(event.target===overlay)close()});
    var roots=overlay.querySelector('[data-roots]');
    try{
      var response=await fetch('/__dsh_mobile/fs/roots',{cache:'no-store'});
      var data=await response.json();
      if(!response.ok)throw new Error(data.error||'读取失败');
      roots.replaceChildren();
      data.roots.forEach(function(path){
        var button=document.createElement('button');
        button.type='button';
        button.textContent='💽  '+path;
        button.style.cssText='display:flex;width:100%;margin:6px 0;padding:12px;border:1px solid var(--dsw-alias-border-l3,#444);border-radius:9px;background:transparent;color:inherit;font:600 15px system-ui;text-align:left';
        button.onclick=function(){close();navigate(path)};
        roots.appendChild(button);
      });
    }catch(error){roots.textContent=error instanceof Error?error.message:String(error)}
  }
  function enhance(){
    document.querySelectorAll('[role="dialog"][aria-label="选择工作区目录"]').forEach(function(dialog){
      if(dialog.querySelector('[data-dsh-my-computer]'))return;
      var home=Array.from(dialog.querySelectorAll('button')).find(function(button){return button.textContent.trim()==='主目录'});
      if(!home)return;
      var button=document.createElement('button');
      button.type='button';
      button.textContent='我的电脑';
      button.setAttribute('data-dsh-my-computer','');
      button.style.cssText='margin-left:8px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer';
      button.onclick=function(){void open()};
      home.insertAdjacentElement('afterend',button);
    });
  }
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
})();</script>`

export function injectDriveShortcuts(html) {
  if (html.includes('data-dsh-drive-shortcuts')) return html
  return html.replace('</body>', `${driveShortcutScript}</body>`)
}
