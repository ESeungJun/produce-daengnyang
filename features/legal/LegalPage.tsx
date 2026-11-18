/**
 * 이용약관·개인정보처리방침 화면 틀(#16 푸터에서 연결). 내용은 각 page.tsx 가 children 으로 넣는다.
 * 초안이다: 법률 검토 전이라 시행일 옆에 적어 둔다.
 */
import { TopBar, page } from "@/shared/ui/TopBar";
import { LoginButton } from "@/features/auth/LoginButton";
import { SiteNav } from "@/features/entries/SiteNav";
import s from "./legal.module.css";

export const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function LegalPage({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  return (
    <div className={page.page}>
      <TopBar nav={<SiteNav />} login={<LoginButton />} />
      <article className={s.doc}>
        <h1>{title}</h1>
        <p className={s.meta}>시행일 {effective} · 초안(법률 검토 전)</p>
        {children}
      </article>
    </div>
  );
}
