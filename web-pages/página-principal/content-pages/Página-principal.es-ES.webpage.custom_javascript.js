// =============================================
// 0. Estado global EPJA
// =============================================
window.EPJA_progress = window.EPJA_progress || { institucion: false, autoridad: false };
window.epjaInstituciones = window.epjaInstituciones || [];
//window.EPJA_renderAutoridad = window.EPJA_renderAutoridad || function(){};

// =============================================
// 1. Helper ready
// =============================================
function epjaReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

// =============================================
// 2. Función GLOBAL para cambiar de vista
//    (IMPORTANTE: ahora está ARRIBA y es GLOBAL)
// =============================================
window.EPJA_setActiveView = function(viewId) {
  // ocultar todas
  document.querySelectorAll(".epja-view").forEach(function (v) {
    v.classList.add("is-hidden");
    v.classList.remove("is-active");
  });

  // mostrar destino
  var targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.remove("is-hidden");
    targetView.classList.add("is-active");
  }

  // si es autoridad → forzar render
  if (viewId === "view-op2" && typeof window.EPJA_renderAutoridad === "function") {
    window.EPJA_renderAutoridad();
  }

  // activar botón del menú
  document.querySelectorAll(".epja-nav-btn").forEach(function (btn) {
    btn.classList.remove("is-active");
    btn.removeAttribute("aria-current");
  });
  var btn = document.querySelector('.epja-nav-btn[data-view="' + viewId + '"]');
  if (btn) {
    btn.classList.add("is-active");
    btn.setAttribute("aria-current", "page");
  }
};

// =============================================
// 3. MÓDULO — Aviso / mostrar app
// =============================================
epjaReady(function () {
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

    // vista por defecto
    window.EPJA_setActiveView("view-op1");
  }, { passive: true });
});

