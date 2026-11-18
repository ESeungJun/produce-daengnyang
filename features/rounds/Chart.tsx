"use client";
/**
 * 메인의 라운드 차트. 휴대폰은 강아지·고양이 탭으로 하나씩, 데스크톱은 두 게시판을 나란히.
 * 줄: 순위 · 썸네일 · 이름(▲▼ 변동 · 표 수) · 얼굴 픽 버튼. 가림 기간에는 순위·표 수가 없어 "??" 와 안내만.
 */
import Link from "next/link";
import { useState } from "react";
import { BOARD_NAME, rankDelta, type Board } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { PickButton } from "@/features/picks/PickButton";
import { usePicks } from "@/features/picks/PicksProvider";
import { VoteCount } from "@/features/picks/VoteCount";
import type { BoardEntry } from "@/features/entries/api";
import ui from "@/shared/ui/ui.module.css";
import s from "./rounds.module.css";

export function Chart({ lists }: { lists: Record<Board, BoardEntry[]> }) {
  const [tab, setTab] = useState<Board>("dog");
  const { setFocusBoard } = usePicks();
  const choose = (b: Board) => {
    setTab(b);
    setFocusBoard(b);
  };
  return (
    <>
      <div className={`${ui.tabs} ${s.tabs}`} role="tablist" aria-label="게시판">
        {(["dog", "cat"] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="tab"
            id={`chart-tab-${b}`}
            aria-controls={`chart-${b}`}
            aria-selected={tab === b}
            tabIndex={tab === b ? 0 : -1}
            onClick={() => choose(b)}
            onKeyDown={(e) => {
              // 탭 목록 관례: ←/→ 로 옆 탭을 고르고 초점도 옮긴다.
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              const next: Board = b === "dog" ? "cat" : "dog";
              choose(next);
              document.getElementById(`chart-tab-${next}`)?.focus();
            }}
          >
            {BOARD_NAME[b]}
          </button>
        ))}
      </div>
      <div className={s.boards}>
        {(["dog", "cat"] as const).map((b) => (
          <section key={b} id={`chart-${b}`} role="tabpanel" aria-labelledby={`chart-tab-${b}`} className={s.boardPanel} data-active={tab === b}>
            <h3 className={s.boardTitle}>
              {BOARD_NAME[b]}
              <Link href={`/${b}`}>전체 보기</Link>
            </h3>
            <ChartList board={b} items={lists[b]} />
          </section>
        ))}
      </div>
    </>
  );
}

function ChartList({ board, items }: { board: Board; items: BoardEntry[] }) {
  if (items.length === 0) {
    return <p className={s.empty}>아직 {BOARD_NAME[board]} 연습생이 없어요. 첫 연습생이 되어 주세요.</p>;
  }
  // 오늘 0시 순위 기록이 하나도 없으면(자정 작업 전·실패한 날) 모두 NEW 로 보이지 않게 변동을 숨긴다.
  const tracked = items.some((e) => e.prev_rank != null);
  return (
    <ol className={s.chart}>
      {items.map((e) => {
        const d = tracked ? rankDelta(e.rank, e.prev_rank) : null;
        return (
          <li key={e.id}>
            {/* 가림 기간에는 순위가 없고 순서도 섞여 있어 숫자 대신 "?" */}
            <span className={s.rk} data-blind={e.rank == null}>
              {e.rank ?? "?"}
            </span>
            <img className={s.thumb} src={photoUrl(e.thumb_path) ?? undefined} alt="" width={60} height={60} loading="lazy" decoding="async" />
            <Link className={s.nm} href={`/${board}/${e.id}`}>
              <b>{e.pet_name}</b>
              <small>
                {d ? <span className={d.dir === "same" ? undefined : s[d.dir]}>{d.mark}</span> : null}
                {d ? " · " : null}
                <VoteCount entryId={e.id} base={e.pick_count} pickedToday={e.picked_today} />표
              </small>
            </Link>
            <PickButton entryId={e.id} board={board} pickedToday={e.picked_today} closed={e.is_mine ? "mine" : undefined} />
          </li>
        );
      })}
    </ol>
  );
}
