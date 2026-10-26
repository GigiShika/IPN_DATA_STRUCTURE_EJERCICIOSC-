/* Bus de eventos mínimo: permite el data-binding observable entre ViewModel y Views. */
class EventBus {
  constructor() { this.l = {}; }
  on(evt, fn) { (this.l[evt] = this.l[evt] || []).push(fn); }
  emit(evt, payload) { (this.l[evt] || []).forEach(fn => fn(payload)); }
}
