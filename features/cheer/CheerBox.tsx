"use client";
/**
 * 결선 진출 글의 응원단 상자(#39, 기획서 「결선까지 다시 올 이유」). 글 상세에서 댓글 위에 둔다.
 * 화면 말은 "데뷔 평가"로 쓴다(DESIGN_SYSTEM #20: 화면에 "결선"은 "결선 진출"만).
 * - 주간 1·2위 원본 글, 데뷔 평가 시작 전: 남은 "응원단 들어가기"(회원만), 주인은 응원단 수와 모으는 법.
 * - 데뷔 평가가 열린 원본 글: 데뷔 평가 글로 가는 길. 끝났으면 지난 일로 알려 준다.
 * - 데뷔 평가 글(복사본): 원본에서 모은 응원단 수.
 * - 손님·익명이 누르면 이 탭에 적어 두고(handoff) 로그인 시트를 띄운다. 회원으로 돌아오면 한 번 바로 들어간다.
 *   앱 안 브라우저에서 기본 브라우저로 옮겨 오면 주소의 ch=1 로 다시 적어 두고 시트를 띄운다.
 * 응원단은 표가 아니다(set_cheer 는 picks·pick_count 를 건드리지 않는다). 데뷔 평가 날 알림만 받는다.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CHEER_PARAM, savePendingCheer, takePendingCheer } from "@/features/auth/handoff";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { usePicks } from "@/features/picks/PicksProvider";
import type { Board } from "@/shared/lib/format";
import { browserClient } from "@/shared/lib/supabase/client";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { cheerErrorText, finalDayLabel, type CheerState } from "./rules";
import s from "./cheer.module.css";

type Props = { entryId: string; board: Board; initial: CheerState };

/** 아래 댓글 입력칸으로 옮긴다(Comments.tsx 의 #cm-in) */
function focusComment() {
  const el = document.getElementById("cm-in");
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus({ preventScroll: true });
}

