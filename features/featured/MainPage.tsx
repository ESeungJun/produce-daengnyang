/**
 * 메인: 데뷔 표지(1280px 이상은 양옆 세로 배너) → 이달 오디션 일정 달력·바로가기(#20) → 센터 화보 → 이번 주차 차트 → 데뷔조 후보 → 연습생 모집 공고(전체 폭).
 * 데이터 네 가지를 한꺼번에 받는다(get_featured, 지금 라운드, 강아지·고양이 차트 4줄씩). 화면 글은 "라운드" 대신 주차(#20).
 * #16: 잡지 비유("○월호 목차", 큰 제호)를 빼고 첫 화면에서 무슨 사이트인지 한 줄로 알리게 했다. 맨 아래는 사이트 푸터(레이아웃)가 맡는다.
 */
import { BOARD_NAME, deadlineLabel, roundName } from "@/shared/lib/format";
import { createClient } from "@/shared/lib/supabase/server";
import { SectionHead, Toc, type TocItem } from "@/shared/ui/parts";
import { TopBar, page } from "@/shared/ui/TopBar";
import { LoginButton } from "@/features/auth/LoginButton";
import { loadBoard } from "@/features/entries/api";
import { RecruitAd } from "@/features/entries/RecruitAd";
import { SiteNav } from "@/features/entries/SiteNav";
import { Band } from "@/features/rounds/Band";
import { Chart } from "@/features/rounds/Chart";
import { loadOpenRound } from "@/features/rounds/api";
import { MonthPlan } from "@/features/rounds/MonthPlan";
import { bandLabel, isBlind } from "@/features/rounds/schedule";
import { Cover } from "./Cover";
import { DebutRail } from "./DebutRail";
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
  const monthNo = Number(featured.month.slice(5, 7));
  const debutMonth = String(monthNo === 1 ? 12 : monthNo - 1);
  const center = featured.center;
  // 이번 달 지난 라운드 1위(= 그 라운드 센터). 후보 목록에서 지금 센터를 빼고 최근 라운드부터.
  const pastCenters = featured.finalists.filter((f) => f.pos === 1 && !center.some((c) => c.entry_id === f.entry_id));
  const blind = round ? isBlind(round) : false;
  const chartTitle = round ? `${roundName(round.kind, round.seq)} 차트` : "이번 주차 차트";
  const hasDebut = featured.debut.length > 0;
  // 모집 포스터에 붙일 지금 연습생 사진(댕댕이·냥이 번갈아 최대 4장)
  const poster = [dog[0], cat[0], dog[1], cat[1]].flatMap((e) => (e?.thumb_path ? [e.thumb_path] : []));

  const toc: TocItem[] = [
    { href: "#chart", title: "지금 픽하러 가기", note: round ? `${roundName(round.kind, round.seq)} · ${deadlineLabel(round.ends_at)}` : "다음 주차 준비 중" },
    { href: "#center", title: "이번 주 센터", note: center.length ? center.map((c) => c.pet_name).join(" · ") : "첫 센터를 기다려요" },
    { href: "#finalists", title: "데뷔 후보", note: "22일부터 데뷔 평가" },
    { href: "#recruit", title: "우리 아이 등록하기", note: "1~3주차마다 2번까지" },
    { href: "/hall", title: "명예의 전당", note: "지난 센터·데뷔 모음" },
  ];

  const main = (
    <div className={s.mainCol}>
      <div className={page.bleed}>
        <Cover
          debutMonth={debutMonth}
          debut={featured.debut}
          toc={
            <Toc
              heading={`${monthNo}월 댕냥 오디션 일정`}
              lead="마음에 드는 아이에게 픽! 로그인하면 댕댕이·냥이 각각 하루 3픽(로그인 전엔 1픽)이에요."
              label="오디션 일정과 바로가기"
              items={toc}
              className={s.toc}
            >
              <MonthPlan month={featured.month} className={s.plan} />
            </Toc>
          }
        />
      </div>

      <section aria-labelledby="center">
        <SectionHead
          id="center"
          title="이번 주 센터 화보"
          sub={center.length ? `${Number(center[0].round_month.slice(5, 7))}월 ${center[0].round_seq}주차 1위. 다음 주간 투표 결과가 나올 때까지 사이트 곳곳에 걸려요.` : "1주차가 끝나면 댕댕이·냥이 1위가 여기 걸려요."}
        />
        {center.length ? <CenterSpread center={center} past={pastCenters} /> : null}
      </section>

      <section aria-labelledby="chart">
        <SectionHead
          id="chart"
          title={chartTitle}
          sub={round ? `${BOARD_NAME.dog}·${BOARD_NAME.cat} 따로, 게시판마다 하루 3픽. 같은 아이는 하루 한 번.` : "다음 주차를 준비하고 있어요."}
        />
        {round ? (
          <>
            <Band endsAt={round.ends_at} label={bandLabel(round, blind)} />
            <Chart lists={{ dog, cat }} />
          </>
        ) : null}
      </section>

      <section aria-labelledby="finalists">
        <SectionHead
          id="finalists"
          title="데뷔조 후보"
          sub={featured.finalists.length ? "주간 1·2위만 오를 수 있어요. 22일부터 데뷔 평가, 다음 달 1일 0시에 게시판마다 1마리가 데뷔해요." : "1주차가 끝나면 첫 후보가 여기 걸려요."}
        />
        {featured.finalists.length ? <Polaroids items={featured.finalists} /> : null}
      </section>
    </div>
  );
  // 모집 공고는 양옆 배너 밖, 화면 폭 전체 한 줄(#16)
  const recruit = <RecruitAd id="recruit" title="연습생 모집 공고" closed={round?.kind === "final"} wide poster={poster} />;

  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav current="home" />} login={<LoginButton />} />
      <h1 className="sr-only">프로듀스 댕냥: 댕댕이·냥이 사진 오디션</h1>
      {hasDebut ? (
        <div className={s.railGrid}>
          <DebutRail board="dog" card={featured.debut.find((d) => d.board === "dog")} debutMonth={debutMonth} />
          {main}
          <DebutRail board="cat" card={featured.debut.find((d) => d.board === "cat")} debutMonth={debutMonth} />
        </div>
      ) : (
        main
      )}
      {recruit}
    </div>
  );
}
