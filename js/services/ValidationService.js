/* SERVICIO: decide si la salida del programa del alumno es correcta.
   Estrategia: se compila y ejecuta el codigo con la entrada de prueba (stdin) oficial y se
   comparan los VALORES calculados (numeros, en orden) contra los de la solucion de referencia.
   Asi no importa el texto de los mensajes (prompts). Los programas con rand() se ejecutan con
   srand(42) para que alumno y referencia generen la misma secuencia. */
class ValidationService {
  static prepare(code) {
    if (/\bsrand\s*\(/.test(code)) return code.replace(/srand\s*\(([^;]*)\)\s*;/g, "srand(42);");
    if (/\brand\s*\(/.test(code)) return code.replace(/(main\s*\([^)]*\)\s*\{)/, "$1 srand(42);");
    return code;
  }
  static numbers(text) {
    text = text.replace(/0x[0-9a-fA-F]+/g, " ").replace(/(?<=\w)-(?=\d)/g, " - ");
    return (text.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) || []).map(Number);
  }
  static normalize(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  static close(a, b) { return Math.abs(a - b) <= 1e-3 * Math.max(1, Math.abs(a)); }

  static check(ex, res) {
    if (!res.compileOk) return { ok: false, kind: "compile", message: "Tu programa todavía no compila. Corrige los errores marcados en naranja; a la derecha tienes la explicación de cada uno." };
    const rt = (typeof ErrorService !== "undefined") ? ErrorService.runtime(res) : null;
    if (rt) return { ok: false, kind: "runtime", message: rt };
    const out = res.stdout || "";
    const norm = this.normalize(out);

    for (const w of ex.must || [])
      if (!norm.includes(w)) return { ok: false, kind: "text", message: 'Tu salida debería indicar «' + w + '».' };
    for (const w of ex.mustNot || [])
      if (norm.includes(w)) return { ok: false, kind: "text", message: 'Tu salida contiene «' + w + '», que no corresponde para la entrada de prueba.' };

    if (ex.shape && ex.shape.length) {
      const lines = out.split("\n").map(l => l.replace(/\s+/g, ""));
      let k = 0;
      for (const l of lines) if (k < ex.shape.length && (l === ex.shape[k] || (k === 0 && l.endsWith(ex.shape[k])))) k++;
      if (k < ex.shape.length) return { ok: false, kind: "shape", message: "La figura no coincide: falló en la fila " + (k + 1) + " de " + ex.shape.length + " (se esperaba una fila de " + ex.shape[k].length + " asteriscos)." };
    }

    const got = this.numbers(out);
    // 1) mismos valores y en el mismo orden
    let j = 0, found = 0, miss = null;
    for (const e of ex.expected) {
      while (j < got.length && !this.close(e, got[j])) j++;
      if (j >= got.length) { miss = e; break; }
      j++; found++;
    }
    if (miss !== null) {
      // 2) validacion libre: mismos valores aunque salgan en otro orden o con otra estructura
      const pool = got.slice(); let all = true, first = null;
      for (const e of ex.expected) {
        const k = pool.findIndex(g => this.close(e, g));
        if (k < 0) { all = false; first = e; break; }
        pool.splice(k, 1);
      }
      if (all) return { ok: true, kind: "ok", unordered: true, found: ex.expected.length, total: ex.expected.length,
        message: "¡Correcto! Todos los valores son los esperados (aparecen en otro orden, y eso está bien)." };
      return { ok: false, kind: "values", found, total: ex.expected.length, missing: first, expected: ex.expected, got,
        message: "Tu programa compila y se ejecuta, pero falta el valor " + first + " en lo que imprime. Compara tu salida con los valores esperados." };
    }
    return { ok: true, kind: "ok", found, total: ex.expected.length, message: "¡Correcto!" };
  }
}
if (typeof module !== "undefined") module.exports = ValidationService;