// =============================================
// 4. MÓDULO — Institución Educativa
//    (búsqueda AMIE + extensiones + “Siguiente”)
// =============================================
epjaReady(function () {
  var form       = document.getElementById("frmInstitucion");
  var txtAmie    = document.getElementById("txtAmie");
  var btnBuscar  = document.getElementById("btnBuscar");
  var infoCard   = document.getElementById("infoInstitucion");
  var msj        = document.getElementById("msjInstitucion");
  if (!form || !txtAmie || !btnBuscar) return;

  // endpoint
  var WORKER_AMIE = "https://ie-proxy.jhav-2607.workers.dev/";

  // helpers UI
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

  // bloque de extensiones (estado)
  var EPJA_extState = { panels: [] };
  var $bloqueExt, $radSi, $radNo, $bloqueNum, $numExt, $msgNum, $extPanels;

  function cacheExtControls(){
    $bloqueExt = document.getElementById("bloqueExtensiones");
    $radSi     = document.getElementById("tieneExtSi");
    $radNo     = document.getElementById("tieneExtNo");
    $bloqueNum = document.getElementById("bloqueNumExt");
    $numExt    = document.getElementById("numExtensiones");
    $msgNum    = document.getElementById("msgNumExt");
    $extPanels = document.getElementById("extPanelsContainer");
  }
  cacheExtControls();

  // validación AMIE
  txtAmie.addEventListener("input", function(){
    txtAmie.value = (txtAmie.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  });
  function validarAmie(value){
    var v = (value || "").trim().toUpperCase();
    txtAmie.value = v;
    return { ok: /^[A-Z0-9]{8}$/.test(v), v: v };
  }

  // nombres válidos
  function EPJA_isNombreValido(valor){
    if(typeof valor !== "string") return false;
    var t = valor.trim().toUpperCase();
    if(t.length === 0) return false;
    var re = /^[A-ZÁÉÍÓÚÑ0-9\s\-\.,'()\/]+$/;
    return re.test(t);
  }
  function EPJA_toUpperInput(el){
    if(!el) return;
    var s = el.selectionStart, e = el.selectionEnd;
    el.value = (el.value || "").toUpperCase();
    try { el.setSelectionRange(s, e); } catch(_){}
  }

  // construir paneles de extensiones
  function EPJA_renderPanel(model){
    var idx = model.index;
    var item = document.createElement("div");
    item.className = "epja-acc-item";
    item.setAttribute("data-index", String(idx));

    var header = document.createElement("button");
    header.type = "button";
    header.className = "epja-acc-header";
    header.id = "ext-panel-header-" + idx;
    header.setAttribute("aria-expanded", "false");
    header.setAttribute("aria-controls", "ext-panel-body-" + idx);
    header.innerHTML = '<span>Detalle de Extensión / Establecimiento #'+idx+'</span><span class="epja-acc-caret">&#9656;</span>';

    var body = document.createElement("div");
    body.className = "epja-acc-body hidden";
    body.id = "ext-panel-body-" + idx;

    // tipo
    var fieldTipo = document.createElement("div");
    fieldTipo.className = "epja-field";
    var lblTipo = document.createElement("label");
    lblTipo.textContent = "Tipo";
    lblTipo.setAttribute("for", "ext-tipo-" + idx);
    var selTipo = document.createElement("select");
    selTipo.className = "epja-select";
    selTipo.id = "ext-tipo-" + idx;
    selTipo.innerHTML = '<option value="">Seleccione...</option><option value="EXTENSIÓN">EXTENSIÓN</option><option value="ESTABLECIMIENTO">ESTABLECIMIENTO</option>';
    if (model.tipo) selTipo.value = model.tipo;
    fieldTipo.appendChild(lblTipo);
    fieldTipo.appendChild(selTipo);

    // nombre
    var fieldNom = document.createElement("div");
    fieldNom.className = "epja-field";
    var lblNom = document.createElement("label");
    lblNom.textContent = "Nombre de la Extensión / Establecimiento";
    lblNom.setAttribute("for","ext-nombre-" + idx);
    var inpNom = document.createElement("input");
    inpNom.type = "text";
    inpNom.id   = "ext-nombre-" + idx;
    inpNom.className = "epja-input epja-input-uppercase";
    inpNom.maxLength = 150;
    if (model.nombre) inpNom.value = model.nombre;
    var help = document.createElement("div");
    help.className = "epja-hint";
    help.textContent = "Se transformará automáticamente a MAYÚSCULAS.";
    var err = document.createElement("div");
    err.className = "epja-msg -err hidden";
    err.id = "ext-nombre-err-" + idx;
    err.textContent = "Nombre inválido.";

    fieldNom.appendChild(lblNom);
    fieldNom.appendChild(inpNom);
    fieldNom.appendChild(help);
    fieldNom.appendChild(err);

    header.addEventListener("click", function(){
      var expanded = header.getAttribute("aria-expanded") === "true";
      header.setAttribute("aria-expanded", String(!expanded));
      body.classList.toggle("hidden", expanded);
    });

    selTipo.addEventListener("change", function(){
      model.tipo = selTipo.value;
      EPJA_isInstitucionComplete(false);
    });

    inpNom.addEventListener("input", function(){
      EPJA_toUpperInput(inpNom);
      model.nombre = inpNom.value;
      if (EPJA_isNombreValido(inpNom.value)) {
        err.classList.add("hidden");
      } else {
        if (inpNom.value.trim() !== "") err.classList.remove("hidden");
      }
      EPJA_isInstitucionComplete(false);
    });

    body.appendChild(fieldTipo);
    body.appendChild(fieldNom);
    item.appendChild(header);
    item.appendChild(body);
    return item;
  }

  function EPJA_buildPanels(n){
    var prev = EPJA_extState.panels.slice(0, n);
    while(prev.length < n){
      prev.push({ index: prev.length + 1, tipo: "", nombre: "" });
    }
    EPJA_extState.panels = prev;
    if (!$extPanels) return;
    $extPanels.innerHTML = "";
    prev.forEach(function(m){ $extPanels.appendChild(EPJA_renderPanel(m)); });
    $extPanels.classList.remove("hidden");
    $extPanels.style.display = "block";
  }

  function setNumExtError(msg){
    if(!$msgNum) return;
    $msgNum.textContent = msg || "";
    $msgNum.className = msg ? "epja-msg -err" : "epja-msg";
  }

  function validarNumExt(){
    if (!$numExt) return true;
    var raw = ($numExt.value || "").trim();
    if (raw === "") {
      setNumExtError("");
      if ($extPanels){ $extPanels.classList.add("hidden"); $extPanels.innerHTML=""; }
      EPJA_extState.panels = [];
      return true;
    }
    if (!/^\d{1,3}$/.test(raw)){
      setNumExtError("Ingrese solo números enteros (1–999).");
      return false;
    }
    var n = parseInt(raw,10);
    if (n < 1 || n > 999){
      setNumExtError("Ingrese un valor entre 1 y 999.");
      return false;
    }
    setNumExtError("");
    if ($radSi && $radSi.checked) {
      EPJA_buildPanels(n);
    }
    return true;
  }

  function bindExtEvents(){
    cacheExtControls();
    if ($numExt){
      $numExt.addEventListener("input", function(){
        this.value = this.value.replace(/[^\d]/g, "").slice(0,3);
        validarNumExt();
        EPJA_isInstitucionComplete(false);
      });
    }
    function onChangeRadios(){
      if(!$bloqueNum) return;
      if($radSi && $radSi.checked){
        $bloqueNum.classList.remove("hidden");
        forceShow($bloqueNum);
        validarNumExt();
      } else {
        $bloqueNum.classList.add("hidden");
        if($extPanels){ $extPanels.classList.add("hidden"); $extPanels.innerHTML=""; }
        EPJA_extState.panels = [];
      }
      EPJA_isInstitucionComplete(false);
    }
    if($radSi) $radSi.addEventListener("change", onChangeRadios);
    if($radNo) $radNo.addEventListener("change", onChangeRadios);
  }

  bindExtEvents();

  // ===== validar paso institución =====
  function validarPasoInstitucion(){
    var msgGlobal = document.getElementById("msgValInstitucion");
    if (msgGlobal){
      msgGlobal.classList.add("hidden");
      msgGlobal.textContent = "";
    }

    // debe existir tarjeta
    if (!infoCard || infoCard.classList.contains("hidden")){
      if (msgGlobal){
        msgGlobal.textContent = "Debe buscar y cargar una Institución Educativa antes de continuar.";
        msgGlobal.classList.remove("hidden");
      }
      return false;
    }

    var tipoVal = ((document.getElementById("tipo") || {}).value || "").toUpperCase().trim();
    // si no es MATRIZ, listo
    if (tipoVal !== "MATRIZ") {
      return true;
    }

    // es MATRIZ
    cacheExtControls();
    if (!$radSi && !$radNo) return true;

    var tieneSi = $radSi && $radSi.checked;
    var tieneNo = $radNo && $radNo.checked;
    if (!tieneSi && !tieneNo){
      if (msgGlobal){
        msgGlobal.textContent = "Indique si la Institución Educativa tiene extensiones o establecimientos.";
        msgGlobal.classList.remove("hidden");
      }
      return false;
    }
    if (tieneNo) return true;

    // dijo sí
    if (!validarNumExt() || !$numExt.value.trim()){
      if (msgGlobal){
        msgGlobal.textContent = "Ingrese el número de extensiones/establecimientos.";
        msgGlobal.classList.remove("hidden");
      }
      return false;
    }

    // validar cada panel
    var ok = true;
    EPJA_extState.panels.forEach(function(m){
      var sel = document.getElementById("ext-tipo-" + m.index);
      var inp = document.getElementById("ext-nombre-" + m.index);
      var err = document.getElementById("ext-nombre-err-" + m.index);
      var tipoOk = sel && (sel.value === "EXTENSIÓN" || sel.value === "ESTABLECIMIENTO");
      var nomVal = (inp && inp.value || "").trim();
      var nomOk  = EPJA_isNombreValido(nomVal);
      if (!tipoOk || !nomOk){
        ok = false;
        if (err && !nomOk) err.classList.remove("hidden");
      }
    });

    if (!ok && msgGlobal){
      msgGlobal.textContent = "Complete los datos de todas las extensiones/establecimientos generadas.";
      msgGlobal.classList.remove("hidden");
    }

    return ok;
  }

  function EPJA_isInstitucionComplete(showErrors){
    if (showErrors) {
      var ok = validarPasoInstitucion();
      window.EPJA_progress.institucion = !!ok;
      return ok;
    }

    // silenciosa
    if (!infoCard || infoCard.classList.contains("hidden")) {
      window.EPJA_progress.institucion = false;
      return false;
    }
    var tipoVal = ((document.getElementById("tipo") || {}).value || "").toUpperCase().trim();
    if (tipoVal !== "MATRIZ") {
      window.EPJA_progress.institucion = true;
      return true;
    }
    cacheExtControls();
    if (!($radSi && $radSi.checked) && !($radNo && $radNo.checked)) {
      window.EPJA_progress.institucion = false;
      return false;
    }
    if ($radNo && $radNo.checked) {
      window.EPJA_progress.institucion = true;
      return true;
    }
    if (!$numExt || !/^\d{1,3}$/.test($numExt.value.trim())) {
      window.EPJA_progress.institucion = false;
      return false;
    }
    window.EPJA_progress.institucion = true;
    return true;
  }

  // pintar datos desde worker
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

  function updateExtensionesUI(){
    cacheExtControls();
    var tipoVal = ((document.getElementById("tipo") || {}).value || "").toUpperCase().trim();
    if (tipoVal === "MATRIZ"){
      if ($bloqueExt){
        $bloqueExt.classList.remove("hidden");
        forceShow($bloqueExt);
      }
      bindExtEvents();
    } else {
      if ($bloqueExt) $bloqueExt.classList.add("hidden");
      if ($radSi) $radSi.checked = false;
      if ($radNo) $radNo.checked = false;
      if ($bloqueNum) $bloqueNum.classList.add("hidden");
      if ($extPanels){ $extPanels.classList.add("hidden"); $extPanels.innerHTML = ""; }
      EPJA_extState.panels = [];
    }
  }

  function pintar(data){
    console.log("[EPJA] Payload Worker:", data);
    if (!infoCard) return;

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

    // pasar instituciones al módulo 2
    var _nom  = (document.getElementById("nombreIE") && document.getElementById("nombreIE").value) || "";
    var _tipo = (document.getElementById("tipo") && document.getElementById("tipo").value) || "";
    var _amie = (txtAmie && txtAmie.value) ? txtAmie.value : "";
    window.epjaInstituciones = [{
      nombre: _nom,
      tipo: _tipo,
      amie: _amie
    }];

    // avisar al resto de la app que ya hay institución
    try {
      window.dispatchEvent(new CustomEvent("epja:institucion-loaded", {
        detail: {
          instituciones: window.epjaInstituciones
        }
      }));
    } catch (e) {
      console.warn("[EPJA] no se pudo despachar evento epja:institucion-loaded", e);
    }

    updateExtensionesUI();

    // marcar progreso (si no es matriz pasa directo)
    var esMatriz = (_tipo || "").toUpperCase().trim() === "MATRIZ";
    window.EPJA_progress.institucion = !esMatriz;
    EPJA_isInstitucionComplete(false);

    forceShow(infoCard);
    infoCard.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // 🔴 aquí sí: si ya teníamos la función de autoridad, que pinte
    if (typeof window.EPJA_renderAutoridad === "function") {
      window.EPJA_renderAutoridad();
    }
  }

  // submit
  form.addEventListener("submit", function(e){
    e.preventDefault();
    setMsg("", "");
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

    // construye el arreglo global con matriz + extensiones
function EPJA_buildGlobalInstituciones() {
  // 1) matriz (la que vino del worker)
  var nombreBase = (document.getElementById("nombreIE")?.value || "").trim();
  var tipoBase   = (document.getElementById("tipo")?.value || "").trim();
  var amieBase   = (document.getElementById("txtAmie")?.value || "").trim();

  // si no hay matriz, no hacemos nada raro
  var lista = [];
  if (nombreBase || amieBase) {
    lista.push({
      nombre: nombreBase || "SIN NOMBRE",
      tipo: (tipoBase || "").toUpperCase(),
      amie: amieBase
    });
  }

  // 2) si es MATRIZ y el usuario dijo "Sí" y hay número válido → agregar extensiones
  cacheExtControls();
  var esMatriz = (tipoBase || "").toUpperCase() === "MATRIZ";
  var dijoSi   = $radSi && $radSi.checked;

  if (esMatriz && dijoSi && Array.isArray(EPJA_extState.panels) && EPJA_extState.panels.length) {
    EPJA_extState.panels.forEach(function (p, idx) {
      // leer del DOM por si el usuario editó
      var sel = document.getElementById("ext-tipo-" + p.index);
      var inp = document.getElementById("ext-nombre-" + p.index);

      var tipoExt = (sel && sel.value) ? sel.value : (p.tipo || "");
      var nomExt  = (inp && inp.value) ? inp.value : (p.nombre || "");

      if (nomExt.trim() !== "") {
        lista.push({
          nombre: nomExt.trim(),
          // EXTENSIÓN / ESTABLECIMIENTO
          tipo: (tipoExt || "EXTENSIÓN").toUpperCase(),
          // aquí podrías dejar amie vacío porque suelen no tener
          amie: ""
        });
      }
    });
  }

  // 3) publicar al global para que lo vea el módulo 2
  window.epjaInstituciones = lista;
  // log de control
  console.log("[EPJA][INST] instituciones enviadas al paso 2:", lista);
}

  // botón siguiente
  var btnNext = document.getElementById("btnNextInstitucion");
  if (btnNext){
    btnNext.addEventListener("click", function(){
      // 1) validar todo el paso
      if (!EPJA_isInstitucionComplete(true)) return;

      // 2) construir la lista global (MATRIZ + extensiones)
      EPJA_buildGlobalInstituciones();

      // 3) marcar progreso
      window.EPJA_progress.institucion = true;

      // 4) ir a autoridad (esto ya dispara EPJA_renderAutoridad)
      window.EPJA_setActiveView("view-op2");
    });
  }

  // menú lateral (bloqueo por pasos)
  document.querySelectorAll(".epja-nav-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      var viewId = btn.getAttribute("data-view");
      if (!viewId) return;

      // recalcular
      EPJA_isInstitucionComplete(false);

      if (viewId === "view-op2" && !window.EPJA_progress.institucion) {
        alert("Debe completar la información de Institución Educativa antes de continuar.");
        return;
      }
      if (viewId === "view-op3" && !window.EPJA_progress.autoridad) {
        alert("Debe completar la información de Autoridad Educativa antes de continuar.");
        return;
      }

      window.EPJA_setActiveView(viewId);
    });
  });
});

// =============================================
// 5. MÓDULO — Autoridad Educativa
//    (tabla + modo “misma autoridad” + modal)
// =============================================
epjaReady(function () {
  var viewAutoridad = document.getElementById("view-op2");
  var tblAutoridad = document.getElementById("tblAutoridadInstituciones");
  var tblBody = tblAutoridad ? tblAutoridad.querySelector("tbody") : null;
  var chkMismaAutoridad = document.getElementById("chkMismaAutoridad");
  var bloqueAutoridadGlobal = document.getElementById("bloqueAutoridadGlobal");

  // campos globales
  var autTipoDoc = document.getElementById("autTipoDoc");
  var bloqueCedula = document.getElementById("bloqueCedula");
  var bloquePasaporte = document.getElementById("bloquePasaporte");
  var bloqueExtranjera = document.getElementById("bloqueExtranjera");

  var autCedula = document.getElementById("autCedula");
  var btnBuscarCedula = document.getElementById("btnBuscarCedula");
  var msgCedula = document.getElementById("msgCedula");
  var autNombreCompleto = document.getElementById("autNombreCompleto");

  var autPasaporte = document.getElementById("autPasaporte");
  var autNombreCompletoPas = document.getElementById("autNombreCompletoPas");
  var autExtranjera = document.getElementById("autExtranjera");
  var autNombreCompletoExt = document.getElementById("autNombreCompletoExt");

  var autCorreoPersonal = document.getElementById("autCorreoPersonal");
  var autCorreoInstitucional = document.getElementById("autCorreoInstitucional");
  var autCelular = document.getElementById("autCelular");

  // modal
  var modal = document.getElementById("epja-modal-institucion");
  var modalCloseBtn = document.getElementById("epjaModalClose");
  var modalBodyInst = document.getElementById("epjaModalInstNombre");

  var modTipoDoc = document.getElementById("modTipoDoc");
  var modBloqueCedula = document.getElementById("modBloqueCedula");
  var modBloquePasaporte = document.getElementById("modBloquePasaporte");
  var modBloqueExtranjera = document.getElementById("modBloqueExtranjera");
  var modCedula = document.getElementById("modCedula");
  var modBtnBuscarCedula = document.getElementById("modBtnBuscarCedula");
  var modMsgCedula = document.getElementById("modMsgCedula");
  var modNombreCompleto = document.getElementById("modNombreCompleto");
  var modPasaporte = document.getElementById("modPasaporte");
  var modNombreCompletoPas = document.getElementById("modNombreCompletoPas");
  var modExtranjera = document.getElementById("modExtranjera");
  var modNombreCompletoExt = document.getElementById("modNombreCompletoExt");
  var modCorreoPersonal = document.getElementById("modCorreoPersonal");
  var modCorreoInstitucional = document.getElementById("modCorreoInstitucional");
  var modCelular = document.getElementById("modCelular");
  var modBtnGuardar = document.getElementById("modBtnGuardar");

  var indiceInstitucionEnEdicion = null;

  function mostrarSoloBloqueDoc(tipo, prefijo) {
    var bc, bp, be;
    if (prefijo === "mod") {
      bc = modBloqueCedula;
      bp = modBloquePasaporte;
      be = modBloqueExtranjera;
    } else {
      bc = bloqueCedula;
      bp = bloquePasaporte;
      be = bloqueExtranjera;
    }

    [bc, bp, be].forEach(function (blk) {
      if (!blk) return;
      blk.style.display = "none";
      blk.classList.add("hidden");
    });

    var target = null;
    if (tipo === "cedula") target = bc;
    else if (tipo === "pasaporte") target = bp;
    else if (tipo === "extranjera") target = be;

    if (target) {
      target.classList.remove("hidden");
      target.style.display = "block";
    }
  }

  function validarCorreo(valor) {
    if (!valor) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  }
  function validarCelularEcuador(valor) {
    return /^09\d{8}$/.test(valor);
  }
  function isCedulaEcuadorValida(ced) {
    if (!/^\d{10}$/.test(ced)) return false;
    var prov = parseInt(ced.slice(0, 2), 10);
    if (!((prov >= 1 && prov <= 24) || prov === 30)) return false;
    var coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    var suma = 0;
    for (var i = 0; i < 9; i++) {
      var prod = parseInt(ced[i], 10) * coef[i];
      if (prod > 9) prod -= 9;
      suma += prod;
    }
    var dv = (10 - (suma % 10)) % 10;
    return dv === parseInt(ced[9], 10);
  }

  async function consultarCedulaViaWorker(cedula) {
    var API_URL = "https://rc-proxy.jhav-2607.workers.dev/";
    var API_KEY = "z7jWoFhfjS3V8$#E%#rcj7";
    var resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({ cedula: cedula })
    });
    var text = await resp.text();
    var data = {};
    try { data = JSON.parse(text); } catch(e){ throw new Error("JSON inválido"); }
    if (!resp.ok) throw new Error("Error worker " + resp.status);
    return data;
  }

  function asegurarInstitucionesDesdeDOM() {
    if (Array.isArray(window.epjaInstituciones) && window.epjaInstituciones.length > 0) {
      return;
    }
    var nom  = (document.getElementById("nombreIE") && document.getElementById("nombreIE").value) || "";
    var tipo = (document.getElementById("tipo") && document.getElementById("tipo").value) || "";
    var amie = (document.getElementById("txtAmie") && document.getElementById("txtAmie").value) || "";
    if (!nom && !amie) return;
    window.epjaInstituciones = [{ nombre: nom || "Sin nombre", tipo: tipo || "—", amie: amie || "" }];
  }

  function renderTablaAutoridad() {
    if (!tblBody) return;

    // asegurar que tenemos algo del paso 1
    asegurarInstitucionesDesdeDOM();

    // limpiar tabla
    tblBody.innerHTML = "";

    var lista = Array.isArray(window.epjaInstituciones)
      ? window.epjaInstituciones
      : [];

    if (!lista.length) {
      var trEmpty = document.createElement("tr");
      var tdEmpty = document.createElement("td");
      tdEmpty.colSpan = 4;
      tdEmpty.textContent = "No existen instituciones registradas en el paso anterior.";
      tdEmpty.style.textAlign = "center";
      trEmpty.appendChild(tdEmpty);
      tblBody.appendChild(trEmpty);
      return;
    }

    lista.forEach(function (item, index) {
      var tr = document.createElement("tr");

      // #
      var tdNum = document.createElement("td");
      tdNum.textContent = index + 1;

      // nombre
      var tdNombre = document.createElement("td");
      tdNombre.textContent = item.nombre || "Sin nombre";

      // tipo
      var tdTipo = document.createElement("td");
      tdTipo.textContent = item.tipo || "—";

      // acciones
      var tdAcciones = document.createElement("td");
      var btnAccion = document.createElement("button");
      btnAccion.type = "button";
      btnAccion.className = "epja-btn-action";
      btnAccion.textContent = "Acción";

      // ⚠️ aquí conectamos el modal SI NO está en modo "misma autoridad"
      btnAccion.addEventListener("click", function () {
        if (chkMismaAutoridad && chkMismaAutoridad.checked) {
          return;
        }
        abrirModalInstitucion(item, index);
      });

      tdAcciones.appendChild(btnAccion);

      tr.appendChild(tdNum);
      tr.appendChild(tdNombre);
      tr.appendChild(tdTipo);
      tr.appendChild(tdAcciones);

      tblBody.appendChild(tr);
    });

    // si está activado “usar la misma autoridad” → deshabilitar todos los botones
    if (chkMismaAutoridad && chkMismaAutoridad.checked) {
      tblBody.querySelectorAll(".epja-btn-action").forEach(function (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.4";
        btn.style.pointerEvents = "none";
      });
    }

    console.log("[EPJA][AUTORIDAD] tabla renderizada con", lista.length, "filas.");
  }

  // exponer al global
  window.EPJA_renderAutoridad = renderTablaAutoridad;

  // si alguna institución se carga DESPUÉS, volvemos a pintar
  window.addEventListener("epja:institucion-loaded", function (ev) {
    console.log("[EPJA][Autoridad] recibido evento epja:institucion-loaded", ev.detail);
    renderTablaAutoridad();
  });

  // modo misma autoridad
  if (chkMismaAutoridad) {
    chkMismaAutoridad.addEventListener("change", function () {
      var usar = chkMismaAutoridad.checked;
      if (bloqueAutoridadGlobal) {
        bloqueAutoridadGlobal.style.display = usar ? "block" : "none";
      }
      renderTablaAutoridad();
    });
  }

  // tipo doc global
  if (autTipoDoc) {
    autTipoDoc.addEventListener("change", function () {
      mostrarSoloBloqueDoc(autTipoDoc.value, "");
    });
  }

  // buscar cédula global
  if (btnBuscarCedula) {
    btnBuscarCedula.addEventListener("click", async function () {
      var ced = autCedula.value.trim();
      msgCedula.textContent = "";
      if (!ced) {
        msgCedula.textContent = "Ingrese un número de cédula.";
        msgCedula.style.color = "#b91c1c";
        return;
      }
      if (!isCedulaEcuadorValida(ced)) {
        msgCedula.textContent = "Formato de cédula no estándar, se intentará consultar.";
        msgCedula.style.color = "#b45309";
      } else {
        msgCedula.textContent = "Validando e intentando consultar en Registro Civil...";
        msgCedula.style.color = "#0f766e";
      }

      try {
        var data = await consultarCedulaViaWorker(ced);
        var nombresCompletos = "";
        if (data.nombres || data.apellidos) {
          nombresCompletos = [data.nombres, data.apellidos].filter(Boolean).join(" ");
        } else if (data.nombreCompleto) {
          nombresCompletos = data.nombreCompleto;
        }
        autNombreCompleto.value = nombresCompletos || "";
        msgCedula.textContent = "Datos obtenidos correctamente.";
        msgCedula.style.color = "#0f766e";
      } catch (err) {
        msgCedula.textContent = "No se pudo obtener datos del Registro Civil.";
        msgCedula.style.color = "#b91c1c";
      }
    });
  }

  // modal
  function abrirModalInstitucion(item, index) {
    indiceInstitucionEnEdicion = index;

    if (modal) {
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
      modal.style.display = "flex"; // para centrar con flex
    }

    // ===== Placeholders dinámicos =====
    modCorreoPersonal.setAttribute("placeholder", "ejemplo@gmail.com");
    modCorreoInstitucional.setAttribute("placeholder", "usuario@educacion.gob.ec");
    modCelular.setAttribute("placeholder", "0999999999");

    // título
    if (modalBodyInst) {
      modalBodyInst.textContent = item.nombre || "Institución sin nombre";
    }

    // limpiar primero
    modTipoDoc.value = "";
    mostrarSoloBloqueDoc("", "mod");
    modCedula.value = "";
    modMsgCedula.textContent = "";
    modNombreCompleto.value = "";
    modPasaporte.value = "";
    modNombreCompletoPas.value = "";
    modExtranjera.value = "";
    modNombreCompletoExt.value = "";
    modCorreoPersonal.value = "";
    modCorreoInstitucional.value = "";
    modCelular.value = "";

    // 👇 si ya tenía autoridad, la rellenamos
    if (item && item.autoridad) {
      var a = item.autoridad;

      // tipo doc
      if (a.tipoDoc) {
        modTipoDoc.value = a.tipoDoc;
        mostrarSoloBloqueDoc(a.tipoDoc, "mod");
      }

      // según tipo
      if (a.tipoDoc === "cedula") {
        if (a.cedula) modCedula.value = a.cedula;
        if (a.nombreCompleto) modNombreCompleto.value = a.nombreCompleto;
      } else if (a.tipoDoc === "pasaporte") {
        if (a.pasaporte) modPasaporte.value = a.pasaporte;
        if (a.nombreCompleto) modNombreCompletoPas.value = a.nombreCompleto;
      } else if (a.tipoDoc === "extranjera") {
        if (a.identExtranjera) modExtranjera.value = a.identExtranjera;
        if (a.nombreCompleto) modNombreCompletoExt.value = a.nombreCompleto;
      }

      if (a.correoPersonal)       modCorreoPersonal.value = a.correoPersonal;
      if (a.correoInstitucional)  modCorreoInstitucional.value = a.correoInstitucional;
      if (a.celular)              modCelular.value = a.celular;
    }
  }



  function cerrarModal() {
    if (modal) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      modal.style.display = "none";
    }
    indiceInstitucionEnEdicion = null;
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", cerrarModal);
  }
  if (modal) {
    modal.addEventListener("click", function (ev) {
      if (ev.target && ev.target.dataset && ev.target.dataset.close === "modal") {
        cerrarModal();
      }
    });
  }

  if (modTipoDoc) {
    modTipoDoc.addEventListener("change", function () {
      mostrarSoloBloqueDoc(modTipoDoc.value, "mod");
    });
  }

  if (modBtnBuscarCedula) {
    modBtnBuscarCedula.addEventListener("click", async function () {
      var ced = modCedula.value.trim();
      modMsgCedula.textContent = "";
      if (!ced) {
        modMsgCedula.textContent = "Ingrese un número de cédula.";
        modMsgCedula.style.color = "#b91c1c";
        return;
      }
      if (!isCedulaEcuadorValida(ced)) {
        modMsgCedula.textContent = "Formato de cédula no estándar, se intentará consultar.";
        modMsgCedula.style.color = "#b45309";
      } else {
        modMsgCedula.textContent = "Consultando en Registro Civil...";
        modMsgCedula.style.color = "#0f766e";
      }

      try {
        var data = await consultarCedulaViaWorker(ced);
        var nombresCompletos = "";
        if (data.nombres || data.apellidos) {
          nombresCompletos = [data.nombres, data.apellidos].filter(Boolean).join(" ");
        } else if (data.nombreCompleto) {
          nombresCompletos = data.nombreCompleto;
        }
        modNombreCompleto.value = nombresCompletos || "";
        modMsgCedula.textContent = "Datos obtenidos correctamente.";
        modMsgCedula.style.color = "#0f766e";
      } catch (err) {
        modMsgCedula.textContent = "No se pudo obtener datos del Registro Civil.";
        modMsgCedula.style.color = "#b91c1c";
      }
    });
  }

  if (modBtnGuardar) {
    modBtnGuardar.addEventListener("click", function () {
      if (indiceInstitucionEnEdicion == null) {
        cerrarModal();
        return;
      }
      var inst = window.epjaInstituciones[indiceInstitucionEnEdicion];
      if (!inst) {
        cerrarModal();
        return;
      }

      var tipo = modTipoDoc.value;
      if (!tipo) {
        alert("Seleccione el tipo de documento.");
        return;
      }

      var correo1 = modCorreoPersonal.value.trim();
      var correo2 = modCorreoInstitucional.value.trim();
      var cel = modCelular.value.trim();

      if (!validarCorreo(correo1)) {
        alert("El correo personal no es válido.");
        return;
      }
      if (!validarCorreo(correo2)) {
        alert("El correo institucional no es válido.");
        return;
      }
      if (!validarCelularEcuador(cel)) {
        alert("El número celular no es válido. Debe iniciar con 09 y tener 10 dígitos.");
        return;
      }

      var datosAut = {
        tipoDoc: tipo,
        correoPersonal: correo1,
        correoInstitucional: correo2,
        celular: cel
      };

      if (tipo === "cedula") {
        datosAut.cedula = modCedula.value.trim();
        datosAut.nombreCompleto = modNombreCompleto.value.trim();
      } else if (tipo === "pasaporte") {
        datosAut.pasaporte = modPasaporte.value.trim();
        datosAut.nombreCompleto = modNombreCompletoPas.value.trim();
      } else if (tipo === "extranjera") {
        datosAut.identExtranjera = modExtranjera.value.trim();
        datosAut.nombreCompleto = modNombreCompletoExt.value.trim();
      }

      inst.autoridad = datosAut;
      cerrarModal();
    });
  }

  // botón “guardar y continuar”
  var btnAutoridadSiguiente = document.getElementById("btnAutoridadSiguiente");
  if (btnAutoridadSiguiente) {
    btnAutoridadSiguiente.addEventListener("click", function () {
      // si está en modo misma autoridad, validar
      if (chkMismaAutoridad && chkMismaAutoridad.checked) {
        if (!autTipoDoc.value) {
          alert("Seleccione el tipo de documento de la autoridad.");
          return;
        }
        if (autTipoDoc.value === "cedula" && !autCedula.value.trim()) {
          alert("Ingrese la cédula.");
          return;
        }
        if (autTipoDoc.value === "pasaporte" && !autPasaporte.value.trim()) {
          alert("Ingrese el número de pasaporte.");
          return;
        }
        if (autTipoDoc.value === "extranjera" && !autExtranjera.value.trim()) {
          alert("Ingrese la identificación extranjera.");
          return;
        }
        if (!validarCorreo(autCorreoPersonal.value.trim())) {
          alert("El correo personal no es válido.");
          return;
        }
        if (!validarCorreo(autCorreoInstitucional.value.trim())) {
          alert("El correo institucional no es válido.");
          return;
        }
        if (!validarCelularEcuador(autCelular.value.trim())) {
          alert("El número celular no es válido. Debe iniciar con 09 y tener 10 dígitos.");
          return;
        }

        var datosGlobal = {
          tipoDoc: autTipoDoc.value,
          correoPersonal: autCorreoPersonal.value.trim(),
          correoInstitucional: autCorreoInstitucional.value.trim(),
          celular: autCelular.value.trim()
        };

        if (autTipoDoc.value === "cedula") {
          datosGlobal.cedula = autCedula.value.trim();
          datosGlobal.nombreCompleto = autNombreCompleto.value.trim();
        } else if (autTipoDoc.value === "pasaporte") {
          datosGlobal.pasaporte = autPasaporte.value.trim();
          datosGlobal.nombreCompleto = autNombreCompletoPas.value.trim();
        } else if (autTipoDoc.value === "extranjera") {
          datosGlobal.identExtranjera = autExtranjera.value.trim();
          datosGlobal.nombreCompleto = autNombreCompletoExt.value.trim();
        }

        // propagar a todas
        window.epjaInstituciones = window.epjaInstituciones.map(function (it) {
          it.autoridad = datosGlobal;
          return it;
        });
      }

      // marcar paso 2 como completo
      window.EPJA_progress.autoridad = true;
      // aquí ya podrías pasar a la vista 3
      window.EPJA_setActiveView("view-op3");
    });
  }

  // si por alguna razón ya está visible al cargar
  if (viewAutoridad && !viewAutoridad.classList.contains("is-hidden")) {
    renderTablaAutoridad();
  }
});

