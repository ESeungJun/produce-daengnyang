/**
 * 게시판(강아지·고양이): 제목 · 마감 띠 · 정렬 · 카드 목록(이어 불러오기) · 모집 공고 · 맨 아래 제호.
 * 마감 24시간 전부터 결과 확정까지는 인기순 대신 "섞어 보기"(DB 가 표 수·순위를 숨기고 섞어 준다).
 */
import Link from "next/link";
import { BOARD_NAME, deadlineLabel, issueLabel, type Board } from "@/shared/lib/format";
import { kstDate } from "@/shared/lib/kst";
import { createClient } from "@/shared/lib/supabase/server";
import { Colophon, SortLinks } from "@/shared/ui/parts";
import { TopBar, page } from "@/shared/ui/TopBar";
import { LoginButton } from "@/features/auth/LoginButton";
import { PicksLeft } from "@/features/picks/PicksLeft";
import { Band } from "@/features/rounds/Band";
import { loadOpenRound } from "@/features/rounds/api";
import { isBlind, roundTitle } from "@/features/rounds/schedule";
import { loadBoard, type BoardSort } from "./api";
import { BoardGallery } from "./BoardGallery";
import { RecruitAd } from "./RecruitAd";
import { RegisterButton } from "./RegisterButton";
import { SiteNav } from "./SiteNav";
import ui from "@/shared/ui/ui.module.css";
import s from "./entries.module.css";

export async function BoardPage({ board, sort }: { board: Board; sort: BoardSort }) {
  const supabase = await createClient();
  const [round, items] = await Promise.all([loadOpenRound(supabase), loadBoard(supabase, board, { sort })]);
  const blind = round ? isBlind(round) : false;
  // 결선 기간(22일~말일)에는 새 등록을 받지 않는다(기획서 4절).
  const final = round?.kind === "final";
  const issue = issueLabel(`${kstDate().slice(0, 7)}-01`);

  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav current={board} />} right={<PicksLeft board={board} />} login={<LoginButton />} />
      <div className={s.bhead}>
        <h1>{BOARD_NAME[board]} 연습생</h1>
        <p>{round ? `${roundTitle(round)} · ${deadlineLabel(round.ends_at)}` : "다음 라운드를 준비하고 있어요"}</p>
      </div>
      {/* 휴대폰에는 윗줄 메뉴가 없어 게시판을 여기서 바꾼다(데스크톱은 숨김) */}
      <nav className={`${ui.tabs} ${s.boardTabs}`} aria-label="게시판">
        {(["dog", "cat"] as const).map((b) => (
          <Link key={b} href={`/${b}`} aria-current={b === board ? "page" : undefined}>
            {BOARD_NAME[b]}
          </Link>
        ))}
      </nav>
      {round ? <Band className={s.bandGap} endsAt={round.ends_at} /> : null}
      <div className={s.sortGap}>
        <SortLinks
          current={sort}
          options={[
            { key: "popular", label: blind ? "섞어 보기" : "인기순", href: `/${board}` },
            { key: "latest", label: "최신순", href: `/${board}?sort=latest` },
          ]}
          note={blind ? "마감 전 24시간은 순위를 가려요" : undefined}
        />
      </div>
      {items.length ? (
        <BoardGallery key={sort} board={board} sort={sort} initial={items} showRank={sort === "popular" && !blind} />
      ) : (
        <div className={s.empty}>
          <p>
            {!round
              ? "라운드가 열리면 연습생이 여기 올라와요."
              : final
                ? "지금은 데뷔 평가 중이에요. 다음 달 1일에 새 라운드가 열려요."
                : `아직 ${BOARD_NAME[board]} 연습생이 없어요. 첫 연습생이 되어 주세요.`}
          </p>
          {round && !final ? <RegisterButton className={ui.pill} /> : null}
        </div>
      )}
      <RecruitAd closed={final} />
      <Colophon issue={issue.replace(" ", "년 ")} />
    </div>
  );
}
