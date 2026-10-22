// Formulário de até seis itens; a RPC registra todos numa transação.
(function(){
  const previousPage=window.page;
  async function mostrar(c){
    const [{data:patients,error:ep},{data:meds,error:em}]=await Promise.all([
      sb.from('patients').select('id,nome').eq('ativo',true).order('nome'),
      sb.from('medications').select('id,nome,dosagem,apresentacao,estoque_atual_sem_lote').eq('ativo',true).order('nome')
    ]);
    if(ep)throw ep;if(em)throw em;
    c.innerHTML=`<div class="card"><h2>Adicionar Dispensação</h2>
      <p class="small">Registre até 6 medicamentos para o mesmo paciente e prescritor. Cada item tem sua própria origem de estoque, quantidade e posologia.</p>
      <form id="fdMultipla">
        <div class="grid"><div><label>Paciente</label><select name="patient_id" required><option value="">Selecione...</option>${(patients||[]).map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div>
        <div><label>Prescritor</label><input name="prescritor" required placeholder="Nome do prescritor"></div>
        <div><label>CRM</label><input name="crm" required placeholder="Ex.: CRM-MG 12345"></div></div>
        <div id="dispItens"></div><button type="button" id="addDispItem" class="secondary">Adicionar medicamento</button>
        <div><label>Observações gerais</label><input name="observacoes" placeholder="Opcional"></div>
        <button type="submit" id="confirmDisp">Confirmar dispensação</button>
      </form></div>`;
    const form=c.querySelector('#fdMultipla'), container=c.querySelector('#dispItens'), add=c.querySelector('#addDispItem');
    let nextId=0;
    function addItem(){
      if(container.children.length>=6)return;
      const row=document.createElement('fieldset');row.className='card disp-item';row.style.border='1px solid #cbd5e1';
      row.dataset.row=String(++nextId);
      row.innerHTML=`<legend>Medicamento</legend><div class="grid">
        <div><label>Medicamento</label><select class="med" required><option value="">Selecione...</option>${(meds||[]).map(m=>`<option value="${m.id}">${esc(m.nome)} ${esc(m.dosagem||'')}${m.apresentacao?` — ${esc(m.apresentacao)}`:''}</option>`).join('')}</select></div>
        <div><label>Origem do estoque</label><select class="origem"><option value="lote">Estoque com lote</option><option value="sem_lote">Estoque sem lote</option></select></div>
        <div class="lote-box"><label>Lote</label><select class="lote" required><option value="">Selecione o medicamento primeiro</option></select></div>
        <div class="validade-box"><label>Validade do lote</label><input class="validade" readonly></div>
        <div><label>Saldo disponível</label><input class="saldo" readonly></div>
        <div><label>Quantidade dispensada</label><input class="quantidade" type="number" min="0.01" step="0.01" required></div>
        <div><label>Posologia</label><input class="posologia" placeholder="Ex.: 1 comprimido 2x ao dia"></div></div>
        <button type="button" class="secondary remover">Remover este medicamento</button>
        ${['admin','gestor'].includes(profile?.role)?'<button type="button" class="secondary retirar-saldo">Retirar quantidade do saldo</button> <button type="button" class="danger zerar-saldo">Zerar todo o saldo desta origem</button><p class="small">Para retirar somente algumas unidades, use Retirar quantidade. Zerar todo o saldo elimina o saldo inteiro da origem selecionada. Escolha estoque sem lote ou um lote específico. Ambos exigem motivo e ficam na auditoria.</p>':''}`;
      container.append(row);
      const med=row.querySelector('.med'),origem=row.querySelector('.origem'),lote=row.querySelector('.lote'),saldo=row.querySelector('.saldo'),validade=row.querySelector('.validade');
      let lotes=[],request=0,ajustando=false;
      function details(){
        if(origem.value==='sem_lote'){
          const m=(meds||[]).find(x=>String(x.id)===med.value);
          saldo.value=m?String(+m.estoque_atual_sem_lote||0):'';validade.value='';return;
        }
        const l=lotes.find(x=>String(x.id)===lote.value);
        saldo.value=l?String(l.quantidade_atual):'';
        validade.value=l?.validade?new Date(l.validade+'T00:00:00').toLocaleDateString('pt-BR'):'';
      }
      function refresh(){
        const sem=origem.value==='sem_lote';
        row.querySelector('.lote-box').classList.toggle('hidden',sem);
        row.querySelector('.validade-box').classList.toggle('hidden',sem);
        lote.required=!sem;lote.disabled=sem||!lotes.length;details();
      }
      med.onchange=async()=>{
        const token=++request;lotes=[];lote.innerHTML='<option value="">Carregando...</option>';saldo.value='';validade.value='';refresh();
        if(!med.value){lote.innerHTML='<option value="">Selecione o medicamento primeiro</option>';return;}
        const {data,error}=await sb.from('stock_lots').select('id,lote,validade,quantidade_atual').eq('medication_id',med.value).gt('quantidade_atual',0).order('validade',{ascending:true,nullsFirst:false});
        if(token!==request||!row.isConnected)return;
        if(error){lote.innerHTML='<option value="">Erro ao carregar lotes</option>';alert(error.message);return;}
        lotes=data||[];
        lote.innerHTML=lotes.length?'<option value="">Selecione...</option>'+lotes.map(l=>`<option value="${l.id}">${esc(l.lote||'Sem identificação')} — val. ${l.validade?new Date(l.validade+'T00:00:00').toLocaleDateString('pt-BR'):'—'} — saldo ${l.quantidade_atual}</option>`).join(''):'<option value="">Nenhum lote com saldo disponível</option>';
        refresh();
      };
      origem.onchange=refresh;lote.onchange=details;
      const zerar=row.querySelector('.zerar-saldo');
      const retirar=row.querySelector('.retirar-saldo');
      function ajustarSaldo(parcial){
        if(ajustando)return;
        const m=(meds||[]).find(x=>String(x.id)===med.value);
        const sem=origem.value==='sem_lote';
        const l=lotes.find(x=>String(x.id)===lote.value);
        const atual=Number(sem?m?.estoque_atual_sem_lote:l?.quantidade_atual);
        if(!m||(!sem&&!l))return alert('Selecione o medicamento e a origem do saldo. Para estoque com lote, selecione também o lote.');
        if(!Number.isFinite(atual)||atual<=0)return alert('Esta origem já está sem saldo.');
        const descricao=sem?'Estoque sem lote':'Lote '+(l.lote||'Sem identificação');
        if(row.querySelector('.ajuste-editor'))return;
        const editor=document.createElement('div');
        editor.className='ajuste-editor warn';
        editor.innerHTML=`<h3>${parcial?'Retirar parte do estoque':'Zerar todo o saldo'}</h3>
          <p>${esc(m.nome)} ${esc(m.dosagem||'')} - ${esc(descricao)}</p>
          <p>Saldo atual: <b>${atual}</b></p>
          <label>Quantidade a retirar</label><input class="ajuste-quantidade" type="number" min="0.01" step="0.01" max="${atual}" value="${parcial?'':atual}" ${parcial?'':'readonly'}>
          <p class="ajuste-previa" aria-live="polite">Informe a quantidade a retirar.</p>
          <label>Motivo do ajuste</label><input class="ajuste-motivo" placeholder="Ex.: diferença após conferência física">
          <p class="ajuste-erro" role="alert"></p>
          <button type="button" class="ajuste-confirmar">Confirmar ajuste de estoque</button>
          <button type="button" class="secondary ajuste-cancelar">Cancelar</button>`;
        row.append(editor);
        const qtd=editor.querySelector('.ajuste-quantidade'),mot=editor.querySelector('.ajuste-motivo'),previa=editor.querySelector('.ajuste-previa'),erro=editor.querySelector('.ajuste-erro');
        const medId=m.id,lotId=sem?null:l.id;
        const selecionado=()=>med.value===medId&&(origem.value==='sem_lote')===sem&&(sem||lote.value===lotId);
        const fechar=()=>editor.remove();
        editor.querySelector('.ajuste-cancelar').onclick=fechar;
        function calcular(){
          const quantidade=Number(qtd.value);
          const valido=qtd.value.trim()!==''&&Number.isFinite(quantidade)&&quantidade>0&&quantidade<=atual;
          const novoSaldo=valido?Number((atual-quantidade).toFixed(8)):null;
          previa.textContent=valido?'Retirar '+quantidade+' | Saldo final: '+novoSaldo:'Informe uma quantidade maior que zero e menor ou igual a '+atual+'.';
          return {quantidade,novoSaldo,valido};
        }
        qtd.oninput=calcular;calcular();qtd.focus();
        editor.querySelector('.ajuste-confirmar').onclick=async()=>{
        if(ajustando)return;
        erro.textContent='';
        if(!selecionado()){fechar();return alert('O medicamento ou a origem mudou. Abra o ajuste novamente.');}
        const {novoSaldo,valido}=calcular();
        const motivo=mot.value.trim();
        if(!valido){erro.textContent='Confira a quantidade a retirar.';return;}
        if(!motivo){erro.textContent='Informe o motivo do ajuste.';mot.focus();return;}
        ajustando=true;
        const controls=[...form.querySelectorAll('input,select,button')];
        const estados=controls.map(el=>el.disabled);
        controls.forEach(el=>el.disabled=true);zerar.textContent='Ajustando...';
        try{
          const {data,error}=await sb.rpc('corrigir_estoque_manual',{
            p_medication_id:m.id,p_origem:sem?'SEM_LOTE':'LOTE',p_novo_saldo:novoSaldo,
            p_stock_lot_id:sem?null:l.id,p_motivo:motivo
          });
          if(error)throw error;
          if(sem)m.estoque_atual_sem_lote=novoSaldo;
          else l.quantidade_atual=novoSaldo;
          row.querySelector('.quantidade').value='';
          for(const other of container.children){
            if(other.querySelector('.med').value===m.id)other.querySelector('.quantidade').value='';
          }
          fechar();
          // Recarrega os saldos de todas as linhas que utilizam o mesmo medicamento.
          await Promise.all([...container.children].filter(other=>other.querySelector('.med').value===m.id).map(other=>other.querySelector('.med').onchange()));
          alert('Saldo ajustado de '+(data?.saldo_anterior??atual)+' para '+novoSaldo+'. Ajuste registrado na auditoria.');
        }catch(err){erro.textContent='Não foi possível concluir o ajuste: '+(err.message||err);}
        finally{
          controls.forEach((el,i)=>el.disabled=estados[i]);
          ajustando=false;zerar.textContent='Zerar todo o saldo desta origem';
          container.querySelectorAll('.origem').forEach(el=>el.onchange());
          numberRows();
        }
        };
      }
      if(zerar)zerar.onclick=()=>ajustarSaldo(false);
      if(retirar)retirar.onclick=()=>ajustarSaldo(true);

      row.querySelector('.remover').onclick=()=>{row.remove();numberRows();};
      refresh();numberRows();
    }
    function numberRows(){
      [...container.children].forEach((r,i)=>r.querySelector('legend').textContent=`Medicamento ${i+1}`);
      add.disabled=container.children.length>=6;
      container.querySelectorAll('.remover').forEach(b=>b.disabled=container.children.length===1);
    }
    add.onclick=addItem;addItem();
    form.onsubmit=async e=>{
      e.preventDefault();
      const fd=new FormData(form),itens=[],used=new Map();
      for(const row of container.children){
        const med=row.querySelector('.med').value,sem=row.querySelector('.origem').value==='sem_lote',lot=row.querySelector('.lote').value;
        const quantidade=Number(row.querySelector('.quantidade').value),saldo=Number(row.querySelector('.saldo').value);
        if(!med||(!sem&&!lot)||!Number.isFinite(quantidade)||quantidade<=0)return alert('Preencha medicamento, lote e quantidade em todos os itens.');
        const key=med+':'+(sem?'sem_lote':lot),sum=(used.get(key)||0)+quantidade;
        if(sum>saldo)return alert(`Estoque insuficiente no medicamento ${itens.length+1}. Confira as quantidades dos itens repetidos.`);
        used.set(key,sum);
        itens.push({medication_id:med,stock_lot_id:sem?null:lot,quantidade,posologia:row.querySelector('.posologia').value.trim()||null});
      }
      const btn=c.querySelector('#confirmDisp');btn.disabled=true;btn.textContent='Registrando...';
      try{
        const {error}=await sb.rpc('dispense_stock_direto_multiplo',{
          p_patient_id:fd.get('patient_id'),p_prescritor:String(fd.get('prescritor')).trim(),p_crm:String(fd.get('crm')).trim(),
          p_itens:itens,p_observacoes:String(fd.get('observacoes')||'').trim()||null
        });
        if(error)throw error;
        alert(`Dispensação registrada com ${itens.length} medicamento(s).`);window.page('dispensacao');
      }catch(error){alert('Não foi possível registrar: '+error.message);btn.disabled=false;btn.textContent='Confirmar dispensação';}
    };
  }
  window.dispensacao=mostrar;
  window.page=async function(p){
    if(p!=='dispensacao')return previousPage(p);
    const c=document.querySelector('#content');c.innerHTML='<div class="card">Carregando...</div>';
    try{await mostrar(c)}catch(e){c.innerHTML=`<div class="card warn">${esc(e.message||e)}</div>`;}
  };
  document.querySelectorAll('nav button[data-page="dispensacao"]').forEach(b=>b.onclick=()=>window.page('dispensacao'));
})();

