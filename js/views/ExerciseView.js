/* VIEW: pantalla de un ejercicio (enunciado, editor, consola, validacion). Solo DOM. */
class ExerciseView {
  constructor(vm) {
    this.vm = vm; this.$ = id => document.getElementById(id); this.errors = [];
    vm.onNavigate(p => { if (p.view === "exercise") this.open(p); else this.hide(); });
    vm.onCodeReset(p => { this.$("editor").value = p.code; this.clearErrors(); this.paint(); });
    vm.onBusy(p => this.setBusy(p));
    vm.onRunResult(p => this.showRun(p));
    vm.onValidation(p => this.showVerdict(p));
    vm.onHint(p => this.renderHints(p.exercise, p.shown));
    vm.onSession(p => this.showSession(p));
    vm.onPrecompile(p => this.showPrecompile(p));

    this.$("backBtn").onclick = () => vm.backToMap();
    this.$("resetBtn").onclick = () => { if (confirm("¿Volver al código inicial?")) vm.resetCode(); };
    this.$("runBtn").onclick = () => { this.setConsole("console", "⏳ Compilando y ejecutando…"); vm.startRun(this.$("editor").value); };
    this.$("validateBtn").onclick = () => vm.validate(this.$("editor").value);
    this.$("nextBtn").onclick = () => vm.openNext();
    this.$("hintBtn").onclick = () => vm.askHint();
    this.$("sampleBtn").onclick = () => this.$("samplePane").classList.toggle("hidden");
    const ed = this.$("editor");
    this.guardPaste(ed);
    ed.addEventListener("input", e => {
      if (!this.accept(ed, e)) return;                  // inserción sospechosa: se revierte
      vm.saveDraft(ed.value); this.clearErrors(); this.paint();
      this.setCompState("idle"); clearTimeout(this._idle); this._idle = setTimeout(() => vm.precompile(ed.value), 900);   // compila mientras escribes
    });
    ed.addEventListener("scroll", () => this.syncScroll());
    ed.addEventListener("keydown", e => {
      if (e.key === "Tab") { e.preventDefault(); ed.setRangeText("    ", ed.selectionStart, ed.selectionEnd, "end"); vm.saveDraft(ed.value); this.clearErrors(); this.paint(); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); vm.validate(ed.value); }
    });
  }
  hide() { this.$("exView").classList.add("hidden"); }

  /* ---------- anti pegado: el codigo debe escribirse en el editor ---------- */
  static MAX_BURST = 30;           // caracteres que pueden entrar de golpe (autocompletado, sangrías…)
  toast(msg) {
    const t = this.$("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.add("hidden"), 3500);
  }
  guardPaste(ed) {
    this.internalClip = ""; this.allowPaste = false; this.lastValue = ed.value; this.sel = [0, 0];
    const trackSel = () => { this.sel = [ed.selectionStart, ed.selectionEnd]; };
    ["keydown", "keyup", "mouseup", "select", "focus"].forEach(ev => ed.addEventListener(ev, trackSel));
    const remember = () => { this.internalClip = ed.value.slice(ed.selectionStart, ed.selectionEnd); };
    ed.addEventListener("copy", remember); ed.addEventListener("cut", remember);   // lo copiado AQUÍ se puede volver a pegar
    ed.addEventListener("paste", e => {
      const txt = (e.clipboardData && e.clipboardData.getData("text")) || "";
      if (txt && txt === this.internalClip) { this.allowPaste = true; return; }
      e.preventDefault(); this.toast("📋 Pegar texto de otro lugar está desactivado: escribe tu solución aquí.");
    });
    ed.addEventListener("drop", e => { e.preventDefault(); this.toast("📋 No se puede arrastrar texto al editor: escribe tu solución aquí."); });
    ed.addEventListener("beforeinput", e => {            // menú contextual, atajos del sistema, dictado, etc.
      if (/^insertFrom(Paste|Drop|Yank)|^insertReplacementText$/.test(e.inputType || "") && !this.allowPaste) {
        e.preventDefault(); this.toast("📋 Pegar texto de otro lugar está desactivado: escribe tu solución aquí.");
      }
    });
  }
  /** Devuelve false (y revierte) si en un solo evento entró demasiado texto: típico de un pegado. */
  accept(ed, e) {
    const added = ed.value.length - (this.lastValue || "").length, ok = this.allowPaste;
    this.allowPaste = false;
    if (!ok && e && e.inputType !== "insertCompositionText" && !/^history/.test(e.inputType || "") && added > ExerciseView.MAX_BURST) {   // Ctrl+Z / Ctrl+Y sí se permiten
      ed.value = this.lastValue; ed.setSelectionRange(this.sel[0], this.sel[1]);
      this.toast("📋 Se bloqueó una inserción grande de texto. Escribe tu solución aquí."); return false;
    }
    return true;
  }

  /* ---------- editor: numeros de linea + colores + subrayado naranja ---------- */
  paint() {
    const ed = this.$("editor"), code = ed.value, n = code.split("\n").length;
    const bad = new Set(this.errors.map(e => e.line).filter(Boolean));
    let g = ""; for (let i = 1; i <= n; i++) g += (bad.has(i) ? '<span class="gerr">' + i + "</span>" : i) + (i < n ? "\n" : "");
    this.$("gutter").innerHTML = g;
    this.$("hl").innerHTML = HighlightService.html(code, HighlightService.rangesFor(code, this.errors));
    this.lastValue = code;
    this.syncScroll();
  }
  syncScroll() {
    const ed = this.$("editor");
    this.$("gutter").scrollTop = ed.scrollTop;
    this.$("hl").scrollTop = ed.scrollTop; this.$("hl").scrollLeft = ed.scrollLeft;
  }
  clearErrors() { if (this.errors.length) { this.errors = []; this.$("errStrip").classList.add("hidden"); } }
  jumpTo(line) {
    const ed = this.$("editor"), L = ed.value.split("\n");
    if (!line || line > L.length) return;
    let s = 0; for (let i = 0; i < line - 1; i++) s += L[i].length + 1;
    ed.focus({ preventScroll: true }); const end = s + L[line - 1].length; ed.setSelectionRange(end, end);
    ed.scrollTop = Math.max(0, (line - 4) * 22); this.syncScroll();
  }

  open({ exercise: ex, code, solved, hasNext, hints }) {
    this.$("mapView").classList.add("hidden"); this.$("exView").classList.remove("hidden"); window.scrollTo(0, 0);
    const part = ExerciseModel.partOf(ex);
    this.$("exPartChip").textContent = part.short + " · " + LEVELS[ex.level];
    this.$("exPartChip").style.background = part.color;
    this.$("exStars").textContent = "★".repeat(ex.stars) + "☆".repeat(5 - ex.stars);
    const m = MODES[ex.mode]; const mc = this.$("exModeChip"); mc.textContent = "[" + ex.mode + "] " + m.label; mc.className = "chip " + m.cls;
    this.$("exTitle").textContent = ex.id + ". " + ex.title;
    this.$("exDesc").textContent = ex.desc;
    this.$("exInput").classList.toggle("hidden", !ex.input);
    this.$("exInputTxt").textContent = ex.input || "";
    this.$("exProgress").style.width = (100 * ex.id / ExerciseModel.total()) + "%";
    this.$("exProgress").style.background = part.color;
    this.errors = []; this.$("errStrip").classList.add("hidden"); this.setCompState("idle");
    this.$("editor").value = code; this.paint();
    this.$("randNote").classList.toggle("hidden", !ex.random);
    this.setConsole("console", "// La salida de tu programa aparecerá aquí");
    this.$("meta").textContent = "";
    this.$("verdict").className = "hidden";
    this.renderHints(ex, hints || 0);
    this.$("samplePane").classList.add("hidden"); this.$("sampleOut").textContent = ex.sample;
    this.$("nextBtn").classList.toggle("hidden", !(solved && hasNext));
    this.$("solvedTag").classList.toggle("hidden", !solved);
  }
  setBusy({ busy, msg, keepConsole }) {
    ["runBtn", "validateBtn"].forEach(id => this.$(id).disabled = busy);
    const ti = document.getElementById("termIn"); if (ti) ti.disabled = busy;
    if (keepConsole) { this.$("meta").textContent = busy ? "⏳ ejecutando…" : this.$("meta").textContent; return; }
    if (busy) { this.setConsole("console", "⏳ " + msg); this.$("verdict").className = "hidden"; }
  }
  setConsole(cls, content) {
    const box = this.$("consoleBox"); box.className = cls; box.innerHTML = "";
    if (typeof content === "string") box.textContent = content; else box.appendChild(content);
  }
  /* ---------- pistas progresivas (sin solucion) ---------- */
  static HINT_LABELS = ["Idea", "Plan", "Detalle"];
  rich(el, text) {                        // `codigo` entre acentos graves -> <code>
    text.split(/`([^`]+)`/).forEach((part, i) => { if (!part) return; if (i % 2) el.appendChild(this.el("code", "", part)); else el.appendChild(document.createTextNode(part)); });
  }
  renderHints(ex, shown) {
    const box = this.$("hintList"), total = ex.hints.length; box.innerHTML = "";
    for (let i = 0; i < shown; i++) {
      const card = this.el("div", "hint");
      card.appendChild(this.el("div", "hint-n", "Pista " + (i + 1) + " · " + ExerciseView.HINT_LABELS[i]));
      const t = this.el("div", "hint-t"); this.rich(t, ex.hints[i]); card.appendChild(t); box.appendChild(card);
    }
    const btn = this.$("hintBtn"), done = shown >= total;
    btn.disabled = done;
    btn.textContent = done ? "✔ Ya viste todas las pistas" : (shown === 0 ? "💡 Pedir una pista" : "💡 Otra pista") + " (" + shown + "/" + total + ")";
  }

  /* ---------- resultados ---------- */
  el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  setCompState(st, ms) {
    const el = this.$("compState"); if (!el) return;
    el.className = "compstate " + st;
    el.textContent = { idle: "", compiling: "⏳ compilando…", ok: "⚡ listo: se ejecuta al instante", errors: "🧡 tiene errores: pulsa Ejecutar para verlos" }[st] || "";
  }
  showPrecompile({ state, code }) { if (code === this.$("editor").value) this.setCompState(state); }

  /* ---------- consola interactiva ---------- */
  showSession({ res, lines }) {
    this.$("meta").textContent = res.engine + (res.compileMs ? " · compiló en " + (res.compileMs / 1000).toFixed(1) + " s" : "") + (res.runMs != null ? " · ejecutó en " + res.runMs + " ms" : "");
    if (!res.compileOk) return this.showCompileErrors(res);
    this.clearErrors(); this.paint();
    const { segs, waiting } = TerminalService.compose(res.stdout, lines);
    const term = this.el("div", "term");
    segs.forEach(sg => term.appendChild(this.el("span", sg.k === "in" ? "tin" : "tout", sg.t)));
    if (waiting) {
      const inp = this.el("input", "term-in"); inp.id = "termIn"; inp.type = "text"; inp.autocomplete = "off"; inp.spellcheck = false;
      inp.setAttribute("aria-label", "Entrada del programa");
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const v = inp.value; inp.disabled = true; this.vm.sendLine(v); } });
      term.appendChild(inp);
      term.appendChild(this.el("div", "term-hint", "↳ El programa espera un dato: escríbelo aquí y pulsa Enter (puedes poner varios separados por espacios)."));
    } else {
      const rt = ErrorService.runtime(res);
      term.appendChild(this.el("div", "term-end", "— Programa finalizado" + (res.exitCode ? " (código " + res.exitCode + ")" : "") + " —"));
      if (rt) { const b = this.el("div", "rt"); b.appendChild(this.el("b", "", "🧡 Error al ejecutar. ")); b.appendChild(document.createTextNode(rt)); term.appendChild(b); }
    }
    this.setConsole("console", term);
    const box = this.$("consoleBox"); box.scrollTop = box.scrollHeight;
    const ti = document.getElementById("termIn"); if (ti) ti.focus({ preventScroll: true });
  }

  showRun({ res, error }) {
    if (error) { this.setConsole("console err", this.el("div", "rt", "⚠️ " + error)); return; }
    this.$("meta").textContent = res.engine + (res.ms ? " · " + res.ms + " ms" : "");
    if (!res.compileOk) return this.showCompileErrors(res);
    this.clearErrors(); this.paint();
    const wrap = document.createElement("div");
    wrap.appendChild(this.el("pre", "out", res.stdout || "(el programa no imprimió nada)"));
    const rt = ErrorService.runtime(res);
    if (res.stderr && !rt) wrap.appendChild(this.el("pre", "out dim", "[stderr]\n" + res.stderr));
    if (rt) { const b = this.el("div", "rt"); b.appendChild(this.el("b", "", "🧡 Error al ejecutar. ")); b.appendChild(document.createTextNode(rt)); wrap.appendChild(b); }
    this.setConsole("console", wrap);
  }
  showCompileErrors(res) {
    this.errors = ErrorService.parse(res.compileError);
    this.paint();
    const wrap = document.createElement("div");
    wrap.appendChild(this.el("div", "err-head", "🧡 Tu programa no compila · " + this.errors.length + (this.errors.length === 1 ? " error" : " errores")));
    this.errors.forEach(e => {
      const card = this.el("div", "errcard" + (e.line ? " click" : ""));
      card.appendChild(this.el("div", "errline", e.line ? "Línea " + e.line : "General"));
      const body = this.el("div", "errbody");
      body.appendChild(this.el("div", "errtitle", e.title));
      body.appendChild(this.el("div", "errtip", e.tip));
      const det = this.el("details", "errdet"); det.appendChild(this.el("summary", "", "mensaje original del compilador"));
      det.appendChild(this.el("code", "", e.original)); det.addEventListener("click", ev => ev.stopPropagation());
      body.appendChild(det); card.appendChild(body);
      if (e.line) card.onclick = () => this.jumpTo(e.line);
      wrap.appendChild(card);
    });
    this.setConsole("console err", wrap);
    const first = this.errors.find(e => e.line) || this.errors[0], strip = this.$("errStrip");
    strip.innerHTML = ""; strip.classList.remove("hidden");
    strip.appendChild(this.el("b", "", "🧡 " + (first.line ? "Línea " + first.line + ": " : "") + first.title + " "));
    strip.appendChild(document.createTextNode(first.tip));
    strip.onclick = () => this.jumpTo(first.line);
    if (first.line) this.jumpTo(first.line);
  }

  showVerdict({ verdict, fails, newlySolved, hasNext }) {
    const v = this.$("verdict");
    if (verdict.ok) {
      v.className = "verdict ok";
      v.innerHTML = `<div class="font-extrabold text-lg">✅ ¡Correcto!${newlySolved ? " +" + 10 * this.vm.current.stars + " XP" : ""}</div>
        <div class="text-sm">${verdict.kind === "manual" ? verdict.message : (verdict.message || "Tu programa produjo los valores esperados con la entrada de prueba.")}</div>`;
      this.$("solvedTag").classList.remove("hidden");
      this.$("nextBtn").classList.toggle("hidden", !hasNext);
      v.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    v.className = "verdict bad";
    let detail = "";
    if (verdict.kind === "values")
      detail = `<div class="text-xs mt-2">Con la entrada de prueba tu programa debe mostrar estos valores: <span class="mono break-words">${verdict.expected.slice(0, 40).join(", ")}${verdict.expected.length > 40 ? "…" : ""}</span>.
        Con esta entrada de prueba (un dato por línea): <span class="mono">${(this.vm.current.stdin || "—").trim().split("\n").join(" ⏎ ")}</span>.
        Puedes usar las variables y el método que quieras; lo que cuenta es el resultado. Revisa el orden en que lees los datos (mira «Entrada» en el enunciado).</div>`;
    v.innerHTML = `<div class="font-extrabold text-lg">${verdict.kind === "compile" ? "🧡 No compila" : "❌ Todavía no"}</div><div class="text-sm">${verdict.message}</div>${detail}`;
  }
}
