/* SERVICIO: compilador local. Clang compilado a WebAssembly corriendo en un Web Worker, dentro del navegador:
   sin servidor y sin esperar la red. Se compila UNA vez y se puede ejecutar muchas veces en milisegundos. */
class LocalCompiler {
  constructor(baseUrl) {
    this.baseUrl = baseUrl; this.worker = null; this.pending = new Map(); this.n = 0; this.initP = null; this.onProgress = null;
  }
  _send(msg) {
    return new Promise((resolve, reject) => {
      const id = ++this.n; this.pending.set(id, { resolve, reject });
      this.worker.postMessage(Object.assign({ id }, msg));
    });
  }
  /** Carga el compilador (una sola vez). Rechaza si el navegador o los archivos no lo permiten. */
  init() {
    if (this.initP) return this.initP;
    this.initP = (async () => {
      if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") throw new Error("Este navegador no soporta WebAssembly/Workers");
      this.worker = new Worker(new URL("js/workers/compiler.worker.js", document.baseURI));
      this.worker.onmessage = ev => {
        const m = ev.data;
        if (m.progress !== undefined && m.id === undefined) { if (this.onProgress) this.onProgress(m.progress); return; }
        const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id);
        m.ok === false ? p.reject(new Error(m.error)) : p.resolve(m);
      };
      this.worker.onerror = e => { const err = new Error("No se pudo iniciar el compilador local" + (e && e.message ? ": " + e.message : "")); this.pending.forEach(p => p.reject(err)); this.pending.clear(); };
      await this._send({ type: "init", baseUrl: this.baseUrl });
    })().catch(e => { this.initP = null; throw e; });
    return this.initP;
  }
  async compile(code, args) { await this.init(); return this._send({ type: "compile", code, args: args || [] }); }
  async execute(handle, stdin) { return this._send({ type: "run", handle, stdin: stdin || "" }); }
}
