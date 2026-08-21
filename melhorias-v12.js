// Gestão Farmacêutica - melhorias v12
// Une prescrição e dispensação, adiciona histórico separado e corrige exportação XLSX.

(function(){
  const originalPage = window.page;
  const originalPedidos = window.pedidos;

  async function dispensacaoUnificada(c){
    const [{data:patients,error:ep},{data:meds,error:em}] = await Promise.all([
      sb.from('patients').select('id,nome').eq('ativo',true).order('nome'),
      sb.from('medications').select('id,nome,dosagem,forma,unidade,apresentacao').eq('ativo',true).order('nome')
    ]);
    if(ep) throw ep;
    if(em) throw em;

    c.innerHTML = `
      <div class="card">
        <h2>Adicionar Dispensação</h2>
        <p class="small">Registre paciente, prescritor, CRM, medicamento e lote. Ao confirmar, o saldo do lote será baixado automaticamente.</p>
        <form id="fdNova" class="grid">
          <div><label>Paciente</label><select name="patient_id" required><option value="">Selecione...</option>${(patients||[]).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div>
          <div><label>Prescritor</label><input name="prescritor" required placeholder="Nome do prescritor"></div>
          <div><label>CRM</label><input name="crm" required placeholder="Ex.: CRM-MG 12345"></div>
          <div><label>Medicamento</label><select id="dispMed" name="medication_id" required><option value="">Selecione...</option>${(meds||[]).map(x=>`<option value="${x.id}">${esc(x.nome)} ${esc(x.dosagem||'')}${x.apresentacao?` — ${esc(x.apresentacao)}`:''}</option>`).join('')}</select></div>
          <div><label>Lote</label><select id="dispLote" name="stock_lot_id" required disabled><option value="">Selecione o medicamento primeiro</option></select></div>
          <div><label>Validade do lote</label><input id="dispValidade" readonly></div>
          <div><label>Saldo do lote</label><input id="dispSaldo" readonly></div>
          <div><label>Quantidade dispensada</label><input name="quantidade" type="number" min="0.01" step="0.01" required></div>
          <div><label>Posologia</label><input name="posologia" placeholder="Ex.: 1 comprimido 2x ao dia"></div>
          <div><label>Data da dispensação</label><input type="date" value="${new Date().toISOString().slice(0,10)}" readonly></div>
          <div style="grid-column:1/-1"><label>Observações</label><input name="observacoes" placeholder="Opcional"></div>
          <div><button type="submit">Confirmar Dispensação</button></div>
        </form>
      </div>`;

    let lotes=[];
    const medSel=$('#dispMed'), loteSel=$('#dispLote'), validade=$('#dispValidade'), saldo=$('#dispSaldo');
    const atualizarDetalhes=()=>{
      const l=lotes.find(x=>x.id===loteSel.value);
      validade.value=l?.validade?new Date(l.validade+'T00:00:00').toLocaleDateString('pt-BR'):'';
      saldo.value=l?String(l.quantidade_atual):'';
    };
    medSel.onchange=async()=>{
      loteSel.disabled=true; loteSel.innerHTML='<option>Carregando...</option>'; validade.value=''; saldo.value='';
      if(!medSel.value){loteSel.innerHTML='<option value="">Selecione o medicamento primeiro</option>';return;}
      const {data,error}=await sb.from('stock_lots').select('id,lote,validade,quantidade_atual').eq('medication_id',medSel.value).gt('quantidade_atual',0).order('validade',{ascending:true,nullsFirst:false});
      if(error){alert(error.message);loteSel.innerHTML='<option value="">Erro ao carregar lotes</option>';return;}
      lotes=data||[];
      loteSel.innerHTML=lotes.length?'<option value="">Selecione...</option>'+lotes.map(l=>`<option value="${l.id}">${esc(l.lote||'Sem lote')} — val. ${l.validade?new Date(l.validade+'T00:00:00').toLocaleDateString('pt-BR'):'—'} — saldo ${l.quantidade_atual}</option>`).join(''):'<option value="">Sem lote com saldo disponível</option>';
      loteSel.disabled=!lotes.length;
    };
    loteSel.onchange=atualizarDetalhes;

    $('#fdNova').onsubmit=async e=>{
      e.preventDefault();
      const fd=new FormData(e.target);
      const btn=e.target.querySelector('button[type="submit"]');
      btn.disabled=true; btn.textContent='Registrando...';
      const {error}=await sb.rpc('dispense_stock_direto',{
        p_patient_id:fd.get('patient_id'),
        p_prescritor:String(fd.get('prescritor')||'').trim(),
        p_crm:String(fd.get('crm')||'').trim(),
        p_medication_id:fd.get('medication_id'),
        p_stock_lot_id:fd.get('stock_lot_id'),
        p_quantidade:+fd.get('quantidade'),
        p_posologia:String(fd.get('posologia')||'').trim()||null,
        p_observacoes:String(fd.get('observacoes')||'').trim()||null
      });
      btn.disabled=false; btn.textContent='Confirmar Dispensação';
      if(error) return alert(error.message);
      alert('Dispensação registrada com sucesso e estoque atualizado.');
      window.page('dispensacao');
    };
  }

  async function historicoDispensacoes(c){
    if(!['admin','gestor'].includes(profile?.role)){
      c.innerHTML='<div class="card warn">Histórico disponível somente para administrador e gestor.</div>';
      return;
    }
    const {data,error}=await sb.from('dispensations')
      .select('id,data_dispensacao,prescritor,crm,posologia,observacoes,patients(nome),profiles(nome),dispensation_items(quantidade,medications(nome,dosagem,forma),stock_lots(lote,validade))')
      .order('data_dispensacao',{ascending:false}).limit(1000);
    if(error) throw error;
    const rows=(data||[]).flatMap(d=>(d.dispensation_items||[]).map(i=>({
      data:d.data_dispensacao,
      paciente:d.patients?.nome||'',
      prescritor:d.prescritor||'',
      crm:d.crm||'',
      medicamento:`${i.medications?.nome||''} ${i.medications?.dosagem||''}`.trim(),
      lote:i.stock_lots?.lote||'',
      validade:i.stock_lots?.validade||'',
      quantidade:i.quantidade,
      usuario:d.profiles?.nome||'',
      posologia:d.posologia||''
    })));
    c.innerHTML=`<div class="card"><h2>Histórico de Dispensações</h2><p class="small">Registros separados da tela de dispensação.</p><input id="buscaHistDisp" placeholder="Pesquisar paciente, medicamento, prescritor, CRM ou lote"><div id="tblHistDisp"></div></div>`;
    const render=list=>{$('#tblHistDisp').innerHTML=`<div style="overflow-x:auto"><table><tr><th>Data</th><th>Paciente</th><th>Prescritor</th><th>CRM</th><th>Medicamento</th><th>Lote</th><th>Validade</th><th>Quantidade</th><th>Usuário</th></tr>${list.map(x=>`<tr><td>${new Date(x.data).toLocaleString('pt-BR')}</td><td>${esc(x.paciente)}</td><td>${esc(x.prescritor)}</td><td>${esc(x.crm)}</td><td>${esc(x.medicamento)}</td><td>${esc(x.lote)}</td><td>${x.validade?new Date(x.validade+'T00:00:00').toLocaleDateString('pt-BR'):'—'}</td><td>${x.quantidade}</td><td>${esc(x.usuario)}</td></tr>`).join('')}</table></div>`;};
    render(rows);
    $('#buscaHistDisp').oninput=e=>{const q=e.target.value.toLowerCase();render(rows.filter(x=>[x.paciente,x.prescritor,x.crm,x.medicamento,x.lote].some(v=>String(v).toLowerCase().includes(q))))};
  }

  async function pedidosComXlsx(c){
    await originalPedidos(c);
    const btn=$('#baixarExcel');
    if(!btn) return;
    btn.textContent='Baixar Excel (.xlsx)';
    btn.onclick=()=>{
      if(!window.XLSX){alert('Biblioteca do Excel não carregou. Atualize a página e tente novamente.');return;}
      const tabela=$('#orderCalc table');
      if(!tabela){alert('Não há medicamentos para gerar o pedido.');return;}
      const dados=[];
      tabela.querySelectorAll('tr').forEach((tr,idx)=>{
        if(idx===0)return;
        const td=tr.querySelectorAll('td');
        if(td.length<5)return;
        const chk=td[0].querySelector('input[type="checkbox"]');
        if(chk && !chk.checked)return;
        const qtd=td[4].querySelector('input');
        const valor=+(qtd?.value||0);
        if(valor<=0)return;
        dados.push({
          'Nome do medicamento':td[1].textContent.trim(),
          'Dosagem / Concentração':td[2].textContent.trim(),
          'Forma farmacêutica':td[3].textContent.trim(),
          'Quantidade':valor
        });
      });
      if(!dados.length){alert('Selecione pelo menos um medicamento.');return;}
      const ws=XLSX.utils.json_to_sheet(dados,{header:['Nome do medicamento','Dosagem / Concentração','Forma farmacêutica','Quantidade']});
      ws['!cols']=[{wch:38},{wch:24},{wch:24},{wch:14}];
      ws['!autofilter']={ref:`A1:D${dados.length+1}`};
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,'Pedido de Medicamentos');
      XLSX.writeFile(wb,'Pedido_Medicamentos_Gestao_Farmaceutica.xlsx',{compression:true});
    };
  }

  window.dispensacao=dispensacaoUnificada;
  window.historicoDispensacoes=historicoDispensacoes;
  window.pedidos=pedidosComXlsx;
  window.page=async function(p){
    const c=$('#content');
    c.innerHTML='<div class="card">Carregando...</div>';
    try{
      if(p==='dispensacao') return await dispensacaoUnificada(c);
      if(p==='historico-dispensacoes') return await historicoDispensacoes(c);
      if(p==='pedidos') return await pedidosComXlsx(c);
      return await originalPage(p);
    }catch(e){c.innerHTML=`<div class="card warn">${esc(e.message||e)}</div>`;}
  };

  document.querySelectorAll('nav button[data-page]').forEach(b=>b.onclick=()=>window.page(b.dataset.page));
})();
