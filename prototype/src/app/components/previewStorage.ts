import { useState } from "react";

const localPrefix = "inspiration-preview:";
const sessionValues = new Map<string, unknown>();

function readSetting<T>(key: string, fallback: T): T {
  if (sessionValues.has(key)) return sessionValues.get(key) as T;
  try {
    const stored = localStorage.getItem(localPrefix + key);
    if (stored !== null) return JSON.parse(stored) as T;
  } catch {
    // The in-memory value still works when storage is restricted.
  }
  return fallback;
}

function saveSetting<T>(key: string, value: T): boolean {
  sessionValues.set(key, value);
  try {
    localStorage.setItem(localPrefix + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function usePreviewSettings<T>(key: string, defaults: T) {
  const [value, setValue] = useState(() => readSetting(key, defaults));
  const [feedback, setFeedback] = useState("");
  const save = (next: T, asBasePackage = false) => {
    setValue(next);
    const saved = saveSetting(key, next);
    const baseSaved = !asBasePackage || saveSetting(key + ":base-package", next);
    setFeedback(!saved || !baseSaved ? "浏览器存储不可用，当前修改仅在本次预览中有效。"
      : asBasePackage ? "已保存为本地基础数据包" : "已保存数据源设置");
  };
  return [value, save, feedback] as const;
}

const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" });

export function newsroomDaysBefore(days: number, now = new Date()) {
  const today = new Date(dayFormat.format(now) + "T00:00:00Z");
  today.setUTCDate(today.getUTCDate() - days);
  return today.toISOString().slice(0, 10);
}

export function dateMatches(date: string, filter: string, today = newsroomDaysBefore(0)) {
  if (filter === "all") return true;
  const days = filter === "yesterday" ? 1 : filter === "3days" ? 2 : filter === "7days" ? 6 : 0;
  const start = new Date(today + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - days);
  const lower = start.toISOString().slice(0, 10);
  return filter === "yesterday" ? date === lower : date >= lower && date <= today;
}

function videoTaskStore<T>(mode: IDBTransactionMode, request: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const opening = indexedDB.open("inspiration-preview", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("video-tasks", { keyPath: "id" });
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error("浏览器任务库暂不可用"));
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction("video-tasks", mode);
      const result = request(transaction.objectStore("video-tasks"));
      transaction.oncomplete = () => { db.close(); resolve(result.result); };
      transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("任务保存失败")); };
    };
  });
}

export const readPreviewVideoTasks = <T>() => videoTaskStore<T[]>("readonly", (store) => store.getAll());
export const savePreviewVideoTask = (task: { id: string | number }) => videoTaskStore("readwrite", (store) => store.put(task));
