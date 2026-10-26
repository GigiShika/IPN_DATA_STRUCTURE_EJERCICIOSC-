/* SERVICIO: convierte los mensajes del compilador (GCC, en ingles) en explicaciones claras en espanol
   con numero de linea, y traduce los errores de ejecucion (segfault, division entre cero, etc.). */
class ErrorService {
  static clean(t) { return (t || "").replace(/\x1b\[[0-9;]*m/g, "").replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D]/g, '"'); }

  static INCLUDES = { cout: "<iostream>", cin: "<iostream>", endl: "<iostream>", cerr: "<iostream>", string: "<string>",
    vector: "<vector>", setw: "<iomanip>", setprecision: "<iomanip>", fixed: "<iomanip>", sqrt: "<cmath>", pow: "<cmath>",
    fabs: "<cmath>", sin: "<cmath>", cos: "<cmath>", rand: "<cstdlib>", srand: "<cstdlib>", time: "<ctime>" };

  /** Devuelve [{line, col, title, tip, original}] (solo errores, ordenados por linea). */
  static parse(raw) {
    const text = this.clean(raw), lines = text.split("\n"), errs = [];
    const reErr = /^(\S+?):(\d+):(\d+):\s*(?:fatal )?error:\s*(.*)$/, reNote = /^\S+?:\d+:\d+:\s*note:\s*(.*)$/;
    for (const l of lines) {
      let m = l.match(reErr);
      if (m) { if (!/include\/|\/usr\/|\/opt\//.test(m[1])) errs.push({ line: +m[2], col: +m[3], original: m[4], suggest: null }); else errs.skip = true; continue; }
      m = l.match(reNote);
      if (m && errs.length && !errs.skip) { const s = m[1].match(/suggested alternative:\s*'([^']*)'/); if (s) errs[errs.length - 1].suggest = s[1]; }
    }
    if (!errs.length && /undefined reference to [`']main'/.test(text))
      errs.push({ line: null, col: null, original: "undefined reference to main", suggest: null });
    const seen = new Set(), out = [];
    for (const e of errs) {
      const k = e.line + ":" + e.col + ":" + e.original; if (seen.has(k)) continue; seen.add(k);
      const t = this.translate(e.original, e.suggest);
      if (out.length && out[0].syntax) t.tip += " (Puede ser consecuencia del error anterior: corrige primero el de arriba y vuelve a compilar.)";
      out.push({ line: e.line, col: e.col, title: t.title, tip: t.tip, original: e.original, syntax: !out.length && /^expected/.test(e.original) });
    }
    if (!out.length) {
      const first = text.split("\n").filter(x => x.trim()).slice(0, 3).join("\n");
      out.push({ line: null, col: null, title: "El compilador no pudo generar el programa.", tip: "Revisa que el código esté completo y bien escrito.", original: first });
    }
    return out.slice(0, 5);
  }

  static translate(msg, sug) {
    let m;
    if (m = msg.match(/use of undeclared identifier '([^']+)'(?:; did you mean '([^']+)'\?)?/)) { msg = "'" + m[1] + "' was not declared in this scope"; if (m[2]) sug = m[2]; }
    if (m = msg.match(/unknown type name '([^']+)'/)) {
      const inc = this.INCLUDES[m[1]];
      return { title: "«" + m[1] + "» no es un tipo de dato conocido.", tip: inc ? "Agrega #include " + inc + " y using namespace std; (o escribe std::" + m[1] + ")." : "Revisa la ortografía del tipo (int, double, char, string…) o si falta un #include." };
    }
    if ((m = msg.match(/'([^']+)' was not declared in this scope/)) || (m = msg.match(/'([^']+)' has not been declared/))) {
      const n = m[1], inc = this.INCLUDES[n], std = sug && sug.startsWith("std::");
      if (inc || std) return { title: "«" + n + "» no está disponible.", tip: "Agrega al inicio #include " + (inc || "<iostream>") + " y la línea using namespace std; (o escribe std::" + n + ")." };
      return { title: "«" + n + "» no existe en este punto del programa.",
        tip: "¿La declaraste antes de usarla? ¿Está dentro del bloque { } correcto? Revisa también mayúsculas/minúsculas y la ortografía." + (sug ? " ¿Quisiste escribir «" + sug + "»?" : "") };
    }
    const R = [
      [/expected ';' (?:at end of declaration|after .*|at end of declaration list)/, () => ({ title: "Falta un punto y coma (;).", tip: "Ponlo al final de la instrucción marcada (o de la línea anterior)." })],
      [/^expected '\)'/, () => ({ title: "Falta cerrar un paréntesis «)».", tip: "Cuenta los paréntesis de la instrucción: cada «(» necesita su «)»." })],
      [/^expected '\('/, () => ({ title: "Falta abrir un paréntesis «(».", tip: "Después de if, for, while o switch va un paréntesis." })],
      [/^expected '\}'/, () => ({ title: "Falta cerrar una llave «}».", tip: "Cada «{» necesita su «}». Revisa que main y los ciclos/condicionales estén bien cerrados." })],
      [/extraneous closing brace/, () => ({ title: "Sobra una llave «}».", tip: "Hay una llave de cierre sin su llave de apertura." })],
      [/^expected expression/, () => ({ title: "Falta una expresión (un valor o una variable).", tip: "Suele pasar con un operador sin operando, una coma sobrante o un else sin su if." })],
      [/^expected unqualified-id/, () => ({ title: "Símbolo inesperado.", tip: "Puede sobrar o faltar una llave, o hay una instrucción fuera de main()/función." })],
      [/invalid operands to binary expression \('([^']*)'[^)]*?(?: and|,) '([^']*)'/, m => {
        if (/istream|cin/.test(m[1])) return { title: "Con cin se usa «>>», no «<<».", tip: "Para leer: cin >> variable;" };
        if (/ostream|cout/.test(m[1])) return { title: "Con cout se usa «<<», no «>>».", tip: "Para imprimir: cout << valor;" };
        return { title: "No se puede usar ese operador entre «" + m[1] + "» y «" + m[2] + "».", tip: /double|float/.test(m[1] + m[2]) ? "El operador % solo funciona con enteros (int)." : "Revisa los tipos de las variables que estás operando." };
      }],
      [/no viable overloaded '(<<|>>)'/, m => ({ title: "No se puede usar «" + m[1] + "» con ese tipo de dato.", tip: m[1] === "<<" ? "Con cin se usa >>; con cout, <<." : "Con cout se usa <<; con cin, >>." })],
      [/cannot initialize a variable of type '([^']*)' with an? (?:lvalue|rvalue) of type '([^']*)'/, m => ({ title: "No se puede guardar un «" + m[2] + "» en una variable «" + m[1] + "».", tip: "Revisa el tipo de la variable (¿int, double, apuntador?)." })],
      [/no matching function for call to '([^']*)'/, m => ({ title: "La función «" + m[1] + "» no existe o se llamó con argumentos que no le corresponden.", tip: "Revisa su nombre, cuántos argumentos pide y de qué tipo." })],
      [/too (many|few) arguments to function call, expected (\d+), have (\d+)/, m => ({ title: (m[1] === "many" ? "Sobran" : "Faltan") + " argumentos al llamar la función.", tip: "La función espera " + m[2] + " y le pasaste " + m[3] + "." })],
      [/subscripted value is not an array, pointer, or vector/, () => ({ title: "Estás usando [ ] sobre algo que no es un arreglo.", tip: "Solo los arreglos y apuntadores se indexan: v[i]; una matriz usa dos índices m[i][j]." })],
      [/indirection requires pointer operand|member reference type '[^']*' is not a pointer/, () => ({ title: "Usas * o -> sobre algo que no es un apuntador.", tip: "Con una variable normal usa el punto (a.campo); con un apuntador usa p->campo o *p." })],
      [/member reference type '[^']*' is a pointer; did you mean to use '->'/, () => ({ title: "Es un apuntador: usa «->» en lugar de «.».", tip: "p->campo equivale a (*p).campo." })],
      [/no member named '([^']*)' in '([^']*)'/, m => ({ title: "«" + m[2] + "» no tiene un miembro llamado «" + m[1] + "».", tip: "Revisa la ortografía del campo o de la función." })],
      [/expression is not assignable|cannot assign to variable '([^']*)' with const-qualified type/, () => ({ title: "No se puede asignar a eso.", tip: "Del lado izquierdo de = debe ir una variable que no sea const (¿quisiste usar == para comparar?)." })],
      [/'([^']+)' file not found/, m => ({ title: "No se encontró la librería «" + m[1] + "».", tip: "Revisa el nombre del #include: <iostream>, <cmath>, <cstdlib>… (sin .h)." })],
      [/missing terminating '"' character|unterminated string/, () => ({ title: "Falta cerrar unas comillas (\").", tip: "Un texto entre comillas debe abrir y cerrar en la misma línea." })],
      [/expected ',' or ';' before '([^']*)'/, m => ({ title: "Falta un punto y coma (;).", tip: "Ponlo al final de la instrucción marcada (o de la línea anterior), antes de «" + m[1] + "»." })],
      [/invalid types '[^']*\[(?:double|float)\]' for array subscript/, () => ({ title: "El índice de un arreglo debe ser un entero.", tip: "No uses float/double entre los corchetes [ ]; usa int." })],
      [/expected ';' before '\{'/, () => ({ title: "Falta un punto y coma (;) o cerrar un paréntesis «)».", tip: "Revisa la línea marcada: ¿cerraste todos los paréntesis del if/for/while? ¿Falta un punto y coma antes de la llave «{»?" })],
      [/expected ';' before '([^']*)'/, m => ({ title: "Falta un punto y coma (;).", tip: "Ponlo al final de la instrucción marcada (o de la línea anterior), antes de «" + m[1] + "»." })],
      [/expected ';' at end of/, () => ({ title: "Falta un punto y coma (;).", tip: "Las declaraciones de struct/class terminan con }; ." })],
      [/expected '\)' before '([^']*)'/, m => ({ title: "Falta cerrar un paréntesis «)».", tip: "Cuenta los paréntesis de la instrucción: cada «(» necesita su «)». El problema está cerca de «" + m[1] + "»." })],
      [/expected '\(' before '([^']*)'/, m => ({ title: "Falta abrir un paréntesis «(».", tip: "Después de if, for, while o switch va un paréntesis; revisa cerca de «" + m[1] + "»." })],
      [/expected '\}' at end of input/, () => ({ title: "Falta cerrar una llave «}».", tip: "Cada «{» necesita su «}». Revisa que main y los ciclos/condicionales estén bien cerrados." })],
      [/expected declaration before '\}' token/, () => ({ title: "Sobra una llave «}».", tip: "Hay una llave de cierre sin su llave de apertura." })],
      [/expected primary-expression before '([^']*)'/, m => ({ title: "Instrucción incompleta cerca de «" + m[1] + "».", tip: "Falta un valor o una variable (por ejemplo, un operador sin operando, o dos comas seguidas)." })],
      [/expected unqualified-id before '([^']*)'/, m => ({ title: "Símbolo inesperado cerca de «" + m[1] + "».", tip: "Puede sobrar o faltar una llave, o falta algo antes de este símbolo." })],
      [/expected '([^']*)' before '([^']*)'/, m => ({ title: "Se esperaba «" + m[1] + "» antes de «" + m[2] + "».", tip: "Revisa la sintaxis de esa línea (comas, paréntesis, punto y coma)." })],
      [/no match for 'operator(<<|>>)' \(operand types are '([^']*)'/, m => {
        const cin = /istream|cin/.test(m[2]), cout = /ostream|cout/.test(m[2]);
        if (m[1] === "<<" && cin) return { title: "Con cin se usa «>>», no «<<».", tip: "Para leer: cin >> variable;" };
        if (m[1] === ">>" && cout) return { title: "Con cout se usa «<<», no «>>».", tip: "Para imprimir: cout << valor;" };
        return { title: "No se puede usar «" + m[1] + "» con ese tipo de dato (" + m[2] + ").", tip: "Revisa que estés leyendo/imprimiendo valores simples (números, texto)." };
      }],
      [/invalid operands of types '([^']*)' and '([^']*)' to binary 'operator([^']*)'/, m => ({ title: "No se puede usar «" + m[3] + "» entre " + m[1] + " y " + m[2] + ".",
        tip: m[3] === "%" ? "El operador % solo funciona con enteros (int)." : "Revisa los tipos de las variables que estás operando." })],
      [/invalid conversion from '([^']*)' to '([^']*)'/, m => ({ title: "No se puede convertir «" + m[1] + "» en «" + m[2] + "» directamente.", tip: "Revisa el tipo de la variable que recibe el valor." })],
      [/cannot convert '([^']*)' to '([^']*)'/, m => ({ title: "No se puede convertir «" + m[1] + "» en «" + m[2] + "».", tip: "Revisa los tipos de los argumentos o de la variable." })],
      [/redeclaration of '([^']*)'|conflicting declaration '([^']*)'|redefinition of '([^']*)'/, m => ({ title: "«" + (m[1] || m[2] || m[3]).split(" ").pop() + "» ya fue declarada.", tip: "No puedes declarar dos veces el mismo nombre en el mismo bloque; usa otro nombre o quita el tipo (int) para reutilizarla." })],
      [/'([^']*)' does not name a type/, m => ({ title: "«" + m[1] + "» no es un tipo de dato válido.", tip: "Revisa la ortografía o si falta un #include (string → <string>, vector → <vector>) o using namespace std;." })],
      [/array subscript is not an integer/, () => ({ title: "El índice de un arreglo debe ser un entero.", tip: "No uses float/double entre los corchetes [ ]." })],
      [/too many initializers/, () => ({ title: "Pusiste más valores iniciales de los que caben.", tip: "Aumenta el tamaño del arreglo o quita valores de las llaves { }." })],
      [/variable-sized object '([^']*)' may not be initialized/, m => ({ title: "No puedes inicializar «" + m[1] + "» con { } si su tamaño es una variable.", tip: "Usa un tamaño fijo (una constante) o llena el arreglo con un ciclo for." })],
      [/invalid types '([^']*)' for array subscript/, () => ({ title: "Estás usando [ ] sobre algo que no es un arreglo (o con demasiados índices).", tip: "Una matriz usa dos índices: m[fila][columna]; un vector, uno solo." })],
      [/too few arguments to function/, () => ({ title: "Faltan argumentos al llamar una función.", tip: "Revisa cuántos parámetros pide la función." })],
      [/too many arguments to function/, () => ({ title: "Sobran argumentos al llamar una función.", tip: "Revisa cuántos parámetros pide la función." })],
      [/lvalue required as left operand of assignment/, () => ({ title: "Del lado izquierdo de «=» debe ir una variable.", tip: "¿Quisiste comparar con «==»? Recuerda: = asigna, == compara." })],
      [/'else' without a previous 'if'/, () => ({ title: "Hay un else sin su if.", tip: "Revisa las llaves y que no haya un «;» justo después del if." })],
      [/missing terminating " character/, () => ({ title: "Falta cerrar unas comillas (\").", tip: "Un texto entre comillas debe abrir y cerrar en la misma línea." })],
      [/stray '([^']*)' in program/, () => ({ title: "Hay un carácter extraño en el código.", tip: "Suele ser una comilla “ ” o un guion largo copiado de otro lado. Bórralo y escríbelo de nuevo con el teclado." })],
      [/jump to case label|crosses initialization/, () => ({ title: "No puedes declarar variables dentro de un case sin llaves.", tip: "Encierra el contenido del case entre { }." })],
      [/iostream: No such file|No such file or directory/, () => ({ title: "No se encontró la librería del #include.", tip: "Revisa el nombre: #include <iostream> (sin .h)." })],
      [/undefined reference to main|'main' must return 'int'/, () => ({ title: "Falta la función principal main().", tip: "Tu programa debe tener int main() { ... return 0; }" })],
      [/expected constructor, destructor, or type conversion/, () => ({ title: "Hay una instrucción fuera de main() o de una función.", tip: "Las instrucciones (cout, for, asignaciones) deben ir dentro de { } de una función." })],
    ];
    for (const [re, f] of R) { const mm = msg.match(re); if (mm) return f(mm); }
    return { title: "Error del compilador.", tip: "Revisa la sintaxis de la línea marcada. Mensaje original: " + msg };
  }

  /** Mensaje claro para errores durante la ejecucion; null si todo estuvo bien. */
  static runtime(res) {
    const sig = (res.signal || "").toLowerCase(), code = res.exitCode;
    if (sig.includes("segmentation") || sig.includes("sigsegv") || code === 139 || code === -11)
      return "Falla de segmentación: tu programa tocó memoria que no le pertenece. Revisa que los índices de tus arreglos estén entre 0 y tamaño−1, que los ciclos no se pasen del final y que los apuntadores apunten a memoria válida.";
    if (sig.includes("floating") || sig.includes("sigfpe") || code === 136)
      return "Excepción aritmética: hubo una división o un módulo (%) entre cero. Revisa los divisores.";
    if (sig.includes("abort") || sig.includes("sigabrt") || code === 134)
      return "El programa abortó. Suele deberse a un new con tamaño inválido, a un delete doble o a un arreglo demasiado grande.";
    if (sig.includes("kill") || sig.includes("sigkill") || sig.includes("sigterm") || sig.includes("timeout") || sig.includes("time") || code === 137 || code === 124 || code === 143)
      return "El programa tardó demasiado y fue detenido. Probablemente hay un ciclo infinito (revisa la condición y que la variable del ciclo cambie) o el programa espera más datos de los que hay en la entrada.";
    if (sig || (code && code !== 0)) return "El programa terminó con el código de error " + (code || sig) + ". Revisa que main termine con return 0; y que no haya fallas en tiempo de ejecución.";
    return null;
  }
}
if (typeof module !== "undefined") module.exports = ErrorService;
