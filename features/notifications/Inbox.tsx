"use client";
/**
 * 알림함(#6). 내 정보 화면에 최근 20개를 보여 주고, 화면을 연 뒤 안 읽은 알림을 모두 읽음으로 바꾼다(RLS: 내 알림의 read_at 만).
 * 이번에 새로 온 것은 "새" 표시를 화면에 남긴다(읽음 처리는 DB 에만 반영).
 */
import Link from "next/link";
import { useEffect } from "react";
import { usePicks } from "@/features/picks/PicksProvider";
import { timeAgo } from "@/shared/lib/format";
import { browserClient } from "@/shared/lib/supabase/client";
import { notificationView, type NotificationRow } from "./text";
import s from "./notifications.module.css";

export function Inbox({ items, unread, failed = false }: { items: NotificationRow[]; unread: number; failed?: boolean }) {
  const { clearUnread } = usePicks();
  // 보이는 20개만이 아니라 안 읽은 것을 모두 읽음으로 바꾼다(RLS 가 내 알림만 남긴다). 20개 밖에 남아 점이 다시 켜지지 않게.
  useEffect(() => {
    if (!unread) return;
    void browserClient().then((sb) =>
      sb
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null)
        .then(({ error }) => {
          if (!error) clearUnread(); // 윗줄 "내 정보" 점을 끈다
        }),
    );
  }, [unread, clearUnread]);

  if (failed) return <p className={s.empty}>알림을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>;
  if (!items.length) return <p className={s.empty}>아직 알림이 없어요. 내 아이 글에 댓글이 달리거나 센터·데뷔가 되면 여기로 알려 드려요.</p>;
  return (
    <ul className={s.list}>
      {items.map((n) => {
        const v = notificationView(n);
        const body = (
          <>
            {!n.read_at ? <span className={s.new}>새</span> : null}
            <span className={s.text}>{v.text}</span>
            <time dateTime={n.created_at} suppressHydrationWarning>
              {timeAgo(n.created_at)}
            </time>
          </>
        );
        return <li key={n.id}>{v.href ? <Link href={v.href}>{body}</Link> : <div>{body}</div>}</li>;
      })}
    </ul>
  );
}
