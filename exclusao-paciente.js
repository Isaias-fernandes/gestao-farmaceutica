(function(){
  function addButtons(){
    document.querySelectorAll('.reactivatePatient').forEach(reactivate=>{
      const row=reactivate.closest('tr');
      if(!row||row.querySelector('.deleteInactivePatient'))return;
      const name=(row.cells?.[0]?.textContent||'').trim();
      if(name==='[PACIENTE EXCLUÍDO]'){
        reactivate.remove();
        const actions=row.cells?.[row.cells.length-1];
        if(actions)actions.textContent='Dados pessoais excluídos';
        return;
      }
      const button=document.createElement('button');
      button.type='button';
      button.className='danger deleteInactivePatient';
      button.dataset.id=reactivate.dataset.id;
      button.dataset.name=name;
      button.textContent='Excluir permanentemente';
      reactivate.insertAdjacentText('afterend',' ');
      reactivate.insertAdjacentElement('afterend',button);
    });
  }

  document.addEventListener('click',async event=>{
    const button=event.target.closest('.deleteInactivePatient');
    if(!button)return;
    const name=button.dataset.name||'este paciente';
    const confirmed=confirm(`Excluir permanentemente os dados pessoais de ${name}?\n\nEsta ação não poderá ser desfeita. O nome e os demais dados pessoais serão apagados, e a lista atual de medicamentos desse paciente será removida.\n\nO cadastro geral de medicamentos, o estoque, os lotes e o histórico de dispensações NÃO serão alterados.`);
    if(!confirmed)return;
    button.disabled=true;
    button.textContent='Excluindo...';
    const {data,error}=await sb.rpc('excluir_paciente_inativo_permanente',{p_patient_id:button.dataset.id});
    if(error){
      button.disabled=false;
      button.textContent='Excluir permanentemente';
      alert('Não foi possível excluir os dados do paciente: '+error.message);
      return;
    }
    alert(`Dados pessoais excluídos com sucesso. ${data?.vinculos_medicamentos_removidos||0} vínculo(s) da lista de medicamentos foram removidos. O histórico de dispensações foi preservado.`);
    page('pacientes');
  });

  new MutationObserver(addButtons).observe(document.getElementById('content'),{childList:true,subtree:true});
  addButtons();
})();
