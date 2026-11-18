/**
 * 브라우저용 Supabase 클라이언트(픽 보내기, 게시판 이어 불러오기). 한 탭에 하나만 만든다.
 */
"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function browserClient() {
  if (!client) {
    const { url, key } = supabaseEnv();
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
