/**
 * 모든 화면 맨 끝 사이트 푸터(#16). 사이트 소개 한 줄, 바로가기, 약관·개인정보처리방침, 문의 메일.
 * 문의 메일은 배포 때 NEXT_PUBLIC_CONTACT_EMAIL 로 넣는다(공개 저장소에 주소를 적지 않으려고). 비어 있으면 "준비 중".
 * 메일 주소는 글자 그대로 보여 준다(메일 앱 링크가 안 열리는 환경에서도 복사할 수 있게).
 */
import Link from "next/link";
import s from "./footer.module.css";

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function SiteFooter() {
  return (
    <footer className={s.foot}>
      <div className={s.inner}>
        <div className={s.about}>
          <b className={s.name}>
            프로듀스 <em>댕냥</em>
          </b>
          <p>댕댕이·냥이 사진 오디션. 매일 무료 픽으로 매주 센터를 뽑고, 매달 한 마리씩 데뷔해요.</p>
        </div>
        <nav className={s.links} aria-label="사이트 안내">
          <div>
            <h2>둘러보기</h2>
            <Link href="/dog">댕댕이</Link>
            <Link href="/cat">냥이</Link>
            <Link href="/hall">명예의 전당</Link>
          </div>
          <div>
            <h2>안내</h2>
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">
              <b>개인정보처리방침</b>
            </Link>
          </div>
          <div>
            <h2>문의</h2>
            {CONTACT ? (
              <a className={s.mail} href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>
            ) : (
              <span>문의 창구 준비 중</span>
            )}
            <span className={s.note}>신고는 글·댓글의 신고 버튼이 가장 빨라요</span>
          </div>
        </nav>
        <p className={s.legal}>
          개인이 운영하는 비영리 사이트예요. 사진의 권리는 올린 분께 있어요. 픽은 언제나 무료예요. © 2026 프로듀스 댕냥
        </p>
      </div>
    </footer>
  );
}
