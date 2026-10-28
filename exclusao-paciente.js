(function(){
  function addButtons(){
    document.querySelectorAll('.deactivatePatient, .reactivatePatient').forEach(statusButton=>{
      const row=statusButton.closest('tr');
      if(!row)return;
      const name=(row.cells?.[0]?.textContent||'').trim();
      const actions=row.cells?.[row.cells.length-1];
      if(name==='[PACIENTE EXCLUÍDO]'){
        statusButton.remove();
        if(actions)actions.textContent='Dados pessoais excluídos';
        return;
      }
      if(row.querySelector('.deletePatientPermanent'))return;
      const button=document.createElement('button');
      button.type='button';
      button.className='danger deletePatientPermanent';
      button.dataset.id=statusButton.dataset.id;
      button.dataset.name=name;
      button.textContent='Apagar cadastro definitivo';
      statusButton.insertAdjacentText('afterend',' ');
      statusButton.insertAdjacentElement('afterend',button);
    });
  }

  document.addEventListener('click',async event=>{
    const button=event.target.closest('.deletePatientPermanent');
    if(!button)return;
    const name=button.dataset.name||'este paciente';
    const confirmed=confirm(`Apagar definitivamente o cadastro de ${name}?\n\nOs dados pessoais e os vínculos atuais com medicamentos serão removidos da lista de cadastro. Esta ação não pode ser desfeita.\n\nO histórico de dispensações e prescrições será mantido para rastreabilidade.`);
    if(!confirmed)return;
    button.disabled=true;
    button.textContent='Apagando...';
    const {data,error}=await sb.rpc('excluir_paciente_inativo_permanente',{p_patient_id:button.dataset.id});
    if(error){
      button.disabled=false;
      button.textContent='Apagar cadastro definitivo';
      alert('Não foi possível apagar o cadastro: '+error.message);
      return;
    }
    alert(`Cadastro removido da lista. ${data?.vinculos_medicamentos_removidos||0} vínculo(s) com medicamentos foram removidos. O histórico de dispensações e prescrições foi preservado.`);
    page('pacientes');
  });

  const content=document.getElementById('content');
  if(content)new MutationObserver(addButtons).observe(content,{childList:true,subtree:true});
  addButtons();
})();