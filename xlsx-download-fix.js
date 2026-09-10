// Correção de download XLSX para navegadores/PWA.
// Evita arquivos Excel vazios ou corrompidos gerados pelo download direto.
(function(){
  if(!window.XLSX || window.__XLSX_DOWNLOAD_FIX__) return;
  window.__XLSX_DOWNLOAD_FIX__=true;

  const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const originalWriteFile=window.XLSX.writeFile;

  window.XLSX.writeFile=function(workbook, filename, opts){
    try{
      const name=(filename&&String(filename).trim())||'arquivo.xlsx';
      const finalName=/\.xlsx$/i.test(name)?name:name+'.xlsx';
      const data=window.XLSX.write(workbook,{
        bookType:'xlsx',
        type:'array',
        compression:false,
        cellStyles:true,
        ...(opts||{})
      });
      const blob=new Blob([data],{type:mime});
      if(!blob.size || blob.size<1000) throw new Error('Arquivo XLSX gerado com tamanho inválido.');
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=finalName;
      a.style.display='none';
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500);
    }catch(err){
      console.error('Falha no download XLSX seguro:',err);
      if(typeof originalWriteFile==='function') return originalWriteFile.call(window.XLSX,workbook,filename,opts);
      throw err;
    }
  };
})();
