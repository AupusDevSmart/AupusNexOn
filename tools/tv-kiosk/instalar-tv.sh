#!/usr/bin/env bash
# NexON na TV — Raspberry Pi (3, 4 ou 5) em modo quiosque.
# Raspberry Pi OS **Lite** 64-bit (Bookworm ou Trixie). Rodar UMA vez, por SSH, com o usuário normal (não root):
#   bash instalar-tv.sh [URL]
# O Pi passa a ligar direto no Chromium em tela cheia (cage, sem área de trabalho),
# reabre o navegador se ele fechar e reinicia todo dia às 04:00.
set -euo pipefail

URL="${1:-https://nexon.aupusenergia.com.br}"
USUARIO="$(id -un)"
[ "$USUARIO" = "root" ] && { echo "Rode com o usuário normal (ex.: pi), não root."; exit 1; }
MODELO="$(tr -d '\0' < /proc/device-tree/model 2>/dev/null || echo desconhecido)"
# Pi 3 (1 GB): economia de memória. Pi 4/5: sem as economias (elas pioram o desenho).
FRACO=0
case "$MODELO" in *"Pi 3"*|*"Pi 2"*|*"Zero"*) FRACO=1 ;; esac
EXTRA=""
[ "$FRACO" = 1 ] && EXTRA="--enable-low-end-device-mode --renderer-process-limit=2"
echo "Modelo: $MODELO (modo econômico: $FRACO)"

echo "== Pacotes (cage + Chromium) =="
sudo apt-get update
# Bookworm: pacote chromium-browser; Trixie (Pi OS mais novo): chromium
PACOTE=chromium
apt-cache show chromium-browser >/dev/null 2>&1 && PACOTE=chromium-browser
sudo apt-get install -y --no-install-recommends cage "$PACOTE" fonts-noto-color-emoji
# o binário é descoberto depois de instalar (o pacote de transição pode não trazer o nome antigo)
CHROMIUM="$(command -v chromium || command -v chromium-browser || true)"
[ -n "$CHROMIUM" ] || { echo "Chromium não ficou instalado (pacote $PACOTE). Mande esta saída para o suporte."; exit 1; }
echo "Navegador: $CHROMIUM"

if [ "$FRACO" = 1 ]; then
  echo "== Memória: zram (Pi 3 tem só 1 GB) =="
  sudo apt-get install -y --no-install-recommends zram-tools
  echo -e "ALGO=lz4\nPERCENT=60" | sudo tee /etc/default/zramswap >/dev/null
  sudo systemctl restart zramswap || true
fi

echo "== Script do quiosque =="
cat > "$HOME/tv.sh" <<EOF
#!/usr/bin/env bash
# Abre o NexON em tela cheia; se o Chromium fechar ou travar, abre de novo.
# O perfil (~/.config/chromium) guarda o login: entra uma vez com teclado e mouse e pronto.
while true; do
  cage -- $CHROMIUM \\
    --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
    --no-first-run --password-store=basic --check-for-update-interval=31536000 \\
    --disable-features=Translate,MediaRouter $EXTRA --disk-cache-size=50000000 \\
    --ozone-platform=wayland \\
    "$URL"
  sleep 5
done
EOF
chmod +x "$HOME/tv.sh"

echo "== Login automático no tty1 e quiosque ao entrar =="
sudo raspi-config nonint do_boot_behaviour B2   # console com login automático
if ! grep -q 'tv.sh' "$HOME/.bash_profile" 2>/dev/null; then
  cat >> "$HOME/.bash_profile" <<'EOF'

# NexON na TV: só no console da TV (tty1); SSH continua normal
if [ "$(tty)" = "/dev/tty1" ]; then exec "$HOME/tv.sh"; fi
EOF
fi

echo "== Vídeo: 1080p fixo (em TV 4K o texto fica legível e o desenho leve) e tela sem apagar =="
CMDLINE=/boot/firmware/cmdline.txt
[ -f "$CMDLINE" ] || CMDLINE=/boot/cmdline.txt
sudo cp -n "$CMDLINE" "$CMDLINE.antes-tv" || true
for opt in "video=HDMI-A-1:1920x1080@60" "consoleblank=0"; do
  grep -q "${opt%%=*}=" "$CMDLINE" || sudo sed -i "1 s|\$| $opt|" "$CMDLINE"
done

echo "== Reboot diário 04:00 (limpa a memória) =="
# root ainda não tem crontab num Pi novo: "crontab -l" falha e, com set -e/pipefail, derrubava o script aqui
CRON_ATUAL="$(sudo crontab -l 2>/dev/null | grep -v 'reboot # nexon-tv' || true)"
printf '%s\n%s\n' "$CRON_ATUAL" '0 4 * * * /sbin/shutdown -r now # nexon-tv' | sed '/^$/d' | sudo crontab -

echo
echo "Pronto. Reinicie com:  sudo reboot"
echo "Na primeira vez, faça o login no NexON na TV (teclado e mouse). Depois pode tirar o mouse."
echo "Para sair do quiosque: por SSH,  pkill -f tv.sh; pkill cage"
echo "Para trocar a página: edite a URL em ~/tv.sh e rode  pkill cage"
