import './card-photo-browser.js'

// This is an authored fixture. No real card or original file metadata is used.
window.__showPhotoDiagnosticCard=changed=>window.__renderPhoto(`<html><body><button id="upload">Choose fixture</button><input id="photo" type="file" hidden><output id="status">${changed?'Ready changed':'Ready'}</output><script>
document.getElementById('upload').addEventListener('click',()=>{
 document.getElementById('photo').click();
 ${changed?`setTimeout(()=>document.getElementById('status').textContent='OWN_PRIVATE_FIXTURE_TEXT',250);`:''}
});
document.getElementById('photo').addEventListener('change',event=>{if(event.target.files?.[0])document.getElementById('status').textContent='Selected'});
</script></body></html>`)
