painel=async function(c){
  const [pa,st,rx,set,resumo]=await Promise.all([
    sb.from('patients').select('id',{count:'exact',head:true}).eq('ativo',true),
    sb.from('stock_summary').select('*'),
    sb.from('prescriptions').select('id',{count:'exact',head:true}).eq('ativa',true),
    getAppSettings(),
    sb.rpc('painel_resumo_dispensacoes').maybeSingle()
  ]);
  if(resumo.error)throw resumo.error;
  const baixos=(st.data||[]).filter(x=>+x.estoque_atual<=+x.estoque_minimo).length;
  const r=resumo.data||{};
  const quantidade=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const group=set.whatsapp_group_url?`<div class="card ok"><h3>Comunicação dos gestores</h3><p>Seu acesso foi aprovado. Use o botão abaixo para entrar no grupo <b>${esc(set.whatsapp_group_name||'Gestores')}</b>.</p><a class="btn whatsapp" target="_blank" rel="noopener" href="${esc(set.whatsapp_group_url)}">Entrar no grupo do WhatsApp</a></div>`:`<div class="card warn"><h3>Grupo de WhatsApp</h3><p>O administrador ainda não cadastrou o link de convite do grupo.</p></div>`;
  c.innerHTML=`<div class="grid">
    <div class="card"><div>Pacientes ativos</div><div class="stat">${pa.count||0}</div></div>
    <div class="card"><div>Prescrições ativas</div><div class="stat">${rx.count||0}</div></div>
    <div class="card"><div>Itens com estoque baixo</div><div class="stat">${baixos}</div></div>
    <div class="card"><div>Medicamentos cadastrados</div><div class="stat">${r.medicamentos_cadastrados||0}</div></div>
    <div class="card"><div>Total de dispensações</div><div class="stat">${r.total_dispensacoes||0}</div></div>
    <div class="card"><div>Medicamentos dispensados hoje</div><div class="stat">${quantidade(r.quantidade_dispensada_hoje)}</div></div>
    <div class="card"><div>Medicamentos dispensados na semana</div><div class="stat">${quantidade(r.quantidade_dispensada_semana)}</div></div>
    <div class="card"><div>Medicamentos dispensados no mês</div><div class="stat">${quantidade(r.quantidade_dispensada_mes)}</div></div>
  </div>${group}<div class="card install-card no-print"><h3>Aplicativo no celular</h3><p>Este sistema pode ser adicionado à tela inicial do celular e usado como aplicativo. No Android, use o botão abaixo quando disponível; no iPhone, use Compartilhar → Adicionar à Tela de Início.</p><button id="installApp" class="secondary">Instalar / adicionar ao celular</button></div><div class="card"><h3>Resumo</h3><p>Base compartilhada em tempo real entre os usuários autorizados.</p></div>`;
  const ib=$('#installApp');if(ib)ib.onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null}else alert('Se o botão de instalação do navegador não aparecer, use o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”.')}
};
