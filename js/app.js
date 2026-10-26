/* BOOTSTRAP: arma el grafo de objetos (composicion MVVM). */
(function () {
  let storage = window.localStorage;
  try { storage.getItem("x"); } catch (e) { storage = { getItem() { return null; }, setItem() {}, removeItem() {} }; }
  const vm = new AppViewModel(new ProgressModel(storage), new CodeRepository(storage), new CompilerService());
  new StatsView(vm);
  const path = new PathView(vm);
  new ExerciseView(vm);
  document.getElementById("continueBtn").addEventListener("click", () => path.scrollToCurrent());
  vm.bus.emit("navigate", { view: "map" });
  vm.warmup();                       // descarga/inicia el compilador local en segundo plano
  setTimeout(() => path.scrollToCurrent(), 400);
})();
