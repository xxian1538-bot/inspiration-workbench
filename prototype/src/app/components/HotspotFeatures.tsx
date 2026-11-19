import { useEffect, useState } from "react";

type Story = { id: string; title: string; summary: string; source: string; publishedAt: string; keywords: string[] };
type Tracked = Story & { level?: string; alert?: boolean; recipients?: string[]; updatedAt: number };
export const previewUsers = ["林晓 · 责任编辑", "周宁 · 选题编辑", "小编 · 创作者"];
const key = "inspiration-preview:tracked-hotspots";
function readTracked(): Tracked[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
export function useTracked() {
  const [items, setItems] = useState(readTracked);
  useEffect(() => {
    const update = () => setItems(readTracked());
    window.addEventListener("hotspots-updated", update);
    return () => window.removeEventListener("hotspots-updated", update);
  }, []);
  return items;
}
function updateTracked(story: Story, changes: Partial<Tracked>) {
  const items = readTracked();
  const previous = items.find((item) => item.id === story.id);
  const value = { ...previous, ...story, ...changes, updatedAt: Date.now() };
  localStorage.setItem(key, JSON.stringify([value, ...items.filter((item) => item.id !== story.id)]));
  window.dispatchEvent(new Event("hotspots-updated"));
}
const levels = [
  ["必追热点", "请立即跟进", "bg-red-50 text-red-700 border-red-200"],
  ["建议热点", "自行选择是否跟进", "bg-orange-50 text-orange-700 border-orange-200"],
  ["关注热点", "供创作参考", "bg-blue-50 text-blue-700 border-blue-200"],
];
export function HotspotLevel({ story }: { story: Story }) {
  const selected = useTracked().find((item) => item.id === story.id)?.level;
  const [error, setError] = useState("");
  return <section className="space-y-3 border-t border-border pt-5">
    <h3 className="text-xs font-semibold">热点跟进等级</h3>
    <div className="flex flex-wrap gap-2">
      {levels.map(([level, note]) => <button type="button" key={level} aria-pressed={selected === level} title={note}
        onClick={() => {
          try { updateTracked(story, { level }); setError(""); }
          catch { setError("保存失败，请重试"); }
        }}
        className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected === level
          ? "border-primary bg-primary text-white hover:bg-primary/90"
          : "border-primary/25 bg-white text-primary hover:border-primary hover:bg-primary/5"}`}>
        {selected === level && <span aria-hidden="true">✓</span>}{level}
      </button>)}
    </div>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </section>;
}
export function HotspotBadge({ id }: { id: string }) {
  const item = useTracked().find((entry) => entry.id === id);
  const color = levels.find(([level]) => level === item?.level)?.[2];
  return item?.level ? <span title={levels.find(([level]) => level === item.level)?.[1]} className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color}`}>{item.level}</span> : null;
}
export function extractTopics(text: string) {
  return [...new Set(Array.from(text.matchAll(/#([^#\s，。！？；：、,!?;:<>{}\[\]（）()]+)/gu), (match) => match[1]))];
}
export function ArticleTopics({ title, articleId }: { title: string; articleId?: number }) {
  const [originalTopics, setOriginalTopics] = useState<string[]>([]);
  const [status, setStatus] = useState(articleId ? "正在读取原文话题…" : "原文未获取，当前仅识别标题话题");
  const [analysis, setAnalysis] = useState(false);
  useEffect(() => {
    if (articleId === undefined) return;
    const controller = new AbortController();
    fetch("/api/article/topics", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId }), signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.topics)) throw new Error();
        if (!controller.signal.aborted) { setOriginalTopics(data.topics); setStatus("已读取原文"); }
      }).catch(() => { if (!controller.signal.aborted) setStatus("原文话题暂未获取，可重新打开详情重试"); });
    return () => controller.abort();
  }, [articleId]);
  const topics = [...new Set([...extractTopics(title), ...originalTopics])];
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="text-xs font-semibold text-violet-600">文章话题</h3>
    <p className="text-[11px] text-muted-foreground">{status}</p>
    <div className="flex flex-wrap gap-2">{topics.length ? topics.map((topic) => <span key={topic} className="rounded bg-primary/5 px-2 py-1 text-xs text-primary">#{topic}#</span>) : <p className="text-xs text-muted-foreground">当前已读取内容中未识别到 #话题</p>}</div>
    <button onClick={() => setAnalysis(true)} className="rounded-lg border border-primary/25 px-3 py-1.5 text-xs text-primary">分析话题</button>
    {analysis && <dl className="space-y-3 rounded-lg bg-muted/40 p-3 text-xs leading-5">
      {[["传播速度", "需接入带时间戳的发布量与互动增量后计算传播速度。"], ["情感倾向", "需结合话题原文及网友评论判断正向、中性与负向占比。"], ["参与人群", "需接入参与账号和可用人群统计，展示核心参与群体。"], ["跨平台联动效应", "需按同一话题关联各平台发文、传播时点和互动变化。"]].map(([name, value]) => <div key={name}><dt className="font-semibold">{name}</dt><dd className="text-muted-foreground">{value}</dd></div>)}
      <p className="text-muted-foreground">当前尚未获取话题传播分析数据。</p>
    </dl>}
  </section>;
}
