const marker = '<meta name="dsh-mobile-web-remote" content="1">'

const remoteRestrictionsScript = String.raw`<script data-dsh-mobile-restrictions>(function(){
  if(document.querySelector('meta[name="dsh-mobile-web-remote"]')===null)return;
  var blockedLabels=new Set(['添加工作区','添加工作区…','Add workspace','Add workspace…','设置','Settings']);
  function labelOf(element){return (element.getAttribute('aria-label')||element.textContent||'').replace(/\s+/g,' ').trim()}
  function applyRestrictions(){document.querySelectorAll('button,a,[role="button"],[role="menuitem"]').forEach(function(element){if(!blockedLabels.has(labelOf(element)))return;element.hidden=true;element.setAttribute('aria-hidden','true');element.setAttribute('tabindex','-1');element.style.setProperty('display','none','important')})}
  applyRestrictions();
  new MutationObserver(applyRestrictions).observe(document.documentElement,{childList:true,subtree:true});
})();</script>`

export function injectRemoteMobileRestrictions(html) {
  if (html.includes('data-dsh-mobile-restrictions')) return html
  const withMarker = html.replace('<head>', `<head>${marker}`)
  return withMarker.replace('</body>', `${remoteRestrictionsScript}</body>`)
}
