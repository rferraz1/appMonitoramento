export function StatCard({ label, value, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200',
    green: 'border-emerald-200 bg-emerald-50',
    red: 'border-red-200 bg-red-50',
    yellow: 'border-amber-200 bg-amber-50',
    gray: 'border-slate-200 bg-slate-50'
  };
  return (
    <div className={`stat-card rounded-lg border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
