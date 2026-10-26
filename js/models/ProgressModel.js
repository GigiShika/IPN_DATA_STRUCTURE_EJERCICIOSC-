/* MODEL: progreso del alumno (resueltos, XP, racha de días, modo libre). */
class ProgressModel {
  constructor(storage) { this.storage = storage; this.state = this._load(); }
  _load() {
    try { const raw = this.storage.getItem("cpp90_progress"); if (raw) return JSON.parse(raw); } catch (e) {}
    return { solved: [], streak: 0, lastDay: null, free: false, hints: {} };
  }
  _save() { try { this.storage.setItem("cpp90_progress", JSON.stringify(this.state)); } catch (e) {} }
  get solved() { return this.state.solved; }
  get streak() { return this.state.streak || 0; }
  get free() { return !!this.state.free; }
  get xp() { return this.state.solved.reduce((t, id) => t + 10 * ExerciseModel.byId(id).stars, 0); }
  isSolved(id) { return this.state.solved.includes(id); }
  isUnlocked(id) { return this.free || id === 1 || this.isSolved(id) || this.isSolved(id - 1); }
  nextPending() { const e = EXERCISES.find(x => !this.isSolved(x.id)); return e ? e.id : null; }
  markSolved(id) {
    if (this.isSolved(id)) return false;
    this.state.solved.push(id);
    const hoy = new Date().toDateString();
    if (this.state.lastDay !== hoy) {
      const ayer = new Date(Date.now() - 864e5).toDateString();
      this.state.streak = this.state.lastDay === ayer ? (this.state.streak || 0) + 1 : 1;
      this.state.lastDay = hoy;
    }
    this._save(); return true;
  }
  hintsUsed(id) { return (this.state.hints && this.state.hints[id]) || 0; }
  addHint(id, max) {
    this.state.hints = this.state.hints || {};
    if (this.hintsUsed(id) < max) { this.state.hints[id] = this.hintsUsed(id) + 1; this._save(); }
    return this.hintsUsed(id);
  }
  setFree(v) { this.state.free = !!v; this._save(); }
  reset() { this.state = { solved: [], streak: 0, lastDay: null, free: this.state.free, hints: {} }; this._save(); }
}
