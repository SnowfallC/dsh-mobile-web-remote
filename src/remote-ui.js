const marker = '<meta name="dsh-mobile-web-remote" content="1">'

const remoteRestrictionsScript = String.raw`<script data-dsh-mobile-restrictions>(function(){
  if(document.querySelector('meta[name="dsh-mobile-web-remote"]')===null)return;
  var blockedLabels=new Set(['添加工作区','添加工作区…','Add workspace','Add workspace…','设置','Settings']);
  function labelOf(element){return (element.getAttribute('aria-label')||element.textContent||'').replace(/\s+/g,' ').trim()}
  function isBlocked(element){return blockedLabels.has(labelOf(element))||element.querySelector('[data-slot="settings.trigger"]')!==null}
  function applyRestrictions(){document.querySelectorAll('button,a,[role="button"],[role="menuitem"]').forEach(function(element){if(!isBlocked(element))return;element.hidden=false;if('disabled'in element)element.disabled=true;element.setAttribute('aria-disabled','true');element.setAttribute('tabindex','-1');element.setAttribute('data-dsh-mobile-disabled','');element.style.setProperty('opacity','.38','important');element.style.setProperty('cursor','not-allowed','important');element.style.setProperty('pointer-events','none','important')})}
  applyRestrictions();
  new MutationObserver(applyRestrictions).observe(document.documentElement,{childList:true,subtree:true});
})();</script>`

export function injectRemoteMobileRestrictions(html) {
  if (html.includes('data-dsh-mobile-restrictions')) return html
  const withMarker = html.replace('<head>', `<head>${marker}`)
  return withMarker.replace('</body>', `${remoteRestrictionsScript}</body>`)
}