export function CheerBox({ entryId, board, initial }: Props) {
  const { viewer } = usePicks();
  const openLogin = useLoginSheet();
  const toast = useToast();
  const [st, setSt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const resumed = useRef(false);

  const setCheer = useCallback(
    async (on: boolean) => {
      setBusy(true);
      const sb = await browserClient();
      const { data, error } = await sb.rpc("set_cheer", { p_entry_id: entryId, p_on: on });
      setBusy(false);
      if (error) {
        const t = cheerErrorText(error.message);
        // 페이지를 열어 둔 사이 데뷔 평가가 시작됐으면 상자를 닫힌 모습으로 바꾼다
        if (error.message === "cheer_closed") setSt((cur) => ({ ...cur, open: false }));
        if (t === "sheet") {
          savePendingCheer(entryId);
          return openLogin("cheer");
        }
        return toast(t);
      }
      setSt((cur) => ({ ...cur, mine: on, count: typeof data === "number" ? data : cur.count }));
      toast(on ? "응원단에 들어갔어요. 데뷔 평가가 열리는 날 알림함으로 알려 드려요" : "응원단에서 나왔어요");
    },
    [entryId, openLogin, toast],
  );

  // 앱 안 브라우저에서 넘어왔으면(ch=1) 하려던 응원단을 다시 적어 두고 주소에서 뗀다
  useEffect(() => {
    const u = new URL(location.href);
    if (u.searchParams.get(CHEER_PARAM) == null) return;
    u.searchParams.delete(CHEER_PARAM);
    history.replaceState(history.state, "", u.toString());
    if (!initial.open || initial.mine || initial.is_owner) return;
    savePendingCheer(entryId);
    if (viewer !== "member") setTimeout(() => openLogin("cheer"), 0);
    // 처음 한 번만(viewer 가 바뀌어도 다시 띄우지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로그인하고 돌아왔으면 한 번 바로 들어간다(다른 글에서 누른 것이면 버린다)
  useEffect(() => {
    if (resumed.current || viewer !== "member") return;
    resumed.current = true;
    if (takePendingCheer() !== entryId || initial.mine || !initial.open) return;
    setTimeout(() => void setCheer(true), 0);
  }, [viewer, entryId, initial.mine, initial.open, setCheer]);

  function press() {
    if (busy) return;
    if (viewer !== "member") {
      savePendingCheer(entryId);
      return openLogin("cheer");
    }
    void setCheer(!st.mine);
  }

  const n = st.count.toLocaleString("ko-KR");
  const day = st.final_starts_at ? finalDayLabel(st.final_starts_at) : null;

  // 데뷔 평가 글: 원본에서 모은 응원단 수만 보여 준다(없으면 상자를 두지 않는다)
  if (st.is_final) {
    if (!st.count) return null;
    return (
      <section className={s.box} aria-label="응원단">
        <p className={s.text}>
          <b>{st.final_ended ? `응원단 ${n}명이 함께했어요` : `응원단 ${n}명과 함께 데뷔 평가 중이에요`}</b>
          <span>주간 결선 진출 때부터 기다려 온 집사님들이에요.</span>
        </p>
      </section>
    );
  }

  // 데뷔 평가가 열린 원본 글: 데뷔 평가 글로 보낸다. 끝났으면 지난 일로
  if (!st.open) {
    if (st.final_ended) {
      if (!st.count) return null;
      return (
        <section className={s.box} aria-label="응원단">
          <p className={s.text}>
            <b>데뷔 평가가 끝났어요</b>
            <span>응원단 {n}명이 함께했어요.</span>
          </p>
          <Link className={s.out} href="/hall">
            명예의 전당 보기
          </Link>
        </section>
      );
    }
    if (!st.final_entry_id) return null;
    return (
      <section className={s.box} aria-label="응원단">
        <p className={s.text}>
          <b>데뷔 평가가 열렸어요</b>
          <span>{st.count ? `응원단 ${n}명이 기다리던 날이에요. ` : ""}데뷔 평가 글에서 픽할 수 있어요.</span>
        </p>
        <Link className={ui.pill} href={`/${board}/${st.final_entry_id}`}>
          데뷔 평가에서 픽하기
        </Link>
      </section>
    );
  }

  if (st.is_owner) {
    return (
      <section className={s.box} aria-label="응원단">
        <p className={s.text}>
          <b>결선 진출! {day}부터 데뷔 평가예요</b>
          <span>
            {st.count ? (
              <>
                지금 응원단 <em className={s.num}>{n}</em>명. 데뷔 평가 날 이 집사님들에게 픽하러 오라는 알림이 가요.
              </>
            ) : (
              "아직 응원단이 없어요. 응원단에 들어온 집사님에게는 데뷔 평가 날 알림이 가요."
            )}{" "}
            위 공유하기로 링크를 보내 모아 보세요.
          </span>
        </p>
      </section>
    );
  }

  return (
    <section className={s.box} aria-label="응원단">
      <p className={s.text}>
        <b>결선 진출! {day}부터 데뷔 평가예요</b>
        <span>
          {st.mine ? (
            <>
              응원단 <em className={s.num}>{n}</em>명과 함께하고 있어요. 데뷔 평가 날 알림함으로 알려 드려요(내 정보에서 이 기기 알림을 켜면 바로 받아요).
            </>
          ) : st.count ? (
            <>
              지금 응원단 <em className={s.num}>{n}</em>명. 들어오면 데뷔 평가 날 알려 드려요.
            </>
          ) : (
            "첫 응원단이 되어 주세요. 들어오면 데뷔 평가 날 알려 드려요."
          )}
        </span>
      </p>
      <div className={s.acts}>
        {st.mine ? (
          <button type="button" className={ui.pill} onClick={focusComment}>
            한마디 남기기
          </button>
        ) : null}
        <button type="button" className={st.mine ? s.out : ui.pill} onClick={press} disabled={busy}>
          {busy ? "잠시만요…" : st.mine ? "응원단 나가기" : "응원단 들어가기"}
        </button>
      </div>
    </section>
  );
}
