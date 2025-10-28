/* =========================================================
   MÓDULO 1 — Aviso: mostrar la app al aceptar el consentimiento
========================================================= */
(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else { fn(); }
  }

  ready(function () {
    var body  = document.body;
    var aviso = document.getElementById("epja-aviso");
    var app   = document.getElementById("epja-app");
    var chk   = document.getElementById("chkAcepto");
    if (!aviso || !app || !chk) return;

    app.setAttribute("aria-hidden", "true");

    chk.addEventListener("change", function () {
      if (!chk.checked) return;

      aviso.classList.add("epja-fade-out");
      setTimeout(function(){ aviso.style.display = "none"; }, 220);

      app.classList.remove("is-hidden");
      app.style.display = "block";
      app.removeAttribute("aria-hidden");
      body.classList.add("epja-app-active");

      var main = app.querySelector(".epja-main") || app;
      if (main && main.focus) main.focus();
    }, { passive: true });
  });
})();

/* =========================================================
   MÓDULO 2 — Búsqueda de Institución (AMIE) con Cloudflare Worker
========================================================= */
(function(){
  function ready(fn){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else { fn(); }
  }

  ready(function(){
    var form       = document.getElementById("frmInstitucion");
    var txtAmie    = document.getElementById("txtAmie");
    var btnBuscar  = document.getElementById("btnBuscar");
    var infoCard   = document.getElementById("infoInstitucion");
    var msj        = document.getElementById("msjInstitucion");
    if(!form || !txtAmie || !btnBuscar) return;

    // Endpoint del Worker (ajústalo si cambia)
    var WORKER_AMIE = "https://ie-proxy.jhav-2607.workers.dev/";

    /* ---------- Utilidades UI ---------- */
    function setMsg(text, kind){
      if(!msj) return;
      msj.className = "epja-msg" + (kind ? " " + kind : "");
      msj.textContent = text || "";
    }
    function setLoading(isLoading){
      if(isLoading){
        btnBuscar.disabled = true;
        btnBuscar.dataset._oldText = btnBuscar.textContent;
        btnBuscar.textContent = "Buscando...";
      }else{
        btnBuscar.disabled = false;
        if(btnBuscar.dataset._oldText){ btnBuscar.textContent = btnBuscar.dataset._oldText; }
      }
    }
    function forceShow(el){
      if(!el) return;
      el.classList.remove("hidden");
      el.style.removeProperty("display");
      el.style.removeProperty("visibility");
      el.style.display = "block";
      el.style.visibility = "visible";
    }
    function ensureResultBlock(){
      infoCard = document.getElementById("infoInstitucion");
      if(!infoCard){
        var tpl = document.createElement("div");
        tpl.innerHTML = [
          '<div id="infoInstitucion" class="epja-result hidden" aria-labelledby="subtitulo-institucion">',
          '  <h3 id="subtitulo-institucion" class="epja-subtitle">Datos de la Institución Educativa</h3>',
          '  <div class="epja-field"><label for="nombreIE">Nombre de la Institución Educativa</label><input type="text" id="nombreIE" readonly /></div>',
          '  <div class="epja-grid">',
          '    <div class="epja-field"><label for="sostenimiento">Sostenimiento</label><input type="text" id="sostenimiento" readonly /></div>',
          '    <div class="epja-field"><label for="zona">Zona</label><input type="text" id="zona" readonly /></div>',
          '    <div class="epja-field"><label for="distrito">Distrito</label><input type="text" id="distrito" readonly /></div>',
          '  </div>',
          '  <div class="epja-grid">',
          '    <div class="epja-field"><label for="provincia">Provincia</label><input type="text" id="provincia" readonly /></div>',
          '    <div class="epja-field"><label for="canton">Cantón</label><input type="text" id="canton" readonly /></div>',
          '    <div class="epja-field"><label for="parroquia">Parroquia</label><input type="text" id="parroquia" readonly /></div>',
          '  </div>',
          '  <div class="epja-field"><label for="tipo">Tipo</label><input type="text" id="tipo" readonly /></div>',
          // Bloque Extensiones (por si se creó dinámico)
          '  <div id="bloqueExtensiones" class="epja-field hidden" aria-live="polite">',
          '    <label>¿La Institución Educativa tiene extensiones o establecimientos?</label>',
          '    <div class="epja-inline-options" role="radiogroup" aria-label="Tiene extensiones">',
          '      <label class="epja-radio"><input type="radio" name="tieneExt" id="tieneExtSi" value="SI" /><span>Sí</span></label>',
          '      <label class="epja-radio"><input type="radio" name="tieneExt" id="tieneExtNo" value="NO" /><span>No</span></label>',
          '    </div>',
          '    <div id="bloqueNumExt" class="epja-field hidden">',
          '      <label for="numExtensiones">Ingrese el número de extensiones</label>',
          '      <input type="text" id="numExtensiones" inputmode="numeric" autocomplete="off" placeholder="Ejemplo: 3" aria-describedby="hint-numext" maxlength="3" />',
          '      <small id="hint-numext" class="epja-hint">Solo números enteros (0–999).</small>',
          '      <div id="msgNumExt" class="epja-msg"></div>',
          '    </div>',
          '  </div>',
          '</div>'
        ].join("");
        (form.parentElement || form).appendChild(tpl.firstChild);
        infoCard = document.getElementById("infoInstitucion");
        console.info("[EPJA] Se creó dinámicamente #infoInstitucion.");
      }
      forceShow(infoCard);
    }

    /* ---------- Normalización / validación AMIE ---------- */
    txtAmie.addEventListener("input", function(){
      txtAmie.value = (txtAmie.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    });
    function validarAmie(value){
      var v = (value || "").trim().toUpperCase();
      txtAmie.value = v;
      return { ok: /^[A-Z0-9]{8}$/.test(v), v: v };
    }

    /* ---------- Mapeo payload → campos UI ---------- */
    function pick(obj, keys) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (obj && obj[k] != null && String(obj[k]).trim() !== "") {
          return String(obj[k]).trim();
        }
      }
      return "";
    }
    function setVal(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val || "";
    }

    /* ---------- Extensiones/Establecimientos: setup y validación ---------- */
    var $bloqueExt = null, $radSi = null, $radNo = null, $bloqueNum = null, $numExt = null, $msgNum = null;

    function cacheExtControls(){
      $bloqueExt = document.getElementById("bloqueExtensiones");
      $radSi     = document.getElementById("tieneExtSi");
      $radNo     = document.getElementById("tieneExtNo");
      $bloqueNum = document.getElementById("bloqueNumExt");
      $numExt    = document.getElementById("numExtensiones");
      $msgNum    = document.getElementById("msgNumExt");
    }
    function clearNumExt(){
      if($numExt) $numExt.value = "";
      if($msgNum){ $msgNum.textContent = ""; $msgNum.className = "epja-msg"; }
    }
    function setNumExtError(msg){
      if(!$msgNum) return;
      $msgNum.textContent = msg || "";
      $msgNum.className = "epja-msg -err";
    }
    function validarNumExt(){
      if(!$numExt) return true;
      var raw = ($numExt.value || "").trim();
      if(raw === "") { setNumExtError(""); return true; }
      if(!/^\d{1,3}$/.test(raw)){
        setNumExtError("Ingrese solo números enteros (0–999).");
        return false;
      }
      setNumExtError("");
      return true;
    }
    function bindExtEvents(){
      if(!$bloqueExt) return;
      if($numExt){
        $numExt.addEventListener("input", function(){
          this.value = this.value.replace(/[^\d]/g, "").slice(0,3);
          validarNumExt();
        });
      }
      function onChangeRadios(){
        if(!$radSi || !$radNo || !$bloqueNum) return;
        if($radSi.checked){
          $bloqueNum.classList.remove("hidden");
          forceShow($bloqueNum);
          if($numExt) $numExt.focus();
        }else{
          $bloqueNum.classList.add("hidden");
          clearNumExt();
        }
      }
      if($radSi) $radSi.addEventListener("change", onChangeRadios);
      if($radNo) $radNo.addEventListener("change", onChangeRadios);
    }
    function updateExtensionesUI(){
      cacheExtControls();
      if(!$bloqueExt) return;
      var tipoVal = (document.getElementById("tipo") && document.getElementById("tipo").value || "").toUpperCase().trim();
      if(tipoVal === "MATRIZ"){
        $bloqueExt.classList.remove("hidden");
        forceShow($bloqueExt);
        bindExtEvents();
      }else{
        $bloqueExt.classList.add("hidden");
        if($radSi) $radSi.checked = false;
        if($radNo) $radNo.checked = false;
        if($bloqueNum) $bloqueNum.classList.add("hidden");
        clearNumExt();
      }
    }

    /* ---------- Pintar datos ---------- */
    function pintar(data){
      console.log("[EPJA] Payload Worker:", data);
      ensureResultBlock();

      var map = {
        nombreIE:     ["NOM_INSTITUCION_EDUCATIVA"],
        sostenimiento:["NOM_SOSTENIMIENTO"],
        zona:         ["DA_ZONA"],
        distrito:     ["DA_DIST"],
        provincia:    ["DPA_DESPRO"],
        canton:       ["DPA_DESCAN"],
        parroquia:    ["DPA_DESPAR"],
        tipo:         ["TE_fin"]
      };
      Object.keys(map).forEach(function(id){ setVal(id, pick(data, map[id])); });

      // Actualizar UI dependiente del Tipo
      updateExtensionesUI();

      requestAnimationFrame(function(){
        forceShow(infoCard);
        infoCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }

    /* ---------- Submit: llamar al Worker ---------- */
    form.addEventListener("submit", function(e){
      e.preventDefault();
      setMsg("", "");
      var existingCard = document.getElementById("infoInstitucion");
      if (existingCard) existingCard.classList.add("hidden");

      var val = validarAmie(txtAmie.value);
      if(!val.ok){
        setMsg("Ingrese un AMIE válido (8 caracteres A-Z, 0-9).", " -err");
        return;
      }

      setLoading(true);

      fetch(WORKER_AMIE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amie: val.v })
      })
      .then(function(resp){
        if(!resp.ok){
          if (resp.status === 404) throw new Error("No se encontró información para el AMIE ingresado.");
          throw new Error("El servicio devolvió un error (" + resp.status + ").");
        }
        return resp.json();
      })
      .then(function(data){
        if (!data || typeof data !== "object") throw new Error("Respuesta inesperada del servicio.");
        pintar(data);
        setMsg("Institución encontrada.", " -ok");
      })
      .catch(function(err){
        var msg = (err && err.message) || "";
        if (msg === "Failed to fetch" || err instanceof TypeError) {
          setMsg("No se pudo contactar al servicio. Verifique conexión o permisos CORS.", " -err");
        } else {
          setMsg(msg, " -err");
        }
      })
      .finally(function(){ setLoading(false); });
    });
  });
})();