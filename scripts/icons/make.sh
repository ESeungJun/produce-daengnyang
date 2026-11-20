#!/bin/bash
# 앱 아이콘을 다시 만든다(#8): public/icons/*.png, app/apple-icon.png.
# 원본은 같은 폴더 icon.html. 크롬 머리 없는 모드로 크기마다 찍는다(글꼴은 Google Fonts 에서 받으므로 인터넷 필요).
set -euo pipefail
cd "$(dirname "$0")/../.."
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SRC="file://$PWD/scripts/icons/icon.html"
shot() { # 크기 출력 [#mask]
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=4000 --window-size="$1,$1" --screenshot="$PWD/$2" "$SRC${3:-}" >/dev/null 2>&1
  echo "$2 $(sips -g pixelWidth "$2" | tail -1 | awk '{print $2}')px"
}
shot 192 public/icons/icon-192.png
shot 512 public/icons/icon-512.png
shot 512 public/icons/maskable-512.png "#mask"
shot 180 app/apple-icon.png
