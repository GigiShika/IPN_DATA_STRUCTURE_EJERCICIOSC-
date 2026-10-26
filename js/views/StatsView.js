/* VIEW: contadores del encabezado y controles globales. */
class StatsView {
  constructor(vm) {
    this.vm = vm; vm.onStats(s => this.render(s)); this.render(vm.stats());
    vm.onCompiler(c => this.renderCompiler(c));
    document.getElementById("freeToggle").addEventListener("change", e => vm.setFree(e.target.checked));
    document.getElementById("resetProgress").addEventListener("click", () => {
      if (confirm("¿Borrar todo tu progreso? Esta acción no se puede deshacer.")) vm.resetProgress();
    });
  }
  renderCompiler({ state, progress }) {
    const el = document.getElementById("compilerStatus"); el.className = "stat comp " + state;
    if (state === "warming") el.textContent = "⏳ Preparando compilador…";
    else if (state === "loading") el.textContent = "⏳ Cargando compilador " + Math.round((progress || 0) * 100) + "%";
    else if (state === "ready") { el.textContent = "⚡ Compilador listo"; el.title = "Clang (LLVM) corriendo dentro de tu navegador: sin servidor"; }
    else if (state === "remote") { el.textContent = "☁ Compilador remoto"; el.title = "No se pudo cargar el compilador local; se usa un servidor en línea (más lento)"; }
  }
  render(s) {
    document.getElementById("xpLbl").textContent = s.xp + " XP";
    document.getElementById("streakLbl").textContent = s.streak;
    document.getElementById("progLbl").textContent = s.solved + "/" + s.total;
    document.getElementById("globalBar").style.width = (100 * s.solved / s.total) + "%";
    document.getElementById("freeToggle").checked = s.free;
  }
}
