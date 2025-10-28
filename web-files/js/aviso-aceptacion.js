/* Aviso EPJA — aceptar, bloquear checkbox, ocultar tarjeta y mostrar menú */
(function () {
  var chk  = document.getElementById('chkAcepto');
  var card = document.querySelector('.aviso-card');

  // Persistencia
  var KEY  = 'aviso_aceptado_until';
  var DAYS = 90; // recordar por 90 días

  function expiresAt(days){ return Date.now() + days * 864e5; }
  function isAccepted(){
    try { return Date.now() < parseInt(localStorage.getItem(KEY) || '0', 10); }
    catch(e){ return false; }
  }
  function setAccepted(days){
    try { localStorage.setItem(KEY, String(expiresAt(days))); } catch(_) {}
  }

  // Estado visual del sitio: ocultar/mostrar menú
  function applySiteState(){
    var html = document.documentElement;
    if (isAccepted()){
      html.classList.remove('aviso-pending');
      html.classList.add('aviso-ok');
      if (card){ card.style.display = 'none'; }
    } else {
      html.classList.add('aviso-pending');
      html.classList.remove('aviso-ok');
      if (card){ card.style.display = ''; }
    }
  }

  // Bloquear el checkbox tras aceptar
  function lockCheckbox(){
    if (!chk) return;
    chk.disabled = true;
    var label = document.querySelector('label[for="chkAcepto"]');
    if (label){ label.style.opacity = '0.7'; }
  }

  if (!chk){ applySiteState(); return; }

  // Restaurar
  if (isAccepted()){
    chk.checked = true;
    lockCheckbox();
  }
  applySiteState();

  // Evento de aceptación
  chk.addEventListener('change', function (e) {
    var ok = !!e.target.checked;
    if (ok){
      setAccepted(DAYS);
      lockCheckbox();

      // ocultar tarjeta con una pequeña animación
      if (card){
        card.style.transition = 'opacity .25s ease, transform .25s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateY(-6px)';
        setTimeout(function(){
          card.style.display = 'none';
          applySiteState(); // muestra el menú
        }, 260);
      } else {
        applySiteState();
      }
    } else {
      try { localStorage.removeItem(KEY); } catch(_) {}
      applySiteState();
    }
  });
})();