/**
 * 한국 시간(KST, UTC+9) 날짜 계산.
 *
 * 픽 한도("하루 3픽"), 라운드 일정, 자정 결과 확정이 모두 한국 시간 하루를 기준으로 한다.
 * 서버(Cloudflare)와 DB 는 UTC 로 돌기 때문에, 날짜를 셀 때는 반드시 이 파일의 함수를 거친다.
 * 한국은 서머타임이 없어서 +9시간 고정으로 계산해도 된다(Intl 을 쓰지 않는 이유: 워커에서 더 가볍다).
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 그 순간의 한국 날짜를 "YYYY-MM-DD" 로 준다. DB 의 picks.kst_date 와 같은 꼴. */
export function kstDate(at: Date = new Date()): string {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 다음 한국 자정(00:00 KST)의 UTC 시각. "자정에 픽 3장이 다시 생겨요" 남은 시간 계산에 쓴다. */
export function nextKstMidnight(at: Date = new Date()): Date {
  const [y, m, d] = kstDate(at).split("-").map(Number);
  // 한국 날짜 y-m-d 다음 날 00:00 KST = 그날 15:00 UTC
  return new Date(Date.UTC(y, m - 1, d, 15, 0, 0));
}

/** 한국 시간 기준 그 달의 마지막 날짜(28~31). 결선 기간(22일~말일) 계산에 쓴다. */
export function kstLastDayOfMonth(year: number, month: number): number {
  // month 는 1~12. Date.UTC 의 일자 0 은 전달 마지막 날이다.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
