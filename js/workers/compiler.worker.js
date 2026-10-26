/* WORKER: Clang (LLVM) compilado a WebAssembly. Compila el C++ del alumno DENTRO del navegador (sin servidor).
   Se compila una sola vez y el programa compilado se puede ejecutar muchas veces en milisegundos
   (así la consola interactiva responde al instante cada vez que se teclea un dato). */
importScripts("../vendor/clang-wasm-toolchain.global.js");
const T = self.clangWasmToolchain;
let tc = null, initP = null, seq = 0;
const artifacts = new Map();            // handle -> artefacto compilado (los ultimos 6)
const reply = (id, data) => postMessage(Object.assign({ id }, data));

function makeStdin(text) {              // se entrega todo de una vez; luego EOF
  let sent = false;
  return () => { if (!text || sent) return null; sent = true; return text; };
}

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      initP = initP || T.createToolchain({ baseUrl: m.baseUrl, onProgress: v => postMessage({ progress: v }) });
      tc = await initP; reply(m.id, { ok: true });
    } else if (m.type === "compile") {
      tc = tc || await initP;
      const t0 = performance.now();
      const out = await tc.lock(() => tc.captureCompilerOutput(() =>
        tc.runtime.compileArtifact(m.code, { language: "CPP", fileName: "main.cpp",
          compileArgs: [...(T.CLANG_DRIVER_DEFAULT_ARGS || []), "-std=gnu++17", "-O0", "-w", ...(m.args || [])] })));
      const ms = Math.round(performance.now() - t0);
      if (out.error) {
        const errs = T.compilerDiagnostics(out.raw); if (!errs.length) errs.push(String(out.error.message || out.error));
        reply(m.id, { ok: true, compiled: false, errors: errs.join("\n"), ms });
      } else {
        const h = ++seq; artifacts.set(h, out.result);
        if (artifacts.size > 12) artifacts.delete(artifacts.keys().next().value);
        reply(m.id, { ok: true, compiled: true, handle: h, ms });
      }
    } else if (m.type === "run") {
      const art = artifacts.get(m.handle); if (!art) return reply(m.id, { ok: false, error: "artefacto no disponible" });
      let stdout = "", stderr = "", exitCode = 0; const t0 = performance.now();
      try {
        const r = await tc.execute(art, { args: [], stdin: makeStdin(m.stdin),
          stdout: c => { stdout += typeof c === "string" ? c : new TextDecoder().decode(c); },
          stderr: c => { stderr += typeof c === "string" ? c : new TextDecoder().decode(c); } });
        exitCode = r && r.exitCode != null ? r.exitCode : 0;
      } catch (e) { exitCode = 134; stderr += "\n" + (e && e.message ? e.message : e); }   // trampa / aborto
      reply(m.id, { ok: true, stdout: stdout.replace(/\u001b\[[0-9;]*[A-Za-z]/g, ""), stderr, exitCode, ms: Math.round(performance.now() - t0) });
    }
  } catch (e) { reply(m.id, { ok: false, error: String(e && e.message || e) }); }
};
