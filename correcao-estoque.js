// Gestão Farmacêutica — correção manual segura de estoque
// Não apaga registros. Apenas ajusta o saldo selecionado e registra auditoria no banco.
(function(){
  const previousPage=window.page;
  if(typeof previousPage!=='function') return;

  async function instalarCorrecaoEstoque(){
    const c=document.querySelector('#content');
    if(!c || document.querySelector('#correcaoEstoqueCard')) return;
    if(!['admin','gestor'].includes(profile?.role)) return;

    const [{data:meds,error:em},{data:lots,error:el}]=await Promise.all([
      sb.from('medications').select('id,nome,dosagem,forma,unidade,apresentacao,estoque_atual_sem_lote,ativo').eq('ativo',true).order('nome'),
      sb.from('stock_lots').select('id,medication_id,lote,validade,quantidade_atual').order('validade',{ascending:true,nullsFirst:false})
    ]);
    if(em) throw em;
    if(el) throw el;

    const card=document.createElement('div');
    card.id='correcaoEstoqueCard';
    card.className='card';
    card.innerHTML=`
      <h2>Correção de estoque</h2>
      <p class="small"><b>Uso para ajuste de inventário.</b> O sistema preserva os cadastros e históricos atuais. Informe o saldo correto encontrado, e a alteração ficará registrada na auditoria com saldo anterior, novo saldo e motivo.</p>
      <div class="warn" style="margin-bottom:12px">A correção substitui somente o saldo selecionado. Não exclui medicamento, lote, paciente, dispensação ou histórico.</div>
      <form id="fCorrecaoEstoque" class="grid">
        <div><label>Medicamento</label><select id="corrMed" required><option value="">Selecione...</option>${(meds||[]).map(m=>`<option value="${m.id}">${esc(m.nome)} ${esc(m.dosagem||'')}${m.apresentacao?` — ${esc(m.apresentacao)}`:''}</option>`).join('')}</select></div>
        <div><label>Tipo de estoque</label><select id="corrOrigem"><option value="SEM_LOTE">Estoque sem lote</option><option value="LOTE">Estoque com lote</option></select></div>
        <div id="corrLoteBox" class="hidden"><label>Lote</label><select id="corrLote"><option value="">Selecione o medicamento primeiro</option></select></div>
        <div><label>Saldo atual</label><input id="corrSaldoAtual" readonly></div>
        <div><label>Novo saldo correto</label><input id="corrNovoSaldo" type="number" min="0" step="0.01" required placeholder="Ex.: 120"></div>
        <div style="grid-column:1/-1"><label>Motivo da correção</label><input id="corrMotivo" required placeholder="Ex.: conferência física do armário / ajuste de inventário"></div>
        <div><button type="submit">Confirmar correção</button></div>
      </form>`;
    c.appendChild(card);

    const medSel=document.querySelector('#corrMed'), origem=document.querySelector('#corrOrigem'), loteSel=document.querySelector('#corrLote'), saldoAtual=document.querySelector('#corrSaldoAtual');
    const medAtual=()=> (meds||[]).find(m=>String(m.id)===String(medSel.value));
    const lotesDoMed=()=> (lots||[]).filter(l=>String(l.medication_id)===String(medSel.value));

    function atualizar(){
      const comLote=origem.value==='LOTE';
      document.querySelector('#corrLoteBox').classList.toggle('hidden',!comLote);
      if(!medSel.value){saldoAtual.value='';loteSel.innerHTML='<option value="">Selecione o medicamento primeiro</option>';return;}
      if(!comLote){
        const m=medAtual();
        saldoAtual.value=m?String(+m.estoque_atual_sem_lote||0):'';
        return;
      }
      const ls=lotesDoMed();
      loteSel.innerHTML=ls.length?'<option value="">Selecione...</option>'+ls.map(l=>`<option value="${l.id}">${esc(l.lote||'Sem identificação')} — val. ${l.validade?new Date(l.validade+'T00:00:00').toLocaleDateString('pt-BR'):'—'} — saldo ${l.quantidade_atual}</option>`).join(''):'<option value="">Nenhum lote cadastrado para este medicamento</option>';
      const l=ls.find(x=>String(x.id)===String(loteSel.value));
      saldoAtual.value=l?String(l.quantidade_atual):'';
    }

    medSel.onchange=()=>{loteSel.value='';atualizar();};
    origem.onchange=()=>{loteSel.value='';atualizar();};
    loteSel.onchange=()=>{
      const l=lotesDoMed().find(x=>String(x.id)===String(loteSel.value));
      saldoAtual.value=l?String(l.quantidade_atual):'';
    };

    document.querySelector('#fCorrecaoEstoque').onsubmit=async e=>{
      e.preventDefault();
      const comLote=origem.value==='LOTE';
      const novo=+document.querySelector('#corrNovoSaldo').value;
      const motivo=document.querySelector('#corrMotivo').value.trim();
      if(!medSel.value) return alert('Selecione o medicamento.');
      if(comLote && !loteSel.value) return alert('Selecione o lote.');
      if(!Number.isFinite(novo) || novo<0) return alert('Informe um novo saldo válido, maior ou igual a zero.');
      if(!motivo) return alert('Informe o motivo da correção.');
      const anterior=+saldoAtual.value||0;
      const origemTexto=comLote?'estoque do lote':'estoque sem lote';
      if(!confirm(`Confirmar correção do ${origemTexto} de ${anterior} para ${novo}?\n\nMotivo: ${motivo}`)) return;
      const btn=e.target.querySelector('button[type="submit"]');
      btn.disabled=true;btn.textContent='Corrigindo...';
      try{
        const {error}=await sb.rpc('corrigir_estoque_manual',{
          p_medication_id:medSel.value,
          p_origem:origem.value,
          p_novo_saldo:novo,
          p_stock_lot_id:comLote?loteSel.value:null,
          p_motivo:motivo
        });
        if(error) throw error;
        alert(`Estoque corrigido com sucesso: ${anterior} → ${novo}. A alteração foi registrada na auditoria.`);
        await window.page('medicamentos');
      }catch(err){
        alert('Erro ao corrigir estoque: '+(err?.message||err));
      }finally{
        btn.disabled=false;btn.textContent='Confirmar correção';
      }
    };
    atualizar();
  }

  window.page=async function(p){
    const result=await previousPage(p);
    if(p==='medicamentos'){
      try{await instalarCorrecaoEstoque();}
      catch(e){console.error('Falha ao carregar correção de estoque:',e);}
    }
    return result;
  };
  document.querySelectorAll('nav button[data-page]').forEach(b=>b.onclick=()=>window.page(b.dataset.page));
})();
