/* RESPALDO: compilador remoto (se usa solo si el compilador local no pudo cargarse).
   Intenta primero con Wandbox (GCC) y, si falla la red, con Compiler Explorer (Godbolt).
   Requiere conexion a internet y que la pagina se sirva por http(s). */
class RemoteCompiler {
  constructor() { this._wb = null; this._gb = null; }

  async run(code, stdin) {
    let err1;
    try { return await this._wandbox(code, stdin); } catch (e) { err1 = e; }
    try { return await this._godbolt(code, stdin); }
    catch (e2) { throw new Error("No se pudo contactar al compilador en línea (" + err1.message + " / " + e2.message + "). Revisa tu conexión a internet."); }
  }

  async _fetchJson(url, opts, ms = 30000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, Object.assign({ signal: ctl.signal }, opts));
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  static ver(name) { return (name.match(/\d+/g) || []).map(Number); }
  static cmp(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }

  /* ---------- Wandbox ---------- */
  async _wbCompiler() {
    if (this._wb) return this._wb;
    const list = await this._fetchJson("https://wandbox.org/api/list.json", {}, 15000);
    const g = list.filter(c => c.language === "C++" && /^gcc-\d/.test(c.name)).map(c => c.name)
      .sort((a, b) => RemoteCompiler.cmp(RemoteCompiler.ver(b), RemoteCompiler.ver(a)));
    this._wb = g[0] || "gcc-head";
    return this._wb;
  }
  async _wandbox(code, stdin) {
    const compiler = await this._wbCompiler();
    const t0 = performance.now();
    const j = await this._fetchJson("https://wandbox.org/api/compile.json", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler, code, stdin: stdin || "", "compiler-option-raw": "-std=c++17", save: false }),
    });
    const ran = ("program_message" in j) || ("program_output" in j);
    return {
      compileOk: ran, compileError: ran ? "" : (j.compiler_error || j.compiler_message || "Error de compilación"),
      warnings: ran ? (j.compiler_error || "") : "", stdout: j.program_output || "", stderr: j.program_error || "",
      exitCode: j.status === undefined ? 0 : parseInt(j.status, 10) || 0, signal: j.signal || "", engine: "Wandbox " + compiler,
      ms: Math.round(performance.now() - t0),
    };
  }

  /* ---------- Compiler Explorer ---------- */
  async _gbCompiler() {
    if (this._gb) return this._gb;
    const list = await this._fetchJson("https://godbolt.org/api/compilers/c++?fields=id,name", { headers: { Accept: "application/json" } }, 15000);
    const g = list.filter(c => /^x86-64 gcc \d+(\.\d+)*$/.test(c.name))
      .sort((a, b) => RemoteCompiler.cmp(RemoteCompiler.ver(b.name), RemoteCompiler.ver(a.name)));
    if (!g.length) throw new Error("sin compilador GCC");
    this._gb = g[0]; return this._gb;
  }
  async _godbolt(code, stdin) {
    const c = await this._gbCompiler(); const t0 = performance.now();
    const j = await this._fetchJson("https://godbolt.org/api/compiler/" + c.id + "/compile", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ source: code, options: { userArguments: "-std=c++17", executeParameters: { args: [], stdin: stdin || "" },
        compilerOptions: { executorRequest: true }, filters: { execute: true } } }),
    });
    const txt = a => (a || []).map(x => x.text).join("\n");
    const build = j.buildResult || {};
    const failed = (build.code !== undefined && build.code !== 0) || j.didExecute === false;
    return {
      compileOk: !failed, compileError: failed ? txt(build.stderr) || txt(j.stderr) : "", warnings: "",
      stdout: txt(j.stdout), stderr: txt(j.stderr), exitCode: j.code || 0, engine: c.name, ms: Math.round(performance.now() - t0),
    };
  }
}
