#!/usr/bin/env bash
# Gera os sons de letra provisorios (espeak-ng + ffmpeg) em assets/audio/gerado/som_<letra>.mp3
# Uso: bash ferramentas/gerar-sons.sh   (precisa de espeak-ng e ffmpeg)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=assets/audio/gerado
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
V="pt-br+f3"

# letra | entrada de fonemas | duracao maxima em segundos (0 = sem corte)
# Vogais e consoantes continuas: alongadas. Oclusivas surdas: curtas, sem vogal.
# Oclusivas sonoras (b d g): espeak sozinho sai mudo; pega-se "ba/da/ga" e corta-se
# logo depois da soltura, antes da vogal ficar audivel.
gerar() {
  # gerar letra fonemas duracao_max [fade_final]
  local letra="$1" fon="$2" dur="$3" fade="${4:-0.06}"
  espeak-ng -v "$V" -s 110 -p 60 "[[$fon]]" -w "$TMP/$letra.wav"
  # 1) corta silencio do inicio e, se pedido, limita a duracao
  local cut=""
  [ "$dur" != "0" ] && cut="-t $dur"
  ffmpeg -v error -y -i "$TMP/$letra.wav" \
    -af "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.004" \
    $cut -ar 22050 -ac 1 "$TMP/$letra.a.wav"
  # 2) corta silencio do fim
  ffmpeg -v error -y -i "$TMP/$letra.a.wav" \
    -af "areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse" \
    "$TMP/$letra.b.wav"
  # 3) normaliza pelo volume medio (alvo -20 dB) com limitador, fade curto, mp3 48 kbps
  local mean gain
  mean=$(ffmpeg -v info -i "$TMP/$letra.b.wav" -af volumedetect -f null - 2>&1 | sed -n 's/.*mean_volume: \(-\?[0-9.]*\) dB.*/\1/p')
  gain=$(awk -v m="$mean" 'BEGIN{g=-20-m; if(g>30)g=30; printf "%.1f", g}')
  ffmpeg -v error -y -i "$TMP/$letra.b.wav" \
    -af "volume=${gain}dB,alimiter=limit=0.89:attack=1:release=20,afade=t=in:d=0.004,areverse,afade=t=in:d=${fade},areverse" \
    -ar 22050 -ac 1 -b:a 48k "$OUT/som_$letra.mp3"
}

gerar a "a:::"      0.7
gerar e "e:::"      0.7
gerar i "i:::"      0.7
gerar o "o:::"      0.7
gerar u "u:::"      0.7
gerar m "mmmmmmm"   0.7
gerar n "nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn" 0.7
gerar l "llllllllllllllllll" 0.7
gerar f "ffffffffff"    0.7
gerar v "vvvvvvvvvvvv" 0.7
gerar s "ssssssssss"    0.7
gerar j "ZZZZZZZZZZ"    0.7
gerar z "zzzzzzzzzz"    0.7
# R forte do inicio da palavra (rato, rosa, roda): fricativa da garganta, como no Brasil
gerar r "xxxxxxxx"      0.7
# Oclusivas: pega-se a silaba com "a" e corta-se logo depois da soltura (antes da vogal soar).
gerar p "pa"        0.04 0.015
gerar t "ta"        0.04 0.015
gerar c "ka"        0.05 0.015
gerar b "ba"        0.07 0.02
gerar d "da"        0.045 0.02
gerar g "ga"        0.045 0.02
echo "Sons gerados em $OUT:"
for f in "$OUT"/som_*.mp3; do
  printf '%s %s s\n' "$(basename "$f")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
