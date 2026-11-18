"use client";
/**
 * 글 상세의 응원 댓글(#6, 기획서 4절 · 시안 V2A `.cm`). 서버가 첫 30개와 전체 수를 넣어 준다.
 * - 구경은 누구나, 쓰기는 회원만. 픽을 안 해도 쓸 수 있다.
 * - 손님·익명이 "남기기"를 누르면 쓴 글을 이 탭에 적어 두고(handoff) 로그인 시트를 띄운다. 시트를 닫으면 입력칸 글은 그대로다.
 *   구글에서 회원으로 돌아오면 이 글에 한 번 바로 올린다(시트 문구 "로그인하면 바로 올라가요").
 *   앱 안 브라우저에서 기본 브라우저로 옮겨 왔으면 주소의 cm 값으로 입력칸을 다시 채운다(handoff.hrefWithPendingComment).
 * - 금지어·100자는 DB(add_comment)가 거르고, 걸리면 입력칸 아래에 안내하고 글을 남긴다(토스트는 입력줄을 가려서 쓰지 않는다).
 * - 내 댓글은 확인 시트를 거쳐 지우고, 남의 댓글은 신고(ReportButton). 입력줄은 화면 아래에 붙는다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CARRY_PARAM, savePendingComment, takePendingComment } from "@/features/auth/handoff";
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { usePicks } from "@/features/picks/PicksProvider";
import { timeAgo } from "@/shared/lib/format";
import { browserClient } from "@/shared/lib/supabase/client";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";
import type { CommentRow } from "./api";
import { commentErrorOutcome } from "./messages";
import { ReportButton } from "./ReportButton";
import s from "./comments.module.css";

const PAGE = 30;
const MAX = 100;
const COUNT_FROM = 80; // 이 글자 수부터 "n/100"을 보여 준다

type Props = { entryId: string; petName: string; initial: CommentRow[]; total: number; loadFailed?: boolean };

export function Comments({ entryId, petName, initial, total: total0, loadFailed = false }: Props) {
  const { viewer } = usePicks();
  const openLogin = useLoginSheet();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(total0);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const resumed = useRef(false);

  const send = useCallback(
    async (body: string) => {
      const t = body.trim();
      if (!t) return setErr("응원 한 줄을 적어 주세요");
      setBusy(true);
      setErr(null);
      const sb = await browserClient();
      const { data, error } = await sb.rpc("add_comment", { p_entry_id: entryId, p_body: t });
      setBusy(false);
      if (error || !data) {
        const out = commentErrorOutcome(error?.message);
        if (out.kind === "sheet") {
          savePendingComment({ entryId, body: t });
          return openLogin("comment");
        }
        if (out.keep) return setErr(out.text);
        setText("");
        return toast(out.text);
      }
      // 새 첫 페이지를 받아 내 닉네임을 맞춘다. 더 불러온 줄은 지우지 않고 뒤에 이어 둔다(id 로 겹침 제거).
      const fresh = await sb.rpc("entry_comments", { p_entry_id: entryId, p_limit: PAGE, p_offset: 0 });
      if (!fresh.error && fresh.data) {
        const head = fresh.data;
        setItems((cur) => {
          const seen = new Set(head.map((c) => c.id));
          return [...head, ...cur.filter((c) => !seen.has(c.id))];
        });
        setTotal(head[0]?.total ?? 0);
      } else {
        setItems((cur) => [{ id: data, body: t, nickname: "나", is_entry_owner: false, is_mine: true, created_at: new Date().toISOString(), total: 0 }, ...cur]);
        setTotal((n) => n + 1);
      }
      setText("");
      toast("응원 댓글을 남겼어요");
    },
    [entryId, openLogin, toast],
  );

  // 앱 안 브라우저에서 넘어왔으면 쓰던 댓글로 입력칸을 채우고 주소에서 뗀다(새로고침해도 다시 채우지 않게)
  useEffect(() => {
    const u = new URL(location.href);
    const carried = u.searchParams.get(CARRY_PARAM);
    if (carried == null) return;
    u.searchParams.delete(CARRY_PARAM);
    history.replaceState(history.state, "", u.toString());
    setTimeout(() => setText(carried.slice(0, MAX)), 0);
  }, []);

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

  function change(v: string) {
    if (v.length > MAX) {
      setText(v.slice(0, MAX));
      setErr(`한 줄 응원은 ${MAX}자까지 남길 수 있어요. 넘친 뒷부분은 잘렸어요`);
      return;
    }
    setText(v);
    if (err) setErr(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!text.trim()) return setErr("응원 한 줄을 적어 주세요");
    if (viewer !== "member") {
      savePendingComment({ entryId, body: text.trim() });
      return openLogin("comment");
    }
    void send(text);
  }

  async function remove() {
    const id = askDelete;
    if (!id || deleting) return;
    setDeleting(true);
    const sb = await browserClient();
    const { error } = await sb.rpc("delete_comment", { p_comment_id: id });
    setDeleting(false);
    setAskDelete(null);
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
    const rows = data ?? [];
    // 그사이 숨겨지거나 새로 달린 댓글이 있으면 전체 수를 서버 값으로 맞춘다(버튼이 헛돌지 않게)
    const seen = new Set(items.map((c) => c.id));
    const next = [...items, ...rows.filter((c) => !seen.has(c.id))];
    setItems(next);
    setTotal(rows.length ? rows[0].total : next.length);
  }

  const showCount = text.length >= COUNT_FROM;
  return (
    <>
      <section className={s.cm} aria-labelledby="cm-h">
        <h2 id="cm-h">
          응원 댓글 {loadFailed ? null : <span>{total.toLocaleString("ko-KR")}</span>}
        </h2>
        {loadFailed ? (
          <p className={s.empty}>댓글을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>
        ) : items.length ? (
          <ul>
            {items.map((c) => (
              <li key={c.id}>
                <div className={s.who}>
                  <b>{c.nickname}</b>
                  {c.is_entry_owner ? <span className={s.tag}>주인</span> : null}
                  <time dateTime={c.created_at} suppressHydrationWarning>
                    {timeAgo(c.created_at)}
                  </time>
                  {c.is_mine ? (
                    <button type="button" className={s.whoBtn} onClick={() => setAskDelete(c.id)}>
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
        <div className={s.row}>
          <label htmlFor="cm-in" className={s.srOnly}>
            {petName}에게 응원 댓글
          </label>
          <input
            id="cm-in"
            value={text}
            onChange={(e) => change(e.target.value)}
            placeholder={`한 줄 응원 남기기 (${MAX}자)`}
            autoComplete="off"
            enterKeyHint="send"
            aria-invalid={err ? true : undefined}
            aria-describedby="cm-note"
          />
          <button type="submit" disabled={busy}>
            {busy ? "보내는 중" : "남기기"}
          </button>
        </div>
        <p id="cm-note" className={s.note} aria-live="polite" hidden={!err && !showCount}>
          <span className={s.err}>{err}</span>
          {showCount ? (
            <span className={s.count}>
              {text.length}/{MAX}
            </span>
          ) : null}
        </p>
      </form>
      <Sheet
        open={askDelete !== null}
        title="이 댓글을 지울까요?"
        body="지운 댓글은 되돌릴 수 없어요."
        mainLabel={deleting ? "지우는 중…" : "지우기"}
        subLabel="취소"
        onMain={remove}
        onClose={() => setAskDelete(null)}
      />
    </>
  );
}
