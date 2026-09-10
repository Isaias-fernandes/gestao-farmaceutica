// Gestão Farmacêutica — correção segura de validade de lote
// Exibe a função na tela ESTOQUE, junto do cadastro de lote/validade.
(function(){
  const previousPage=window.page;
  if(typeof previousPage!=='function') return;

  async function instalarCorrecaoValidade(){
    const c=document.querySelector('#content');
    if(!c || document.querySelector('#correcaoValidadeCard')) return;
    if(!['admin','gestor'].includes(profile?.role)) return;

    const [{data:meds,error:em},{data:lots,error:el}]=await Promise.all([
      sb.from('medications').select('id,nome,dosagem,apresentacao').eq('ativo',true).order('nome'),
      sb.from('stock_lots').select('id,medication_id,lote,validade,quantidade_atual').order('validade',{ascending:true,nullsFirst:false})
    ]);
    if(em) throw em;
    if(el) throw el;

    const card=document.createElement('div');
    card.id='correcaoValidadeCard';
    card.className='card';
    card.innerHTML=`
      <h2>Corrigir validade de lote</h2>
      <p class="small">Use esta opção quando a data de validade de um lote tiver sido cadastrada incorretamente.</p>
      <div class="warn" style="margin-bottom:12px">A correção altera somente a validade. Lote, quantidade, saldo, medicamento e históricos permanecem inalterados. A alteração fica registrada na Auditoria.</div>
      <form id="fCorrecaoValidade" class="grid">
        <div><label>Medicamento</label><select id="valMed" required><option value="">Selecione...</option>${(meds||[]).map(m=>`<option value="${m.id}">${esc(m.nome)} ${esc(m.dosagem||'')}${m.apresentacao?` — ${esc(m.apresentacao)}`:''}</option>`).join('')}</select></div>
        <div><label>Lote</label><select id="valLote" required disabled><option value="">Selecione o medicamento primeiro</option></select></div>
        <div><label>Validade atual</label><input id="valAtual" type="date" readonly></div>
        <div><label>Nova validade correta</label><input id="valNova" type="date" required></div>
        <div style="grid-column:1/-1"><label>Motivo da correção</label><input id="valMotivo" required placeholder="Ex.: validade digitada incorretamente na entrada da nota"></div>
        <div><button type="submit">Salvar correção da validade</button></div>
      </form>`;

    // Coloca o quadro no início da tela de Estoque, próximo do cadastro de lote/validade.
    c.insertBefore(card,c.firstChild);

    const medSel=document.querySelector('#valMed');
    const loteSel=document.querySelector('#valLote');
    const atual=document.querySelector('#valAtual');
    const nova=document.querySelector('#valNova');
    const lotesDoMed=()=> (lots||[]).filter(l=>String(l.medication_id)===String(medSel.value));

    medSel.onchange=()=>{
      atual.value=''; nova.value='';
      const ls=lotesDoMed();
      loteSel.disabled=!ls.length;
      loteSel.innerHTML=ls.length?'<option value="">Selecione...</option>'+ls.map(l=>`<option value="${l.id}">${esc(l.lote||'Sem identificação')} — validade ${l.validade?new Date(l.validade+'T00:00:00').toLocaleDateString('pt-BR'):'não informada'} — saldo ${l.quantidade_atual}</option>`).join(''):'<option value="">Nenhum lote cadastrado</option>';
    };
    loteSel.onchange=()=>{
      const l=lotesDoMed().find(x=>String(x.id)===String(loteSel.value));
      atual.value=l?.validade||'';
      nova.value=l?.validade||'';
    };

    document.querySelector('#fCorrecaoValidade').onsubmit=async e=>{
      e.preventDefault();
      const lote=lotesDoMed().find(x=>String(x.id)===String(loteSel.value));
      const novaVal=nova.value;
      const motivo=document.querySelector('#valMotivo').value.trim();
      if(!lote) return alert('Selecione o lote.');
      if(!novaVal) return alert('Informe a nova validade.');
      if(!motivo) return alert('Informe o motivo da correção.');
      if(lote.validade===novaVal) return alert('A nova validade é igual à validade atual.');
      const anteriorTexto=lote.validade?new Date(lote.validade+'T00:00:00').toLocaleDateString('pt-BR'):'não informada';
      const novaTexto=new Date(novaVal+'T00:00:00').toLocaleDateString('pt-BR');
      if(!confirm(`Confirmar correção da validade do lote ${lote.lote||'sem identificação'}?\n\nValidade anterior: ${anteriorTexto}\nNova validade: ${novaTexto}\nMotivo: ${motivo}`)) return;
      const btn=e.target.querySelector('button[type="submit"]');
      btn.disabled=true; btn.textContent='Corrigindo...';
      try{
        const {error}=await sb.rpc('corrigir_validade_lote',{p_stock_lot_id:lote.id,p_nova_validade:novaVal,p_motivo:motivo});
        if(error) throw error;
        alert(`Validade corrigida com sucesso: ${anteriorTexto} → ${novaTexto}. A alteração foi registrada na auditoria.`);
        await window.page('estoque');
      }catch(err){alert('Erro ao corrigir validade: '+(err?.message||err));}
      finally{btn.disabled=false;btn.textContent='Salvar correção da validade';}
    };
  }

  window.page=async function(p){
    const result=await previousPage(p);
    if(p==='estoque'){
      try{await instalarCorrecaoValidade();}
      catch(e){console.error('Falha ao carregar correção de validade:',e);}
    }
    return result;
  };
  document.querySelectorAll('nav button[data-page]').forEach(b=>b.onclick=()=>window.page(b.dataset.page));
})();
