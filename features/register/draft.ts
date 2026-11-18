"use client";
/**
 * 등록 임시 저장(이 기기에만, 설계서 5절). 글자는 localStorage, 사진(다시 그린 WebP)은 IndexedDB.
 * 로그인 시트를 다녀오거나 창을 닫았다 와도 이어 쓴다. 등록하면·로그아웃하면 지운다(clearDraft).
 * 저장소를 못 쓰는 환경(사생활 보호 창 등)에서는 조용히 넘어간다. 임시 저장은 편의 기능이라 실패해도 등록은 된다.
 */
import type { Board } from "@/shared/lib/format";
import type { ProcessedPhoto } from "./photo";

export type DraftText = { board: Board; name: string; bio: string; instagram: string; threads: string; youtube: string };

const TEXT_KEY = "pd_register_draft";
const DB = "pd-register";
const STORE = "photos";
const PHOTOS_KEY = "draft";

export function loadDraftText(): DraftText | null {
  try {
    const v = localStorage.getItem(TEXT_KEY);
    if (!v) return null;
    // 형식이 바뀌었거나 깨진 값이면 쓰지 않는다(빠진 칸 때문에 화면이 깨지지 않게)
    const d = JSON.parse(v) as Partial<DraftText>;
    const str = (x: unknown) => (typeof x === "string" ? x : "");
    return {
      board: d.board === "cat" ? "cat" : "dog",
      name: str(d.name),
      bio: str(d.bio),
      instagram: str(d.instagram),
      threads: str(d.threads),
      youtube: str(d.youtube),
    };
  } catch {
    return null;
  }
}

export function saveDraftText(t: DraftText): void {
  try {
    localStorage.setItem(TEXT_KEY, JSON.stringify(t));
  } catch {
    /* 저장 공간이 없거나 막힘 */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T>((resolve, reject) => {
      const r = run(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }).finally(() => db.close());
  } catch {
    return undefined;
  }
}

export async function loadDraftPhotos(): Promise<ProcessedPhoto[]> {
  const v = await tx<ProcessedPhoto[]>("readonly", (s) => s.get(PHOTOS_KEY));
  return Array.isArray(v) ? v.filter((p) => p?.big instanceof Blob && p?.thumb instanceof Blob) : [];
}

export async function saveDraftPhotos(photos: ProcessedPhoto[]): Promise<void> {
  await tx("readwrite", (s) => s.put(photos, PHOTOS_KEY));
}

export async function clearDraft(): Promise<void> {
  try {
    localStorage.removeItem(TEXT_KEY);
  } catch {
    /* 무시 */
  }
  await tx("readwrite", (s) => s.delete(PHOTOS_KEY));
}
