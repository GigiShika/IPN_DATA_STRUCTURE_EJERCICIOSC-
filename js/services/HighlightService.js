/* SERVICIO: resaltado de sintaxis de C++ (tokenizador ligero, sin dependencias).
   Devuelve HTML con <span class="tk-..."> listo para pintarse sobre el editor. */
class HighlightService {
  static esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  static span(c, s) { return '<span class="tk-' + c + '">' + this.esc(s) + "</span>"; }

  /** HTML resaltado. `ranges` = [[inicio, fin)] de caracteres a subrayar en naranja (errores). */
  static html(code, ranges) {
    ranges = ranges || [];
    const KW = this.KW, TY = this.TY, STD = this.STD, self = this;
    const mark = (start, end) => {                       // texto original [start,end) con subrayado de error
      let res = "", pos = start;
      while (pos < end) {
        const r = ranges.find(x => pos >= x[0] && pos < x[1]);
        if (r) { const e = Math.min(end, r[1]); res += '<span class="tk-err">' + self.esc(code.slice(pos, e)) + "</span>"; pos = e; }
        else {
          const nx = ranges.map(x => x[0]).filter(x => x > pos && x < end).sort((a, b) => a - b)[0];
          const e = nx === undefined ? end : nx; res += self.esc(code.slice(pos, e)); pos = e;
        }
      }
      return res;
    };
    const sp = (c, st, en) => '<span class="tk-' + c + '">' + mark(st, en) + "</span>";
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(^[ \t]*#[ \t]*\w+[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFuUlL]*\b)|([A-Za-z_]\w*)/gm;
    let out = "", last = 0, m;
    while ((m = re.exec(code)) !== null) {
      const st = m.index, en = re.lastIndex;
      out += mark(last, st); last = en;
      if (m[1] !== undefined) out += sp("com", st, en);
      else if (m[2] !== undefined) {
        const hit = ranges.some(x => x[0] < en && x[1] > st);
        const p = m[2].match(/^([ \t]*#[ \t]*\w+)([\s\S]*)$/);
        const inc = p[2].match(/^(\s*)(<[^>\n]*>|"[^"\n]*")([\s\S]*)$/);
        if (hit || !inc) out += sp("pp", st, en);
        else out += this.span("pp", p[1]) + this.esc(inc[1]) + this.span("str", inc[2]) + this.esc(inc[3]);
      }
      else if (m[3] !== undefined) out += sp("str", st, en);
      else if (m[4] !== undefined) out += sp("num", st, en);
      else {
        const w = m[5], call = /^\s*\(/.test(code.slice(en, en + 40));
        if (KW.has(w)) out += sp("kw", st, en);
        else if (TY.has(w)) out += sp("ty", st, en);
        else if (STD.has(w)) out += sp("std", st, en);
        else if (call) out += sp("fn", st, en);
        else out += mark(st, en);
      }
    }
    out += mark(last, code.length);
    return out + "\n ";          // línea extra para que la altura coincida con la del textarea
  }

  /** Convierte {line, col} de los errores del compilador en rangos de caracteres a subrayar. */
  static rangesFor(code, errs) {
    const starts = [0];
    for (let i = 0; i < code.length; i++) if (code[i] === "\n") starts.push(i + 1);
    const isW = c => /\w/.test(c || ""), out = [];
    for (const e of errs) {
      if (!e.line || e.line > starts.length) continue;
      const ls = starts[e.line - 1], le = starts[e.line] !== undefined ? starts[e.line] - 1 : code.length;
      const off = Math.min(ls + Math.max((e.col || 1) - 1, 0), le);
      let s, t;
      if (off < le && isW(code[off])) { s = off; t = off; while (s > ls && isW(code[s - 1])) s--; while (t < le && isW(code[t])) t++; }
      else if (off < le && !/\s/.test(code[off])) { s = off; t = off + 1; }
      else {                                            // fin de linea o espacio: subraya lo ultimo escrito
        let p = off - 1; while (p >= 0 && /\s/.test(code[p])) p--;
        if (p < 0) continue;
        t = p + 1; s = p; if (isW(code[p])) while (s > 0 && isW(code[s - 1])) s--;
      }
      out.push([s, t]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }
}
HighlightService.KW = new Set("if else for while do switch case default break continue return goto new delete sizeof struct class public private protected const static using namespace typedef enum template typename nullptr true false this operator try catch throw auto".split(" "));
HighlightService.TY = new Set("int float double char bool void long short unsigned signed string size_t".split(" "));
HighlightService.STD = new Set("cout cin cerr endl std setw setprecision fixed vector map set pair min max swap sqrt pow abs fabs sin cos rand srand time NULL".split(" "));
if (typeof module !== "undefined") module.exports = HighlightService;
