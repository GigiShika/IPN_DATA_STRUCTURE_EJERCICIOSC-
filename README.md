# 90 retos de C++ · Estructura de Datos (UPIICSA)

Página web (HTML + Tailwind + JS) con los 90 ejercicios resueltos del cuaderno, ordenados de menor a mayor
dificultad (en cada parte: Básico → Intermedio → Experto): Parte I lógica (1-30) · Parte II vectores (31-60) · Parte III matrices (61-82) · Parte IV apuntadores (83-90).

## Estructura (igual que el polilibro: index + css + js + assets)
```
index.html
css/style.css
assets/img/
js/
  data/        exercises.js (90 ejercicios) · parts.js (partes y niveles)
  core/        EventBus.js
  models/      ExerciseModel · ProgressModel · CodeRepository      <- MODEL
  services/    CompilerService · TerminalService · ValidationService · ErrorService · HighlightService  <- dominio
  viewmodels/  AppViewModel                                        <- VIEWMODEL
  views/       StatsView · PathView · ExerciseView                 <- VIEW (solo DOM)
  app.js       composición de objetos
```

## Ayuda sin solución
La página **no incluye las soluciones**. Cada ejercicio trae 3 pistas progresivas (idea → plan → detalle técnico) que el alumno
va pidiendo una por una; ninguna entrega el código completo. Lo único que se muestra es un ejemplo de la salida.

## Diseño
Tema oscuro plano tipo IDE (paleta GitHub dark), sin brillos ni desenfoques. La pantalla del ejercicio tiene 3 columnas:
Problema + ayudas | Editor | Consola.

## Entrada en la consola
«Ejecutar» abre una consola interactiva: el programa muestra su mensaje y el cursor queda ahí para teclear el dato (Enter para enviarlo),
como en una terminal. Como Wandbox/Godbolt no son interactivos, `TerminalService` inyecta en `main()` un `streambuf` que reemplaza a `cin`:
marca en la salida cada vez que se pide una línea y avisa cuando faltan datos; con cada Enter se vuelve a ejecutar con una línea más
(misma semilla de `rand()`). Funciona con `cin`/`getline`; no con `scanf`. «Validar» ejecuta el programa con una entrada fija de prueba (sin mostrarla de antemano; si falla, el mensaje indica con qué entrada se probó).

## Anti pegado
El editor bloquea pegar texto de otro lugar (Ctrl+V, menú contextual), arrastrar texto y las inserciones grandes de golpe (> 30 caracteres en
un solo evento); copiar/pegar *dentro* del editor sí se permite. **Es una barrera del lado del navegador:** desalienta, pero no es infalible
(se puede evadir con las herramientas del navegador, reescribiendo el código a mano o desde otro dispositivo) y no puede detectar si un código
fue hecho con IA. Para eso conviene complementarlo con revisión en clase.

## Compilador (rápido, dentro del navegador)
`CompilerService` usa **Clang (LLVM) compilado a WebAssembly** en un Web Worker (`js/workers/compiler.worker.js`, binarios en `assets/clang/`,
~29 MB que el navegador descarga una sola vez y guarda en caché). No hay servidor ni espera de red:
* el programa se **compila mientras escribes** (al dejar de teclear ~1 s) y al pulsar *Ejecutar* o *Validar* ya está listo;
* se compila una sola vez y se ejecuta las veces que haga falta en **milisegundos** (cada dato que tecleas en la consola);
* `rand()` se sustituye por una versión idéntica a la de GCC, así los resultados son los mismos con cualquier compilador.

Requiere servir la página por http(s) (GitHub Pages, Live Server de VS Code); con `file://` los Workers no funcionan.
Si el compilador local no puede cargarse (navegador antiguo, `file://`), la página usa de respaldo Wandbox/Compiler Explorer (más lento).

## Validación libre
Se ejecuta el programa con la «entrada de prueba» y se comparan los **valores calculados** contra los de la solución de
referencia. El alumno puede nombrar las variables y resolverlo como prefiera; el texto de los mensajes y hasta el orden
de los valores no importan. Los programas con `rand()` se validan con `srand(42)` inyectado.

## Errores claros
`ErrorService` traduce los errores de GCC al español (línea + explicación + consejo) y también los de ejecución
(falla de segmentación, división entre cero, ciclo infinito). El error se **subraya en naranja** en el editor, el número
de línea se marca y al hacer clic en la tarjeta de error el cursor salta a esa línea.
