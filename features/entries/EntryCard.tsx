/**
 * 게시판 카드: 사진(4:5), 인기순일 때 순위 알약, 이름·표 수, 얼굴 픽 버튼(작은 크기).
 * 가림 기간에는 순위 알약이 없고 표 수가 "??".
 */
import Link from "next/link";
import type { Board } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { PickButton } from "@/features/picks/PickButton";
import { VoteCount } from "@/features/picks/VoteCount";
import type { BoardEntry } from "./api";
import s from "./entries.module.css";

export function EntryCard({ e, board, showRank, eager }: { e: BoardEntry; board: Board; showRank: boolean; eager?: boolean }) {
  const href = `/${board}/${e.id}`;
  return (
    <li className={s.gcard}>
      <Link href={href} tabIndex={-1} aria-hidden="true">
        <img src={photoUrl(e.thumb_path) ?? undefined} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
      </Link>
      {showRank && e.rank != null ? <span className={s.rkPill}>{e.rank}위</span> : null}
      <div className={s.row}>
        <Link href={href}>
          <b>{e.pet_name}</b>
          <span className={s.meta}>
            <VoteCount entryId={e.id} base={e.pick_count} pickedToday={e.picked_today} />표
          </span>
        </Link>
        <PickButton entryId={e.id} board={board} size="sm" pickedToday={e.picked_today} closed={e.is_mine ? "mine" : undefined} />
      </div>
    </li>
  );
}
