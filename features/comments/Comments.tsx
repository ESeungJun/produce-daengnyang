"use client";
/**
 * 글 상세의 응원 댓글(#6, 기획서 4절 · 시안 V2A `.cm`). 서버가 첫 30개와 전체 수를 넣어 준다.
 * - 구경은 누구나, 쓰기는 회원만. 픽을 안 해도 쓸 수 있다.
 * - 손님·익명이 "남기기"를 누르면 쓴 글을 이 탭에 적어 두고(handoff) 로그인 시트를 띄운다. 시트를 닫으면 입력칸 글은 그대로다.
 *   구글에서 회원으로 돌아오면 이 글에 한 번 바로 올린다(시트 문구 "로그인하면 바로 올라가요").
 *   앱 안 브라우저에서 기본 브라우저로 옮겨 왔으면 주소의 cm 값으로 입력칸을 다시 채운다(handoff.hrefWithPendingComment).
 * - 금지어·100자는 DB(add_comment)가 거르고, 걸리면 입력칸 아래에 안내하고 글을 남긴다(토스트는 입력줄을 가려서 쓰지 않는다).
 * - 내 댓글은 확인 시트를 거쳐 지우고, 남의 댓글은 신고(ReportButton). 입력줄은 화면 아래에 붙는다.
 * - 주인 한마디(#39): 글 주인은 남의 댓글에 한 번 답할 수 있다(reply_comment, 댓글 쓴 사람에게 알림). 답글은 모두에게 보인다.
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
import { replyErrorText } from "@/features/cheer/rules";
import { commentErrorOutcome } from "./messages";
import { ReportButton } from "./ReportButton";
import s from "./comments.module.css";

const PAGE = 30;
const MAX = 100;
const COUNT_FROM = 80; // 이 글자 수부터 "n/100"을 보여 준다

type Props = { entryId: string; petName: string; isOwner?: boolean; initial: CommentRow[]; total: number; loadFailed?: boolean };

export function Comments({ entryId, petName, isOwner = false, initial, total: total0, loadFailed = false }: Props) {
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
  // 주인 답글: 지금 답하는 댓글 id 와 글
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyErr, setReplyErr] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);

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
        setItems((cur) => [{ id: data, body: t, nickname: "나", is_entry_owner: false, is_mine: true, created_at: new Date().toISOString(), total: 0, reply_body: null, replied_at: null }, ...cur]);
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

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const id = replyTo;
    const t = replyText.trim();
    if (!id || replying) return;
    if (!t) return setReplyErr("답글을 적어 주세요");
    setReplying(true);
    setReplyErr(null);
    const sb = await browserClient();
    const { error } = await sb.rpc("reply_comment", { p_comment_id: id, p_body: t });
    setReplying(false);
    if (error) {
      // 다른 탭·기기에서 먼저 답했으면 폼을 닫고 안내만(다시 눌러도 같은 결과라서)
      if (error.message === "already_replied") {
        setReplyTo((cur) => (cur === id ? null : cur));
        return toast(replyErrorText(error.message));
      }
      return setReplyErr(replyErrorText(error.message));
    }
    const at = new Date().toISOString();
    setItems((cur) => cur.map((c) => (c.id === id ? { ...c, reply_body: t, replied_at: at } : c)));
    // 보내는 사이 다른 댓글의 답글 폼을 열었으면 그 폼은 두고, 이 댓글의 폼만 닫는다
    setReplyTo((cur) => {
      if (cur === id) setReplyText("");
      return cur === id ? null : cur;
    });
    toast("답글을 남겼어요. 댓글 쓴 집사님에게 알림이 가요");
    // 폼이 사라져도 초점이 길을 잃지 않게 새 답글 칸으로 옮긴다
    setTimeout(() => document.getElementById(`rp-done-${id}`)?.focus(), 0);
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
                {c.reply_body ? (
                  <div className={s.reply} id={`rp-done-${c.id}`} tabIndex={-1}>
                    <span className={s.tag}>주인 답글</span>
                    <p>{c.reply_body}</p>
                  </div>
                ) : isOwner && !c.is_mine ? (
                  replyTo === c.id ? (
                    <form className={s.replyForm} onSubmit={sendReply}>
                      <label htmlFor={`rp-${c.id}`} className={s.srOnly}>
                        {c.nickname}님 댓글에 답글
                      </label>
                      <input
                        id={`rp-${c.id}`}
                        value={replyText}
                        maxLength={MAX}
                        onChange={(ev) => {
                          setReplyText(ev.target.value);
                          if (replyErr) setReplyErr(null);
                        }}
                        placeholder="고마운 한마디 (보내면 고칠 수 없어요)"
                        autoComplete="off"
                        autoFocus
                        aria-invalid={replyErr ? true : undefined}
                        aria-describedby={replyErr ? `rp-err-${c.id}` : undefined}
                      />
                      <button type="submit" disabled={replying}>
                        {replying ? "보내는 중" : "답글"}
                      </button>
                      <button
                        type="button"
                        className={s.whoBtn}
                        onClick={() => {
                          setReplyTo(null);
                          setTimeout(() => document.getElementById(`rp-btn-${c.id}`)?.focus(), 0);
                        }}
                      >
                        취소
                      </button>
                      {replyErr ? (
                        <p className={s.err} role="alert" id={`rp-err-${c.id}`}>
                          {replyErr}
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <button
                      type="button"
                      id={`rp-btn-${c.id}`}
                      className={s.replyBtn}
                      onClick={() => {
                        setReplyTo(c.id);
                        setReplyText("");
                        setReplyErr(null);
                      }}
                    >
                      답글 달기
                    </button>
                  )
                ) : null}
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
