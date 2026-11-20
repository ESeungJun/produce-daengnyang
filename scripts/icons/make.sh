#!/bin/bash
# 앱 아이콘을 다시 만든다(#8, #35): public/icons/*.png, app/apple-icon.png, app/favicon.ico.
# 원본은 같은 폴더 icon.html. 크롬 머리 없는 모드로 512 만 찍고 작은 크기는 sips 로 줄인다
# (크롬은 창을 약 500px 아래로 줄이지 못해 180·192 를 바로 찍으면 왼쪽 위만 찍힌다, #35).
# 글꼴은 Google Fonts 에서 받으므로 인터넷이 필요하다.
set -euo pipefail
cd "$(dirname "$0")/../.."
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SRC="file://$PWD/scripts/icons/icon.html"
WORK="$PWD/.work/icon/make"
mkdir -p "$WORK"
shot() { # 출력 [#mask|#small]  — 늘 512 로 찍는다
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=4000 --window-size=512,512 --screenshot="$1" "$SRC${2:-}" >/dev/null 2>&1
}
size() { # 원본 크기 출력
  sips -z "$2" "$2" "$1" --out "$3" >/dev/null
  echo "$3 $(sips -g pixelWidth "$3" | tail -1 | awk '{print $2}')px"
}
shot public/icons/icon-512.png
shot public/icons/maskable-512.png "#mask"
shot "$WORK/small-512.png" "#small"
echo "public/icons/icon-512.png 512px"
size public/icons/icon-512.png 192 public/icons/icon-192.png
size public/icons/icon-512.png 180 app/apple-icon.png
# Next 빌드는 ICO 안 PNG 가 RGBA 여야 읽는다(sips 결과는 RGB 라 빌드가 멈춤, #35). ffmpeg 로 줄이며 RGBA 로 쓴다
for s in 16 32 48; do
  ffmpeg -loglevel error -y -i "$WORK/small-512.png" -vf "scale=$s:$s:flags=lanczos,format=rgba" "$WORK/fav-$s.png"
  echo "$WORK/fav-$s.png ${s}px"
done
# favicon.ico: PNG 세 장을 그대로 담는다(ICO 머리 6바이트 + 장마다 16바이트 목록 + PNG 본문)
node -e '
const fs = require("fs");
const [out, ...files] = process.argv.slice(1);
const pngs = files.map((f) => fs.readFileSync(f));
const head = Buffer.alloc(6 + 16 * pngs.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
let off = head.length;
pngs.forEach((p, i) => {
  const e = 6 + 16 * i, w = p.readUInt32BE(16);
  head.writeUInt8(w >= 256 ? 0 : w, e); head.writeUInt8(w >= 256 ? 0 : w, e + 1);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(p.length, e + 8); head.writeUInt32LE(off, e + 12);
  off += p.length;
});
fs.writeFileSync(out, Buffer.concat([head, ...pngs]));
console.log(out, pngs.length + "장");
' app/favicon.ico "$WORK/fav-16.png" "$WORK/fav-32.png" "$WORK/fav-48.png"
