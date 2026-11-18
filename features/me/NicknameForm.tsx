"use client";
/**
 * 닉네임 바꾸기. 한 번 바꾸면 7일 동안 다시 못 바꾼다(결정기록 2026-11-18, DB set_nickname 이 막는다).
 * 쿨타임 중이면 입력칸을 잠그고 언제부터 바꿀 수 있는지 보여 준다.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/shared/lib/supabase/client";
import { useToast } from "@/shared/ui/Toast";
import ui from "@/shared/ui/ui.module.css";
import { charLen } from "@/features/register/fields";
import { kstDateTime, nicknameNextChange, parseDbTime } from "./rules";
import s from "./me.module.css";

/** set_nickname 과 같은 2~12자(결정기록 #5) */
const MIN = 2;
const MAX = 12;

export function NicknameForm({ nickname, changedAt }: { nickname: string; changedAt: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(nickname);
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(() => nicknameNextChange(changedAt));
  const len = charLen(value.trim());
  const changed = value.trim() !== nickname;
  const bad = len < MIN || len > MAX;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!changed || bad || busy || lockedUntil) return;
    setBusy(true);
    const sb = await browserClient();
    const { data, error } = await sb.rpc("set_nickname", { p_nickname: value });
    setBusy(false);
    if (error) {
      if (error.message === "nickname_cooldown") {
        const until = parseDbTime(error.details);
        setLockedUntil(until);
        return toast(until ? `${kstDateTime(until)}부터 다시 바꿀 수 있어요` : "닉네임은 일주일에 한 번 바꿀 수 있어요");
      }
      return toast(error.message === "invalid_nickname" ? `닉네임을 ${MIN}~${MAX}자로 적어 주세요` : "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요");
    }
    const r = data as { nickname: string; changed_at: string };
    setValue(r.nickname);
    setLockedUntil(nicknameNextChange(r.changed_at));
    toast("닉네임을 바꿨어요");
    router.refresh();
  }

  return (
    <form className={s.nick} onSubmit={save}>
      <label className={s.label} htmlFor="nickname">
        닉네임 <span>{len}/{MAX}</span>
      </label>
      <div className={s.nickRow}>
        <input
          id="nickname"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!!lockedUntil}
          autoComplete="nickname"
          aria-describedby="nickname-note"
          aria-invalid={bad}
        />
        <button type="submit" className={ui.pill} disabled={!changed || bad || busy || !!lockedUntil}>
          {busy ? "저장 중…" : "바꾸기"}
        </button>
      </div>
      <p id="nickname-note" className={bad && !lockedUntil ? s.noteErr : s.note}>
        {lockedUntil
          ? `${kstDateTime(lockedUntil)}부터 다시 바꿀 수 있어요.`
          : bad
            ? `닉네임은 ${MIN}~${MAX}자로 적어 주세요.`
            : "댓글에 보이는 이름이에요. 한 번 바꾸면 일주일 동안 다시 바꿀 수 없어요."}
      </p>
    </form>
  );
}
