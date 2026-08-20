window.__APP_MODULE_STARTED=true;
const createClient = window.supabase?.createClient;
if (!createClient) {
  const m=document.querySelector('#loginMsg');
  if(m) m.textContent='Não foi possível carregar a biblioteca do Supabase. Verifique a internet e atualize a página.';
  throw new Error('Biblioteca Supabase não carregada');
}
const cfg=window.APP_CONFIG||{}; const bad=!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_URL.includes('COLE_AQUI')||cfg.SUPABASE_ANON_KEY.includes('COLE_AQUI');
if(bad) document.querySelector('#cfgWarn').classList.remove('hidden');
const sb=bad?null:createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let profile=null; let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});
async function msg(t){$('#loginMsg').textContent=t}
$('#loginBtn').onclick=async()=>{if(!sb)return; const {error}=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#senha').value}); if(error)msg(error.message); else boot()};
$('#signupBtn').onclick=async()=>{
  if(!sb){msg('Configuração do Supabase incompleta. Confira config.js.');return;}
  const nome=$('#nomeCadastro').value.trim(), telefone=$('#telefoneCadastro').value.trim(), email=$('#emailCadastro').value.trim(), password=$('#senhaCadastro').value;
  if(!nome||!telefone||!email||!password){msg('Preencha nome, celular/WhatsApp, e-mail e senha.');return;}
  if(password.length<6){msg('A senha precisa ter pelo menos 6 caracteres.');return;}
  const btn=$('#signupBtn'); btn.disabled=true; const oldText=btn.textContent; btn.textContent='Criando conta...';
  try {
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{nome,telefone}}});
    if(error){msg('Erro ao criar conta: '+error.message);return;}
    if(data?.user){msg('Conta criada com sucesso. Se o Supabase solicitar confirmação de e-mail, confirme pelo link recebido e depois faça login.');}
    else msg('Cadastro enviado. Verifique seu e-mail e tente entrar.');
  } catch(e){msg('Falha de conexão: '+(e.message||e));}
  finally {btn.disabled=false; btn.textContent=oldText;}
};
$('#logout').onclick=async()=>{await sb.auth.signOut();location.reload()};
async function boot(){
  if(!sb)return;
  try {
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError) throw sessionError;
    if(!session)return;
    const {data,error:profileError}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(profileError) throw profileError;
    profile=data;
    if(!profile){
      msg('Sua conta existe, mas o perfil do sistema não foi criado. Execute o schema.sql atualizado no Supabase e entre novamente.');
      return;
    }
    $('#loginBox').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#logout').classList.remove('hidden');
    $('#who').textContent=profile.nome||session.user.email;
    if(!['admin','gestor','atendente'].includes(profile.role)){
      $('#pending').classList.remove('hidden');
      return;
    }
    $('#nav').classList.remove('hidden');
    if(profile.role!=='admin')$('#btnUsuarios').classList.add('hidden');
    if(!['admin','gestor'].includes(profile.role))$('#btnAudit').classList.add('hidden');
    await page('painel');
  } catch(e){
    console.error('Falha ao iniciar o aplicativo:',e);
    $('#loginBox').classList.remove('hidden');
    $('#app').classList.add('hidden');
    msg('Falha ao iniciar o sistema: '+(e?.message||e));
  }
}
document.querySelectorAll('nav button[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));
async function page(p){const c=$('#content'); c.innerHTML='<div class="card">Carregando...</div>'; try{if(p==='painel')await painel(c);if(p==='pacientes')await pacientes(c);if(p==='medicamentos')await medicamentos(c);if(p==='estoque')await estoque(c);if(p==='prescricoes')await prescricoes(c);if(p==='dispensacao')await dispensacao(c);if(p==='pedidos')await pedidos(c);if(p==='equipe')await equipe(c);if(p==='usuarios')await usuarios(c);if(p==='auditoria')await auditoria(c)}catch(e){c.innerHTML=`<div class="card warn">${esc(e.message)}</div>`}}
async function getAppSettings(){const {data}=await sb.from('app_settings').select('whatsapp_group_url,whatsapp_group_name').eq('id',1).maybeSingle();return data||{}}
async function painel(c){const [pa,st,rx,set]=await Promise.all([sb.from('patients').select('id',{count:'exact',head:true}).eq('ativo',true),sb.from('stock_summary').select('*'),sb.from('prescriptions').select('id',{count:'exact',head:true}).eq('ativa',true),getAppSettings()]); const baixos=(st.data||[]).filter(x=>+x.estoque_atual<=+x.estoque_minimo).length; const group=set.whatsapp_group_url?`<div class="card ok"><h3>Comunicação dos gestores</h3><p>Seu acesso foi aprovado. Use o botão abaixo para entrar no grupo <b>${esc(set.whatsapp_group_name||'Gestores')}</b>.</p><a class="btn whatsapp" target="_blank" rel="noopener" href="${esc(set.whatsapp_group_url)}">Entrar no grupo do WhatsApp</a></div>`:`<div class="card warn"><h3>Grupo de WhatsApp</h3><p>O administrador ainda não cadastrou o link de convite do grupo.</p></div>`; c.innerHTML=`<div class="grid"><div class="card"><div>Pacientes ativos</div><div class="stat">${pa.count||0}</div></div><div class="card"><div>Prescrições ativas</div><div class="stat">${rx.count||0}</div></div><div class="card"><div>Itens com estoque baixo</div><div class="stat">${baixos}</div></div></div>${group}<div class="card install-card no-print"><h3>Aplicativo no celular</h3><p>Este sistema pode ser adicionado à tela inicial do celular e usado como aplicativo. No Android, use o botão abaixo quando disponível; no iPhone, use Compartilhar → Adicionar à Tela de Início.</p><button id="installApp" class="secondary">Instalar / adicionar ao celular</button></div><div class="card"><h3>Resumo</h3><p>Base compartilhada em tempo real entre os usuários autorizados.</p></div>`; const ib=$('#installApp');if(ib)ib.onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null}else alert('Se o botão de instalação do navegador não aparecer, use o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”.')}}
async function pacientes(c){
  const [{data:patients,error:ep},{data:meds,error:em},{data:pm,error:el}]=await Promise.all([
    sb.from('patients').select('*').order('nome'),
    sb.from('medications').select('id,nome,dosagem,forma,unidade,apresentacao').eq('ativo',true).order('nome'),
    sb.from('patient_medications').select('id,patient_id,medication_id,posologia,quantidade_mensal,observacoes,ativo,medications(nome,dosagem,forma,unidade,apresentacao)').eq('ativo',true).order('created_at')
  ]);
  if(ep)throw ep;if(em)throw em;if(el)throw new Error('A atualização de medicamentos por paciente ainda não foi instalada no Supabase. Execute ATUALIZACAO_MEDICAMENTOS_PACIENTE.sql.');
  const can=['admin','gestor'].includes(profile.role);
  const active=(patients||[]).filter(x=>x.ativo!==false);
  const patientOptions=active.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('');
  const medOptions=(meds||[]).map(x=>`<option value="${x.id}">${esc(x.nome)} ${esc(x.dosagem||'')} — ${esc(x.forma||'')}${x.apresentacao?` — ${esc(x.apresentacao)}`:''}</option>`).join('');
  c.innerHTML=`<div class="card"><h2 id="patientFormTitle">Novo paciente</h2><p class="small">Use <b>Corrigir</b> para alterar um cadastro existente. <b>Desativar</b> retira o paciente dos cálculos e listas ativas sem apagar o histórico. O paciente pode ser reativado depois.</p><form id="fp" class="grid"><input type="hidden" name="id"><div><label>Nome</label><input name="nome" required></div><div><label>CPF</label><input name="cpf"></div><div><label>CNS</label><input name="cns"></div><div><label>Nascimento</label><input name="nascimento" type="date"></div><div><label>Telefone</label><input name="telefone"></div><div><label>Nome da mãe</label><input name="nome_mae"></div><div style="grid-column:1/-1"><label>Endereço</label><input name="endereco"></div><div style="grid-column:1/-1"><label>Observações</label><textarea name="observacoes"></textarea></div><div><button id="patientSubmit">Salvar paciente</button> <button type="button" id="cancelPatientEdit" class="secondary hidden">Cancelar correção</button></div></form></div>
  <div class="card"><h2>Medicamentos de uso do paciente</h2><p class="small">Cadastre aqui todos os medicamentos usados por cada paciente. A quantidade mensal será usada para calcular automaticamente o pedido de compra.</p><form id="fpm" class="grid"><div><label>Paciente</label><select name="patient_id" required>${patientOptions}</select></div><div><label>Medicamento</label><select name="medication_id" required>${medOptions}</select></div><div><label>Posologia</label><input name="posologia" placeholder="Ex.: 1 comprimido 2x ao dia"></div><div><label>Quantidade mensal</label><input name="quantidade_mensal" type="number" min="0" step="0.01" required placeholder="Ex.: 60"></div><div style="grid-column:1/-1"><label>Observações</label><input name="observacoes"></div><div><button>Adicionar à lista do paciente</button></div></form></div>
  <div class="card"><h2>Lista de pacientes</h2><input id="buscaP" placeholder="Pesquisar paciente"><div id="tblP"></div></div>`;
  const form=$('#fp');
  const resetPatientForm=()=>{form.reset();form.elements.id.value='';$('#patientFormTitle').textContent='Novo paciente';$('#patientSubmit').textContent='Salvar paciente';$('#cancelPatientEdit').classList.add('hidden')};
  const renderPatients=(list)=>{ $('#tblP').innerHTML=patientTable(list,pm||[],can); bindPatientActions(); };
  const bindPatientActions=()=>{
    document.querySelectorAll('.togglePatientMeds').forEach(b=>b.onclick=()=>{const box=$(`#pm_${b.dataset.id}`); if(box)box.classList.toggle('hidden')});
    document.querySelectorAll('.removePatientMed').forEach(b=>b.onclick=async()=>{if(!confirm('Remover este medicamento da lista do paciente?'))return;const {error}=await sb.from('patient_medications').update({ativo:false,updated_at:new Date().toISOString()}).eq('id',b.dataset.id);if(error)alert(error.message);else page('pacientes')});
    document.querySelectorAll('.editPatient').forEach(b=>b.onclick=()=>{const x=(patients||[]).find(p=>p.id===b.dataset.id);if(!x)return;form.elements.id.value=x.id;form.elements.nome.value=x.nome||'';form.elements.cpf.value=x.cpf||'';form.elements.cns.value=x.cns||'';form.elements.nascimento.value=x.nascimento||'';form.elements.telefone.value=x.telefone||'';form.elements.nome_mae.value=x.nome_mae||'';form.elements.endereco.value=x.endereco||'';form.elements.observacoes.value=x.observacoes||'';$('#patientFormTitle').textContent='Corrigir paciente';$('#patientSubmit').textContent='Salvar correção';$('#cancelPatientEdit').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})});
    document.querySelectorAll('.deactivatePatient').forEach(b=>b.onclick=async()=>{const x=(patients||[]).find(p=>p.id===b.dataset.id);if(!x)return;if(!confirm(`Desativar o paciente ${x.nome}? O histórico será preservado e ele deixará de entrar nos cálculos de pedidos.`))return;const {error}=await sb.from('patients').update({ativo:false}).eq('id',x.id);if(error)alert(error.message);else page('pacientes')});
    document.querySelectorAll('.reactivatePatient').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('patients').update({ativo:true}).eq('id',b.dataset.id);if(error)alert(error.message);else page('pacientes')});
  };
  renderPatients(patients||[]);
  $('#cancelPatientEdit').onclick=resetPatientForm;
  form.onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));const id=o.id;delete o.id;['cpf','cns','nascimento','telefone','nome_mae','endereco','observacoes'].forEach(k=>{if(o[k]==='')o[k]=null});let error;if(id){({error}=await sb.from('patients').update(o).eq('id',id))}else{o.created_by=profile.id;o.ativo=true;({error}=await sb.from('patients').insert(o))}if(error)alert(error.message);else page('pacientes')};
  $('#fpm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));const payload={patient_id:o.patient_id,medication_id:o.medication_id,posologia:o.posologia||null,quantidade_mensal:+o.quantidade_mensal,observacoes:o.observacoes||null,ativo:true,created_by:profile.id,updated_at:new Date().toISOString()};const {error}=await sb.from('patient_medications').upsert(payload,{onConflict:'patient_id,medication_id'});if(error)alert(error.message);else page('pacientes')};
  $('#buscaP').oninput=e=>{const q=e.target.value.toLowerCase();renderPatients((patients||[]).filter(x=>(x.nome||'').toLowerCase().includes(q)||(x.cpf||'').includes(q)||(x.cns||'').includes(q)))};
}
function patientTable(d=[],patientMeds=[],can=false){return `<div style="overflow-x:auto"><table><tr><th>Nome</th><th>CPF</th><th>CNS</th><th>Nascimento</th><th>Status</th><th>Medicamentos</th>${can?'<th>Ações</th>':''}</tr>${d.map(x=>{const list=patientMeds.filter(pm=>pm.patient_id===x.id&&pm.ativo!==false);return `<tr><td>${esc(x.nome)}</td><td>${esc(x.cpf||'')}</td><td>${esc(x.cns||'')}</td><td>${esc(x.nascimento||'')}</td><td>${x.ativo===false?'<span class="pill">Inativo</span>':'Ativo'}</td><td><button type="button" class="secondary togglePatientMeds" data-id="${x.id}">${list.length} medicamento(s)</button><div id="pm_${x.id}" class="hidden patient-med-list">${list.length?`<table><tr><th>Medicamento</th><th>Posologia</th><th>Qtd./mês</th><th></th></tr>${list.map(pm=>`<tr><td>${esc(pm.medications?.nome)} ${esc(pm.medications?.dosagem||'')} ${pm.medications?.apresentacao?`— ${esc(pm.medications.apresentacao)}`:''}</td><td>${esc(pm.posologia||'')}</td><td>${pm.quantidade_mensal} ${esc(pm.medications?.unidade||'')}</td><td><button type="button" class="danger removePatientMed" data-id="${pm.id}">Remover</button></td></tr>`).join('')}</table>`:'Nenhum medicamento cadastrado.'}</div></td>${can?`<td><button type="button" class="secondary editPatient" data-id="${x.id}">Corrigir</button> ${x.ativo===false?`<button type="button" class="reactivatePatient" data-id="${x.id}">Reativar</button>`:`<button type="button" class="danger deactivatePatient" data-id="${x.id}">Desativar</button>`}</td>`:''}</tr>`}).join('')}</table></div>`}
async function medicamentos(c){
  const {data,error}=await sb.from('medications').select('*').order('nome');
  if(error)throw error;
  const can=['admin','gestor'].includes(profile.role);
  const formas=['Comprimido','Cápsula','Solução oral','Suspensão oral','Xarope','Gotas','Colírio','Creme','Pomada','Gel','Loção','Spray','Injetável','Pó','Sachê','Supositório','Óvulo','Adesivo','Outro'];
  const unidades=['Comprimido','Cápsula','Frasco','Ampola','Sachê','Tubo','Bisnaga','Unidade','mL','Gota','Dose','Aplicador','Seringa','Envelope','Cartela','Caixa'];
  const rows=(data||[]);
  c.innerHTML=`${can?`<div class="card"><h2 id="medFormTitle">Novo medicamento</h2><p class="small">Cadastre o medicamento de forma padronizada. Use <b>Corrigir</b> para alterar um cadastro já existente. A opção <b>Excluir</b> desativa o medicamento sem apagar o histórico de estoque, prescrições, dispensações e pedidos.</p><form id="fm" class="grid"><input type="hidden" name="id"><div><label>Nome</label><input name="nome" required placeholder="Ex.: Losartana"></div><div><label>Dosagem</label><input name="dosagem" placeholder="Ex.: 50 mg"></div><div><label>Forma farmacêutica</label><select name="forma" required><option value="">Selecione...</option>${formas.map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div><div><label>Unidade de estoque</label><select name="unidade" required><option value="">Selecione...</option>${unidades.map(v=>`<option value="${v}">${v}</option>`).join('')}</select><div class="small">Escolha como o medicamento será contado: comprimido, cápsula, frasco, ampola, unidade etc.</div></div><div><label>Apresentação</label><input name="apresentacao" placeholder="Ex.: Frasco 100 mL / Comprimido 50 mg"></div><div><label>Estoque mínimo</label><input name="estoque_minimo" type="number" min="0" step="0.01" value="0"></div><div><label>Estoque ideal</label><input name="estoque_ideal" type="number" min="0" step="0.01" value="0"></div><div><button id="medSubmit">Salvar medicamento</button> <button type="button" id="cancelMedEdit" class="secondary hidden">Cancelar correção</button></div></form></div>`:''}<div class="card"><h2>Medicamentos</h2><table><tr><th>Nome</th><th>Dosagem</th><th>Forma</th><th>Unidade de estoque</th><th>Apresentação</th><th>Mínimo</th><th>Ideal</th><th>Status</th>${can?'<th>Ações</th>':''}</tr>${rows.map(x=>`<tr><td>${esc(x.nome)}</td><td>${esc(x.dosagem||'')}</td><td>${esc(x.forma||'')}</td><td>${esc(x.unidade||'')}</td><td>${esc(x.apresentacao||'')}</td><td>${x.estoque_minimo??0}</td><td>${x.estoque_ideal??0}</td><td>${x.ativo===false?'<span class="pill">Inativo</span>':'Ativo'}</td>${can?`<td><button type="button" class="secondary editMed" data-id="${x.id}">Corrigir</button> ${x.ativo===false?`<button type="button" class="reactivateMed" data-id="${x.id}">Reativar</button>`:`<button type="button" class="danger deactivateMed" data-id="${x.id}">Excluir</button>`}</td>`:''}</tr>`).join('')}</table></div>`;
  if(!can)return;
  const form=$('#fm');
  const resetForm=()=>{form.reset();form.elements.id.value='';form.elements.estoque_minimo.value='0';form.elements.estoque_ideal.value='0';$('#medFormTitle').textContent='Novo medicamento';$('#medSubmit').textContent='Salvar medicamento';$('#cancelMedEdit').classList.add('hidden')};
  form.onsubmit=async e=>{e.preventDefault();let o=Object.fromEntries(new FormData(e.target));const id=o.id;delete o.id;o.estoque_minimo=+o.estoque_minimo||0;o.estoque_ideal=+o.estoque_ideal||0;if(id){const {error}=await sb.from('medications').update(o).eq('id',id);if(error)return alert(error.message);alert('Cadastro do medicamento corrigido com sucesso.')}else{const {error}=await sb.from('medications').insert({...o,ativo:true});if(error)return alert(error.message);alert('Medicamento cadastrado com sucesso.')}page('medicamentos')};
  document.querySelectorAll('.editMed').forEach(b=>b.onclick=()=>{const x=rows.find(m=>m.id===b.dataset.id);if(!x)return;form.elements.id.value=x.id;form.elements.nome.value=x.nome||'';form.elements.dosagem.value=x.dosagem||'';form.elements.forma.value=x.forma||'';form.elements.unidade.value=x.unidade||'';form.elements.apresentacao.value=x.apresentacao||'';form.elements.estoque_minimo.value=x.estoque_minimo??0;form.elements.estoque_ideal.value=x.estoque_ideal??0;$('#medFormTitle').textContent='Corrigir medicamento';$('#medSubmit').textContent='Salvar correção';$('#cancelMedEdit').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})});
  $('#cancelMedEdit').onclick=resetForm;
  document.querySelectorAll('.deactivateMed').forEach(b=>b.onclick=async()=>{const x=rows.find(m=>m.id===b.dataset.id);if(!confirm(`Excluir o cadastro de ${x?.nome||'este medicamento'}?\n\nPor segurança, ele será desativado e deixará de aparecer em novos lançamentos, mas o histórico será preservado.`))return;const {error}=await sb.from('medications').update({ativo:false}).eq('id',b.dataset.id);if(error)alert(error.message);else{alert('Medicamento excluído da lista ativa. O histórico foi preservado.');page('medicamentos')}});
  document.querySelectorAll('.reactivateMed').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('medications').update({ativo:true}).eq('id',b.dataset.id);if(error)alert(error.message);else page('medicamentos')});
}
async function estoque(c){
  const [{data:sum,error:es},{data:meds,error:em},{data:lots,error:el}]=await Promise.all([
    sb.from('stock_summary').select('*').order('nome'),
    sb.from('medications').select('id,nome,dosagem,unidade,apresentacao').eq('ativo',true).order('nome'),
    sb.from('stock_lots').select('id,medication_id,lote,validade,quantidade_inicial,quantidade_atual,fornecedor,documento,created_at,medications(nome,dosagem,unidade,apresentacao)').gt('quantidade_atual',0).order('validade',{ascending:true,nullsFirst:false})
  ]);
  if(es)throw es;if(em)throw em;if(el)throw el;
  const can=['admin','gestor'].includes(profile.role);
  const formasNota=['Comprimido','Cápsula','Solução oral','Suspensão oral','Xarope','Gotas','Colírio','Creme','Pomada','Gel','Loção','Spray','Injetável','Pó','Sachê','Supositório','Óvulo','Adesivo','Outro'];
  const unidadesNota=['Comprimido','Cápsula','Frasco','Ampola','Sachê','Tubo','Bisnaga','Unidade','mL','Gota','Dose','Aplicador','Seringa','Envelope','Cartela','Caixa'];
  const today=new Date(); today.setHours(0,0,0,0);
  const expiryInfo=(v)=>{
    if(!v)return {label:'Sem validade',cls:''};
    const d=new Date(v+'T00:00:00'); const days=Math.ceil((d-today)/86400000);
    if(days<0)return {label:`VENCIDO há ${Math.abs(days)} dia(s)`,cls:'danger-text'};
    if(days<=30)return {label:`Vence em ${days} dia(s)`,cls:'danger-text'};
    if(days<=90)return {label:`Vence em ${days} dia(s)`,cls:'warn-text'};
    return {label:`Validade ${d.toLocaleDateString('pt-BR')}`,cls:''};
  };
  const lotRows=(lots||[]).map(l=>{const ex=expiryInfo(l.validade);return `<tr><td>${esc(l.medications?.nome||'')} ${esc(l.medications?.dosagem||'')}</td><td>${esc(l.lote||'')}</td><td>${l.validade?new Date(l.validade+'T00:00:00').toLocaleDateString('pt-BR'):'—'}</td><td class="${ex.cls}">${esc(ex.label)}</td><td>${l.quantidade_atual} ${esc(l.medications?.unidade||'')}</td><td>${esc(l.documento||'')}</td><td>${esc(l.fornecedor||'')}</td><td>${new Date(l.created_at).toLocaleDateString('pt-BR')}</td></tr>`}).join('');
  c.innerHTML=`${can?`<div class="card"><h2>Entrada de estoque por nota fiscal</h2><p class="small">Informe os dados da nota uma vez e adicione todos os medicamentos recebidos. Cada item será gravado com lote, validade, quantidade, fornecedor e número da nota fiscal.</p>
    <div class="grid"><div><label>Número da nota fiscal / documento</label><input id="nfDocumento" placeholder="Ex.: NF 12345"></div><div><label>Fornecedor</label><input id="nfFornecedor" placeholder="Fornecedor"></div><div><label>Data da entrada</label><input id="nfData" type="date" value="${new Date().toISOString().slice(0,10)}" disabled></div></div>
    <hr><h3>Adicionar item da nota</h3><div class="actions"><button id="abrirCadastroMedNota" type="button" class="secondary">+ Cadastrar medicamento desta nota</button></div>
    <div id="cadastroMedNota" class="card hidden"><h3>Cadastrar medicamento recebido</h3><p class="small">Use esta opção quando o medicamento da nota ainda não existir no cadastro. Depois de salvar, ele será selecionado automaticamente no item da nota.</p><form id="fNovoMedNota" class="grid"><div><label>Nome</label><input name="nome" required placeholder="Ex.: Losartana"></div><div><label>Dosagem</label><input name="dosagem" placeholder="Ex.: 50 mg"></div><div><label>Forma farmacêutica</label><select name="forma" required><option value="">Selecione...</option>${formasNota.map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div><div><label>Unidade de estoque</label><select name="unidade" required><option value="">Selecione...</option>${unidadesNota.map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div><div><label>Apresentação</label><input name="apresentacao" placeholder="Ex.: Frasco 100 mL / Comprimido 50 mg"></div><div><label>Estoque mínimo</label><input name="estoque_minimo" type="number" min="0" step="0.01" value="0"></div><div><label>Estoque ideal</label><input name="estoque_ideal" type="number" min="0" step="0.01" value="0"></div><div><button type="submit">Salvar medicamento e usar na nota</button> <button id="cancelarCadastroMedNota" type="button" class="secondary">Cancelar</button></div></form></div>
    <form id="fe" class="grid"><div><label>Medicamento</label><select id="nfMedicationSelect" name="medication_id" required></select><div class="small">Se não encontrar o medicamento, use “Cadastrar medicamento desta nota”.</div></div><div><label>Lote</label><input name="lote" required placeholder="Lote do fabricante"></div><div><label>Data de validade</label><input name="validade" type="date" required></div><div><label>Quantidade recebida</label><input name="quantidade" type="number" step="0.01" min="0.01" required></div><div><button type="submit">Adicionar item à nota</button></div></form>
    <div id="nfItens"></div><div class="actions"><button id="finalizarNF" type="button">Finalizar entrada da nota</button><button id="limparNF" type="button" class="secondary">Limpar itens</button></div></div>`:''}
    <div class="card"><h2>Alertas de lote e validade</h2><p class="small">Lotes vencidos ou próximos do vencimento ficam destacados. A dispensação deve priorizar o lote com validade mais próxima.</p><table><tr><th>Medicamento</th><th>Lote</th><th>Validade</th><th>Alerta</th><th>Saldo do lote</th><th>NF/Documento</th><th>Fornecedor</th><th>Entrada</th></tr>${lotRows||'<tr><td colspan="8">Nenhum lote com saldo disponível.</td></tr>'}</table></div>
    <div class="card"><h2>Estoque atual</h2><table><tr><th>Medicamento</th><th>Dosagem</th><th>Saldo</th><th>Mínimo</th><th>Ideal</th><th>Situação</th></tr>${(sum||[]).map(x=>`<tr><td>${esc(x.nome)}</td><td>${esc(x.dosagem)}</td><td>${x.estoque_atual} ${esc(x.unidade)}</td><td>${x.estoque_minimo}</td><td>${x.estoque_ideal}</td><td>${+x.estoque_atual<=+x.estoque_minimo?'<b>COMPRAR</b>':'OK'}</td></tr>`).join('')}</table></div>`;
  if(!can)return;
  const medSelect=$('#nfMedicationSelect');
  const renderMedOptions=(selected='')=>{const sorted=[...(meds||[])].sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR'));medSelect.innerHTML='<option value="">Selecione</option>'+sorted.map(m=>`<option value="${m.id}" data-unit="${esc(m.unidade||'')}" ${m.id===selected?'selected':''}>${esc(m.nome)} ${esc(m.dosagem||'')}${m.apresentacao?` — ${esc(m.apresentacao)}`:''} [${esc(m.unidade||'')}]</option>`).join('')};
  renderMedOptions();
  $('#abrirCadastroMedNota').onclick=()=>{$('#cadastroMedNota').classList.remove('hidden');$('#fNovoMedNota').elements.nome.focus()};
  $('#cancelarCadastroMedNota').onclick=()=>{$('#fNovoMedNota').reset();$('#fNovoMedNota').elements.estoque_minimo.value='0';$('#fNovoMedNota').elements.estoque_ideal.value='0';$('#cadastroMedNota').classList.add('hidden')};
  $('#fNovoMedNota').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const novo={nome:String(fd.get('nome')||'').trim(),dosagem:String(fd.get('dosagem')||'').trim()||null,forma:String(fd.get('forma')||''),unidade:String(fd.get('unidade')||''),apresentacao:String(fd.get('apresentacao')||'').trim()||null,estoque_minimo:+fd.get('estoque_minimo')||0,estoque_ideal:+fd.get('estoque_ideal')||0,ativo:true};if(!novo.nome||!novo.forma||!novo.unidade)return alert('Preencha nome, forma farmacêutica e unidade de estoque.');const {data:criado,error}=await sb.from('medications').insert(novo).select('id,nome,dosagem,unidade,apresentacao').single();if(error)return alert('Erro ao cadastrar medicamento: '+error.message);meds.push(criado);renderMedOptions(criado.id);e.target.reset();e.target.elements.estoque_minimo.value='0';e.target.elements.estoque_ideal.value='0';$('#cadastroMedNota').classList.add('hidden');alert('Medicamento cadastrado e selecionado para esta nota. Agora informe lote, validade e quantidade.');};
  let itensNota=[];
  const renderItens=()=>{const box=$('#nfItens'); if(!itensNota.length){box.innerHTML='<p class="small">Nenhum item adicionado à nota.</p>';return;} box.innerHTML=`<h3>Itens da nota</h3><table><tr><th>Medicamento</th><th>Lote</th><th>Validade</th><th>Quantidade</th><th></th></tr>${itensNota.map((x,i)=>`<tr><td>${esc(x.nome)}</td><td>${esc(x.lote)}</td><td>${new Date(x.validade+'T00:00:00').toLocaleDateString('pt-BR')}</td><td>${x.quantidade} ${esc(x.unidade)}</td><td><button class="danger rmNfItem" data-i="${i}" type="button">Remover</button></td></tr>`).join('')}</table>`; document.querySelectorAll('.rmNfItem').forEach(b=>b.onclick=()=>{itensNota.splice(+b.dataset.i,1);renderItens()});};
  renderItens();
  $('#fe').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);const medication_id=fd.get('medication_id'),lote=String(fd.get('lote')||'').trim(),validade=String(fd.get('validade')||''),quantidade=+fd.get('quantidade');const m=(meds||[]).find(x=>x.id===medication_id);if(!m)return alert('Selecione o medicamento.');if(!lote)return alert('Informe o lote.');if(!validade)return alert('Informe a data de validade.');if(!(quantidade>0))return alert('Informe uma quantidade válida.');itensNota.push({medication_id,lote,validade,quantidade,nome:`${m.nome} ${m.dosagem||''}`,unidade:m.unidade||''});e.target.reset();renderItens();};
  $('#limparNF').onclick=()=>{if(itensNota.length&&confirm('Limpar todos os itens adicionados à nota?')){itensNota=[];renderItens()}};
  $('#finalizarNF').onclick=async()=>{const documento=$('#nfDocumento').value.trim(),fornecedor=$('#nfFornecedor').value.trim();if(!documento)return alert('Informe o número da nota fiscal ou documento.');if(!fornecedor)return alert('Informe o fornecedor.');if(!itensNota.length)return alert('Adicione pelo menos um medicamento à nota.');if(!confirm(`Registrar ${itensNota.length} item(ns) desta nota no estoque?`))return;const btn=$('#finalizarNF');btn.disabled=true;btn.textContent='Registrando...';try{for(const x of itensNota){const {error}=await sb.rpc('add_stock',{p_medication_id:x.medication_id,p_lote:x.lote,p_validade:x.validade,p_quantidade:x.quantidade,p_fornecedor:fornecedor,p_documento:documento});if(error)throw error;}alert('Entrada da nota registrada com sucesso.');page('estoque');}catch(e){alert('Erro ao registrar entrada: '+(e.message||e));}finally{btn.disabled=false;btn.textContent='Finalizar entrada da nota';}};
}
async function prescricoes(c){const [{data:patients},{data:meds},{data:rx}]=await Promise.all([sb.from('patients').select('id,nome').eq('ativo',true).order('nome'),sb.from('medications').select('id,nome,dosagem,unidade,apresentacao').eq('ativo',true).order('nome'),sb.from('prescriptions').select('id,data_prescricao,prescritor,patient_id,patients(nome)').order('created_at',{ascending:false}).limit(50)]); c.innerHTML=`<div class="card"><h2>Nova prescrição</h2><form id="fr"><div class="grid"><div><label>Paciente</label><select name="patient_id">${(patients||[]).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div><label>Prescritor</label><input name="prescritor"></div><div><label>CRM</label><input name="crm"></div><div><label>Data</label><input name="data_prescricao" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div><label>Validade até</label><input name="validade_ate" type="date"></div></div><hr><div class="grid"><div><label>Medicamento</label><select name="medication_id">${(meds||[]).map(x=>`<option value="${x.id}">${esc(x.nome)} ${esc(x.dosagem)}${x.apresentacao?` — ${esc(x.apresentacao)}`:''}</option>`).join('')}</select></div><div><label>Posologia</label><input name="posologia"></div><div><label>Quantidade prescrita</label><input name="quantidade_prescrita" type="number" step="0.01" required></div></div><button>Salvar prescrição</button></form></div><div class="card"><h2>Últimas prescrições</h2><table><tr><th>Paciente</th><th>Data</th><th>Prescritor</th></tr>${(rx||[]).map(r=>`<tr><td>${esc(r.patients?.nome)}</td><td>${esc(r.data_prescricao)}</td><td>${esc(r.prescritor)}</td></tr>`).join('')}</table></div>`; $('#fr').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target)); const {data:r,error}=await sb.from('prescriptions').insert({patient_id:o.patient_id,prescritor:o.prescritor,crm:o.crm,data_prescricao:o.data_prescricao,validade_ate:o.validade_ate||null,created_by:profile.id}).select().single();if(error)return alert(error.message);const {error:e2}=await sb.from('prescription_items').insert({prescription_id:r.id,medication_id:o.medication_id,posologia:o.posologia,quantidade_prescrita:+o.quantidade_prescrita});if(e2)alert(e2.message);else page('prescricoes')}}
async function dispensacao(c){
  const {data:items}=await sb.from('prescription_items')
    .select('id,quantidade_prescrita,quantidade_dispensada,posologia,prescription_id,medication_id,prescriptions(patient_id,patient:patients(nome)),medications(nome,dosagem)')
    .order('id').limit(500);
  const open=(items||[]).filter(i=>+i.quantidade_prescrita>+i.quantidade_dispensada);
  c.innerHTML=`<div class="card"><h2>Dispensação</h2><p>Selecione um item de prescrição com saldo pendente.</p><select id="rxItem">${open.map(i=>`<option value="${i.id}">${esc(i.prescriptions?.patient?.nome)} — ${esc(i.medications?.nome)} ${esc(i.medications?.dosagem)} — saldo ${+i.quantidade_prescrita-+i.quantidade_dispensada}</option>`).join('')}</select><div id="dispForm"></div></div>`;

  async function render(){
    const i=open.find(x=>String(x.id)===String($('#rxItem').value));
    if(!i)return;
    const {data:lots}=await sb.from('stock_lots').select('*').eq('medication_id',i.medication_id).gt('quantidade_atual',0).order('validade',{ascending:true});
    $('#dispForm').innerHTML=`<label>Lote</label><select id="lot">${(lots||[]).map(l=>`<option value="${l.id}">${esc(l.lote||'sem lote')} | val. ${esc(l.validade||'-')} | saldo ${l.quantidade_atual}</option>`).join('')}</select><label>Quantidade</label><input id="qtdD" type="number" step="0.01"><label>Observações</label><input id="obsD"><button id="doDisp">Confirmar dispensação</button>`;
    $('#doDisp').onclick=async()=>{
      const {error}=await sb.rpc('dispense_stock',{
        p_patient_id:i.prescriptions.patient_id,
        p_prescription_id:i.prescription_id,
        p_prescription_item_id:i.id,
        p_medication_id:i.medication_id,
        p_stock_lot_id:$('#lot').value,
        p_quantidade:+$('#qtdD').value,
        p_observacoes:$('#obsD').value||null
      });
      if(error)alert(error.message);
      else{alert('Dispensação registrada.');page('dispensacao');}
    };
  }

  $('#rxItem').onchange=render;
  await render();
}
async function pedidos(c){

  // =========================================================
  // PADRONIZAÇÃO DOS MEDICAMENTOS
  // =========================================================

  const limparTexto = (v='') =>
    String(v).replace(/\s+/g,' ').trim();

  const semAcento = (v='') =>
    String(v)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'');

  const corrigirNome = (nome='') => {

    let n = limparTexto(nome);

    const chave = semAcento(n).toLowerCase();

    const correcoes = {
      'setralina':'Sertralina',
      'sertralina':'Sertralina',

      'alprazolan':'Alprazolam',
      'alprazolam':'Alprazolam',

      'lanzoprazol':'Lansoprazol',
      'lansoprazol':'Lansoprazol',

      'simeticon':'Simeticona',
      'simeticona':'Simeticona',

      'cetrolac':'Cetorolaco',
      'cetorolac':'Cetorolaco',
      'cetorolaco':'Cetorolaco',

      'topiramato':'Topiramato',
      'pregabalina':'Pregabalina',
      'risperidona':'Risperidona',
      'quetiapina':'Quetiapina',
      'trazodona':'Trazodona',
      'gabapentina':'Gabapentina',
      'escitalopram':'Escitalopram',
      'duloxetina':'Duloxetina',
      'atorvastatina':'Atorvastatina',
      'rosuvastatina':'Rosuvastatina',
      'dapagliflozina':'Dapagliflozina'
    };

    if(correcoes[chave]){
      return correcoes[chave];
    }

    return n
      .toLowerCase()
      .replace(/(^|\s)([a-záàâãéêíóôõúç])/g,
        (m,p1,p2)=>p1+p2.toUpperCase()
      );
  };


  const corrigirDosagem = (valor='') => {

    let d = limparTexto(valor);

    d = d
      .replace(/(\d)(mg)\b/gi,'$1 mg')
      .replace(/(\d)(mcg)\b/gi,'$1 mcg')
      .replace(/(\d)(ml)\b/gi,'$1 mL')
      .replace(/(\d)(g)\b/gi,'$1 g')
      .replace(/(\d)(ui)\b/gi,'$1 UI')
      .replace(/\s*\+\s*/g,' + ')
      .replace(/\s*\/\s*/g,' / ')
      .replace(/\bml\b/gi,'mL')
      .replace(/\bui\b/gi,'UI')
      .replace(/\s+/g,' ')
      .trim();

    return d;
  };


  const corrigirForma = (forma='',unidade='') => {

    let f = limparTexto(forma || unidade);

    const chave = semAcento(f).toLowerCase();

    const formas = {

      'comp':'Comprimido',
      'comprimido':'Comprimido',
      'comprimidos':'Comprimido',

      'caps':'Cápsula',
      'capsula':'Cápsula',
      'capsulas':'Cápsula',

      'frasco':'Frasco',
      'frascos':'Frasco',

      'gota':'Gotas',
      'gotas':'Gotas',
      'gts':'Gotas',

      'ampola':'Ampola',
      'ampolas':'Ampola',

      'sache':'Sachê',
      'saches':'Sachê',

      'tubo':'Tubo',
      'bisnaga':'Bisnaga',

      'solucao oral':'Solução oral',
      'suspensao oral':'Suspensão oral',

      'xarope':'Xarope',

      'colirio':'Colírio',

      'creme':'Creme',
      'pomada':'Pomada',
      'gel':'Gel',
      'locao':'Loção',

      'spray':'Spray',

      'injetavel':'Injetável',

      'unidade':'Unidade'
    };

    return formas[chave] || f || 'Unidade';
  };


  // =========================================================
  // BUSCAR NECESSIDADE DOS PACIENTES + ESTOQUE
  // =========================================================

  const [
    {data:stock,error:erroEstoque},
    {data:needs,error:erroNecessidade}
  ] = await Promise.all([

    sb
      .from('stock_summary')
      .select('*')
      .order('nome'),

    sb
      .from('patient_medication_needs')
      .select('*')
      .order('nome')

  ]);


  if(erroEstoque) throw erroEstoque;

  if(erroNecessidade){
    throw new Error(
      'Não foi possível carregar os medicamentos dos pacientes.'
    );
  }


  const estoquePorMedicamento = new Map(
    (stock || []).map(x => [
      x.medication_id,
      +(x.estoque_atual || 0)
    ])
  );


  // =========================================================
  // AGRUPAR MEDICAMENTOS IGUAIS
  // =========================================================

  function calcularPedido(meses){

    const grupos = new Map();


    (needs || [])
      .filter(x => +(x.necessidade_mensal || 0) > 0)
      .forEach(x => {

        const nome =
          corrigirNome(x.nome);

        const dosagem =
          corrigirDosagem(x.dosagem || '');

        const forma =
          corrigirForma(x.forma,x.unidade);


        // Chave usada para eliminar duplicidade
        const chave = [

          semAcento(nome).toLowerCase(),

          semAcento(dosagem).toLowerCase(),

          semAcento(forma).toLowerCase()

        ].join('|');


        if(!grupos.has(chave)){

          grupos.set(chave,{

            medication_id:x.medication_id,

            nome:nome,

            dosagem:dosagem,

            forma:forma,

            pacientes:0,

            necessidade:0,

            estoque:0

          });

        }


        const g = grupos.get(chave);


        g.pacientes +=
          +(x.pacientes_ativos || 0);


        g.necessidade +=
          +(x.necessidade_mensal || 0) * meses;


        g.estoque +=
          +(estoquePorMedicamento.get(x.medication_id) || 0);

      });


    return [...grupos.values()]

      .map(x => ({

        ...x,

        quantidade:
          Math.max(
            0,
            x.necessidade - x.estoque
          )

      }))

      .filter(x => x.quantidade > 0)

      .sort((a,b)=>

        a.nome.localeCompare(
          b.nome,
          'pt-BR',
          {sensitivity:'base'}
        )

      );

  }


  // =========================================================
  // TELA DO PEDIDO
  // =========================================================

  c.innerHTML = `

  <div class="card">

    <h2>
      GESTÃO FARMACÊUTICA —
      ISAÍAS FERNANDES DE CARVALHO
    </h2>

    <h3>Pedido de Medicamentos</h3>

    <p>
      O sistema soma automaticamente os medicamentos
      utilizados pelos pacientes ativos, elimina
      duplicidades e desconta o estoque disponível.
    </p>

    <div class="grid">

      <div>

        <label>Período do pedido</label>

        <select id="mesesPedido">

          <option value="1">1 mês</option>

          <option value="2">2 meses</option>

          <option value="3">3 meses</option>

        </select>

      </div>

      <div>

        <label>Regra</label>

        <div class="pill">
          Necessidade dos pacientes − estoque atual
        </div>

      </div>

    </div>

  </div>


  <form id="fo">

    <div class="card">

      <div id="orderCalc"></div>

      <label>Observações</label>

      <input
        name="obs"
        placeholder="Observações do pedido"
      >

      <div class="actions">

        <button type="submit">
          Gerar pedido
        </button>

        <button
          type="button"
          id="baixarExcel"
          class="secondary"
        >
          Baixar Excel
        </button>

      </div>

    </div>

  </form>

  `;


  // =========================================================
  // MOSTRAR TABELA
  // =========================================================

  const render = () => {

    const meses =
      +$('#mesesPedido').value;


    const rows =
      calcularPedido(meses)
      .map((x,n)=>({...x,n}));


    $('#orderCalc').innerHTML =

      rows.length

      ? `

      <table>

        <tr>

          <th>Incluir</th>

          <th>
            Nome do medicamento
          </th>

          <th>
            Dosagem / Concentração
          </th>

          <th>
            Forma farmacêutica
          </th>

          <th>
            Quantidade
          </th>

        </tr>


        ${rows.map(x=>`

        <tr>

          <td>

            <input
              type="checkbox"
              name="inc_${x.n}"
              checked
            >

          </td>

          <td>
            ${esc(x.nome)}
          </td>

          <td>
            ${esc(x.dosagem)}
          </td>

          <td>
            ${esc(x.forma)}
          </td>

          <td>

            <input
              type="number"
              min="0"
              step="0.01"
              name="q_${x.n}"
              value="${x.quantidade}"
            >

          </td>

        </tr>

        `).join('')}

      </table>

      `

      :

      `<div class="ok">
        O estoque atual cobre a necessidade
        cadastrada para este período.
      </div>`;


    return rows;

  };


  let currentRows = render();


  $('#mesesPedido').onchange = () => {

    currentRows = render();

  };


  // =========================================================
  // GERAR EXCEL
  // =========================================================

  $('#baixarExcel').onclick = () => {

    if(!currentRows.length){

      alert(
        'Não há medicamentos para gerar o pedido.'
      );

      return;

    }


    const fd =
      new FormData($('#fo'));


    const selecionados =

      currentRows

      .filter(x =>
        fd.get(`inc_${x.n}`)
      )

      .map(x => ({

        nome:x.nome,

        dosagem:x.dosagem,

        forma:x.forma,

        quantidade:
          +fd.get(`q_${x.n}`)

      }))

      .filter(x =>
        x.quantidade > 0
      );


    if(!selecionados.length){

      alert(
        'Selecione pelo menos um medicamento.'
      );

      return;

    }


    let tabela = `

    <html>

    <head>

      <meta charset="UTF-8">

    </head>

    <body>

      <h2>
        GESTÃO FARMACÊUTICA —
        ISAÍAS FERNANDES DE CARVALHO
      </h2>

      <h3>
        PEDIDO DE MEDICAMENTOS
      </h3>

      <table border="1">

        <tr>

          <th>
            Nome do medicamento
          </th>

          <th>
            Dosagem / Concentração
          </th>

          <th>
            Forma farmacêutica
          </th>

          <th>
            Quantidade
          </th>

        </tr>

    `;


    selecionados.forEach(x=>{

      tabela += `

        <tr>

          <td>${esc(x.nome)}</td>

          <td>${esc(x.dosagem)}</td>

          <td>${esc(x.forma)}</td>

          <td>${x.quantidade}</td>

        </tr>

      `;

    });


    tabela += `

      </table>

    </body>

    </html>

    `;


    const blob =
      new Blob(
        [tabela],
        {
          type:
          'application/vnd.ms-excel;charset=utf-8'
        }
      );


    const url =
      URL.createObjectURL(blob);


    const link =
      document.createElement('a');


    link.href = url;


    link.download =
      'Pedido_Medicamentos_Gestao_Farmaceutica.xls';


    document.body.appendChild(link);


    link.click();


    link.remove();


    URL.revokeObjectURL(url);

  };


  // =========================================================
  // SALVAR PEDIDO NO SISTEMA
  // =========================================================

  $('#fo').onsubmit = async e => {

    e.preventDefault();


    if(!currentRows.length){

      alert(
        'Não há medicamentos com necessidade de compra.'
      );

      return;

    }


    const fd =
      new FormData(e.target);


    const selecionados =

      currentRows.filter(
        x => fd.get(`inc_${x.n}`)
      );


    if(!selecionados.length){

      alert(
        'Selecione pelo menos um medicamento.'
      );

      return;

    }


    const meses =
      +$('#mesesPedido').value;


    const obsUsuario =
      fd.get('obs') || '';


    const observacoes =

      `Pedido automático consolidado, ` +

      `sem duplicidades, em ordem alfabética, ` +

      `referente a ${meses} mês(es). ` +

      obsUsuario;


    const {data:pedido,error} =

      await sb
      .from('purchase_orders')
      .insert({

        status:'emitido',

        observacoes,

        created_by:profile.id

      })

      .select()

      .single();


    if(error){

      alert(error.message);

      return;

    }


    const itens =

      selecionados.map(x => ({

        order_id:
          pedido.id,

        medication_id:
          x.medication_id,

        estoque_no_momento:
          x.estoque,

        quantidade_sugerida:
          x.quantidade,

        quantidade_pedida:
          +fd.get(`q_${x.n}`)

      }));


    const {error:erroItens} =

      await sb
      .from('purchase_order_items')
      .insert(itens);


    if(erroItens){

      alert(erroItens.message);

      return;

    }


    alert(
      'Pedido gerado com sucesso.'
    );

  };



