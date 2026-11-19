import { useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { previewUsers } from "./HotspotFeatures";

export function AlertRecipientPicker({ selected, onChange }: { selected: string[]; onChange: (users: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const colors = ["#626f83", "#ffbf00", "#238cf5"];
  const toggle = (user: string) => onChange(selected.includes(user) ? selected.filter((value) => value !== user) : [...selected, user]);
  return <section className="relative mt-6 space-y-3 border-t border-border pt-5">
    <h3 className="text-xs font-medium">预警通知对象</h3>
    <div className="flex flex-wrap items-start gap-5">
      {selected.map((user, index) => {
        const name = user.split(" · ")[0];
        return <div key={user} className="group relative flex w-20 flex-col items-center gap-2">
          <div style={{ backgroundColor: colors[index % colors.length] }} className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold text-white">{name.slice(-2)}</div>
          <span className="max-w-full truncate text-sm" title={user}>{name}</span>
          <button type="button" aria-label={`移除通知对象${name}`} onClick={() => toggle(user)} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-muted-foreground hover:text-red-600"><X size={12} /></button>
        </div>;
      })}
      <button type="button" aria-label="添加预警通知对象" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex w-20 flex-col items-center gap-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-slate-50 text-slate-500 shadow-sm hover:border-primary hover:text-primary"><Plus size={28} strokeWidth={1.5} /></span>
      </button>
    </div>
    {open && <div className="max-w-md rounded-xl border border-border bg-white p-3 shadow-lg">
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border px-2 py-1.5"><Search size={14} className="text-muted-foreground" /><input aria-label="搜索通知对象" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名或角色" className="w-full text-xs outline-none" /></div>
      <p className="mb-2 text-[11px] text-muted-foreground">系统用户样例</p>
      {previewUsers.filter((user) => user.includes(query.trim())).map((user) => <button type="button" key={user} aria-pressed={selected.includes(user)} onClick={() => toggle(user)}
        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-muted"><span>{user}</span>{selected.includes(user) && <Check size={14} className="text-primary" />}</button>)}
      {!previewUsers.some((user) => user.includes(query.trim())) && <p className="py-3 text-xs text-muted-foreground">未找到匹配用户</p>}
      <button type="button" onClick={() => setOpen(false)} className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs text-white">完成</button>
    </div>}
  </section>;
}
