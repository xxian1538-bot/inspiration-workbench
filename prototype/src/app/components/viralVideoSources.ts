export type CatalogSource = "library" | "subscribed" | "latest";

export type VideoWork = {
  id: string;
  platform: string;
  title: string;
  account: string;
  publishedAt?: string;
  duration?: string;
  cover?: string;
  videoUrl?: string;
  library?: "personal" | "team";
  mine?: boolean;
};

export type PlatformSnapshot = {
  platform: string;
  workId: string;
  publishedAt: string | null;
  account: string | null;
  metrics: Partial<Record<"views" | "favorites" | "comments" | "likes" | "shares", number>>;
  viralAssessment?: {
    isViral: boolean;
    basis: string;
  };
  comments: Array<{ id: string; author: string; date: string; likes?: number; text: string }> | null;
};

export type VideoImport =
  | { kind: "local"; file: File }
  | { kind: "link"; url: URL }
  | { kind: CatalogSource; work: VideoWork; snapshot?: PlatformSnapshot; demo: boolean };

export const socialChannels = ["微博", "抖音", "网站", "快手", "微信", "头条", "B站"];
const apiBase = import.meta.env.VITE_VIDEO_SOURCE_API?.replace(/\/+$/, "");
export const hasVideoSourceApi = Boolean(apiBase);

export const workKey = (work: VideoWork) => JSON.stringify([work.platform, work.id]);

async function readSource(path: string, signal: AbortSignal) {
  const response = await fetch(`${apiBase}${path}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("视频来源服务暂时不可用，请重试。");
  return response.json();
}

// The configured application service supplies authorized catalog and platform data.
// GET /works?source=library|subscribed|latest&platform=...&q=...&library=...&mine=...
// Returns { items: VideoWork[] }. GET /works/:platform/:id returns PlatformSnapshot.
export async function readVideoCatalog(params: URLSearchParams, signal: AbortSignal): Promise<VideoWork[]> {
  const data = await readSource(`/works?${params}`, signal);
  if (!Array.isArray(data?.items)) throw new Error("视频来源服务返回了无效的列表。");
  return data.items;
}

export async function readPlatformSnapshot(work: VideoWork, signal: AbortSignal): Promise<PlatformSnapshot> {
  const data = await readSource(`/works/${encodeURIComponent(work.platform)}/${encodeURIComponent(work.id)}`, signal);
  if (data?.platform !== work.platform || data?.workId !== work.id) {
    throw new Error(`「${work.title}」的传播数据与作品标识不一致，请重试。`);
  }
  if (!data.metrics || typeof data.metrics !== "object" || (data.comments !== null && !Array.isArray(data.comments))) {
    throw new Error(`「${work.title}」的传播数据格式有误，请重试。`);
  }
  return data;
}

export function parsePlaybackUrl(input: string) {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.replace(/\.$/, "");
    const ip = host.split(".").map(Number);
    const privateIp = ip.length === 4 && (ip[0] === 0 || ip[0] === 10 || ip[0] === 127 || ip[0] >= 224 ||
      (ip[0] === 169 && ip[1] === 254) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) ||
      (ip[0] === 192 && ip[1] === 168) || (ip[0] === 100 && ip[1] >= 64 && ip[1] <= 127));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        !host.includes(".") || /\.(?:localhost|local|internal|test)$/.test(host) || privateIp ||
        !/\.mp4$/i.test(url.pathname)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export type VideoContentAnalysis = {
  technical: Array<{ label: string; value: string }>;
  summary: string;
  structure: Array<{ label: string; value: string }>;
  reusableStructure: string[];
};

const analysisEndpoint = import.meta.env.VITE_VIDEO_ANALYSIS_API;
export const hasVideoAnalysisApi = Boolean(analysisEndpoint);

// The analysis service accepts the source video independently of platform metrics.
export async function analyzeVideo(item: VideoImport, signal: AbortSignal): Promise<VideoContentAnalysis> {
  const body = new FormData();
  body.set("source", item.kind);
  if (item.kind === "local") body.set("file", item.file);
  else if (item.kind === "link") body.set("url", item.url.href);
  else {
    body.set("platform", item.work.platform);
    body.set("workId", item.work.id);
    if (item.work.videoUrl) body.set("url", item.work.videoUrl);
  }
  const response = await fetch(analysisEndpoint, { method: "POST", body, signal });
  if (!response.ok) throw new Error("内容拆解服务暂时不可用。");
  const result = await response.json();
  const validRows = (rows: unknown) => Array.isArray(rows) && rows.length > 0 &&
    rows.every((row) => row && typeof row.label === "string" && typeof row.value === "string");
  if (!validRows(result?.technical) || !validRows(result?.structure) ||
    typeof result?.summary !== "string" || !result.summary.trim() ||
    !Array.isArray(result?.reusableStructure) || !result.reusableStructure.length ||
    !result.reusableStructure.every((step: unknown) => typeof step === "string")) {
    throw new Error("内容拆解服务未返回完整报告。");
  }
  return result;
}
