/**
 * 데뷔 확정 메일(#27). dispatch-notifications 가 kind=debut 알림을 메일로 보낼 때 이 본문을 쓴다(다른 kind 는 null → 기존 한 줄 본문).
 * 데뷔 주인에게 화보 사진·GIF·동영상(최대 20칸)을 올려 달라고 부탁하고, 사이트 어느 자리에 어떻게 보이는지 가이드 그림과 자리 설명을 함께 준다.
 * 가이드 그림은 사이트 정적 파일 public/mail/debut-guide.jpg(960px, 실제 메인 댕댕이 보기·데뷔 화보 화면 캡처에 자리 번호를 얹은 것)다.
 * 화면 구성이 바뀌면 그림도 다시 찍는다(설계서 #27 줄).
 * 메일 앱은 CSS 변수·외부 글꼴을 못 읽어 색 값을 직접 적는다: --pd-ink #141414 · --pd-ink-2 #5F5F5F · --pd-pink #E0457B.
 * Deno(Edge Function)와 Vitest 가 함께 읽으므로 아무것도 가져오지 않는다.
 */
type Payload = { entry_id?: string; pet_name?: string; board?: string };

export type DebutMail = { subject: string; html: string; text: string };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** 사진이 걸리는 자리. 가이드 그림의 번호와 같다(원래 사진 = 투표 때 올린 사진, 화보 = 새로 올리는 사진) */
export const DEBUT_SPOTS = [
  { no: 1, photo: "원래 사진", where: "메인 표지", how: "가로로 넓게 잘려요" },
  { no: 2, photo: "원래 사진", where: "왼쪽 세로 배너(컴퓨터)", how: "세로로 길게 잘려요" },
  { no: 3, photo: "화보 사진", where: "오른쪽 세로 배너(컴퓨터)", how: "댕댕이·냥이 보기에서, 세로로 길게 몇 장씩 넘겨요" },
  { no: 4, photo: "화보 사진", where: "표지 아래 대각선 배너", how: "댕댕이·냥이 보기에서, 가로로 넓게 잘려요" },
  { no: 5, photo: "화보 사진", where: "데뷔 화보 사진 벽", how: "올린 사진·GIF·동영상 전부(최대 20칸)" },
] as const;

/** 사진 고르는 요령. 자리마다 가로·세로로 잘리므로 얼굴이 가운데 있는 사진이 어디서든 잘 보인다 */
export const DEBUT_TIPS = [
  "얼굴이 가운데 있는 사진이 가로·세로 어느 자리에서도 잘 보여요",
  "밝은 곳에서 찍은 사진, 흔들리지 않은 원본 화질이 좋아요",
  "가로 사진과 세로 사진을 섞어 3장 이상 올려 주세요(최대 20칸)",
  "사람 얼굴·집 주소처럼 알리고 싶지 않은 것이 보이면 빼 주세요",
] as const;

/**
 * 데뷔 메일 제목·본문. debut 가 아니거나 글 정보가 모자라면 null(호출하는 쪽이 기존 본문을 쓴다).
 * site: 끝 / 없는 사이트 주소(예: https://….workers.dev)
 */
export function debutMail(kind: string, payload: unknown, site: string): DebutMail | null {
  if (kind !== "debut") return null;
  const p = (payload && typeof payload === "object" ? payload : {}) as Payload;
  const board = p.board === "dog" || p.board === "cat" ? p.board : null;
  if (!board || !p.entry_id || !/^[0-9a-f-]{36}$/i.test(p.entry_id)) return null;
  // 제목 머리글에 들어가므로 줄바꿈·제어 문자는 공백으로
  const name = p.pet_name?.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() || "우리 아이";
  const upload = `${site}/${board}/${p.entry_id}/gallery`;
  const detail = `${site}/${board}/${p.entry_id}`;
  const guide = `${site}/mail/debut-guide.jpg`;
  const n = escapeHtml(name);
  const subject = `‘${name}’ 데뷔 확정! 화보 사진을 올려 주세요`;

  const spots = DEBUT_SPOTS.map(
    (s) =>
      `<tr><td style="padding:6px 10px 6px 0;vertical-align:top"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;text-align:center;font-size:12px;font-weight:700;color:#fff;background:${s.photo === "화보 사진" ? "#E0457B" : "#141414"}">${s.no}</span></td><td style="padding:6px 0;font-size:14px;line-height:1.5"><b>${s.where}</b> · ${s.photo}<br><span style="color:#5F5F5F">${s.how}</span></td></tr>`,
  ).join("");
  const tips = DEBUT_TIPS.map((t) => `<li style="margin:0 0 6px">${t}</li>`).join("");

  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#141414;background:#ffffff">
<p style="font-size:13px;color:#5F5F5F;margin:0 0 8px">프로듀스 댕냥</p>
<p style="font-size:22px;font-weight:700;line-height:1.4;margin:0 0 12px">‘${n}’ 데뷔를 축하해요!</p>
<p style="font-size:15px;line-height:1.7;margin:0 0 20px">이번 달 내내 ‘${n}’ 사진이 사이트 메인과 데뷔 화보에 걸려요. 더 멋진 화보가 되도록 <b>보여 주고 싶은 사진을 올려 주세요.</b></p>
<p style="margin:0 0 28px"><a href="${escapeHtml(upload)}" style="display:inline-block;background:#E0457B;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700">화보 사진 올리기 (최대 20칸)</a></p>
<p style="font-size:17px;font-weight:700;margin:0 0 10px">사진은 이렇게 걸려요</p>
<img src="${escapeHtml(guide)}" width="472" alt="데뷔 사진이 걸리는 자리 예시: 메인 표지, 양옆 세로 배너, 대각선 배너, 데뷔 화보 사진 벽" style="display:block;width:100%;max-width:472px;height:auto;border:1px solid #EEEEEE;border-radius:12px;margin:0 0 12px">
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px">${spots}</table>
<p style="font-size:17px;font-weight:700;margin:0 0 8px">사진 고르는 요령</p>
<ul style="font-size:14px;line-height:1.6;padding-left:20px;margin:0 0 24px">${tips}</ul>
<p style="margin:0 0 24px"><a href="${escapeHtml(detail)}" style="color:#141414;font-weight:700">‘${n}’ 데뷔 화보 보러 가기 →</a></p>
<p style="font-size:12px;color:#5F5F5F;line-height:1.6;margin:0">데뷔한 글의 주인에게만 보내요. 사진은 로그인한 뒤 내 정보 → 내 글에서도 올릴 수 있어요. 알림은 사이트의 내 정보에서도 볼 수 있어요.</p>
</div>`;

  const text = [
    `‘${name}’ 데뷔를 축하해요!`,
    `이번 달 내내 사이트 메인과 데뷔 화보에 걸려요. 보여 주고 싶은 사진을 올려 주세요(최대 20칸).`,
    `화보 사진 올리기: ${upload}`,
    ``,
    `사진은 이렇게 걸려요 (가이드 그림: ${guide})`,
    ...DEBUT_SPOTS.map((s) => `${s.no}. ${s.where} · ${s.photo} · ${s.how}`),
    ``,
    `사진 고르는 요령`,
    ...DEBUT_TIPS.map((t) => `- ${t}`),
    ``,
    `데뷔 화보 보러 가기: ${detail}`,
  ].join("\n");

  return { subject, html, text };
}