// =====================================================
// DEBUG EPJA — forzar que se vea "Autoridad Educativa"
// Pegar AL FINAL del archivo JS
// =====================================================
(function () {
  console.log("[EPJA][DEBUG] parche de autoridad cargó.");

  // función de respaldo por si la vista 2 existe pero no pintaba
  function renderAutoridadFallback() {
    // 1. asegurar array
    var lista = Array.isArray(window.epjaInstituciones)
      ? window.epjaInstituciones
      : [];

    // 2. intentar conseguir la tabla
    var tbl = document.getElementById("tblAutoridadInstituciones");
    var tbody = tbl ? tbl.querySelector("tbody") : null;

    // 2.a. si NO hay tabla, al menos mostramos algo en la vista
    if (!tbl || !tbody) {
      var cont = document.getElementById("view-op2");
      if (cont) {
        cont.classList.remove("is-hidden");
        cont.classList.add("is-active");
        cont.style.display = "block";

        // crear bloque mínimo solo una vez
        if (!cont.querySelector(".epja-debug-autoridad")) {
          var box = document.createElement("div");
          box.className = "epja-debug-autoridad";
          box.style.padding = "1.5rem";
          box.style.background = "#fff";
          box.style.borderRadius = "12px";
          box.style.boxShadow = "0 6px 20px rgba(15,23,42,.08)";
          if (!lista.length) {
            box.textContent = "No existen instituciones registradas en el paso anterior.";
          } else {
            box.innerHTML = "<h3 style='margin:0 0 .75rem'>Instituciones detectadas</h3>";
            var ul = document.createElement("ul");
            lista.forEach(function (it, idx) {
              var li = document.createElement("li");
              li.textContent = (idx + 1) + ". " + (it.nombre || "Sin nombre") + " (" + (it.tipo || "—") + ")";
              ul.appendChild(li);
            });
            box.appendChild(ul);
          }
          cont.appendChild(box);
        }
      }
      console.warn("[EPJA][DEBUG] no encontré la tabla de autoridad, usé fallback.");
      return;
    }

    // 3. sí hay tabla → pintar normal
    tbody.innerHTML = "";
    if (!lista.length) {
      var trEmpty = document.createElement("tr");
      var tdEmpty = document.createElement("td");
      tdEmpty.colSpan = 4;
      tdEmpty.textContent = "No existen instituciones registradas en el paso anterior.";
      tdEmpty.style.textAlign = "center";
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      console.log("[EPJA][DEBUG] tabla sin datos, puse mensaje.");
      return;
    }

    lista.forEach(function (it, idx) {
      var tr = document.createElement("tr");

      var td1 = document.createElement("td");
      td1.textContent = idx + 1;

      var td2 = document.createElement("td");
      td2.textContent = it.nombre || "Sin nombre";

      var td3 = document.createElement("td");
      td3.textContent = it.tipo || "—";

      var td4 = document.createElement("td");
      td4.textContent = "—";

      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      tbody.appendChild(tr);
    });

    console.log("[EPJA][DEBUG] tabla de autoridad renderizada con", lista.length, "filas.");
  }

  // exponerla GLOBAL SOLO si no hay otra
  if (typeof window.EPJA_renderAutoridad !== "function") {
    window.EPJA_renderAutoridad = renderAutoridadFallback;
  }

  // 1) enganchar menú
  var btns = document.querySelectorAll(".epja-nav-btn");
  btns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var viewId = btn.getAttribute("data-view");
      if (viewId === "view-op2") {
        console.log("[EPJA][DEBUG] usuario entró a Autoridad.");
        // mostrar vista y pintar
        var v2 = document.getElementById("view-op2");
        if (v2) {
          v2.classList.remove("is-hidden");
          v2.classList.add("is-active");
          v2.style.display = "block";
        }
        window.EPJA_renderAutoridad();
      }
    });
  });

  // 2) re-logear instituciones un poco después de la carga
  //    (para ver si el worker ya trajo datos)
  setTimeout(function () {
    console.log("[EPJA][DEBUG] instituciones en memoria (t+1500):", window.epjaInstituciones);
  }, 1500);
})();

  // 🔧 Parche para que la vista de Autoridad NO quede oculta por style inline
(function () {
  function showAutoridad() {
    var v2 = document.getElementById("view-op2");
    if (v2) {
      v2.style.removeProperty("display"); // quita display:none;
      v2.classList.remove("is-hidden");
      v2.classList.add("is-active");
    }
  }

  // 1) cuando usemos nuestro cambio de vista global
  var _oldSetView = window.EPJA_setActiveView;
  window.EPJA_setActiveView = function (viewId) {
    _oldSetView(viewId);
    if (viewId === "view-op2") {
      showAutoridad();
      // y de paso renderizamos
      if (typeof window.EPJA_renderAutoridad === "function") {
        window.EPJA_renderAutoridad();
      }
    }
  };

  // 2) por si ya estaba abierta al cargar
  document.addEventListener("DOMContentLoaded", function () {
    var v2 = document.getElementById("view-op2");
    if (v2 && v2.classList.contains("is-active")) {
      showAutoridad();
    }
  });
})();

// 🔧 Parche específico para la tabla
(function () {
  var tbl = document.getElementById("tblAutoridadInstituciones");
  if (tbl) {
    tbl.style.removeProperty("display");
  }
})();

