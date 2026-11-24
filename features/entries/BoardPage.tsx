/**
 * 게시판(강아지·고양이): 제목 · 마감 띠 · 정렬 · 카드 목록(이어 불러오기) · 모집 공고 · 맨 아래 제호.
 * 마감 24시간 전부터 결과 확정까지는 인기순 대신 "섞어 보기"(DB 가 표 수·순위를 숨기고 섞어 준다).
 * 이름 검색(?q=, #5)은 지금 라운드·이 게시판 안에서만 찾고, 정렬·가림 규칙은 그대로 따른다.
 */
import Link from "next/link";
import { BOARD_NAME, deadlineLabel, type Board } from "@/shared/lib/format";
import { cookies } from "next/headers";
import { kstDate } from "@/shared/lib/kst";
import { createClient } from "@/shared/lib/supabase/server";
import { VISITOR_COOKIE, cleanVisitorKey } from "@/shared/lib/visitor";
import { CenterBanner } from "@/features/featured/CenterBanner";
import { getFeatured } from "@/features/featured/server";
import { SortLinks } from "@/shared/ui/parts";
import { TopBar, page } from "@/shared/ui/TopBar";
import { LoginButton } from "@/features/auth/LoginButton";
import { PicksLeft } from "@/features/picks/PicksLeft";
import { Band } from "@/features/rounds/Band";
import { loadOpenRound } from "@/features/rounds/api";
import { HowToPick } from "@/features/rounds/HowToPick";
import { CHEER_DAY_NOTE, bandLabel, isBlind, isCheerDay, roundTitle } from "@/features/rounds/schedule";
import { loadBoard, type BoardSort } from "./api";
import { BoardGallery } from "./BoardGallery";
import { RecruitAd } from "./RecruitAd";
import { RegisterButton } from "./RegisterButton";
import { SearchBox } from "./SearchBox";
import { boardHref, isSearch } from "./search";
import { SiteNav } from "./SiteNav";
import ui from "@/shared/ui/ui.module.css";
import s from "./entries.module.css";

export async function BoardPage({ board, sort, q }: { board: Board; sort: BoardSort; q: string }) {
  // 위 센터 띠 데이터를 페이지 데이터와 같이 읽기 시작한다(cache 가 같은 Promise 를 띠에 넘긴다)
  void getFeatured().catch(() => null);
  const supabase = await createClient();
  // 가림 기간 섞기 seed. 첫 방문이라 쿠키가 없으면 null(모든 첫 방문 손님이 같은 순서), 다음부터 사람마다 다르다.
  const seed = cleanVisitorKey((await cookies()).get(VISITOR_COOKIE)?.value);
  const [round, items] = await Promise.all([loadOpenRound(supabase), loadBoard(supabase, board, { sort, seed, q: isSearch(q) ? q : undefined })]);
  const blind = round ? isBlind(round) : false;
  // 결선 기간(22일~말일)과 그 전날 응원단 모으는 날(21일, #41)에는 새 등록을 받지 않는다(기획서 4절).
  const final = round?.kind === "final";
  const cheerDay = !round && isCheerDay();
  const searching = isSearch(q);

  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav current={board} />} right={<PicksLeft board={board} />} login={<LoginButton />} />
      <CenterBanner board={board} />
      <div className={s.bhead}>
        <h1>{BOARD_NAME[board]} 연습생</h1>
        <p>{round ? `${roundTitle(round)} · ${deadlineLabel(round.ends_at)}` : cheerDay ? CHEER_DAY_NOTE : "다음 주차를 준비하고 있어요"}</p>
      </div>
      {round ? <Band className={s.bandGap} endsAt={round.ends_at} label={bandLabel(round, blind)} /> : null}
      {/* 투표하러 온 사람이 규칙을 바로 볼 수 있게 접어 둔 안내(#20) */}
      <HowToPick month={round?.month ?? `${kstDate().slice(0, 7)}-01`} />
      {round ? <SearchBox board={board} sort={sort} q={q} /> : null}
      <div className={s.sortGap}>
        <SortLinks
          current={sort}
          options={[
            { key: "popular", label: blind ? "섞어 보기" : "인기순", href: boardHref(board, "popular", q) },
            { key: "latest", label: "최신순", href: boardHref(board, "latest", q) },
          ]}
          note={blind ? "마감 전 24시간은 순위를 가려요" : undefined}
        />
      </div>
      {items.length ? (
        <BoardGallery key={`${sort}|${q}`} board={board} sort={sort} seed={seed} q={searching ? q : ""} initial={items} showRank={sort === "popular" && !blind} />
      ) : searching ? (
        <div className={s.empty}>
          <p>이번 주차에 ‘{q}’ 연습생이 없어요. 이름을 다시 확인하거나 최신순으로 둘러보세요.</p>
          <Link className={ui.ghost} href={boardHref(board, "latest", "")}>
            최신순 보기
          </Link>
        </div>
      ) : (
        <div className={s.empty}>
          <p>
            {cheerDay
              ? "오늘은 투표를 쉬어요. 메인의 데뷔조 후보에게 응원단으로 들어가 두면 내일 데뷔 평가가 열릴 때 알려 드려요."
              : !round
              ? "새 주차가 열리면 연습생이 여기 올라와요."
              : final
                ? "지금은 데뷔 평가 중이에요. 다음 달 1일에 1주차가 열려요."
                : `아직 ${BOARD_NAME[board]} 연습생이 없어요. 첫 연습생이 되어 주세요.`}
          </p>
          {round && !final ? <RegisterButton className={ui.pill} /> : null}
          {cheerDay ? (
            <Link className={ui.pill} href="/#finalists">
              데뷔조 후보 보러 가기
            </Link>
          ) : null}
        </div>
      )}
      <RecruitAd closed={final || cheerDay} />
    </div>
  );
}
