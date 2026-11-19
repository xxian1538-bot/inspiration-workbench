export type MetricSelection = Record<string, string[]>;
export const defaultMetricSelection: MetricSelection = { 热榜: ["热度"] };
const groups = [
  { name: "热榜", metrics: ["热度", "上榜次数"] },
  ...["微博", "抖音", "微信", "快手", "头条", "B站"].map((name) => ({ name, metrics: ["阅读或播放量", "评论量", "点赞量", "收藏量", "转发量"] })),
];
export function normalizeMetricSelection(value: MetricSelection): MetricSelection {
  return Object.fromEntries(groups.map(({ name, metrics }) => [name,
    metrics.filter((metric) => (value[name] ?? []).includes(metric)),
  ]).filter(([, metrics]) => metrics.length));
}

export function metricSummary(value: MetricSelection) {
  return Object.entries(normalizeMetricSelection(value)).filter(([, metrics]) => metrics.length).map(([name, metrics]) => name + "（" + metrics.join("、") + "）").join("；");
}
export function AnomalyMetrics({ value, onChange }: { value: MetricSelection; onChange: (value: MetricSelection) => void }) {
  const count = Object.values(value).reduce((total, metrics) => total + metrics.length, 0);
  return <section className="rounded-xl border border-border p-4">
    <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">监测指标</h3><span className="text-xs text-muted-foreground">已选 {count} 项</span></div>
    <p className="mb-4 text-xs leading-5 text-muted-foreground">按热榜和渠道选择指标。每项独立计算，任一指标满足下方增长阈值、最低门槛和连续触发次数即命中。</p>
    <div className="divide-y divide-border">{groups.map(({ name, metrics }) => <div key={name} className="flex gap-3 py-3">
      <span className="w-16 shrink-0 text-xs font-medium">{name}</span><div className="flex flex-wrap gap-x-4 gap-y-3">
      {metrics.map((metric) => { const selected = (value[name] ?? []).includes(metric); return <label key={metric} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
        <input type="checkbox" aria-label={name + " · " + metric} checked={selected} onChange={() => onChange({ ...value, [name]: selected ? (value[name] ?? []).filter((item) => item !== metric) : [...(value[name] ?? []), metric] })} className="accent-blue-600" />{metric}
      </label>; })}</div>
    </div>)}</div>
    {!count && <p role="alert" className="mt-2 text-xs text-amber-700">请选择至少一项监测指标</p>}
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">各平台指标分别监测，未获取的指标等待数据接入。</p>
  </section>;
}
