/* VIEWMODEL: expone estado + comandos. Las Views solo leen de aqui y le delegan las acciones;
   nunca tocan los Models ni los Services directamente. */
class AppViewModel {
  constructor(progress, codes, compiler) {
    this.progress = progress; this.codes = codes; this.compiler = compiler;
    this.bus = new EventBus();
    this.current = null; this.busy = false; this.fails = 0; this.sess = null;
    if (compiler.onStatus) compiler.onStatus(st => this.bus.emit("compiler", st));
  }
  // ---- suscripciones ----
  onNavigate(fn) { this.bus.on("navigate", fn); }
  onCodeReset(fn) { this.bus.on("codeReset", fn); }
  onBusy(fn) { this.bus.on("busy", fn); }
  onRunResult(fn) { this.bus.on("runResult", fn); }
  onValidation(fn) { this.bus.on("validation", fn); }
  onStats(fn) { this.bus.on("stats", fn); }
  onHint(fn) { this.bus.on("hint", fn); }
  onSession(fn) { this.bus.on("session", fn); }
  onCompiler(fn) { this.bus.on("compiler", fn); }
  onPrecompile(fn) { this.bus.on("precompile", fn); }
  warmup() { return this.compiler.warmup(); }

  // ---- lecturas (bindings) ----
  pathData() {
    const next = this.progress.nextPending();
    return PARTS.map(part => {
      const items = ExerciseModel.byPart(part.id).map(ex => ({
        ex, solved: this.progress.isSolved(ex.id), unlocked: this.progress.isUnlocked(ex.id), current: ex.id === next,
      }));
      return { part, items, done: items.filter(i => i.solved).length };
    });
  }
  stats() {
    return { xp: this.progress.xp, streak: this.progress.streak, solved: this.progress.solved.length,
             total: ExerciseModel.total(), free: this.progress.free };
  }

  hintsShown() { return this.current ? this.progress.hintsUsed(this.current.id) : 0; }

  // ---- comandos ----
  /** Revela la siguiente pista (idea -> plan -> detalle). Nunca entrega la solucion completa. */
  askHint() {
    if (!this.current) return;
    const n = this.progress.addHint(this.current.id, this.current.hints.length);
    this.bus.emit("hint", { exercise: this.current, shown: n });
  }
  openExercise(id) {
    const ex = ExerciseModel.byId(id);
    if (!ex || !this.progress.isUnlocked(id)) return;
    this.current = ex; this.fails = 0; this.sess = null;
    this.bus.emit("navigate", { view: "exercise", exercise: ex, code: this.codes.load(ex), solved: this.progress.isSolved(id),
                                hasNext: !!ExerciseModel.byId(id + 1), hints: this.progress.hintsUsed(id) });
  }
  openNext() { if (this.current) this.openExercise(this.current.id + 1); }
  backToMap() { this.current = null; this.bus.emit("navigate", { view: "map" }); this.bus.emit("stats", this.stats()); }
  resetCode() { if (this.current) this.bus.emit("codeReset", { code: this.codes.reset(this.current) }); }
  saveDraft(code) { if (this.current) this.codes.save(this.current, code); }
  setFree(v) { this.progress.setFree(v); this.bus.emit("stats", this.stats()); this.bus.emit("navigate", { view: "map" }); }
  resetProgress() { this.progress.reset(); this.bus.emit("stats", this.stats()); this.bus.emit("navigate", { view: "map" }); }

