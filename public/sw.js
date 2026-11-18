/*
 * 서비스 워커(#7 결과 알림 푸시). 내 정보의 "이 기기에서 알림 받기"가 등록한다.
 * - push: dispatch-notifications 가 보낸 { title, body, url, tag } 를 알림으로 띄운다.
 * - notificationclick: 열린 창이 있으면 그 창으로 url 을 열고, 없으면 새 창을 연다(우리 사이트 안 경로만).
 * 오프라인 캐시·설치(PWA)는 #8 에서 이 파일에 더한다.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" ? data.title : "프로듀스 댕냥";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "새 알림이 있어요",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url: typeof data.url === "string" ? data.url : "/me" },
      lang: "ko",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // 주소를 먼저 풀어 보고 우리 사이트가 아니면 내 정보로 보낸다("/\\다른곳" 같은 꼴도 막는다)
  let target = new URL("/me", self.location.origin);
  try {
    const u = new URL(event.notification.data?.url || "/me", self.location.origin);
    if (u.origin === self.location.origin) target = u;
  } catch {}
  const url = target.href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => new URL(w.url).origin === self.location.origin);
      // 이 워커가 맡지 않은 창이면 navigate 가 실패하므로 그때는 새 창을 연다
      if (same) return same.navigate(url).then((w) => (w ? w.focus() : self.clients.openWindow(url))).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    }),
  );
});
