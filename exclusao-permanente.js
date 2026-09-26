// Exclusão operacional definitiva: retira o medicamento do uso futuro e preserva todo o histórico.
(function(){
  const previousPage=window.page;
  if(typeof previousPage!=='function') return;
  const esc2=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function instalar(){
    if(!['admin','gestor'].includes(profile?.role)) return;
    const c=document.querySelector('#content');
    if(!c || document.querySelector('#exclusaoPermanenteCard')) return;
    const {data:meds,error}=await sb.from('medications').select('id,nome,dosagem,apresentacao,ativo').eq('ativo',true).order('nome');
    if(error) throw error;
    const card=document.createElement('div');
    card.id='exclusaoPermanenteCard'; card.className='card';
    card.innerHTML=`<h2>Excluir medicamento permanentemente</h2>
      <div class="warn"><b>Atenção:</b> esta opção retira definitivamente o medicamento do uso operacional. Ele sairá automaticamente das listas dos pacientes e não entrará em novos pedidos. O histórico de dispensações, prescrições, pedidos e estoque já registrado será preservado.</div>
      <div class="grid" style="margin-top:12px"><div><label>Medicamento</label><select id="medExcluirPermanente"><option value="">Selecione...</option>${(meds||[]).map(m=>`<option value="${m.id}">${esc2(m.nome)} ${esc2(m.dosagem||'')}${m.ativo===false?' — INATIVO':''}</option>`).join('')}</select></div><div style="align-self:end"><button type="button" id="btnExcluirPermanente" class="danger">Excluir permanentemente</button></div></div>
      <p class="small">O registro técnico do medicamento permanece no banco somente para preservar o histórico. Os vínculos atuais com pacientes serão desativados automaticamente.</p>`;
    c.appendChild(card);
    document.querySelector('#btnExcluirPermanente').onclick=async()=>{
      const sel=document.querySelector('#medExcluirPermanente'); const id=sel.value;
      if(!id) return alert('Selecione o medicamento.');
      const nome=sel.options[sel.selectedIndex].text;
      if(!confirm(`ATENÇÃO: exclusão permanente.\n\nMedicamento: ${nome}\n\nEle será retirado das listas operacionais e dos pacientes, mas o histórico antigo será preservado. Deseja continuar?`)) return;
      const digitado=prompt(`Para confirmar a exclusão definitiva, digite EXCLUIR:`,'');
      if(String(digitado||'').trim().toUpperCase()!=='EXCLUIR') return alert('Exclusão cancelada.');
      const btn=document.querySelector('#btnExcluirPermanente'); btn.disabled=true; btn.textContent='Excluindo...';
      try{
        const {data,error}=await sb.rpc('excluir_medicamento_permanente',{p_medication_id:id});
        if(error) throw error;
        alert(`Medicamento ${data?.nome||nome} excluído do uso operacional. ${data?.vinculos_pacientes_desativados||0} vínculo(s) com paciente(s) foram retirados. O histórico foi preservado e a operação registrada na auditoria.`);
        await window.page('medicamentos');
      }catch(e){alert(e?.message||String(e));}
      finally{btn.disabled=false;btn.textContent='Excluir permanentemente';}
    };
  }

  window.page=async function(p){const r=await previousPage(p);if(p==='medicamentos'){try{await instalar();}catch(e){console.error('Exclusão permanente:',e);}}return r;};
  document.querySelectorAll('nav button[data-page]').forEach(b=>b.onclick=()=>window.page(b.dataset.page));
})();