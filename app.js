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
async function pacientes(c){const {data}=await sb.from('patients').select('*').order('nome'); c.innerHTML=`<div class="card"><h2>Pacientes</h2><form id="fp" class="grid"><div><label>Nome</label><input name="nome" required></div><div><label>CPF</label><input name="cpf"></div><div><label>CNS</label><input name="cns"></div><div><label>Nascimento</label><input name="nascimento" type="date"></div><div><label>Telefone</label><input name="telefone"></div><div><label>Nome da mãe</label><input name="nome_mae"></div><div style="grid-column:1/-1"><label>Endereço</label><input name="endereco"></div><div style="grid-column:1/-1"><label>Observações</label><textarea name="observacoes"></textarea></div><div><button>Salvar paciente</button></div></form></div><div class="card"><input id="buscaP" placeholder="Pesquisar paciente"><div id="tblP">${patientTable(data)}</div></div>`; $('#fp').onsubmit=async e=>{e.preventDefault();let o=Object.fromEntries(new FormData(e.target));o.created_by=profile.id; const {error}=await sb.from('patients').insert(o);if(error)alert(error.message);else page('pacientes')}; $('#buscaP').oninput=e=>{$('#tblP').innerHTML=patientTable(data.filter(x=>x.nome.toLowerCase().includes(e.target.value.toLowerCase())||(x.cpf||'').includes(e.target.value)||(x.cns||'').includes(e.target.value)))} }
function patientTable(d=[]){return `<table><tr><th>Nome</th><th>CPF</th><th>CNS</th><th>Nascimento</th></tr>${d.map(x=>`<tr><td>${esc(x.nome)}</td><td>${esc(x.cpf)}</td><td>${esc(x.cns)}</td><td>${esc(x.nascimento)}</td></tr>`).join('')}</table>`}
async function medicamentos(c){const {data}=await sb.from('medications').select('*').order('nome'); const can=['admin','gestor'].includes(profile.role); c.innerHTML=`${can?`<div class="card"><h2>Novo medicamento</h2><form id="fm" class="grid"><div><label>Nome</label><input name="nome" required></div><div><label>Dosagem</label><input name="dosagem"></div><div><label>Forma</label><input name="forma"></div><div><label>Unidade</label><input name="unidade" value="un"></div><div><label>Estoque mínimo</label><input name="estoque_minimo" type="number" step="0.01" value="0"></div><div><label>Estoque ideal</label><input name="estoque_ideal" type="number" step="0.01" value="0"></div><div><button>Salvar</button></div></form></div>`:''}<div class="card"><h2>Medicamentos</h2><table><tr><th>Nome</th><th>Dosagem</th><th>Forma</th><th>Mínimo</th><th>Ideal</th></tr>${(data||[]).map(x=>`<tr><td>${esc(x.nome)}</td><td>${esc(x.dosagem)}</td><td>${esc(x.forma)}</td><td>${x.estoque_minimo}</td><td>${x.estoque_ideal}</td></tr>`).join('')}</table></div>`; if(can)$('#fm').onsubmit=async e=>{e.preventDefault();let o=Object.fromEntries(new FormData(e.target));const {error}=await sb.from('medications').insert(o);if(error)alert(error.message);else page('medicamentos')}}
async function estoque(c){const {data:sum}=await sb.from('stock_summary').select('*').order('nome'); const {data:meds}=await sb.from('medications').select('id,nome,dosagem').eq('ativo',true).order('nome'); const can=['admin','gestor'].includes(profile.role); c.innerHTML=`${can?`<div class="card"><h2>Entrada de estoque</h2><form id="fe" class="grid"><div><label>Medicamento</label><select name="medication_id">${(meds||[]).map(m=>`<option value="${m.id}">${esc(m.nome)} ${esc(m.dosagem)}</option>`).join('')}</select></div><div><label>Quantidade</label><input name="quantidade" type="number" step="0.01" required></div><div><label>Lote</label><input name="lote"></div><div><label>Validade</label><input name="validade" type="date"></div><div><label>Fornecedor</label><input name="fornecedor"></div><div><label>Documento/NF</label><input name="documento"></div><div><button>Registrar entrada</button></div></form></div>`:''}<div class="card"><h2>Estoque atual</h2><table><tr><th>Medicamento</th><th>Dosagem</th><th>Saldo</th><th>Mínimo</th><th>Ideal</th><th>Situação</th></tr>${(sum||[]).map(x=>`<tr><td>${esc(x.nome)}</td><td>${esc(x.dosagem)}</td><td>${x.estoque_atual} ${esc(x.unidade)}</td><td>${x.estoque_minimo}</td><td>${x.estoque_ideal}</td><td>${+x.estoque_atual<=+x.estoque_minimo?'<b>COMPRAR</b>':'OK'}</td></tr>`).join('')}</table></div>`; if(can)$('#fe').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));const {error}=await sb.rpc('add_stock',{p_medication_id:o.medication_id,p_lote:o.lote||null,p_validade:o.validade||null,p_quantidade:+o.quantidade,p_fornecedor:o.fornecedor||null,p_documento:o.documento||null});if(error)alert(error.message);else page('estoque')}}
async function prescricoes(c){const [{data:patients},{data:meds},{data:rx}]=await Promise.all([sb.from('patients').select('id,nome').eq('ativo',true).order('nome'),sb.from('medications').select('id,nome,dosagem').eq('ativo',true).order('nome'),sb.from('prescriptions').select('id,data_prescricao,prescritor,patient_id,patients(nome)').order('created_at',{ascending:false}).limit(50)]); c.innerHTML=`<div class="card"><h2>Nova prescrição</h2><form id="fr"><div class="grid"><div><label>Paciente</label><select name="patient_id">${(patients||[]).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div><label>Prescritor</label><input name="prescritor"></div><div><label>CRM</label><input name="crm"></div><div><label>Data</label><input name="data_prescricao" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div><label>Validade até</label><input name="validade_ate" type="date"></div></div><hr><div class="grid"><div><label>Medicamento</label><select name="medication_id">${(meds||[]).map(x=>`<option value="${x.id}">${esc(x.nome)} ${esc(x.dosagem)}</option>`).join('')}</select></div><div><label>Posologia</label><input name="posologia"></div><div><label>Quantidade prescrita</label><input name="quantidade_prescrita" type="number" step="0.01" required></div></div><button>Salvar prescrição</button></form></div><div class="card"><h2>Últimas prescrições</h2><table><tr><th>Paciente</th><th>Data</th><th>Prescritor</th></tr>${(rx||[]).map(r=>`<tr><td>${esc(r.patients?.nome)}</td><td>${esc(r.data_prescricao)}</td><td>${esc(r.prescritor)}</td></tr>`).join('')}</table></div>`; $('#fr').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target)); const {data:r,error}=await sb.from('prescriptions').insert({patient_id:o.patient_id,prescritor:o.prescritor,crm:o.crm,data_prescricao:o.data_prescricao,validade_ate:o.validade_ate||null,created_by:profile.id}).select().single();if(error)return alert(error.message);const {error:e2}=await sb.from('prescription_items').insert({prescription_id:r.id,medication_id:o.medication_id,posologia:o.posologia,quantidade_prescrita:+o.quantidade_prescrita});if(e2)alert(e2.message);else page('prescricoes')}}
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
async function pedidos(c){const {data:s}=await sb.from('stock_summary').select('*').order('nome'); const low=(s||[]).filter(x=>+x.estoque_atual<=+x.estoque_minimo).map(x=>({...x,sug:Math.max(0,+x.estoque_ideal-+x.estoque_atual)})); c.innerHTML=`<div class="card"><h2>Pedido automático conforme estoque</h2><p>Regra: quando o saldo estiver no mínimo ou abaixo, sugerir reposição até o estoque ideal.</p><form id="fo"><table><tr><th>Incluir</th><th>Medicamento</th><th>Saldo</th><th>Mín.</th><th>Ideal</th><th>Quantidade a pedir</th></tr>${low.map((x,n)=>`<tr><td><input type="checkbox" name="inc_${n}" checked></td><td>${esc(x.nome)} ${esc(x.dosagem)}</td><td>${x.estoque_atual}</td><td>${x.estoque_minimo}</td><td>${x.estoque_ideal}</td><td><input type="number" step="0.01" name="q_${n}" value="${x.sug}"></td></tr>`).join('')}</table><label>Observações</label><input name="obs"><button>Gerar pedido</button></form></div><div class="card"><button onclick="window.print()" class="secondary no-print">Imprimir tela</button></div>`; $('#fo').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const {data:o,error}=await sb.from('purchase_orders').insert({status:'emitido',observacoes:fd.get('obs'),created_by:profile.id}).select().single();if(error)return alert(error.message);const rows=low.map((x,n)=>fd.get(`inc_${n}`)?{order_id:o.id,medication_id:x.medication_id,estoque_no_momento:+x.estoque_atual,quantidade_sugerida:x.sug,quantidade_pedida:+fd.get(`q_${n}`)}:null).filter(Boolean);const {error:e2}=await sb.from('purchase_order_items').insert(rows);if(e2)alert(e2.message);else alert('Pedido gerado com sucesso.')} }
async function equipe(c){const [{data:users},{whatsapp_group_url,whatsapp_group_name}]=await Promise.all([sb.from('profiles').select('id,nome,telefone,role,ativo').in('role',['admin','gestor','atendente']).eq('ativo',true).order('nome'),getAppSettings()]); const rows=(users||[]).map(u=>{const n=(u.telefone||'').replace(/\D/g,'');const wa=n?`<a class="btn whatsapp" target="_blank" rel="noopener" href="https://wa.me/${n}">Conversar</a>`:'Sem telefone';return `<tr><td>${esc(u.nome)}</td><td>${esc(u.telefone||'')}</td><td>${esc(u.role)}</td><td>${wa}</td></tr>`}).join(''); c.innerHTML=`${whatsapp_group_url?`<div class="card ok"><h2>${esc(whatsapp_group_name||'Grupo dos Gestores')}</h2><a class="btn whatsapp" target="_blank" rel="noopener" href="${esc(whatsapp_group_url)}">Entrar / abrir grupo no WhatsApp</a></div>`:''}<div class="card"><h2>Equipe autorizada</h2><table><tr><th>Nome</th><th>WhatsApp</th><th>Perfil</th><th>Contato</th></tr>${rows}</table></div>`}
async function usuarios(c){if(profile.role!=='admin')return;c.innerHTML='<div class="card">Carregando usuários...</div>'; const [{data},{whatsapp_group_url,whatsapp_group_name}]=await Promise.all([sb.from('profiles').select('*').order('created_at'),getAppSettings()]); c.innerHTML=`<div class="card"><h2>Grupo de WhatsApp dos gestores</h2><form id="fw"><label>Nome do grupo</label><input name="name" value="${esc(whatsapp_group_name||'Gestores - Gestão Farmacêutica')}"><label>Link de convite do grupo</label><input name="url" type="url" placeholder="https://chat.whatsapp.com/..." value="${esc(whatsapp_group_url||'')}"><p class="small">Crie o grupo no WhatsApp uma única vez, copie o link de convite e salve aqui. Após a aprovação, cada gestor verá automaticamente o botão para entrar.</p><button>Salvar grupo</button></form></div><div class="card"><h2>Usuários</h2><table><tr><th>Nome</th><th>WhatsApp</th><th>Perfil</th><th>Ativo</th><th>Ação</th></tr>${(data||[]).map(u=>`<tr><td>${esc(u.nome)}</td><td>${esc(u.telefone||'')}</td><td><select id="r_${u.id}"><option ${u.role==='pendente'?'selected':''}>pendente</option><option ${u.role==='atendente'?'selected':''}>atendente</option><option ${u.role==='gestor'?'selected':''}>gestor</option><option ${u.role==='admin'?'selected':''}>admin</option><option ${u.role==='bloqueado'?'selected':''}>bloqueado</option></select></td><td>${u.ativo?'Sim':'Não'}</td><td><button data-id="${u.id}" class="saveRole">Salvar</button></td></tr>`).join('')}</table></div>`; $('#fw').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));if(o.url&&!/^https:\/\/(chat\.)?whatsapp\.com\//i.test(o.url)){alert('Informe um link de convite válido do WhatsApp.');return;}const {error}=await sb.from('app_settings').upsert({id:1,whatsapp_group_url:o.url||null,whatsapp_group_name:o.name||'Gestores - Gestão Farmacêutica',updated_by:profile.id});if(error)alert(error.message);else alert('Grupo salvo. Os usuários aprovados verão o botão automaticamente.');}; document.querySelectorAll('.saveRole').forEach(b=>b.onclick=async()=>{const role=$(`#r_${b.dataset.id}`).value;const {error}=await sb.from('profiles').update({role}).eq('id',b.dataset.id);if(error)alert(error.message);else alert(role==='gestor'||role==='atendente'||role==='admin'?'Perfil aprovado. O botão do grupo de WhatsApp já ficará disponível para este usuário.':'Perfil atualizado.')})}
async function auditoria(c){if(!['admin','gestor'].includes(profile.role))return; const {data}=await sb.from('audit_log').select('*').order('created_at',{ascending:false}).limit(200);c.innerHTML=`<div class="card"><h2>Auditoria</h2><table><tr><th>Data</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr>${(data||[]).map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('pt-BR')}</td><td>${esc(x.acao)}</td><td>${esc(x.entidade)}</td><td>${esc(JSON.stringify(x.detalhes||{}))}</td></tr>`).join('')}</table></div>`}
boot();
