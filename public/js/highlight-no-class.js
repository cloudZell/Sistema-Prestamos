// Highlight elements without class (development helper)
(function(){
  try{
    if(typeof window === 'undefined') return;
    if(window.location.port !== '3443') return; // activar solo en dev local

    function highlight(){
      // limpiar previos
      document.querySelectorAll('.__no_class_highlight').forEach(el=>el.classList.remove('__no_class_highlight'));
      document.querySelectorAll('[data-no-class-badge]').forEach(b=>b.remove());

      const all = Array.from(document.body.querySelectorAll('*'));
      all.forEach(el=>{
        if(el === document.body || el === document.documentElement) return;
        if(!el.hasAttribute('class')){
          el.classList.add('__no_class_highlight');
          // estilo inline para evitar depender de CSS
          el.style.outline = '2px dashed rgba(255,99,71,0.9)';
          el.style.position = el.style.position || 'relative';
          const badge = document.createElement('span');
          badge.textContent = 'no-class';
          badge.setAttribute('data-no-class-badge','1');
          badge.style.position = 'absolute';
          badge.style.left = '0';
          badge.style.top = '0';
          badge.style.background = 'rgba(255,99,71,0.95)';
          badge.style.color = '#fff';
          badge.style.fontSize = '10px';
          badge.style.padding = '2px 4px';
          badge.style.borderRadius = '0 0 4px 0';
          badge.style.zIndex = '9999';
          el.appendChild(badge);
        }
      });
    }

    window.addEventListener('load', ()=> setTimeout(highlight, 300));
    // re-ejecutar al hacer clic y al cambiar el DOM
    new MutationObserver((m)=>{ setTimeout(highlight, 200); }).observe(document.body, { childList:true, subtree:true, attributes:true });
  }catch(e){ console.error('highlight-no-class helper error', e); }
})();
