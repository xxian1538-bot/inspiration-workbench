import { useEffect, useState } from "react";
import { ChevronRight, ImageIcon, Search, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import "./holiday-content.css";

type Holiday = { name: string };
type Direction = { title: string; description: string };
type Material = { id: string; title: string; thumbnail: string; preview?: string };
type Result<T> = { status: "loading" | "error" } | { status: "ready"; items: T[] };

const apiBase = import.meta.env.VITE_HOLIDAY_CONTENT_API?.replace(/\/+$/, "");
const materialLimit = 28;

// GET /directions?holiday=... returns { items: Direction[] } from the AI service.
// GET /materials?q=...&limit=28 returns { items: Material[] } from the media library.
async function getItems<T>(path: string, params: URLSearchParams, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(`${apiBase}/${path}?${params}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("获取内容失败");
  const data = await response.json();
  if (!Array.isArray(data?.items)) throw new Error("内容格式有误");
  return data.items;
}

function exampleDirections(holiday: Holiday): Direction[] {
  const { name } = holiday;
  const isSnow = name === "小雪";
  const topics = [
    ["知识科普向", isSnow ? "用一张对比图解释小雪节气与天气预报里的小雪有何区别，再对照南北方的物候变化。" : `用时间线讲清${name}的由来，再用地方档案或采访补充它在本地的变化。`],
    ["情绪共鸣向", isSnow ? "从一罐腌菜或一封写给家人的入冬问候切入，用家乡味道带出冬日记忆。" : `采访一位亲历者，用他的一个具体记忆讲述${name}对个人或社区的意义。`],
    ["实用服务向", isSnow ? "做一张降温出行清单，整理早晚保暖、雨雪防滑和出门前看预报的提醒。" : `整理${name}相关的本地活动、公共服务和可核实信息，做成便于转发的清单。`],
    ["视觉美学向", isSnow ? "以灰蓝、雪白和腊梅黄做节气色卡，搭配雪枝、暖窗等实拍细节设计动态海报。" : `从${name}的场景、器物和代表性色彩中挑选视觉元素，制作一组图卡或摄影特辑。`],
    ["互动参与向", isSnow ? "发起「你那里入冬了吗」照片征集，邀请用户附上城市、拍摄时间与初冬变化。" : `围绕${name}发起照片或故事征集，用一条具体问题引导用户分享地点与亲身经历。`],
    ["人格化 IP 向", isSnow ? "让栏目固定主持人带观众到市场找腌菜食材，再请摊主讲本地的冬藏习俗。" : `让栏目主持人带观众走进一个与${name}有关的现场，用问答串联可连续更新的内容。`],
    ["反差解构向", isSnow ? "用「到了小雪为什么还没下雪」开场，配合两地实拍拆开历法节点与实际天气的区别。" : `挑一个关于${name}的常见误解，用档案、实拍或访谈对照核实。`],
    ["商业转化向", isSnow ? "联动本地菜场或农特产店展示冬藏工序，用季节故事自然带出应季体验与产品。" : `结合${name}的具体场景策划本地文旅或文化体验。遇到纪念、公祭及公共卫生主题，优先采用公益传播。`],
  ];
  return topics.map(([title, description]) => ({ title, description }));
}

const snowSubjects = [
  "雪枝初白", "腊梅与节气签", "冰晶与远山", "水墨留白", "落雪松枝", "枫叶映雪", "蓝调山脊",
  "山村晨雪", "冬日暖窗", "屋檐结霜", "雪后归路", "初冬茶席", "雪落老城", "远山炊烟",
  "枝头新霜", "冬藏手记", "风雪中的行人", "节气色卡", "田间越冬", "蓝白封面", "冬日食单",
  "初雪摄影征集", "入冬生活清单", "雪夜灯影", "小雪明信片", "山河入冬", "节气动效封面", "冷暖对照",
];
const otherSubjects = ["主题海报", "知识图卡", "城市观察", "摄影封面", "活动信息卡", "人物访谈封面", "竖屏短片封面"];
const palettes = [
  ["#173748", "#b8dbdb", "#ead5bd"], ["#6b4223", "#dab56a", "#f5ecd7"], ["#18335c", "#a4bfee", "#ecf8ff"],
  ["#38404c", "#a3a6a0", "#f5f3e9"], ["#34445e", "#95a1b8", "#f2e6ed"], ["#4f2017", "#b56838", "#f4d199"],
  ["#264e66", "#9bc3d7", "#e8f7fb"],
];

function exampleThumbnail(name: string, subject: string, index: number) {
  const [ink, mountain, paper] = palettes[index % palettes.length];
  const offset = (index * 23) % 95;
  const flakes = Array.from({ length: 19 }, (_, point) =>
    `<circle cx="${(point * 53 + index * 19) % 320}" cy="${(point * 31 + index * 11) % 190}" r="${point % 3 + 0.5}" fill="white" opacity=".55"/>`
  ).join("");
  const motifs = [
    '<path d="M0 104Q38 58 93 32M22 76L14 44M47 55L49 20M64 46L89 60" fill="none" stroke="#514138" stroke-width="3"/><g fill="#f0b8ad"><circle cx="14" cy="44" r="6"/><circle cx="49" cy="20" r="7"/><circle cx="89" cy="60" r="6"/></g>',
    '<path d="M320 22Q290 44 242 32" fill="none" stroke="#78552c" stroke-width="4"/><g fill="#f6cf59"><circle cx="247" cy="33" r="10"/><circle cx="265" cy="36" r="7"/><circle cx="290" cy="30" r="9"/></g><path d="M269 39V74" stroke="#78552c"/><rect x="253" y="72" width="32" height="48" rx="5" fill="#ead0a3"/>',
    '<g fill="none" stroke="#fff" opacity=".72"><path d="M45 28v61M19 44l52 30M19 74l52-30M45 28l-6 10m6-10l6 10m-6 51l-6-10m6 10l6-10"/><circle cx="45" cy="58" r="19"/></g>',
    '<path d="M0 173Q29 143 64 155T109 154M0 180Q30 165 90 169" fill="none" stroke="#45484b" stroke-width="3" opacity=".45"/>',
    '<path d="M320 148Q292 88 254 58M280 99l-25-10m24 7l4-25m16 54l-31-10m31 8l7-27" fill="none" stroke="#394d49" stroke-width="5"/>',
    '<path d="M249 157l-15-28 17 6 8-20 10 23 22-8-16 25 8 10-21-4-8 15-2-17z" fill="#d98a35" stroke="#a85623" stroke-width="2"/>',
    '<path d="M6 139q38-8 65 0t67-2m93-14q24-7 51-1t38-1" fill="none" stroke="white" stroke-width="3" opacity=".62"/>',
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${paper}"/><stop offset="1" stop-color="${mountain}"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#sky)"/>
    <circle cx="${65 + offset}" cy="52" r="25" fill="${paper}" opacity=".85"/>
    <path d="M0 154 L${30 + offset} 76 160 151 235 86 320 160V200H0Z" fill="${mountain}"/>
    <path d="M0 172 Q72 128 146 157 T320 149V200H0Z" fill="${ink}" opacity=".7"/>
    <path d="M0 178 Q104 170 163 182 T320 171V200H0Z" fill="${paper}" opacity=".8"/>
    ${name === "小雪" ? flakes : ""}
    ${name === "小雪" ? motifs[index % motifs.length] : ""}
    <text x="160" y="84" text-anchor="middle" fill="${ink}" font-size="${name.length > 9 ? 16 : name.length > 4 ? 21 : 39}" font-family="serif" font-weight="bold">${name}</text>
    <text x="160" y="108" text-anchor="middle" fill="${ink}" font-size="11" font-family="sans-serif" letter-spacing="2">${subject}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function exampleMaterials(query: string, holidays: string[]): Material[] {
  const terms = query.toLowerCase().split(/\s+/);
  return holidays.flatMap((name) => {
    const subjects = name === "小雪" ? snowSubjects : otherSubjects;
    return subjects.flatMap((subject, index) => {
      const title = `${name} · ${subject}`;
      if (!terms.every((term) => title.toLowerCase().includes(term))) return [];
      return [{ id: title, title, thumbnail: exampleThumbnail(name, subject, index) }];
    });
  }).slice(0, materialLimit);
}

export function HolidayContent({ holiday, holidays }: { holiday: Holiday; holidays: string[] }) {
  const [keyword, setKeyword] = useState(holiday.name);
  const [query, setQuery] = useState(holiday.name);
  const [directions, setDirections] = useState<Result<Direction>>({ status: "loading" });
  const [materials, setMaterials] = useState<Result<Material>>({ status: "loading" });
  const [preview, setPreview] = useState<Material | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const [directionsVersion, setDirectionsVersion] = useState(0);

  useEffect(() => {
    if (!apiBase) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ holiday: holiday.name });
    getItems<Direction>("directions", params, controller.signal).then((items) => {
      if (!controller.signal.aborted) setDirections({ status: "ready", items });
    }).catch(() => {
      if (!controller.signal.aborted) setDirections({ status: "error" });
    });
    return () => controller.abort();
  }, [holiday.name, directionsVersion]);

  useEffect(() => {
    if (!apiBase) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, limit: String(materialLimit) });
    getItems<Material>("materials", params, controller.signal).then((items) => {
      if (!controller.signal.aborted) setMaterials({ status: "ready", items: items.slice(0, materialLimit) });
    }).catch(() => {
      if (!controller.signal.aborted) setMaterials({ status: "error" });
    });
    return () => controller.abort();
  }, [query, searchVersion]);

  const directionResult: Result<Direction> = apiBase ? directions : { status: "ready", items: exampleDirections(holiday) };
  const materialResult: Result<Material> = apiBase ? materials : { status: "ready", items: exampleMaterials(query, holidays) };

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = keyword.trim() || holiday.name;
    setKeyword(nextQuery);
    setQuery(nextQuery);
    if (apiBase) {
      setMaterials({ status: "loading" });
      setSearchVersion((version) => version + 1);
    }
  };

  return (
    <>
      <section aria-labelledby="holiday-directions" className="mt-6 border-t border-border pt-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 id="holiday-directions" className="text-sm font-semibold">主流创作方向</h3>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-primary">{apiBase ? "AI 总结" : "AI 总结示例"}</span>
        </div>
        {directionResult.status === "ready" ? (
          directionResult.items.length ? <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/60 px-3 sm:px-4">
            {directionResult.items.map(({ title, description }, index) => (
              <li key={title} className="flex gap-2.5 py-2.5 text-xs leading-relaxed sm:text-sm">
                <span className="w-4 shrink-0 text-right font-semibold tabular-nums text-primary">{index + 1}.</span>
                <p className="min-w-0 text-slate-600"><strong className="mr-2 text-foreground">{title}</strong>{description}</p>
              </li>
            ))}
          </ol> : <p className="text-sm text-muted-foreground">暂无该节日的创作方向。</p>
        ) : directionResult.status === "error" ? (
          <p role="status" className="text-sm text-muted-foreground">创作方向加载失败。<button type="button" className="text-primary" onClick={() => {
            setDirections({ status: "loading" });
            setDirectionsVersion((version) => version + 1);
          }}>重试</button></p>
        ) : <p role="status" className="text-sm text-muted-foreground">正在获取创作方向…</p>}
      </section>

      <section aria-labelledby="holiday-materials" className="holiday-materials mt-6 border-t border-border pb-4 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ImageIcon size={16} className="text-primary" />
            <h3 id="holiday-materials" className="text-sm font-semibold">相关素材</h3>
            {!apiBase && <span className="text-[11px] text-muted-foreground">素材库示例</span>}
          </div>
          <form onSubmit={search} className="flex max-w-full items-center gap-1 rounded-lg border border-border bg-white p-1 focus-within:border-primary">
            <input aria-label="素材库搜索关键词" className="w-36 min-w-0 flex-1 px-2 py-1 text-xs outline-none sm:w-44" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <button type="submit" className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs text-white hover:bg-primary/90"><Search size={13} /> 搜索素材库</button>
          </form>
        </div>
        {materialResult.status === "ready" ? (
          materialResult.items.length ? <ul className="holiday-material-grid grid gap-2.5">
            {materialResult.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <button type="button" onClick={() => setPreview(item)} className="group relative block aspect-[1.6] w-full overflow-hidden rounded-lg bg-slate-100 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-5 text-[11px] text-white">
                    <span className="min-w-0 flex-1 truncate">{item.title}</span><ChevronRight size={13} className="shrink-0" />
                  </span>
                </button>
              </li>
            ))}
          </ul> : <p className="rounded-lg bg-slate-50 py-8 text-center text-sm text-muted-foreground">没有找到与「{query}」相关的素材。</p>
        ) : <p role="status" className="text-sm text-muted-foreground">{materialResult.status === "error" ? "素材加载失败，请重新搜索。" : "正在搜索素材库…"}</p>}
      </section>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
          <DialogTitle>{preview?.title}</DialogTitle>
          {preview && <img src={preview.preview || preview.thumbnail} alt={preview.title} className="max-h-[70dvh] w-full rounded-lg bg-slate-50 object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
