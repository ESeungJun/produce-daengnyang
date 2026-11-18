/**
 * 내 글 고치기(/dog/<글 번호>/edit). 주인이 아니거나 마감된 글이면 안내만 보여 준다.
 * 픽을 받은 글은 사진을 잠근다(EditInitial.photosLocked, DB update_entry 도 photos_locked 로 막는다).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Board } from "@/shared/lib/format";
import { createClient } from "@/shared/lib/supabase/server";
import { TopBar, page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { LoginButton } from "@/features/auth/LoginButton";
import { loadEntry } from "@/features/entries/api";
import { memberId } from "@/features/auth/server";
import { SignInPrompt } from "@/features/me/SignInPrompt";
import { PicksLeft } from "@/features/picks/PicksLeft";
import { RegisterForm } from "./RegisterForm";
import s from "./register.module.css";

export async function EditPage({ board, id }: { board: Board; id: string }) {
  const supabase = await createClient();
  const [e, uid] = await Promise.all([loadEntry(supabase, id), memberId(supabase)]);
  if (!e || e === "deleted" || e.board !== board) notFound();
  const back = { href: `/${board}/${id}`, label: e.pet_name };
  // 손님은 주인인지 알 수 없으니 로그인부터 권한다
  const why = !uid
    ? "로그인하면 내 글을 고칠 수 있어요"
    : !e.is_mine
      ? "내 글만 고칠 수 있어요"
      : e.hidden
        ? "운영자가 확인 중인 글은 고칠 수 없어요"
        : !e.round.open
          ? "라운드가 끝난 글은 고칠 수 없어요"
          : null;

  return (
    <div className={page.page}>
      <TopBar back={back} right={<PicksLeft board={board} />} login={<LoginButton />} />
      {why ? (
        <div className={page.notice}>
          <h1>{why}</h1>
          <div className={page.noticeAct}>
            {!uid ? <SignInPrompt /> : null}
            <Link className={uid ? ui.pill : ui.ghost} href={back.href}>
              글로 돌아가기
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className={s.head}>
            <h1>글 고치기</h1>
            <p>{e.photos_locked ? "픽을 받은 글이라 사진은 그대로 두고 글만 고칠 수 있어요" : "사진·이름·소개·SNS 를 고칠 수 있어요"}</p>
          </div>
          <RegisterForm
            mode="edit"
            initial={{
              id: e.id,
              board: e.board,
              name: e.pet_name,
              bio: e.bio ?? "",
              sns: { instagram: e.instagram ?? "", threads: e.threads ?? "", youtube: e.youtube ?? "" },
              photos: e.photos,
              photosLocked: !!e.photos_locked,
            }}
          />
        </>
      )}
    </div>
  );
}