async function equipe(c){const [{data:users},{whatsapp_group_url,whatsapp_group_name}]=await Promise.all([sb.from('profiles').select('id,nome,telefone,role,ativo').in('role',['admin','gestor','atendente']).eq('ativo',true).order('nome'),getAppSettings()]); const rows=(users||[]).map(u=>{const n=(u.telefone||'').replace(/\D/g,'');const wa=n?`<a class="btn whatsapp" target="_blank" rel="noopener" href="https://wa.me/${n}">Conversar</a>`:'Sem telefone';return `<tr><td>${esc(u.nome)}</td><td>${esc(u.telefone||'')}</td><td>${esc(u.role)}</td><td>${wa}</td></tr>`}).join(''); c.innerHTML=`${whatsapp_group_url?`<div class="card ok"><h2>${esc(whatsapp_group_name||'Grupo dos Gestores')}</h2><a class="btn whatsapp" target="_blank" rel="noopener" href="${esc(whatsapp_group_url)}">Entrar / abrir grupo no WhatsApp</a></div>`:''}<div class="card"><h2>Equipe autorizada</h2><table><tr><th>Nome</th><th>WhatsApp</th><th>Perfil</th><th>Contato</th></tr>${rows}</table></div>`}
async function usuarios(c){if(profile.role!=='admin')return;c.innerHTML='<div class="card">Carregando usuários...</div>'; const [{data},{whatsapp_group_url,whatsapp_group_name}]=await Promise.all([sb.from('profiles').select('*').order('created_at'),getAppSettings()]); c.innerHTML=`<div class="card"><h2>Grupo de WhatsApp dos gestores</h2><form id="fw"><label>Nome do grupo</label><input name="name" value="${esc(whatsapp_group_name||'Gestores - Gestão Farmacêutica')}"><label>Link de convite do grupo</label><input name="url" type="url" placeholder="https://chat.whatsapp.com/..." value="${esc(whatsapp_group_url||'')}"><p class="small">Crie o grupo no WhatsApp uma única vez, copie o link de convite e salve aqui. Após a aprovação, cada gestor verá automaticamente o botão para entrar.</p><button>Salvar grupo</button></form></div><div class="card"><h2>Usuários</h2><table><tr><th>Nome</th><th>WhatsApp</th><th>Perfil</th><th>Ativo</th><th>Ação</th></tr>${(data||[]).map(u=>`<tr><td>${esc(u.nome)}</td><td>${esc(u.telefone||'')}</td><td><select id="r_${u.id}"><option ${u.role==='pendente'?'selected':''}>pendente</option><option ${u.role==='atendente'?'selected':''}>atendente</option><option ${u.role==='gestor'?'selected':''}>gestor</option><option ${u.role==='admin'?'selected':''}>admin</option><option ${u.role==='bloqueado'?'selected':''}>bloqueado</option></select></td><td>${u.ativo?'Sim':'Não'}</td><td><button data-id="${u.id}" class="saveRole">Salvar</button></td></tr>`).join('')}</table></div>`; $('#fw').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));if(o.url&&!/^https:\/\/(chat\.)?whatsapp\.com\//i.test(o.url)){alert('Informe um link de convite válido do WhatsApp.');return;}const {error}=await sb.from('app_settings').upsert({id:1,whatsapp_group_url:o.url||null,whatsapp_group_name:o.name||'Gestores - Gestão Farmacêutica',updated_by:profile.id});if(error)alert(error.message);else alert('Grupo salvo. Os usuários aprovados verão o botão automaticamente.');}; document.querySelectorAll('.saveRole').forEach(b=>b.onclick=async()=>{const role=$(`#r_${b.dataset.id}`).value;const {error}=await sb.from('profiles').update({role}).eq('id',b.dataset.id);if(error)alert(error.message);else alert(role==='gestor'||role==='atendente'||role==='admin'?'Perfil aprovado. O botão do grupo de WhatsApp já ficará disponível para este usuário.':'Perfil atualizado.')})}
async function auditoria(c){if(!['admin','gestor'].includes(profile.role))return; const {data}=await sb.from('audit_log').select('*').order('created_at',{ascending:false}).limit(200);c.innerHTML=`<div class="card"><h2>Auditoria</h2><table><tr><th>Data</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr>${(data||[]).map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('pt-BR')}</td><td>${esc(x.acao)}</td><td>${esc(x.entidade)}</td><td>${esc(JSON.stringify(x.detalhes||{}))}</td></tr>`).join('')}</table></div>`}
boot();
