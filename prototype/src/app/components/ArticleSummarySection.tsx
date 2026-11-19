import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, Sparkles } from "lucide-react";

export type ArticleSummaryMode = "hotspot" | "competitor" | "industry";
const modeLabels: Record<ArticleSummaryMode, string> = {
  hotspot: "热点事件研判",
  competitor: "竞品分析",
  industry: "行业洞察",
};

export type ArticleSummarySource = { articleId: number; originalUrl: string };
type SummaryState =
  | { status: "loading" }
  | { status: "ready"; summary: string }
  | { status: "error"; message: string };

function plainSummary(summary: string) {
  return summary
    .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, "")
    .replace(/^[ \t]*(?:[-*+]|#{1,6})[ \t]+/gm, "")
    .replace(/\*\*|__/g, "")
    .trim();
}

const requests = new Map<string, Promise<string>>();

function loadSummary(articleId: number, mode: ArticleSummaryMode) {
  const key = `${mode}:${articleId}`;
  const existing = requests.get(key);
  if (existing) return existing;

  const endpoint = import.meta.env.VITE_INDUSTRY_SUMMARY_API || "/api/industry/summary";
  const request = (async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, mode }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || typeof data?.summary !== "string" || !data.summary.trim()) {
      throw new Error(data?.error || "AI 解读暂不可用，请稍后重试。");
    }
    return plainSummary(data.summary);
  })().catch((error: unknown) => {
    requests.delete(key);
    throw error;
  });
  requests.set(key, request);
  return request;
}

export function ArticleSummarySection({ source, mode }: { source?: ArticleSummarySource; mode: ArticleSummaryMode }) {
  const [result, setResult] = useState<SummaryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const articleId = source?.articleId;

  useEffect(() => {
    if (articleId === undefined) return;
    let active = true;
    void loadSummary(articleId, mode).then(
      (summary) => { if (active) setResult({ status: "ready", summary }); },
      (failure: unknown) => {
        if (active) setResult({ status: "error", message: failure instanceof Error && !(failure instanceof TypeError)
          ? failure.message : "暂时无法连接 AI 解读服务，请重试。" });
      },
    );
    return () => { active = false; };
  }, [articleId, mode, attempt]);

  const generate = () => {
    setResult({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  return (
    <section aria-labelledby="article-summary-heading" className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="article-summary-heading" className="flex items-center gap-1 text-[11px] font-semibold text-violet-600"><Sparkles size={11} /> AI 解读</h3>
        {source && <a href={source.originalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-primary"><ExternalLink size={11} /> 查看原文</a>}
      </div>
      <p className="text-[11px] text-muted-foreground">分析维度 · {modeLabels[mode]}</p>
      <div aria-live="polite">
        {!source && <p className="text-xs text-muted-foreground">当前稿件暂无可读取的原文，补齐来源后可生成摘要。</p>}
        {source && result.status === "loading" && (
          <p role="status" className="flex items-center gap-2 text-xs text-primary"><LoaderCircle size={14} className="animate-spin" /> 正在获取原文并生成摘要…</p>
        )}
        {result.status === "error" && (
          <div className="space-y-2">
            <p role="alert" className="text-xs text-red-600">{result.message}</p>
            <button type="button" onClick={generate} className="rounded-lg bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90">重试</button>
          </div>
        )}
        {result.status === "ready" && (
          <p className="whitespace-pre-wrap break-words rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs leading-6 text-foreground">{result.summary}</p>
        )}
      </div>
    </section>
  );
}
