/**
 * 메인 = 그달 호 한 권: 표지(데뷔) → 목차 → 센터 화보 → 라운드 차트 → 데뷔조 후보 → 모집 공고 → 맨 아래 제호.
 * 데이터 네 가지를 한꺼번에 받는다(get_featured, 지금 라운드, 강아지·고양이 차트 4줄씩).
 */
import { BOARD_NAME, deadlineLabel, issueLabel, roundName } from "@/shared/lib/format";
import Link from "next/link";
import { createClient } from "@/shared/lib/supabase/server";
import { Colophon, SectionHead, Toc, type TocItem } from "@/shared/ui/parts";
import { TopBar, page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { LoginButton } from "@/features/auth/LoginButton";
import { loadBoard } from "@/features/entries/api";
import { RecruitAd } from "@/features/entries/RecruitAd";
import { SiteNav } from "@/features/entries/SiteNav";
import { PicksLeft } from "@/features/picks/PicksLeft";
import { Band } from "@/features/rounds/Band";
import { Chart } from "@/features/rounds/Chart";
import { loadOpenRound } from "@/features/rounds/api";
import { isBlind } from "@/features/rounds/schedule";
import { Cover } from "./Cover";
import { getFeatured } from "./server";
import { CenterSpread, Polaroids } from "./Spread";
import s from "./main.module.css";

export async function MainPage() {
  const supabase = await createClient();
  const [featured, round, dog, cat] = await Promise.all([
    getFeatured(),
    loadOpenRound(supabase),
    loadBoard(supabase, "dog", { limit: 4 }),
    loadBoard(supabase, "cat", { limit: 4 }),
  ]);
  const issue = issueLabel(featured.month);
  const monthNo = Number(featured.month.slice(5, 7));
  const debutMonth = monthNo === 1 ? 12 : monthNo - 1;
  const center = featured.center;
  // 이번 달 지난 라운드 1위(= 그 라운드 센터). 후보 목록에서 지금 센터를 빼고 최근 라운드부터.
  const pastCenters = featured.finalists.filter((f) => f.pos === 1 && !center.some((c) => c.entry_id === f.entry_id));
  const blind = round ? isBlind(round) : false;
  const chartTitle = round ? `${roundName(round.kind, round.seq)} 차트` : "라운드 차트";

  const toc: TocItem[] = [
    { href: "#center", title: "이번 주 센터 화보", note: center.length ? center.map((c) => c.pet_name).join(" · ") : "첫 센터를 기다려요" },
    { href: "#chart", title: chartTitle, note: round ? deadlineLabel(round.ends_at) : "다음 라운드 준비 중" },
    { href: "#finalists", title: "데뷔조 후보", note: "22일부터 데뷔 평가" },
    { href: "#recruit", title: "연습생 모집", note: "라운드마다 2번까지" },
    { href: "/hall", title: "명예의 전당", note: "지난 센터·데뷔 모음" },
  ];

  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav />} right={<PicksLeft />} login={<LoginButton />} />
      <div className={page.bleed}>
        <Cover issue={issue} debutMonth={String(debutMonth)} debut={featured.debut} toc={<Toc heading={`${monthNo}월호 목차`} items={toc} className={s.toc} />} />
      </div>

      <section aria-labelledby="center">
        <SectionHead
          id="center"
          title="이번 주 센터 화보"
          sub={center.length ? `${center[0].round_seq}라운드 1위. 다음 라운드 내내 사이트 곳곳에 걸려요.` : "첫 라운드가 끝나면 댕댕이·냥이 1위가 여기 걸려요."}
        />
        {center.length ? <CenterSpread center={center} past={pastCenters} /> : null}
      </section>

      <section aria-labelledby="chart">
        <SectionHead
          id="chart"
          title={chartTitle}
          sub={round ? `${BOARD_NAME.dog}·${BOARD_NAME.cat} 따로, 게시판마다 하루 3픽. 같은 아이는 하루 한 번.` : "다음 라운드를 준비하고 있어요."}
        />
        {round ? (
          <>
            <Band endsAt={round.ends_at} label={blind ? "마감까지 · 지금은 순위를 가려요" : "마감까지"} />
            <Chart lists={{ dog, cat }} />
          </>
        ) : null}
      </section>

      <section aria-labelledby="finalists">
        <SectionHead
          id="finalists"
          title="데뷔조 후보"
          sub={featured.finalists.length ? "주간 1·2위만 오를 수 있어요. 22일부터 게시판마다 1마리가 데뷔해요." : "1라운드가 끝나면 첫 후보가 여기 걸려요."}
        />
        <div className={s.bottom}>
          {featured.finalists.length ? <Polaroids items={featured.finalists} /> : <div />}
          <RecruitAd id="recruit" title="연습생 모집 공고" closed={round?.kind === "final"} />
        </div>
      </section>

      {/* 휴대폰은 윗줄 메뉴가 없어 여기서 명예의 전당으로 간다(#8) */}
      <p className={s.hallLink}>
        <Link className={ui.ghost} href="/hall">
          명예의 전당 보기
        </Link>
      </p>

      <Colophon issue={issue.replace(" ", "년 ")} />
    </div>
  );
}
