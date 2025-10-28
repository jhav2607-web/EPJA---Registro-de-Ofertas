/*
  EPJA — Activación simple de la App al aceptar el aviso.
  - No “limpia” el DOM del portal; solo oculta el aviso y muestra #epja-app.
  - Evita pantallas en blanco causadas por reglas globales agresivas.
*/
(function () {
  function ready(fn){
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else { fn(); }
  }

  ready(function () {
    var body  = document.body;
    var aviso = document.getElementById("epja-aviso");
    var app   = document.getElementById("epja-app");
    var chk   = document.getElementById("chkAcepto");

    // Diagnóstico básico en consola por si falta algo
    if (!aviso) console.warn("[EPJA] #epja-aviso no encontrado");
    if (!app)   console.warn("[EPJA] #epja-app no encontrado");
    if (!chk)   console.warn("[EPJA] #chkAcepto no encontrado");
    if (!aviso || !app || !chk) return;

    // Estado seguro inicial
    app.setAttribute("aria-hidden", "true");

    chk.addEventListener("change", function () {
      if (!chk.checked) return;

      // Ocultar aviso con fade
      aviso.classList.add("epja-fade-out");
      setTimeout(function(){ aviso.style.display = "none"; }, 220);

      // Mostrar app
      app.classList.remove("is-hidden");  // por si el HTML lo trae así
      app.style.display = "block";        // cinturón y tirantes contra CSS del tema
      app.removeAttribute("aria-hidden");
      body.classList.add("epja-app-active");

      // Accesibilidad: foco al contenido
      var main = app.querySelector(".epja-main") || app;
      if (main && main.focus) main.focus();
    }, { passive: true });
  });
})();
