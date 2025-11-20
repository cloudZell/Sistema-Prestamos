// public/js/ui.js
// Helper UI: toasts, confirm modal, inline errors
(function(){
  // Toast system with stack limit and close button
  function createContainer(){
    let c = document.querySelector('.toast-container');
    if(!c){ c = document.createElement('div'); c.className='toast-container'; document.body.appendChild(c); }
    return c;
  }

  function showToast(msg, type='info', ms=4000){
    const c = createContainer();
    const t = document.createElement('div'); t.className = `toast ${type}`;
    const txt = document.createElement('div'); txt.textContent = msg; txt.style.display='inline-block'; txt.style.marginRight='8px';
    const close = document.createElement('button'); close.textContent='✕'; close.style.border='none'; close.style.background='transparent'; close.style.color='inherit'; close.style.cursor='pointer'; close.style.float='right';
    t.appendChild(txt); t.appendChild(close);
    c.insertBefore(t, c.firstChild);
    // stack limit 5
    while(c.children.length > 5) c.removeChild(c.lastChild);
    const timeout = setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, ms);
    close.onclick = ()=>{ clearTimeout(timeout); t.remove(); };
    return t;
  }

  // Confirm modal returning promise
  function confirmModal(title, message){
    return new Promise((resolve)=>{
      const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
      const modal = document.createElement('div'); modal.className='modal';
      modal.innerHTML = `<h3>${title}</h3><p style="margin-top:8px">${message}</p><div style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="_ui_confirm_ok">Aceptar</button><button class="btn secondary" id="_ui_confirm_cancel">Cancelar</button></div>`;
      backdrop.appendChild(modal); document.body.appendChild(backdrop);
      document.getElementById('_ui_confirm_ok').onclick = ()=>{ backdrop.remove(); resolve(true); };
      document.getElementById('_ui_confirm_cancel').onclick = ()=>{ backdrop.remove(); resolve(false); };
    });
  }

  // Inline error helpers
  function showInlineError(inputEl, msg){
    clearInlineError(inputEl);
    const wrap = document.createElement('div'); wrap.className='inline-error'; wrap.textContent = msg; wrap.style.color='var(--danger)'; wrap.style.fontSize='13px'; wrap.style.marginTop='6px';
    inputEl.classList.add('input-error');
    inputEl.parentNode && inputEl.parentNode.insertBefore(wrap, inputEl.nextSibling);
  }
  function clearInlineError(inputEl){
    if(!inputEl) return;
    inputEl.classList.remove('input-error');
    const sib = inputEl.nextSibling; if(sib && sib.className === 'inline-error') sib.remove();
  }

  // Input modal: fields = [{name, label, type='text', value:'', placeholder:''}]
  function inputModal(title, fields){
    return new Promise((resolve)=>{
      const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
      const modal = document.createElement('div'); modal.className='modal';
      const form = document.createElement('form');
      form.style.maxWidth = '100%';
      form.innerHTML = `<h3>${title}</h3>`;
      fields.forEach(f=>{
        const group = document.createElement('div'); group.className='form-group';
        const label = document.createElement('label'); label.textContent = f.label || f.name;
        const input = document.createElement('input'); input.type = f.type || 'text'; input.name = f.name; input.value = f.value || '';
        if(f.placeholder) input.placeholder = f.placeholder;
        group.appendChild(label); group.appendChild(input); form.appendChild(group);
      });
      const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px'; actions.style.marginTop='12px';
      const ok = document.createElement('button'); ok.className='btn'; ok.type='submit'; ok.textContent='Aceptar';
      const cancel = document.createElement('button'); cancel.className='btn secondary'; cancel.type='button'; cancel.textContent='Cancelar';
      actions.appendChild(ok); actions.appendChild(cancel); form.appendChild(actions);
      modal.appendChild(form); backdrop.appendChild(modal); document.body.appendChild(backdrop);

      cancel.addEventListener('click', ()=>{ backdrop.remove(); resolve(null); });
      form.addEventListener('submit', (e)=>{
        e.preventDefault();
        const data = {};
        fields.forEach(f=>{ const v = form.elements[f.name] ? form.elements[f.name].value : ''; data[f.name] = v; });
        backdrop.remove(); resolve(data);
      });
    });
  }

  window.UI = { showToast, confirmModal, showInlineError, clearInlineError, inputModal };
  // Wire global logout buttons
  document.addEventListener('DOMContentLoaded', ()=>{
    const btns = document.querySelectorAll('#btnCerrarSesion');
    btns.forEach(b=> b.addEventListener('click', ()=>{ sessionStorage.clear(); window.location.href = '/vistas/login.html'; }));
  });
})();
