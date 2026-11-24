#!/bin/zsh
# 把 ChatGPT 去边框后的画面（~/Downloads/naiwa_art_NN*.png，取最新）导入为网页素材
cd "$(dirname "$0")/.."
for n in "$@"; do
  f=$(ls -t ~/Downloads/naiwa_art_${n}*.png 2>/dev/null | head -1)
  [ -z "$f" ] && { echo "$n 缺失"; continue; }
  cp "$f" assets-src/chatgpt_art/$n.png
  magick assets-src/chatgpt_art/$n.png -resize 1024x1536^ -gravity center -extent 1024x1536 -quality 95 /tmp/naiwa_art_tmp.png
  cwebp -quiet -q 82 /tmp/naiwa_art_tmp.png -o public/cards/art-full/${ID_PREFIX:-major_}$n.webp
  cwebp -quiet -q 80 -resize 512 0 /tmp/naiwa_art_tmp.png -o public/cards/art-sm/${ID_PREFIX:-major_}$n.webp
  echo "$n ok $(magick assets-src/chatgpt_art/$n.png -format '%wx%h' info:)"
done
