// Gestão Farmacêutica — Pedidos v2
// Calcula necessidade dos pacientes ativos, desconta o estoque atual e gera Excel .xlsx.
// Não altera cadastros nem saldo de estoque ao gerar pedido.
(function(){
  const previousPage=window.page;
  if(typeof previousPage!=='function') return;

  const safeEsc=(v)=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number.isFinite(+v)?+v:0;
  const semAcento=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const limpar=s=>String(s??'').replace(/\s+/g,' ').trim();
  const nomePadrao=s=>limpar(s).toLowerCase().replace(/(^|\s)([a-záàâãéêíóôõúç])/g,(m,p1,p2)=>p1+p2.toUpperCase());
  const dosagemPadrao=s=>limpar(s)
    .replace(/(\d)(mg)\b/gi,'$1 mg').replace(/(\d)(mcg)\b/gi,'$1 mcg')
    .replace(/(\d)(ml)\b/gi,'$1 mL').replace(/(\d)(g)\b/gi,'$1 g')
    .replace(/(\d)(ui)\b/gi,'$1 UI').replace(/\s*\+\s*/g,' + ')
    .replace(/\bml\b/gi,'mL').replace(/\bui\b/gi,'UI');
  const formaPadrao=(forma,unidade)=>{
    const raw=limpar(forma||unidade||'Unidade');
    const k=semAcento(raw).toLowerCase();
    const map={comp:'Comprimido',comprimido:'Comprimido',comprimidos:'Comprimido',caps:'Cápsula',capsula:'Cápsula',capsulas:'Cápsula',frasco:'Frasco',frascos:'Frasco',gota:'Gotas',gotas:'Gotas',gts:'Gotas',ampola:'Ampola',ampolas:'Ampola',sache:'Sachê',saches:'Sachê',tubo:'Tubo',bisnaga:'Bisnaga','solucao oral':'Solução oral','suspensao oral':'Suspensão oral',xarope:'Xarope',colirio:'Colírio',creme:'Creme',pomada:'Pomada',gel:'Gel',locao:'Loção',spray:'Spray',injetavel:'Injetável',unidade:'Unidade'};
    return map[k]||raw||'Unidade';
  };
  const unidadeInteira=u=>/comprim|caps|ampola|frasco|unidade|sache|tubo|bisnaga/i.test(String(u||''));
  const arredondar=(v,u)=>{
    const n=Math.max(0,num(v));
    return unidadeInteira(u)?Math.ceil(n):Math.round((n+Number.EPSILON)*100)/100;
  };

  function exportarXlsx(rows){
    if(!window.XLSX) throw new Error('Biblioteca do Excel não carregou. Atualize a página e tente novamente.');
    const dados=rows.map(x=>({
      'Nome do medicamento':x.nome,
      'Dosagem / Concentração':x.dosagem,
      'Forma farmacêutica':x.forma,
      'Quantidade':x.quantidade
    }));
    const ws=XLSX.utils.json_to_sheet(dados,{header:['Nome do medicamento','Dosagem / Concentração','Forma farmacêutica','Quantidade']});
    ws['!cols']=[{wch:42},{wch:24},{wch:26},{wch:14}];
    ws['!autofilter']={ref:`A1:D${dados.length+1}`};
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Pedido de Medicamentos');
    XLSX.writeFile(wb,'Pedido_Medicamentos_Gestao_Farmaceutica.xlsx',{compression:true});
  }

  async function pedidosV2(c){
    const [{data:needs,error:en},{data:stock,error:es}]=await Promise.all([
      sb.from('patient_medication_needs').select('*').order('nome'),
      sb.from('stock_summary').select('*').order('nome')
    ]);
    if(en) throw new Error('Não foi possível carregar a necessidade dos pacientes: '+en.message);
    if(es) throw new Error('Não foi possível carregar o estoque atual: '+es.message);

    const estoquePorId=new Map((stock||[]).map(x=>[String(x.medication_id),num(x.estoque_atual)]));

    function calcular(meses){
      const grupos=new Map();
      (needs||[]).filter(x=>num(x.necessidade_mensal)>0).forEach(x=>{
        const nome=nomePadrao(x.nome);
        const dosagem=dosagemPadrao(x.dosagem||'');
        const forma=formaPadrao(x.forma,x.unidade);
        const chave=[semAcento(nome).toLowerCase(),semAcento(dosagem).toLowerCase(),semAcento(forma).toLowerCase()].join('|');
        if(!grupos.has(chave)) grupos.set(chave,{nome,dosagem,forma,unidade:x.unidade||forma,necessidade:0,estoque:0,pacientes:0,medicationIds:new Set()});
        const g=grupos.get(chave);
        g.necessidade+=num(x.necessidade_mensal)*meses;
        g.pacientes+=num(x.pacientes_ativos);
        const medId=String(x.medication_id||'');
        if(medId && !g.medicationIds.has(medId)){
          g.medicationIds.add(medId);
          g.estoque+=num(estoquePorId.get(medId));
        }
      });
      return [...grupos.values()].map(g=>({
        ...g,
        medication_id:[...g.medicationIds][0]||null,
        quantidade:arredondar(Math.max(0,g.necessidade-g.estoque),g.unidade)
      })).filter(x=>x.quantidade>0).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR',{sensitivity:'base'}));
    }

    c.innerHTML=`
      <div class="card">
        <h2>GESTÃO FARMACÊUTICA — ISAÍAS FERNANDES DE CARVALHO</h2>
        <h3>Pedido de Medicamentos</h3>
        <p>O pedido usa somente medicamentos vinculados aos pacientes, soma a necessidade do período e <b>desconta o estoque atual disponível</b> antes de calcular a quantidade a comprar.</p>
        <div class="grid">
          <div><label>Período do pedido</label><select id="mesesPedidoV2"><option value="1">1 mês</option><option value="2">2 meses</option><option value="3">3 meses</option></select></div>
          <div><label>Regra de cálculo</label><div class="pill">Necessidade dos pacientes − estoque atual</div></div>
        </div>
      </div>
      <form id="pedidoFormV2">
        <div class="card">
          <div id="resumoPedidoV2" class="small" style="margin-bottom:10px"></div>
          <div id="tabelaPedidoV2"></div>
          <label>Observações</label><input name="obs" placeholder="Observações do pedido">
          <div class="actions">
            <button type="submit">Gerar pedido e baixar Excel</button>
            <button type="button" id="baixarPedidoV2" class="secondary">Baixar Excel (.xlsx)</button>
          </div>
        </div>
      </form>`;

    let currentRows=[];
    const render=()=>{
      const meses=num(document.querySelector('#mesesPedidoV2').value)||1;
      currentRows=calcular(meses).map((x,n)=>({...x,n}));
      const necessidadeTotal=currentRows.reduce((s,x)=>s+x.necessidade,0);
      const estoqueTotal=currentRows.reduce((s,x)=>s+x.estoque,0);
      const pedidoTotal=currentRows.reduce((s,x)=>s+x.quantidade,0);
      document.querySelector('#resumoPedidoV2').innerHTML=`Itens para comprar: <b>${currentRows.length}</b> · Necessidade: <b>${necessidadeTotal.toFixed(2)}</b> · Estoque descontado: <b>${estoqueTotal.toFixed(2)}</b> · Quantidade final do pedido: <b>${pedidoTotal.toFixed(2)}</b>`;
      document.querySelector('#tabelaPedidoV2').innerHTML=currentRows.length?`<div style="overflow-x:auto"><table><tr><th>Incluir</th><th>Nome do medicamento</th><th>Dosagem / Concentração</th><th>Forma farmacêutica</th><th>Necessidade</th><th>Estoque atual</th><th>Quantidade a pedir</th></tr>${currentRows.map(x=>`<tr><td><input type="checkbox" name="inc_${x.n}" checked></td><td>${safeEsc(x.nome)}</td><td>${safeEsc(x.dosagem)}</td><td>${safeEsc(x.forma)}</td><td>${x.necessidade.toFixed(2)}</td><td>${x.estoque.toFixed(2)}</td><td><input type="number" min="0" step="${unidadeInteira(x.unidade)?'1':'0.01'}" name="q_${x.n}" value="${x.quantidade}"></td></tr>`).join('')}</table></div>`:'<div class="ok">O estoque atual cobre toda a necessidade cadastrada para este período.</div>';
    };

    const selecionados=()=>{
      const fd=new FormData(document.querySelector('#pedidoFormV2'));
      return currentRows.filter(x=>fd.get(`inc_${x.n}`)).map(x=>({...x,quantidade:arredondar(fd.get(`q_${x.n}`),x.unidade)})).filter(x=>x.quantidade>0);
    };

    document.querySelector('#mesesPedidoV2').onchange=render;
    document.querySelector('#baixarPedidoV2').onclick=()=>{
      try{
        const rows=selecionados();
        if(!rows.length) return alert('Selecione pelo menos um medicamento com quantidade maior que zero.');
        exportarXlsx(rows);
      }catch(err){alert(err.message||err);}
    };

    document.querySelector('#pedidoFormV2').onsubmit=async e=>{
      e.preventDefault();
      const rows=selecionados();
      if(!rows.length) return alert('Selecione pelo menos um medicamento com quantidade maior que zero.');
      if(!['admin','gestor'].includes(profile?.role)) return alert('Somente administrador ou gestor pode gravar pedidos no sistema.');
      const btn=e.target.querySelector('button[type="submit"]');
      btn.disabled=true;btn.textContent='Gerando pedido...';
      try{
        const meses=num(document.querySelector('#mesesPedidoV2').value)||1;
        const fd=new FormData(e.target);
        const obs=limpar(fd.get('obs')||'');
        const observacoes=`Pedido automático consolidado, sem duplicidades, referente a ${meses} mês(es). Regra: necessidade dos pacientes menos estoque atual.${obs?' '+obs:''}`;
        const {data:pedido,error:ep}=await sb.from('purchase_orders').insert({status:'emitido',observacoes,created_by:profile.id}).select().single();
        if(ep) throw ep;
        const itens=rows.map(x=>({order_id:pedido.id,medication_id:x.medication_id,estoque_no_momento:x.estoque,quantidade_sugerida:x.quantidade,quantidade_pedida:x.quantidade}));
        const {error:ei}=await sb.from('purchase_order_items').insert(itens);
        if(ei) throw ei;
        exportarXlsx(rows);
        alert('Pedido gerado com sucesso e Excel criado. O saldo de estoque foi usado apenas no cálculo e não foi baixado do estoque.');
      }catch(err){
        alert('Erro ao gerar pedido: '+(err?.message||err));
      }finally{
        btn.disabled=false;btn.textContent='Gerar pedido e baixar Excel';
      }
    };

    render();
  }

  window.pedidos=pedidosV2;
  window.page=async function(p){
    if(p==='pedidos'){
      const c=document.querySelector('#content');
      c.innerHTML='<div class="card">Carregando pedido...</div>';
      try{return await pedidosV2(c);}catch(e){c.innerHTML=`<div class="card warn">${safeEsc(e?.message||e)}</div>`;return;}
    }
    return await previousPage(p);
  };
  document.querySelectorAll('nav button[data-page]').forEach(b=>b.onclick=()=>window.page(b.dataset.page));
})();
