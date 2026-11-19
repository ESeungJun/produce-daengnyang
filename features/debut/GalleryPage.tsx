/**
 * 데뷔 화보 사진 올리기 화면(/dog/<글>/gallery, #17). 주인·데뷔 글이 아니면 안내만 보여 준다.
 * 실제 권한 판정은 DB set_debut_photos 가 다시 한다(not_owner·not_debut).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Board } from "@/shared/lib/format";
import { createClient } from "@/shared/lib/supabase/server";
import { TopBar, page } from "@/shared/ui/TopBar";
import ui from "@/shared/ui/ui.module.css";
import { LoginButton } from "@/features/auth/LoginButton";
import { memberId } from "@/features/auth/server";
import { loadEntry } from "@/features/entries/api";
import { SignInPrompt } from "@/features/me/SignInPrompt";
import r from "@/features/register/register.module.css";
import { GalleryForm } from "./GalleryForm";
import { GALLERY_MAX } from "./limits";

export async function GalleryPage({ board, id }: { board: Board; id: string }) {
  const supabase = await createClient();
  const [e, uid] = await Promise.all([loadEntry(supabase, id), memberId(supabase)]);
  if (!e || e === "deleted" || e.board !== board) notFound();
  const back = { href: `/${board}/${id}`, label: e.pet_name };
  const why = !uid
    ? "로그인하면 화보 사진을 올릴 수 있어요"
    : !e.is_mine
      ? "내 글에만 화보 사진을 올릴 수 있어요"
      : e.hidden
        ? "운영자가 확인 중인 글은 고칠 수 없어요"
        : !e.debut
          ? "데뷔한 글에만 화보 사진을 올릴 수 있어요"
          : null;

  return (
    <div className={page.page}>
      <TopBar back={back} login={<LoginButton />} />
      {why ? (
        <div className={page.notice}>
          <h1>{why}</h1>
          <p>데뷔한 아이의 주인은 데뷔 화보에 사진을 {GALLERY_MAX}장까지 더할 수 있어요.</p>
          <div className={page.noticeAct}>
            {!uid ? <SignInPrompt /> : null}
            <Link className={uid ? ui.pill : ui.ghost} href={back.href}>
              글로 돌아가기
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className={r.head}>
            <h1>화보 사진 올리기</h1>
            <p>{e.pet_name}의 데뷔 화보에 사진을 {GALLERY_MAX}장까지 더할 수 있어요. 투표에 쓴 사진은 그대로예요.</p>
          </div>
          <GalleryForm entryId={e.id} back={back.href} initial={e.gallery} />
        </>
      )}
    </div>
  );
}
