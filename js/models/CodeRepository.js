/* MODEL: borradores de código por ejercicio (localStorage). */
class CodeRepository {
  constructor(storage) { this.storage = storage; }
  _key(id) { return "cpp90_code_" + id; }
  load(ex) { try { const v = this.storage.getItem(this._key(ex.id)); if (v) return v; } catch (e) {} return ex.starter; }
  save(ex, code) { try { this.storage.setItem(this._key(ex.id), code); } catch (e) {} }
  reset(ex) { try { this.storage.removeItem(this._key(ex.id)); } catch (e) {} return ex.starter; }
}
