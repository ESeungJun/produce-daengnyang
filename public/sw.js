/*
 * 서비스 워커. 모든 화면이 처음 열릴 때 등록한다(features/pwa/RegisterSW, #8). 알림 받기(PushToggle)도 같은 파일을 쓴다.
 * - install: 오프라인 안내 화면(/offline.html)만 미리 담아 둔다(넘김을 거친 응답이어도 새 응답으로 다시 만들어 담는다). 다른 화면·데이터는 담지 않는다(늘 최신 표 수를 보여야 해서).
 * - activate: 이름이 바뀐 옛 캐시를 지운다. 안내 화면을 고치면 OFFLINE_CACHE 이름의 숫자를 올린다.
 * - fetch: 페이지 이동(navigate)만 맡는다. 네트워크로 받고, 연결이 끊겨 실패할 때만 안내 화면을 준다.
 *   사진·스크립트·API 요청은 건드리지 않는다(브라우저가 평소대로 처리).
 * - push: dispatch-notifications 가 보낸 { title, body, url, tag } 를 알림으로 띄운다(#7).
 * - notificationclick: 열린 창이 있으면 그 창으로 url 을 열고, 없으면 새 창을 연다(우리 사이트 안 경로만).
 */
// 운영(Cloudflare 정적 파일)은 /offline.html 을 /offline 으로 307 넘긴다. 넘어간 응답은 페이지 이동에 쓸 수 없어서
// 캐시에는 넘어간 뒤의 본문으로 새 응답을 만들어 넣는다(로컬 next dev 는 /offline.html 이 바로 200).
const OFFLINE_CACHE = "pd-offline-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then(async (c) => {
        const res = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
        if (!res.ok) throw new Error("오프라인 안내를 받지 못했어요");
        const body = await res.blob();
        await c.put(OFFLINE_URL, new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pd-offline-") && k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;
  event.respondWith(
    fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || new Response("인터넷이 끊겼어요", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })),
  );
});

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
