/**
 * E2E 시작 전 한 번(#9): 로컬 Supabase 주소·키를 읽어 시험에 넘기고, 같은 날 여러 번 돌려도 익명 픽 접속 한도에 걸리지 않게 비운다.
 * 로컬 주소(127.0.0.1·localhost)가 아니거나, SQL 이 닿은 DB 에 운영 발송 주소가 있으면 멈춘다(운영 DB 를 건드리지 않게).
 */
import { localEnv, sql } from "./support";

export default async function globalSetup() {
  const env = localEnv();
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.API_URL)) throw new Error(`로컬 Supabase 가 아니에요: ${env.API_URL}`);
  // sql() 은 `supabase db query`(기본이 로컬 DB)로 간다. 위 주소 검사와 근거가 달라 한 번 더 본다:
  // 운영 DB 에만 발송 주소(Vault project_url)가 있다. 있으면 아무것도 바꾸기 전에 멈춘다(#48 보안 리뷰)
  const remote = sql<{ remote: boolean }>("select exists (select 1 from vault.secrets where name = 'project_url') as remote")[0]?.remote;
  if (remote !== false) throw new Error("sql() 이 로컬 DB 가 아닌 곳(발송 주소가 있는 DB)에 닿았어요. 시험을 멈춰요");
  sql("delete from public.anon_ip_daily");
}
