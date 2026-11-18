/**
 * 관리자 화면(#6, 기획서 4절 "신고와 관리자 화면", 설계서 5절).
 * - profiles.is_admin 인 회원만 본다. 아니면 404(관리자 화면이 있다는 것도 알리지 않는다).
 * - 진짜 권한은 DB 함수(require_admin)와 Edge Function(admin-purge-user)이 다시 확인한다. 여기는 화면을 고르는 데만.
 * - 처리 안 된 신고를 대상별로 묶어 신고 많은 순으로 보여 준다. 동작은 AdminActions(숨기기·되살리기·문제없음·계정 정리).
 * - 숨기면 신고가 닫혀 목록에서 빠지므로, 아래 "최근 숨긴 것"(14일)에서 잘못 숨긴 것을 되살린다.
 * - 라운드 결과 다시 계산은 결과 확정(#7)과 함께 붙인다.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { memberId } from "@/features/auth/server";
import { LoginButton } from "@/features/auth/LoginButton";
import { SiteNav } from "@/features/entries/SiteNav";
import { PicksLeft } from "@/features/picks/PicksLeft";
import { BOARD_NAME, timeAgo } from "@/shared/lib/format";
import { createClient } from "@/shared/lib/supabase/server";
import { photoUrl } from "@/shared/lib/supabase/env";
import { TopBar, page } from "@/shared/ui/TopBar";
import { AdminActions } from "./AdminActions";
import s from "./admin.module.css";

export async function AdminPage() {
  const supabase = await createClient();
  const uid = await memberId(supabase);
  if (!uid) notFound();
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  if (!me?.is_admin) notFound();
  const [{ data: rows, error }, { data: hiddenRows }] = await Promise.all([
    supabase.rpc("admin_reports", { p_limit: 100 }),
    supabase.rpc("admin_recent_hidden", { p_days: 14 }),
  ]);

  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav />} right={<PicksLeft />} login={<LoginButton />} />
      <h1 className={s.title}>신고 처리</h1>
      <p className={s.lead}>처리 안 된 신고를 대상별로 모았어요. 숨기면 게시판·상세·센터·결과 계산에서 빠지고, 신고는 처리됨으로 닫혀요.</p>
      {error ? <p className={s.lead}>신고 목록을 읽지 못했어요. 새로고침해 주세요.</p> : null}
      {!error && !rows?.length ? <p className={s.empty}>처리할 신고가 없어요.</p> : null}
      <ul className={s.list}>
        {(rows ?? []).map((r) => {
          const href = r.entry_id && r.board ? `/${r.board}/${r.entry_id}` : null;
          const thumb = photoUrl(r.thumb_path);
          return (
            <li key={`${r.target}-${r.target_id}`} className={s.row}>
              {thumb ? <img src={thumb} alt="" className={s.thumb} loading="lazy" /> : <span className={s.thumb} aria-hidden="true" />}
              <div className={s.body}>
                <p className={s.meta}>
                  <b>{r.target === "entry" ? "글" : "댓글"}</b> · 신고 {r.reports}건 · {timeAgo(r.last_at)}
                  {r.hidden ? " · 숨김 중" : ""}
                  {r.deleted ? " · 주인이 지움" : ""}
                </p>
                <p className={s.what}>
                  {r.target === "comment" ? <>“{r.body}”</> : null}
                  {href ? (
                    <>
                      {" "}
                      <Link href={href}>
                        {r.board ? BOARD_NAME[r.board] : ""} ‘{r.pet_name}’ {r.target === "comment" ? "글의 댓글" : "글 보기"}
                      </Link>
                    </>
                  ) : null}
                </p>
                <p className={s.meta}>작성자 {r.author_name ?? "(탈퇴 또는 프로필 없음)"}{r.reasons?.length ? ` · 사유: ${r.reasons.join(" / ")}` : ""}</p>
                <AdminActions target={r.target} targetId={r.target_id} hidden={r.hidden} deleted={r.deleted} authorId={r.author_id} authorName={r.author_name} self={r.author_id === uid} />
              </div>
            </li>
          );
        })}
      </ul>
      <h2 className={s.h2}>최근 숨긴 것</h2>
      <p className={s.lead}>지난 14일 동안 숨긴 글·댓글이에요. 잘못 숨겼으면 되살려 주세요.</p>
      {!hiddenRows?.length ? <p className={s.empty}>최근 숨긴 것이 없어요.</p> : null}
      <ul className={s.list}>
        {(hiddenRows ?? []).map((h) => {
          const thumb = photoUrl(h.thumb_path);
          return (
            <li key={`h-${h.target}-${h.target_id}`} className={s.row}>
              {thumb ? <img src={thumb} alt="" className={s.thumb} loading="lazy" /> : <span className={s.thumb} aria-hidden="true" />}
              <div className={s.body}>
                <p className={s.meta}>
                  <b>{h.target === "entry" ? "글" : "댓글"}</b> · {timeAgo(h.hidden_at)} 숨김
                </p>
                <p className={s.what}>
                  {h.target === "comment" ? <>“{h.body}” </> : null}
                  {BOARD_NAME[h.board]} ‘{h.pet_name}’{h.target === "comment" ? " 글의 댓글" : ""}
                </p>
                <p className={s.meta}>작성자 {h.author_name ?? "(탈퇴 또는 프로필 없음)"}</p>
                <AdminActions target={h.target} targetId={h.target_id} hidden deleted={false} authorId={null} authorName={null} self={false} restoreOnly />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
