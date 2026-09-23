// All server times are UTC ISO. Display in local timezone (browser).
export const d = (iso) => (iso ? new Date(iso) : null);
export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}
export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
export function dueLabel(dueIso, isClosed) {
  if (!dueIso) return { text: 'No due', cls: 'muted' };
  if (isClosed) return { text: 'Done', cls: 'done' };
  const now = new Date(), due = new Date(dueIso);
  const diff = due - now;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const span = days >= 1 ? `${days}d${hrs % 24 ? ` ${hrs % 24}h` : ''}` : hrs >= 1 ? `${hrs}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (diff < 0) return { text: `Overdue by ${span}`, cls: 'overdue' };
  if (sameDay(due, now)) return { text: mins < 60 ? `Due in ${span}` : `Due today, ${fmtTime(dueIso)}`, cls: diff < 2 * 3600000 ? 'soon' : 'today' };
  if (sameDay(due, tomorrow)) return { text: `Due tomorrow, ${fmtTime(dueIso)}`, cls: 'upcoming' };
  if (days < 7) return { text: `Due ${due.toLocaleDateString('en-IN', { weekday: 'short' })}, ${fmtTime(dueIso)}`, cls: 'upcoming' };
  return { text: `Due ${fmtDateTime(dueIso)}`, cls: 'future' };
}
export function toLocalInput(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
export function fromLocalInput(v) {
  if (!v) return null;
  return new Date(v).toISOString();
}
export function presetDue(preset) {
  const n = new Date();
  if (preset === 'today') { n.setHours(18, 0, 0, 0); }
  if (preset === 'tomorrow') { n.setDate(n.getDate() + 1); n.setHours(10, 0, 0, 0); }
  if (preset === 'week') { n.setDate(n.getDate() + ((8 - n.getDay()) % 7 || 7)); n.setHours(10, 0, 0, 0); }
  return n.toISOString();
}
