#!/bin/zsh
cd "$(dirname "$0")"
PORT=8000
URL="http://localhost:${PORT}/index.html"

python3 -m http.server "${PORT}" >/tmp/mappa-dei-suoni-server.log 2>&1 &
SERVER_PID=$!

sleep 1
open "${URL}"

echo "Server avviato su ${URL}"
echo "Per fermarlo chiudi questa finestra oppure esegui: kill ${SERVER_PID}"
wait ${SERVER_PID}
