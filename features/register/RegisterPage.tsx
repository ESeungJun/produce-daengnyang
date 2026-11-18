/**
 * 연습생 등록 화면(/register). 서버에서 라운드와 "이번 라운드에 몇 번 더 올릴 수 있나"(my_entries_left: 지운 글까지 셈)를 읽는다.
 * 올릴 수 없는 때(라운드 없음·데뷔 평가 기간·두 번 다 씀)는 폼 대신 안내를 먼저 보여 준다(다 쓴 뒤에 막히지 않게).
 * 로그인 전이어도 폼은 보여 준다(쓰는 내용은 임시 저장되고, 등록을 누르면 로그인 시트가 뜬다. 기획서 7절 흐름).
 */
import Link from "next/link";
import { createClient } from "@/shared/lib/supabase/server";
import { deadlineLabel } from "@/shared/lib/format";
import { TopBar, page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { InAppNotice } from "@/features/auth/InAppNotice";
import { LoginButton } from "@/features/auth/LoginButton";
import { memberId } from "@/features/auth/server";
import { SiteNav } from "@/features/entries/SiteNav";
import { PicksLeft } from "@/features/picks/PicksLeft";
import { loadOpenRound } from "@/features/rounds/api";
import { roundTitle } from "@/features/rounds/schedule";
import { RegisterForm } from "./RegisterForm";
import s from "./register.module.css";

/** 한 사람이 한 라운드에 올릴 수 있는 글 수(create_entry entry_limit 과 같음) */
const ROUND_LIMIT = 2;

/** 한국 날짜의 "일" */
const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).getUTCDate();

export async function RegisterPage() {
  const supabase = await createClient();
  const [round, uid] = await Promise.all([loadOpenRound(supabase), memberId(supabase)]);
  let left = ROUND_LIMIT;
  if (uid && round?.kind === "weekly") {
    const { data } = await supabase.rpc("my_entries_left");
    left = typeof data === "number" ? data : ROUND_LIMIT;
  }
  // 주간 1·2라운드가 끝나면 바로 다음 주간이, 3라운드 뒤에는 결선이라 다음 달 1일에 열린다
  const nextOpen = round && round.kind === "weekly" && round.seq < 3 ? `${kstDay(round.ends_at)}일` : "다음 달 1일";
  const closed = !round
    ? { title: "지금은 열린 라운드가 없어요", body: "다음 라운드가 열리면 올릴 수 있어요." }
    : round.kind === "final"
      ? { title: "지금은 데뷔 평가 기간이에요", body: "결선 동안은 등록을 쉬어요. 다음 달 1일부터 다시 받아요." }
      : left === 0
        ? { title: "이번 라운드에는 두 번 다 올렸어요", body: `지운 글도 횟수에 들어가요. 다음 라운드는 ${nextOpen}에 열려요.` }
        : null;

  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav current="register" />} right={<PicksLeft />} login={<LoginButton />} />
      <div className={s.head}>
        <h1>연습생 등록</h1>
        <p>{round && round.kind === "weekly" ? `${roundTitle(round)} · ${deadlineLabel(round.ends_at)}` : "사진 한 장이면 충분해요"}</p>
      </div>
      {closed ? (
        <div className={s.closed} role="status">
          <p className={s.closedTitle}>{closed.title}</p>
          <p>{closed.body}</p>
          <div className={page.noticeAct}>
            <Link className={ui.pill} href="/dog">
              게시판 구경하기
            </Link>
            {uid ? (
              <Link className={ui.ghost} href="/me">
                내가 올린 아이 보기
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {/* 로그인 전이면 앱 안 브라우저 안내를 먼저(다 쓰고 나서 로그인에서 막히지 않게) */}
          {uid ? null : <InAppNotice />}
          <RegisterForm mode="create" left={left} />
        </>
      )}
    </div>
  );
}
