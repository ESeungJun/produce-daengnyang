/**
 * 내 정보(/me). 회원만: 닉네임 · 알림함(#6) · 내 글 · 로그아웃 · 탈퇴(결정기록 2026-11-18 #5). 관리자면 관리자 화면 링크.
 * 로그인 전·익명이면 로그인 안내만 보여 준다(내 글은 회원만 올릴 수 있으므로).
 */
import { createClient } from "@/shared/lib/supabase/server";
import { TopBar, page } from "@/shared/ui/TopBar";
import { LoginButton } from "@/features/auth/LoginButton";
import { memberId } from "@/features/auth/server";
import { SiteNav } from "@/features/entries/SiteNav";
import { PicksLeft } from "@/features/picks/PicksLeft";
import Link from "next/link";
import { Inbox } from "@/features/notifications/Inbox";
import type { NotificationRow } from "@/features/notifications/text";
import { AccountActions } from "./AccountActions";
import { MyEntries } from "./MyEntries";
import { NicknameForm } from "./NicknameForm";
import { SignInPrompt } from "./SignInPrompt";
import type { MyEntry } from "./rules";
import s from "./me.module.css";

export async function MePage({ resumeLeave = false }: { resumeLeave?: boolean }) {
  const supabase = await createClient();
  const uid = await memberId(supabase);
  const bar = <TopBar nav={<SiteNav />} right={<PicksLeft />} login={<LoginButton />} />;
  if (!uid) {
    return (
      <div className={page.page}>
        {bar}
        <div className={page.notice}>
          <h1>내 정보는 회원만 볼 수 있어요</h1>
          <p>구글로 로그인하면 올린 아이들을 보고 고칠 수 있어요.</p>
          <div className={page.noticeAct}>
            <SignInPrompt />
          </div>
        </div>
      </div>
    );
  }
  const [{ data: profile }, { data: mine }, { data: notes }] = await Promise.all([
    supabase.from("profiles").select("nickname, nickname_changed_at, is_admin").eq("id", uid).maybeSingle(),
    supabase.rpc("my_entries"),
    supabase.from("notifications").select("id, kind, payload, created_at, read_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const inbox = (notes ?? []) as NotificationRow[];
  const unread = inbox.filter((n) => !n.read_at).length;
  const entries = (mine as unknown as MyEntry[] | null) ?? [];

  return (
    <div className={page.page}>
      {bar}
      <div className={s.layout}>
        <section className={s.side} aria-labelledby="me-h">
          <h1 id="me-h" className={s.title}>
            내 정보
          </h1>
          <NicknameForm nickname={profile?.nickname ?? ""} changedAt={profile?.nickname_changed_at ?? null} />
          <AccountActions resume={resumeLeave} />
          {profile?.is_admin ? (
            <Link className={s.adminLink} href="/admin">
              관리자 화면(신고 처리)
            </Link>
          ) : null}
        </section>
        <section className={s.main} aria-labelledby="mine-h">
          <h2 id="inbox-h" className={s.h2}>
            알림 {unread ? <span>새 {unread}</span> : null}
          </h2>
          <div className={s.inbox}>
            <Inbox items={inbox} />
          </div>
          <h2 id="mine-h" className={s.h2}>
            내가 올린 아이 <span>{entries.length}</span>
          </h2>
          <MyEntries entries={entries} />
        </section>
      </div>
    </div>
  );
}
