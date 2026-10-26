/* VIEW: ruta de aprendizaje (estilo Duolingo) con las 4 partes. */
class PathView {
  constructor(vm) {
    this.vm = vm;
    vm.onNavigate(p => { if (p.view === "map") { this.render(); this.show(); } else this.hide(); });
  }
  show() { document.getElementById("mapView").classList.remove("hidden"); window.scrollTo(0, this._scroll || 0); }
  hide() { this._scroll = window.scrollY; document.getElementById("mapView").classList.add("hidden"); }
  render() {
    const root = document.getElementById("path"), side = document.getElementById("sideParts");
    root.innerHTML = ""; side.innerHTML = "";
    let currentEl = null;
    this.vm.pathData().forEach(g => {
      const p = g.part;
      // barra lateral
      const li = document.createElement("a");
      li.href = "#part" + p.id; li.className = "side-item"; li.style.setProperty("--c", p.color);
      li.innerHTML = `<span class="dot" style="--c:${p.color}"></span><span class="flex-1"><b>${p.short}</b> · ${p.name}</span><span class="text-xs text-dim">${g.done}/${g.items.length}</span>`;
      side.appendChild(li);

      // encabezado de la parte
      const sec = document.createElement("section"); sec.id = "part" + p.id; sec.className = "mb-10";
      sec.innerHTML = `<div class="unit-banner" style="--c:${p.color};--d:${p.dark}">
        <div><div class="text-xs font-extrabold tracking-widest opacity-90">${p.short.toUpperCase()} · EJERCICIOS ${p.from}–${p.to}</div>
        <div class="text-xl font-extrabold leading-tight">${p.name}</div>
        <div class="text-sm opacity-95 mt-1">${p.desc}</div></div>
        <div class="unit-count">${g.done}/${g.items.length}</div></div>`;
      const col = document.createElement("div"); col.className = "path-col";
      let lastLevel = null;
      g.items.forEach((it, k) => {
        if (it.ex.level !== lastLevel) {
          lastLevel = it.ex.level;
          const d = document.createElement("div"); d.className = "level-divider";
          d.innerHTML = `<span>Nivel ${LEVELS[lastLevel].toLowerCase()}</span>`; col.appendChild(d);
        }
        const row = document.createElement("div"); row.className = "path-row";
        row.style.transform = `translateX(${Math.round(Math.sin(k * 0.9) * 58)}px)`;
        const state = it.solved ? "solved" : it.unlocked ? "open" : "locked";
        if (it.current && it.unlocked) {
          const b = document.createElement("div"); b.className = "start-bubble"; b.style.color = p.color; b.textContent = "¡EMPEZAR!"; row.appendChild(b);
        }
        const n = document.createElement("button");
        n.className = "node " + state + (it.current ? " current" : "");
        n.style.setProperty("--c", p.color); n.style.setProperty("--d", p.dark);
        n.title = it.ex.id + ". " + it.ex.title;
        n.textContent = it.solved ? "✔" : it.unlocked ? it.ex.id : "🔒";
        if (it.unlocked) n.addEventListener("click", () => this.vm.openExercise(it.ex.id));
        row.appendChild(n);
        const t = document.createElement("div"); t.className = "node-title"; t.textContent = it.ex.title; row.appendChild(t);
        col.appendChild(row);
        if (it.current && it.unlocked) currentEl = n;
      });
      sec.appendChild(col); root.appendChild(sec);
    });
    this._currentEl = currentEl;
  }
  scrollToCurrent() { if (this._currentEl) this._currentEl.scrollIntoView({ block: "center", behavior: "smooth" }); }
}
