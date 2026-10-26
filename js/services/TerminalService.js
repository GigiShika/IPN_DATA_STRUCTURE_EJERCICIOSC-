/* SERVICIO: consola interactiva sobre un compilador NO interactivo (Wandbox / Godbolt).
   Idea: al ejecutar, se inyecta en main() un streambuf que reemplaza a cin. Cada vez que el programa pide
   una linea nueva escribe una marca (\x1e) en la salida -> ahi se "pega" lo que tecleo el alumno, igual que el eco de una
   terminal. Si ya no hay lineas disponibles escribe la marca \x1f y termina: el programa esta ESPERANDO un dato.
   La consola muestra esa salida y deja el cursor ahi; al pulsar Enter se vuelve a ejecutar con una linea mas
   (con la misma semilla de rand() para que todo sea reproducible). */
class TerminalService {
  static MARK_IN = "\x1e";
  static MARK_WAIT = "\x1f";
  // Una sola linea, para no desplazar los numeros de linea de los errores del alumno.
  // La primera linea de stdin es la SEMILLA de rand(): asi el mismo programa compilado sirve para ejecutar, validar y repetir.
  // rand() portable: reproduce exactamente el de glibc (GCC), asi Clang/WebAssembly da los mismos numeros. Una sola linea.
  static RNG = "static unsigned __qr[34];static unsigned __qk;static void __qsrand(unsigned s){if(!s)s=1;__qr[0]=s;for(int i=1;i<31;i++){long long w=(16807LL*(int)__qr[i-1])%2147483647LL;if(w<0)w+=2147483647LL;__qr[i]=(unsigned)w;}for(int i=31;i<34;i++)__qr[i]=__qr[i-31];for(unsigned i=34;i<344;i++)__qr[i%34]=__qr[(i-31)%34]+__qr[(i-3)%34];__qk=344;}static int __qrand(){unsigned v=__qr[__qk%34]=__qr[(__qk+3)%34]+__qr[(__qk+31)%34];__qk++;return (int)(v>>1);}";
  static snippet(usesRand) {
    return "struct __Q:std::streambuf{std::streambuf*o;std::string b;__Q():o(std::cin.rdbuf()){std::string s;int c;" +
      "while((c=o->sbumpc())!=EOF&&c!='\\n')s+=(char)c;" + (usesRand ? "__qsrand((unsigned)std::atoi(s.c_str()));" : "") + "}" +
      "int_type underflow()override{b.clear();int c;while((c=o->sbumpc())!=EOF){b+=(char)c;if(c=='\\n')break;}" +
      "if(b.empty()){std::cout<<'\\x1f'<<std::flush;__builtin_trap();}std::cout<<'\\x1e'<<std::flush;" +
      "setg(&b[0],&b[0],&b[0]+b.size());return traits_type::to_int_type(b[0]);}} __q; std::cin.rdbuf(&__q);";
  }

  /** Prepara el codigo del alumno. Devuelve {src, instr}; instr=true si se instrumento (entonces stdin lleva la semilla en la 1a linea). */
  static build(code) {
    const reMain = /(main\s*\([^)]*\)\s*\{)/;
    let c = code.replace(/sync_with_stdio\s*\(\s*(?:false|0)\s*\)/g, "sync_with_stdio(true)");
    const io = /#include\s*<(?:iostream|bits\/stdc\+\+\.h)>/.test(c), rnd = /\brand\s*\(/.test(c), cin = /\bcin\b/.test(c);
    if (!io || !(rnd || cin)) {                          // sin instrumentacion: semilla fija en compilacion
      if (/\bsrand\s*\(/.test(c)) c = c.replace(/srand\s*\(([^;]*)\)\s*;/g, "srand(42);");
      else if (rnd) c = c.replace(reMain, (m, a) => a + " srand(42);");
      return { src: c, instr: false, offset: 0 };
    }
    c = c.replace(/(?:\bstd\s*::\s*)?\bsrand\s*\([^;]*\)\s*;/g, ";");     // la semilla la pone la consola
    c = c.replace(/(?:\bstd\s*::\s*)?\brand\s*\(\s*\)/g, "__qrand()");          // rand() portable
    c = c.replace(reMain, (m, a) => a + " " + this.snippet(rnd));
    if (rnd) c = this.RNG + "\n" + c;                                           // 1 linea antes del codigo: se corrige en los errores
    return { src: c, instr: true, offset: rnd ? 1 : 0 };
  }
  /** Corrige los numeros de linea de los errores del compilador (restando las lineas que se anteponen al codigo). */
  static shiftErrors(text, offset) {
    return !offset || !text ? text : text.replace(/^(\S+?):(\d+):/gm, (m, f, l) => f + ":" + Math.max(1, +l - offset) + ":");
  }
  /** stdin del programa: [semilla] + lineas tecleadas. */
  static stdin(instr, seed, lines) { return (instr ? seed + "\n" : "") + (lines.length ? lines.join("\n") + "\n" : ""); }

  /** Convierte la salida cruda en segmentos {t, k:'out'|'in'} y dice si el programa espera un dato. */
  static compose(stdout, lines) {
    const segs = []; let buf = "", k = 0, waiting = false;
    for (const ch of stdout || "") {
      if (ch === this.MARK_IN) { if (buf) { segs.push({ t: buf, k: "out" }); buf = ""; } segs.push({ t: (lines[k++] ?? "") + "\n", k: "in" }); }
      else if (ch === this.MARK_WAIT) { waiting = true; break; }
      else buf += ch;
    }
    if (buf) segs.push({ t: buf, k: "out" });
    return { segs, waiting };
  }
}
if (typeof module !== "undefined") module.exports = TerminalService;
