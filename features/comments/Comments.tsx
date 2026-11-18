"use client";
/**
 * 글 상세의 응원 댓글(#6, 기획서 4절 · 시안 V2A `.cm`). 서버가 첫 30개와 전체 수를 넣어 준다.
 * - 구경은 누구나, 쓰기는 회원만. 픽을 안 해도 쓸 수 있다.
 * - 손님·익명이 "남기기"를 누르면 쓴 글을 이 탭에 적어 두고(handoff) 로그인 시트를 띄운다. 시트를 닫으면 입력칸 글은 그대로다.
 *   구글에서 회원으로 돌아오면 이 글에 한 번 바로 올린다(시트 문구 "로그인하면 바로 올라가요").
 * - 금지어·100자는 DB(add_comment)가 거르고, 걸리면 안내만 하고 글을 입력칸에 남긴다.
 * - 내 댓글은 지우기, 남의 댓글은 신고(ReportButton). 입력줄은 화면 아래에 붙는다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { savePendingComment, takePendingComment } from "@/features/auth/handoff";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { usePicks } from "@/features/picks/PicksProvider";
import { timeAgo } from "@/shared/lib/format";
import { browserClient } from "@/shared/lib/supabase/client";
import { useToast } from "@/shared/ui/Toast";
import type { CommentRow } from "./api";
import { commentErrorOutcome } from "./messages";
import { ReportButton } from "./ReportButton";
import s from "./comments.module.css";

const PAGE = 30;
const MAX = 100;

export function Comments({ entryId, petName, initial, total: total0 }: { entryId: string; petName: string; initial: CommentRow[]; total: number }) {
  const { viewer } = usePicks();
  const openLogin = useLoginSheet();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(total0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const resumed = useRef(false);

  const send = useCallback(
    async (body: string) => {
      const t = body.trim();
      if (!t) return toast("응원 한 줄을 적어 주세요");
      setBusy(true);
      const sb = await browserClient();
      const { data, error } = await sb.rpc("add_comment", { p_entry_id: entryId, p_body: t });
      setBusy(false);
      if (error || !data) {
        const out = commentErrorOutcome(error?.message);
        if (out.kind === "sheet") {
          savePendingComment({ entryId, body: t });
          return openLogin("comment");
        }
        if (!out.keep) setText("");
        return toast(out.text);
      }
      // 내 닉네임은 목록을 다시 받아 맞춘다(첫 페이지만). 실패해도 글은 이미 올라갔다.
      const fresh = await sb.rpc("entry_comments", { p_entry_id: entryId, p_limit: PAGE, p_offset: 0 });
      if (!fresh.error && fresh.data) {
        setItems(fresh.data);
        setTotal(fresh.data[0]?.total ?? 0);
      } else {
        setItems((cur) => [{ id: data, body: t, nickname: "나", is_entry_owner: false, is_mine: true, created_at: new Date().toISOString(), total: total + 1 }, ...cur]);
        setTotal((n) => n + 1);
      }
      setText("");
      toast("응원 댓글을 남겼어요");
    },
    [entryId, openLogin, toast, total],
  );

  // 로그인하고 돌아왔으면 쓰던 댓글을 한 번 올린다(다른 글에서 적어 둔 것이면 버린다)
  useEffect(() => {
    if (resumed.current || viewer !== "member") return;
    resumed.current = true;
    const pending = takePendingComment();
    if (pending?.entryId !== entryId) return;
    setTimeout(() => {
      setText(pending.body);
      void send(pending.body);
    }, 0);
  }, [viewer, entryId, send]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!text.trim()) return toast("응원 한 줄을 적어 주세요");
    if (viewer !== "member") {
      savePendingComment({ entryId, body: text.trim() });
      return openLogin("comment");
    }
    void send(text);
  }

  async function remove(id: string) {
    const sb = await browserClient();
    const { error } = await sb.rpc("delete_comment", { p_comment_id: id });
    if (error) return toast("댓글을 지우지 못했어요. 잠시 뒤 다시 눌러 주세요");
    setItems((cur) => cur.filter((c) => c.id !== id));
    setTotal((n) => Math.max(0, n - 1));
    toast("댓글을 지웠어요");
  }

  async function more() {
    setLoadingMore(true);
    const sb = await browserClient();
    const { data, error } = await sb.rpc("entry_comments", { p_entry_id: entryId, p_limit: PAGE, p_offset: items.length });
    setLoadingMore(false);
    if (error) return toast("댓글을 더 불러오지 못했어요");
    setItems((cur) => {
      const seen = new Set(cur.map((c) => c.id));
      return [...cur, ...(data ?? []).filter((c) => !seen.has(c.id))];
    });
  }

  return (
    <>
      <section className={s.cm} aria-labelledby="cm-h">
        <h2 id="cm-h">
          응원 댓글 <span>{total.toLocaleString("ko-KR")}</span>
        </h2>
        {items.length ? (
          <ul>
            {items.map((c) => (
              <li key={c.id}>
                <div className={s.who}>
                  <b>{c.nickname}</b>
                  {c.is_entry_owner ? <span className={s.tag}>주인</span> : null}
                  <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>
                  {c.is_mine ? (
                    <button type="button" onClick={() => remove(c.id)}>
                      지우기
                    </button>
                  ) : (
                    <ReportButton target="comment" targetId={c.id} className={s.whoBtn} />
                  )}
                </div>
                <p>{c.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>첫 응원을 남겨 주세요. {petName}에게 힘이 돼요.</p>
        )}
        {items.length < total ? (
          <button type="button" className={s.more} onClick={more} disabled={loadingMore}>
            {loadingMore ? "불러오는 중…" : "댓글 더 보기"}
          </button>
        ) : null}
      </section>
      <form className={s.form} onSubmit={submit}>
        <label htmlFor="cm-in" className={s.srOnly}>
          {petName}에게 응원 댓글
        </label>
        <input
          id="cm-in"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          placeholder={`한 줄 응원 남기기 (${MAX}자)`}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button type="submit" disabled={busy}>
          {busy ? "보내는 중" : "남기기"}
        </button>
      </form>
    </>
  );
}
