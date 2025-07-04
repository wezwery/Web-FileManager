#!/bin/bash

# 📂 Путь к backend и frontend
BACKEND_DIR="./backend"
FRONTEND_DIR="./frontend"

# 🌐 Порт для API и фронтенда
API_PORT=3000
FRONTEND_PORT=8080

# 🟢 Запуск backend
echo "🚀 Запускаем Backend на http://localhost:$API_PORT"
node "$BACKEND_DIR/server.js" &
BACKEND_PID=$!

# 🟢 Запуск фронтенда
echo "🌐 Хостим Frontend на http://localhost:$FRONTEND_PORT"
cd "$FRONTEND_DIR"
python3 -m http.server "$FRONTEND_PORT" --bind 0.0.0.0 &
FRONTEND_PID=$!

# 💤 Ожидание завершения процессов
echo "✅ File Manager запущен."
echo "🔗 API: http://localhost:$API_PORT"
echo "🔗 UI:  http://localhost:$FRONTEND_PORT"

# ⏹️ Завершение всех процессов при Ctrl+C
trap "echo '⛔ Остановка...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
