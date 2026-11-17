/**
 * 메인 자리. 지금은 배포가 되는지 확인하는 준비 화면이고, #4 에서 표지·목차·차트로 바뀐다.
 */
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <p className={styles.issue}>창간 준비호</p>
      <h1 className={styles.mast}>
        프로듀스
        <br />
        댕냥
      </h1>
      <p className={styles.lead}>
        강아지·고양이 사진 오디션을 준비하고 있어요. 매주 픽으로 센터를 뽑고, 월말 결선에서 데뷔해요.
      </p>
      <p className={styles.close}>
        첫 라운드가 열리면 <em>연습생 모집 공고</em>가 여기 올라와요.
      </p>
    </main>
  );
}
