/**
 * 관리자 화면(#6, 기획서 4절 "신고와 관리자 화면", 설계서 5절).
 * - profiles.is_admin 인 회원만 본다. 아니면 404(관리자 화면이 있다는 것도 알리지 않는다).
 * - 진짜 권한은 DB 함수(require_admin)와 Edge Function(admin-purge-user)이 다시 확인한다. 여기는 화면을 고르는 데만.
 * - 처리 안 된 신고를 대상별로 묶어 신고 많은 순으로 보여 준다. 동작은 AdminActions(숨기기·되살리기·문제없음·계정 정리).
 * - 댓글 신고 줄에는 그 댓글에 글 주인이 단 답글도 보인다. 답글만 문제면 "답글만 지우기"(#40, 답글은 따로 신고하지 않는다).
 * - 숨기면 신고가 닫혀 목록에서 빠지므로, 아래 "최근 숨긴 것"(14일)에서 잘못 숨긴 것을 되살린다.
 * - "결선 대기 성과"(#43): 최근 4주, 주마다 응원단·주인 답글·데뷔 평가 알림 클릭·응원단 로그인 시트 수(admin_revisit_stats).
 * - 맨 아래 "라운드 결과": 최근 끝난 라운드와 확정 여부. 신고로 글을 숨긴 뒤 RecalcButton 으로 다시 센다(#7).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { memberId } from "@/features/auth/server";
import { LoginButton } from "@/features/auth/LoginButton";
import { SiteNav } from "@/features/entries/SiteNav";
import { BOARD_NAME, roundName, timeAgo, type Board } from "@/shared/lib/format";
import { createClient } from "@/shared/lib/supabase/server";
import { photoUrl } from "@/shared/lib/supabase/env";
import { TopBar, page } from "@/shared/ui/TopBar";
import { AdminActions } from "./AdminActions";
import { RecalcButton } from "./RecalcButton";
import s from "./admin.module.css";

/** 결선 대기 성과 표의 줄(#43). 좁은 화면에서도 한 화면에 들어오게 주를 열로, 항목을 줄로 둔다 */
const REVISIT_ROWS = [
  ["응원단 들어옴", "cheers"],
  ["주인 답글", "replies"],
  ["데뷔 평가 알림 클릭", "final_open_clicks"],
  ["응원단 로그인 안내", "cheer_sheets"],
] as const;

export async function AdminPage() {
  const supabase = await createClient();
  const uid = await memberId(supabase);
  if (!uid) notFound();
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  if (!me?.is_admin) notFound();
  const [{ data: rows, error }, { data: hiddenRows }, { data: rounds }, { data: revisit }] = await Promise.all([
    supabase.rpc("admin_reports", { p_limit: 100 }),
    supabase.rpc("admin_recent_hidden", { p_days: 14 }),
    supabase.rpc("admin_rounds", { p_limit: 8 }),
    supabase.rpc("admin_revisit_stats", { p_weeks: 4 }),
  ]);

  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav />} login={<LoginButton />} />
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
                {r.reply_body ? (
                  <p className={s.reply}>
                    <b>글 주인 답글</b> “{r.reply_body}”
                  </p>
                ) : null}
                <p className={s.meta}>작성자 {r.author_name ?? "(탈퇴 또는 프로필 없음)"}{r.reasons?.length ? ` · 사유: ${r.reasons.join(" / ")}` : ""}</p>
                <AdminActions target={r.target} targetId={r.target_id} hidden={r.hidden} deleted={r.deleted} authorId={r.author_id} authorName={r.author_name} self={r.author_id === uid} hasReply={!!r.reply_body} />
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
      <h2 className={s.h2}>결선 대기 성과</h2>
      <p className={s.lead}>결선 진출자가 다시 오게 하는 장치(응원단·주인 답글·데뷔 평가 알림)가 얼마나 쓰이는지 주마다 세요. 왼쪽이 이번 주예요.</p>
      {revisit?.length ? (
        <div className={s.tableWrap} tabIndex={0} role="region" aria-label="결선 대기 성과 표">
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">주(월요일부터)</th>
                {revisit.map((w) => (
                  <th scope="col" key={w.week_start}>{`${Number(w.week_start.slice(5, 7))}/${Number(w.week_start.slice(8, 10))}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REVISIT_ROWS.map(([label, key]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {revisit.map((w) => (
                    <td key={w.week_start}>{w[key].toLocaleString("ko-KR")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={s.empty}>숫자를 읽지 못했어요. 새로고침해 주세요.</p>
      )}
      <p className={s.meta}>응원단은 지금 남아 있는 사람만 세요(나가면 빠져요). 알림 클릭은 푸시·알림함을 합친 수예요.</p>
      <h2 className={s.h2}>라운드 결과</h2>
      <p className={s.lead}>결과는 매일 0시에 자동으로 확정돼요. 신고로 글을 숨긴 뒤에는 여기서 다시 계산해 주세요.</p>
      {!rounds?.length ? <p className={s.empty}>끝난 라운드가 아직 없어요.</p> : null}
      <ul className={s.list}>
        {(rounds ?? []).map((r) => {
          const title = `${Number(r.month.slice(5, 7))}월 ${roundName(r.kind, r.seq)}`;
          const tops = (Array.isArray(r.tops) ? r.tops : []) as { board: Board; rank: number; pet_name: string }[];
          const quiet = r.exposure_over; // DB result_exposure_over(결과 확정이 알림을 넣을지와 같은 기준)
          return (
            <li key={`r-${r.id}`} className={s.row}>
              <div className={s.body}>
                <p className={s.what}>{title}</p>
                <p className={s.meta}>
                  {r.finalized_at ? `${timeAgo(r.finalized_at)} 확정 · 결과 ${r.results}줄` : "아직 확정 전(다음 0시에 확정)"}
                  {quiet ? " · 노출 끝남" : ""}
                </p>
                {tops.length ? (
                  <p className={s.meta}>
                    {(["dog", "cat"] as const)
                      .map((b) => tops.filter((t) => t.board === b))
                      .filter((list) => list.length)
                      .map((list) => `${BOARD_NAME[list[0].board]} ${list.map((t) => `${t.rank}위 ${t.pet_name}`).join(" · ")}`)
                      .join(" / ")}
                  </p>
                ) : null}
                <div className={s.actions}>
                  <RecalcButton roundId={r.id} title={title} finalized={!!r.finalized_at} quiet={quiet} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