  async _exec(code, stdin, keepConsole) {
    this.bus.emit("busy", { busy: true, msg: "Compilando y ejecutando en el servidor…", keepConsole: !!keepConsole });
    try { return await this.compiler.run(code, stdin); }
    finally { this.bus.emit("busy", { busy: false, keepConsole: !!keepConsole }); }
  }
  /* ---- consola interactiva: el alumno teclea los datos directamente en la consola ---- */
  /** Inicia una ejecucion nueva; el programa se detiene en cada cin hasta que el alumno escribe una linea. */
  async startRun(code, presetLines) {
    if (!this.current || this.busy) return;
    this.saveDraft(code);
    this.sess = { code, seed: 1000 + Math.floor(Math.random() * 9000), lines: presetLines ? presetLines.slice() : [] };
    await this._session();
  }
  /** Entrega al programa lo que el alumno escribio en la consola (una linea). */
  async sendLine(text) {
    if (!this.sess || this.busy) return;
    this.sess.lines.push(text);
    await this._session();
  }
  async _session() {
    const s = this.sess; this.busy = true;
    try {
      if (!s.h) {                                         // se compila UNA vez por ejecucion (y casi nunca: ya se compila mientras escribes)…
        this.bus.emit("busy", { busy: true, msg: "Compilando…", keepConsole: true });
        s.b = TerminalService.build(s.code);
        s.h = await this.compiler.compile(s.b.src);
        if (!s.h.ok) { const h = s.h; s.h = null; this.bus.emit("session", { res: { compileOk: false, compileError: TerminalService.shiftErrors(h.errors, s.b.offset), engine: h.engine, ms: h.ms }, lines: s.lines.slice() }); return; }
      }
      this.bus.emit("busy", { busy: true, msg: "Ejecutando…", keepConsole: true });
      const r = await this.compiler.execute(s.h, TerminalService.stdin(s.b.instr, s.seed, s.lines));   // …y se ejecuta las veces que haga falta (ms)
      if (r.compileOk === false) {                          // respaldo remoto: el error de compilacion llega al ejecutar
        s.h = null; this.bus.emit("session", { res: { compileOk: false, compileError: TerminalService.shiftErrors(r.compileError, s.b.offset), engine: r.engine, ms: r.ms }, lines: s.lines.slice() }); return;
      }
      if (r.compileOk === false) {                         // (respaldo remoto: compila y ejecuta juntos)
        this.bus.emit("session", { res: { compileOk: false, compileError: TerminalService.shiftErrors(r.compileError, s.b.offset), engine: r.engine, ms: r.ms }, lines: s.lines.slice() }); s.h = null; return;
      }
      this.bus.emit("session", { res: { compileOk: true, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, engine: s.h.engine,
        compileMs: s.h.cached ? 0 : s.h.ms, runMs: r.runMs, ms: r.runMs }, lines: s.lines.slice() });
    } catch (e) { this.bus.emit("runResult", { error: e.message }); }
    finally { this.busy = false; this.bus.emit("busy", { busy: false, keepConsole: true }); }
  }

  /** Compila en segundo plano cuando el alumno deja de escribir: al pulsar Ejecutar/Validar el programa ya esta listo. */
  async precompile(code) {
    if (!this.current || this.busy) return;
    this.bus.emit("precompile", { state: "compiling", code });
    try {
      const h = await this.compiler.compile(TerminalService.build(code).src);
      this.bus.emit("precompile", { state: h.ok ? "ok" : "errors", code, ms: h.ms, cached: !!h.cached });
    } catch (e) { this.bus.emit("precompile", { state: "idle", code }); }
  }

  /** Compila y compara contra la solucion de referencia usando la entrada de prueba oficial. */
  async validate(code) {
    if (!this.current || this.busy) return;
    const ex = this.current; this.saveDraft(code); this.busy = true;
    try {
      const bd = TerminalService.build(code), lines = ex.stdin.split("\n").filter(l => l !== "");
      const res = await this._exec(bd.src, TerminalService.stdin(bd.instr, 42, lines));
      const wantsMore = res.compileOk && (res.stdout || "").includes(TerminalService.MARK_WAIT);
      if (res.compileOk) res.stdout = (res.stdout || "").replace(/[\x1e\x1f]/g, ""); else res.compileError = TerminalService.shiftErrors(res.compileError, bd.offset);
      const verdict = wantsMore ? { ok: false, kind: "input", message: "Tu programa pide más datos de los que tiene la entrada de prueba. Revisa el orden y la cantidad de valores que lees con cin (mira «Entrada» en el enunciado)." } : ValidationService.check(ex, res);
      let nuevo = false;
      if (verdict.ok) { nuevo = this.progress.markSolved(ex.id); this.fails = 0; } else this.fails++;
      this.bus.emit("runResult", { res });
      this.bus.emit("validation", { verdict, fails: this.fails, newlySolved: nuevo, hasNext: !!ExerciseModel.byId(ex.id + 1) });
      this.bus.emit("stats", this.stats());
    } catch (e) { this.bus.emit("runResult", { error: e.message }); }
    finally { this.busy = false; }
  }
}
