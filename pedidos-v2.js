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
    let needs=[],atualizadoEm='';
    const assinatura=rows=>JSON.stringify((rows||[]).map(x=>[
      x.medication_id,x.nome,x.dosagem,x.forma,x.unidade,num(x.necessidade_mensal),
      num(x.estoque_atual),num(x.pacientes_ativos)
    ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
    async function carregar(){
      const {data,error}=await sb.from('purchase_order_needs').select('*').order('nome');
      if(error)throw new Error('Não foi possível atualizar o pedido: '+error.message);
      const novo=data||[],mudou=assinatura(needs)!==assinatura(novo);
      needs=novo;atualizadoEm=new Date().toLocaleString('pt-BR');
      return mudou;
    }
    await carregar();

    function calcular(meses){
      return (needs||[])
        .filter(x=>num(x.necessidade_mensal)>0)
        .map(x=>{
          const unidade=x.unidade||x.forma||'Unidade';
          const necessidade=num(x.necessidade_mensal)*meses;
          const estoque=num(x.estoque_atual);
          return {
            nome:nomePadrao(x.nome),
            dosagem:dosagemPadrao(x.dosagem||''),
            forma:formaPadrao(x.forma,x.unidade),
            unidade,
            necessidade,
            estoque,
            pacientes:num(x.pacientes_ativos),
            medication_id:x.medication_id,
            cadastrosAgrupados:num(x.cadastros_agrupados),
            quantidade:arredondar(Math.max(0,necessidade-estoque),unidade)
          };
        })
        .filter(x=>x.quantidade>0)
        .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR',{sensitivity:'base'}));
    }

    c.innerHTML=`
      <div class="card">
        <h2>GESTÃO FARMACÊUTICA — ISAÍAS FERNANDES DE CARVALHO</h2>
        <h3>Pedido de Medicamentos</h3><p class="small">Versão 4 - cálculo atualizado antes de gerar ou baixar o pedido.</p>
        <p>O pedido usa somente medicamentos vinculados aos pacientes, soma a necessidade do período e <b>desconta o estoque atual disponível</b> antes de calcular a quantidade a comprar.</p>
        <button type="button" id="atualizarPedidoV2" class="secondary">Atualizar estoque e necessidade</button>
        <p id="horaPedidoV2" class="small" aria-live="polite"></p>
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
      document.querySelector('#horaPedidoV2').textContent='Dados consultados em '+atualizadoEm;
      const meses=num(document.querySelector('#mesesPedidoV2').value)||1;
      currentRows=calcular(meses).map((x,n)=>({...x,n}));
      const necessidadeTotal=currentRows.reduce((s,x)=>s+x.necessidade,0);
      const estoqueTotal=currentRows.reduce((s,x)=>s+x.estoque,0);
      const pedidoTotal=currentRows.reduce((s,x)=>s+x.quantidade,0);
      document.querySelector('#resumoPedidoV2').innerHTML=`Itens para comprar: <b>${currentRows.length}</b> · Necessidade: <b>${necessidadeTotal.toFixed(2)}</b> · Estoque descontado: <b>${estoqueTotal.toFixed(2)}</b> · Quantidade final do pedido: <b>${pedidoTotal.toFixed(2)}</b>`;
      document.querySelector('#tabelaPedidoV2').innerHTML=currentRows.length?`<div style="overflow-x:auto"><table><tr><th>Incluir</th><th>Nome do medicamento</th><th>Dosagem / Concentração</th><th>Forma farmacêutica</th><th>Necessidade no período</th><th>Saldo disponível em estoque</th><th>Quantidade a comprar</th></tr>${currentRows.map(x=>`<tr><td><input type="checkbox" name="inc_${x.n}" checked></td><td>${safeEsc(x.nome)}</td><td>${safeEsc(x.dosagem)}</td><td>${safeEsc(x.forma)}</td><td>${x.necessidade.toFixed(2)}</td><td>${x.estoque.toFixed(2)}</td><td><input type="number" min="0" step="${unidadeInteira(x.unidade)?'1':'0.01'}" name="q_${x.n}" value="${x.quantidade}"></td></tr>`).join('')}</table></div>`:'<div class="ok">O estoque atual cobre toda a necessidade cadastrada para este período.</div>';
    };

    const selecionados=()=>{
      const fd=new FormData(document.querySelector('#pedidoFormV2'));
      return currentRows.filter(x=>fd.get(`inc_${x.n}`)).map(x=>({...x,quantidade:arredondar(fd.get(`q_${x.n}`),x.unidade)})).filter(x=>x.quantidade>0);
    };

    let ocupado=false;
    async function atualizar(){
      if(ocupado)return;
      ocupado=true;
      const btn=document.querySelector('#atualizarPedidoV2');btn.disabled=true;
      try{await carregar();render();}catch(err){alert(err.message||err);}
      finally{ocupado=false;btn.disabled=false;}
    }
    async function conferirAtualizacao(){
      const mudou=await carregar();
      document.querySelector('#horaPedidoV2').textContent='Dados consultados em '+atualizadoEm;
      if(mudou){render();alert('O estoque ou os cadastros mudaram. O pedido foi recalculado. Confira as quantidades e confirme novamente.');return false;}
      return true;
    }
    document.querySelector('#atualizarPedidoV2').onclick=atualizar;
    document.querySelector('#mesesPedidoV2').onchange=atualizar;
    document.querySelector('#baixarPedidoV2').onclick=async()=>{
      if(ocupado)return;ocupado=true;
      try{
        if(!await conferirAtualizacao())return;
        const rows=selecionados();
        if(!rows.length) return alert('Selecione pelo menos um medicamento com quantidade maior que zero.');
        exportarXlsx(rows);
      }catch(err){alert(err.message||err);}
      finally{ocupado=false;}
    };

    document.querySelector('#pedidoFormV2').onsubmit=async e=>{
      e.preventDefault();
      if(ocupado)return;
      if(!['admin','gestor'].includes(profile?.role)) return alert('Somente administrador ou gestor pode gravar pedidos no sistema.');
      const btn=e.target.querySelector('button[type="submit"]');
      ocupado=true;btn.disabled=true;btn.textContent='Gerando pedido...';
      try{
        if(!await conferirAtualizacao())return;
        const rows=selecionados();
        if(!rows.length)return alert('Selecione pelo menos um medicamento com quantidade maior que zero.');
        const meses=num(document.querySelector('#mesesPedidoV2').value)||1;
        const fd=new FormData(e.target);
        const obs=limpar(fd.get('obs')||'');
        const observacoes=`Pedido automático consolidado, sem duplicidades, referente a ${meses} mês(es). Regra: necessidade dos pacientes menos estoque atual.${obs?' '+obs:''}`;
        const {data:pedido,error:ep}=await sb.from('purchase_orders').insert({status:'emitido',observacoes,created_by:profile.id}).select().single();
        if(ep) throw ep;
        const itens=rows.map(x=>({order_id:pedido.id,medication_id:x.medication_id,estoque_no_momento:x.estoque,quantidade_sugerida:x.quantidade,quantidade_pedida:x.quantidade}));
        const {error:ei}=await sb.from('purchase_order_items').insert(itens);
        if(ei) throw ei;
        try{exportarXlsx(rows);}catch(erroExcel){alert('Pedido salvo no sistema. O Excel não pôde ser baixado. Use Baixar Excel para tentar novamente, sem gerar outro pedido. '+erroExcel.message);return;}
        alert('Pedido gerado com sucesso e Excel criado. O saldo de estoque foi usado apenas no cálculo e não foi baixado do estoque.');
      }catch(err){
        alert('Erro ao gerar pedido: '+(err?.message||err));
      }finally{
        ocupado=false;btn.disabled=false;btn.textContent='Gerar pedido e baixar Excel';
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
