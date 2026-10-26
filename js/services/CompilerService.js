/* SERVICIO (fachada): compilar y ejecutar C++.
   1) LOCAL (principal): Clang en WebAssembly dentro del navegador. Compila ~2 s la primera vez y ejecuta en milisegundos.
   2) REMOTO (respaldo): Wandbox / Compiler Explorer, solo si el compilador local no pudo cargarse. */
class CompilerService {
  constructor(baseUrl) {
    this.local = new LocalCompiler(baseUrl || new URL("assets/clang/", document.baseURI).href);
    this.remote = new RemoteCompiler();
    this.state = "idle";                  // idle | loading | ready | remote
    this.listeners = []; this.cache = new Map();
    this.local.onProgress = v => this._set("loading", v);
  }
  onStatus(fn) { this.listeners.push(fn); }
  _set(state, progress) { this.state = state; this.listeners.forEach(fn => fn({ state, progress })); }

  /** Empieza a cargar el compilador en segundo plano (mientras el alumno lee el problema). */
  warmup() {
    if (this._warm) return this._warm;
    this._set("loading", 0);
    return this._warm = this.local.init()
      .then(() => { this._set("warming"); return this.local.compile("#include <iostream>\nint main(){std::cout<<1;}\n"); })   // calienta el compilador (la 1a compilacion es la mas lenta)
      .then(() => this._set("ready", 1)).catch(e => { console.warn("Compilador local no disponible:", e); this._set("remote"); });
  }
  async _useLocal() { await this.warmup(); try { await this.local.init(); return true; } catch (e) { return false; } }

  /** Compila. Devuelve {ok:true, handle, ms, engine} o {ok:false, errors, engine}. */
  async compile(code) {
    if (await this._useLocal()) {
      const hit = this.cache.get(code); if (hit) return Object.assign({ cached: true }, hit);
      const r = await this.local.compile(code);
      const out = r.compiled ? { ok: true, handle: r.handle, ms: r.ms, engine: "Clang (en tu navegador)", local: true }
                             : { ok: false, errors: r.errors, ms: r.ms, engine: "Clang (en tu navegador)", local: true };
      this.cache.set(code, out); if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);   // tambien se guardan los errores
      return out;
    }
    return { ok: true, remote: true, code, ms: 0, engine: "GCC (servidor remoto)" };
  }
  /** Ejecuta un programa ya compilado con la entrada (stdin) dada. */
  async execute(h, stdin) {
    if (h.local) { const r = await this.local.execute(h.handle, stdin); return { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, runMs: r.ms }; }
    const r = await this.remote.run(h.code, stdin);
    return Object.assign({}, r, { runMs: r.ms });
  }
  /** Compila + ejecuta (forma de resultado compatible con la version anterior). */
  async run(code, stdin) {
    const c = await this.compile(code);
    if (c.remote) { const r = await this.remote.run(code, stdin); return Object.assign({}, r, { compileMs: 0, runMs: r.ms }); }
    if (!c.ok) return { compileOk: false, compileError: c.errors, stdout: "", stderr: "", exitCode: null, engine: c.engine, ms: c.ms, compileMs: c.ms };
    const r = await this.execute(c, stdin);
    return { compileOk: true, compileError: "", stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, signal: "", engine: c.engine,
             ms: c.ms + r.runMs, compileMs: c.cached ? 0 : c.ms, runMs: r.runMs };
  }
}
