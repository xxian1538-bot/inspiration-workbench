import { useEffect, useRef, useState } from "react";
import { Check, Film, Search, Upload, Video, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  hasVideoSourceApi, parsePlaybackUrl, readPlatformSnapshot, readVideoCatalog, socialChannels, workKey,
  type CatalogSource, type VideoImport, type VideoWork,
} from "./viralVideoSources";

const sources = [
  { id: "local", label: "本地上传" },
  { id: "link", label: "视频链接" },
  { id: "library", label: "媒资库" },
  { id: "subscribed", label: "社媒订阅账号" },
  { id: "latest", label: "最新作品" },
] as const;
type Source = typeof sources[number]["id"];
const fieldClass = "min-h-9 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary";

export function ViralVideoUploadDialog({ demoWorks, onImport }: {
  demoWorks: VideoWork[];
  onImport: (items: VideoImport[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source>("local");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("全部");
  const [library, setLibrary] = useState("personal");
  const [mine, setMine] = useState(false);
  const [selected, setSelected] = useState<VideoWork[]>([]);
  const [catalog, setCatalog] = useState<VideoWork[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "failed">("idle");
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const submission = useRef<AbortController | null>(null);
  const catalogSource = source === "local" || source === "link" ? null : source;
  const showCatalog = Boolean(catalogSource && (source !== "latest" || query));

  useEffect(() => {
    if (!open || !catalogSource || !showCatalog || !hasVideoSourceApi) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ source: catalogSource, q: query });
    if (channel !== "全部") params.set("platform", channel);
    if (catalogSource === "library") {
      params.set("library", library);
      params.set("mine", String(mine));
    }
    setCatalog([]);
    setCatalogState("loading");
    readVideoCatalog(params, controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      setCatalog(items);
      setCatalogState("idle");
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogState("failed");
    });
    return () => controller.abort();
  }, [open, catalogSource, showCatalog, query, channel, library, mine, reload]);

  useEffect(() => () => submission.current?.abort(), []);

  const changeSource = (value: Source) => {
    setSource(value);
    setKeyword("");
    setQuery("");
    setChannel(value === "latest" ? "抖音" : "全部");
    setSelected([]);
    setCatalog([]);
    setCatalogState("idle");
    setError("");
  };

  const changeOpen = (value: boolean) => {
    if (!value) {
      submission.current?.abort();
      submission.current = null;
      setSubmitting(false);
    } else {
      changeSource("local");
      setFile(null);
      setLink("");
      setLibrary("personal");
      setMine(false);
    }
    setOpen(value);
  };

  const sourceWorks = demoWorks.filter((work) => source === "library" ? Boolean(work.library) : !work.library);
  const visibleWorks = !showCatalog ? [] : hasVideoSourceApi ? catalog : sourceWorks.filter((work) =>
    (source === "library" ? work.library === library && (!mine || work.mine) : channel === "全部" || work.platform === channel) &&
    query.toLowerCase().split(/\s+/).every((term) => `${work.title} ${work.account}`.toLowerCase().includes(term))
  );
  const allSelected = visibleWorks.length > 0 && visibleWorks.every((work) =>
    selected.some((item) => workKey(item) === workKey(work))
  );

  const toggleWork = (work: VideoWork) => {
    const key = workKey(work);
    setSelected((current) => current.some((item) => workKey(item) === key)
      ? current.filter((item) => workKey(item) !== key) : [...current, work]);
  };

  const toggleAll = () => {
    const visibleKeys = new Set(visibleWorks.map(workKey));
    setSelected((current) => allSelected
      ? current.filter((item) => !visibleKeys.has(workKey(item)))
      : [...new Map([...current, ...visibleWorks].map((work) => [workKey(work), work])).values()]);
  };

  const chooseFile = (chosen: File | undefined) => {
    if (!chosen) return;
    const valid = chosen.size > 0 && (chosen.type.startsWith("video/") || (!chosen.type && /\.(mp4|mov|m4v|webm|ogv)$/i.test(chosen.name)));
    setError(valid ? "" : "请选择有效的视频文件。");
    setFile(valid ? chosen : null);
  };

  const confirm = async () => {
    if (submission.current) return;
    setError("");
    if (source === "local" && file) {
      onImport([{ kind: "local", file }]);
      changeOpen(false);
      return;
    }
    if (source === "link") {
      const url = parsePlaybackUrl(link);
      if (!url) {
        setError("请输入公开可访问的 HTTP(S) .mp4 播放地址。");
        return;
      }
      onImport([{ kind: "link", url }]);
      changeOpen(false);
      return;
    }
    if (!catalogSource || !selected.length) return;

    const controller = new AbortController();
    submission.current = controller;
    setSubmitting(true);
    try {
      const items = await Promise.all(selected.map(async (work): Promise<VideoImport> => ({
        kind: catalogSource,
        work,
        demo: !hasVideoSourceApi,
        snapshot: hasVideoSourceApi && catalogSource !== "library"
          ? await readPlatformSnapshot(work, controller.signal).catch(() => undefined)
          : undefined,
      })));
      if (controller.signal.aborted) return;
      onImport(items);
      changeOpen(false);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : "获取作品数据失败，请重试。");
        controller.abort();
      }
    } finally {
      if (submission.current === controller) {
        submission.current = null;
        setSubmitting(false);
      }
    }
  };

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery(keyword.trim());
  };

  const canConfirm = source === "local" ? Boolean(file) : source === "link" ? Boolean(link.trim()) : selected.length > 0;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs text-white hover:bg-primary/90">
          <Upload size={13} /> 上传视频
        </button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(86dvh,760px)] w-[min(calc(100%-1.5rem),1080px)] max-w-none flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-none [&>button]:hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">上传视频</DialogTitle>
        <Tabs value={source} onValueChange={(value) => changeSource(value as Source)} className="min-h-0 flex-1 gap-0">
          <div className="flex shrink-0 items-center border-b border-border px-3 sm:px-5">
            <TabsList aria-label="视频来源" className="h-auto min-w-0 justify-start gap-3 overflow-x-auto rounded-none bg-transparent p-0 sm:gap-6">
              {sources.map(({ id, label }) => (
                <TabsTrigger key={id} value={id} disabled={submitting} className="flex-none rounded-none border-0 border-b-2 border-transparent px-0 py-4 text-sm text-slate-500 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <DialogClose aria-label="关闭上传弹窗" className="ml-auto shrink-0 p-2 text-slate-500 hover:text-foreground"><X size={18} /></DialogClose>
          </div>
          <TabsContent value="local" className="min-h-0 overflow-y-auto bg-slate-50 p-5 sm:p-7">
            <input ref={picker} type="file" accept="video/*,.m4v,.mov" hidden onChange={(event) => {
              chooseFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }} />
            <button type="button" onClick={() => picker.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0]);
            }} className="flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border border-transparent bg-white px-4 py-8 text-sm text-slate-600 hover:border-primary/40">
              <span className="rounded-2xl bg-blue-50 p-4 text-primary"><Upload size={30} /></span>
              {file ? <span className="max-w-full break-all font-semibold text-foreground">{file.name}</span> : "点击上传文件"}
              <span className="text-xs text-muted-foreground">{file ? "点击更换视频" : "也可将视频拖到此处"}</span>
            </button>
          </TabsContent>
          <TabsContent value="link" className="min-h-0 overflow-y-auto bg-slate-50 p-5 sm:p-7">
            <label className="block text-sm font-medium">视频播放链接
              <input value={link} onChange={(event) => { setLink(event.target.value); setError(""); }} placeholder="请输入可直接播放的 HTTP(S) .mp4 地址" className={`${fieldClass} mt-3 block w-full`} />
            </label>
            <p className="mt-3 text-xs text-muted-foreground">仅支持公开可访问的 MP4 播放链接，抖音、B站作品页面和内网地址无法使用此入口。</p>
          </TabsContent>
          {(["library", "subscribed", "latest"] as CatalogSource[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="min-h-0 overflow-y-auto bg-slate-50">
              {source === tab && (
                <div className={tab === "subscribed" ? "flex min-h-full flex-col sm:flex-row" : "min-h-full"}>
                  {tab === "subscribed" && (
                    <aside className="shrink-0 border-b border-border p-3 sm:w-40 sm:border-r sm:border-b-0">
                      <p className="px-2 pb-2 text-xs font-semibold text-slate-600">已订阅渠道</p>
                      <div className="flex flex-wrap gap-1 sm:flex-col">
                        {["全部", ...socialChannels].map((platform) => (
                          <button key={platform} disabled={submitting} aria-pressed={channel === platform} onClick={() => setChannel(platform)} className="rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-blue-50 aria-pressed:bg-blue-100 aria-pressed:text-primary">{platform}</button>
                        ))}
                      </div>
                    </aside>
                  )}
                  <div className="min-w-0 flex-1 p-4 sm:p-5">
                    <form onSubmit={search} className="mb-4 flex flex-wrap items-center gap-3">
                      {tab === "library" && <>
                        <select aria-label="选择媒资库" value={library} onChange={(event) => setLibrary(event.target.value)} className={fieldClass}><option value="personal">个人库</option><option value="team">团队库</option></select>
                        <span className="rounded-lg border border-border bg-slate-100 px-3 py-2 text-sm text-muted-foreground">视频</span>
                        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} /> 只看我的</label>
                      </>}
                      {tab === "latest" && (
                        <select aria-label="选择平台" disabled={submitting} value={channel} onChange={(event) => setChannel(event.target.value)} className={fieldClass}>
                          <option>全部</option>{socialChannels.map((platform) => <option key={platform}>{platform}</option>)}
                        </select>
                      )}
                      <div className="flex min-w-36 flex-1 items-center gap-2">
                        <input aria-label="搜索视频作品" value={keyword} disabled={submitting} onChange={(event) => setKeyword(event.target.value)} placeholder={tab === "subscribed" ? "多个关键词使用空格分隔" : "请输入关键词搜索"} className={`${fieldClass} min-w-0 flex-1`} />
                        <button type="submit" disabled={submitting} aria-label="搜索" className="rounded-lg bg-primary p-2.5 text-white"><Search size={16} /></button>
                      </div>
                      {tab !== "library" && <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={!visibleWorks.length || submitting} checked={allSelected} onChange={toggleAll} /> 全选</label>}
                    </form>
                    {!hasVideoSourceApi && <p className="mb-3 text-xs text-muted-foreground">当前显示原型示例，连接来源服务后可查看真实作品。</p>}
                    {hasVideoSourceApi && showCatalog && catalogState === "loading" ? <p role="status" className="py-16 text-center text-sm text-muted-foreground">正在加载作品…</p>
                      : hasVideoSourceApi && showCatalog && catalogState === "failed" ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                          作品加载失败。<button type="button" onClick={() => setReload((value) => value + 1)} className="text-primary">重试</button>
                        </div>
                      ) : visibleWorks.length ? (
                        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {visibleWorks.map((work) => {
                            const key = workKey(work);
                            const checked = selected.some((item) => workKey(item) === key);
                            return (
                              <button key={key} type="button" aria-pressed={checked} disabled={submitting} onClick={() => toggleWork(work)} className="group relative min-w-0 overflow-hidden rounded-xl border border-border bg-white text-left hover:border-primary/50 aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary">
                                <div className="relative aspect-video overflow-hidden bg-slate-100">
                                  {work.cover ? <img src={work.cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Film className="absolute inset-0 m-auto text-slate-400" size={28} />}
                                  <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white"><Video size={12} />{work.duration}</span>
                                  {checked && <span className="absolute top-2 right-2 rounded-full bg-primary p-1 text-white"><Check size={14} /></span>}
                                </div>
                                <div className="p-2.5">
                                  <p className="line-clamp-2 text-sm font-semibold">{work.title}</p>
                                  <p className="mt-1 truncate text-xs text-muted-foreground">{[work.account, work.publishedAt].filter(Boolean).join(" · ")}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
                          <span className="rounded-2xl bg-blue-50 p-4 text-primary"><Search size={26} /></span>
                          {tab === "latest" && !query ? "请输入关键词后搜索" : "没有符合条件的视频"}
                        </div>
                      )}
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-white px-4 py-3">
          {error && <p role="alert" className="mr-auto text-xs text-red-600">{error}</p>}
          {!error && selected.length > 0 && <span className="mr-auto text-xs text-muted-foreground">已选 {selected.length} 个作品</span>}
          <DialogClose className="rounded-lg border border-border bg-slate-50 px-4 py-2 text-sm text-slate-600">关闭</DialogClose>
          <button type="button" disabled={!canConfirm || submitting} onClick={confirm} className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:bg-slate-200 disabled:text-slate-500">
            {submitting ? "正在同步作品数据…" : "确定"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
