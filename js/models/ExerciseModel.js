/* MODEL: datos puros de los ejercicios. No conoce el DOM. */
class ExerciseModel {
  static all() { return EXERCISES; }
  static byId(id) { return EXERCISES.find(e => e.id === id); }
  static byPart(partId) { return EXERCISES.filter(e => e.part === partId); }
  static partOf(ex) { return PARTS.find(p => p.id === ex.part); }
  static total() { return EXERCISES.length; }
}
