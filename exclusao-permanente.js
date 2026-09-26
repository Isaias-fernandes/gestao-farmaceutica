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
      <div class="grid" style="margin-top:12px"><div><label>Medicamento</label><select id="medExcluirPermanente"><option value="">Selecione...</option>${(meds||[]).map(m=>`<option value="${m.id}">${esc2(m.nome)} ${esc2(m.dosagem||'')}${m.ativo===false?' — INATIVO':''}</option>`).join('')}</select></div><div><label>Motivo</label><input id="motivoExcluirMedicamento" value="Alto custo" placeholder="Ex.: Alto custo"></div><div style="align-self:end"><button type="button" id="btnExcluirPermanente" class="danger">Excluir permanentemente</button></div></div>
      <p class="small">O registro técnico do medicamento permanece no banco somente para preservar o histórico. Os vínculos atuais com pacientes serão desativados automaticamente.</p>`;
    c.appendChild(card);
    const report=document.createElement('div');report.className='card';report.id='relatorioMedicamentosExcluidos';report.innerHTML='<h2>Relatório de medicamentos excluídos</h2><p class="small">Registro automático das exclusões operacionais. O histórico de dispensações permanece preservado.</p><div id="tblMedicamentosExcluidos">Carregando...</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" id="baixarPdfMedicamentosExcluidos" class="secondary">Baixar PDF</button><button type="button" id="baixarExcelMedicamentosExcluidos" class="secondary">Baixar Excel</button><button type="button" id="imprimirMedicamentosExcluidos" class="secondary">Imprimir relatório</button></div>';c.appendChild(report);
    const {data:logs,error:elog}=await sb.from('audit_log').select('created_at,detalhes').eq('acao','EXCLUSAO_OPERACIONAL_DEFINITIVA').order('created_at',{ascending:false});
    if(elog) document.querySelector('#tblMedicamentosExcluidos').textContent='Não foi possível carregar o relatório: '+elog.message;
    else {const rs=(logs||[]).slice().sort((a,b)=>String(a.detalhes?.nome||'').localeCompare(String(b.detalhes?.nome||''),'pt-BR',{sensitivity:'base'}));document.querySelector('#tblMedicamentosExcluidos').innerHTML=rs.length?'<div style="overflow-x:auto"><table><tr><th>Nº</th><th>Medicamento</th><th>Dosagem</th><th>Indicação terapêutica</th><th>Pacientes retirados</th><th>Motivo</th><th>Data</th></tr>'+rs.map((x,i)=>{const d=x.detalhes||{};return '<tr><td>'+(i+1)+'</td><td><b>'+esc2(d.nome||'')+'</b></td><td>'+esc2(d.dosagem||'')+'</td><td>'+esc2(d.indicacao_terapeutica||'Em revisão técnica')+'</td><td>'+esc2(d.vinculos_pacientes_desativados??0)+'</td><td>'+esc2(d.motivo||'Alto custo')+'</td><td>'+esc2(new Date(x.created_at).toLocaleString('pt-BR'))+'</td></tr>'}).join('')+'</table></div>':'Nenhum medicamento excluído registrado até o momento.';}
    const cols=['Nº','Medicamento','Dosagem','Indicação terapêutica','Pacientes retirados','Motivo','Data'];
    const linhas=(logs||[]).slice().sort((a,b)=>String(a.detalhes?.nome||'').localeCompare(String(b.detalhes?.nome||''),'pt-BR',{sensitivity:'base'})).map((x,i)=>{const d=x.detalhes||{};return [i+1,d.nome||'',d.dosagem||'',d.indicacao_terapeutica||'Em revisão técnica',d.vinculos_pacientes_desativados??0,d.motivo||'Alto custo',new Date(x.created_at).toLocaleString('pt-BR')]});
    document.querySelector('#imprimirMedicamentosExcluidos').onclick=()=>window.print();
    document.querySelector('#baixarPdfMedicamentosExcluidos').onclick=()=>{const w=window.open('','_blank');if(!w)return alert('Permita pop-ups para gerar o PDF.');const rows=linhas.map(r=>'<tr>'+r.map(v=>'<td>'+esc2(v)+'</td>').join('')+'</tr>').join('');w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório de Medicamentos Excluídos</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;font-size:9px}h1{text-align:center;font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:4px;vertical-align:top}th{font-weight:bold}</style></head><body><h1>Relatório de Medicamentos Excluídos</h1><table><thead><tr>'+cols.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>');w.document.close();};
    document.querySelector('#baixarExcelMedicamentosExcluidos').onclick=()=>{const xml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const rows=[cols,...linhas].map(r=>'<Row>'+r.map(v=>'<Cell><Data ss:Type="String">'+xml(v)+'</Data></Cell>').join('')+'</Row>').join('');const x='<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Medicamentos excluídos"><Table>'+rows+'</Table></Worksheet></Workbook>';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([x],{type:'application/vnd.ms-excel;charset=utf-8'}));a.download='medicamentos-excluidos.xls';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
    document.querySelector('#btnExcluirPermanente').onclick=async()=>{
      const sel=document.querySelector('#medExcluirPermanente'); const id=sel.value;
      if(!id) return alert('Selecione o medicamento.');
      const nome=sel.options[sel.selectedIndex].text;
      if(!confirm(`ATENÇÃO: exclusão permanente.\n\nMedicamento: ${nome}\n\nEle será retirado das listas operacionais e dos pacientes, mas o histórico antigo será preservado. Deseja continuar?`)) return;
      const btn=document.querySelector('#btnExcluirPermanente'); btn.disabled=true; btn.textContent='Excluindo...';
      try{
        const motivo=(document.querySelector('#motivoExcluirMedicamento')?.value||'Alto custo').trim()||'Alto custo';
        const {data,error}=await sb.rpc('excluir_medicamento_permanente',{p_medication_id:id,p_motivo:motivo});
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