
# Финансовый помощник — Telegram WebApp (полная версия)

Это готовый проект WebApp, который можно загрузить в GitHub и подключить к Telegram через BotFather.

## Что внутри
- `index.html` — основная страница WebApp (использует Telegram WebApp JS API и Chart.js)
- `style.css` — стили
- `script.js` — логика: сохранение в localStorage, график, экспорт CSV, отправка данных в Telegram

## Как развернуть на GitHub Pages
1. Создайте публичный репозиторий на GitHub.
2. Загрузите файлы (`index.html`, `style.css`, `script.js`, `README.md`) в корень репозитория.
3. Включите GitHub Pages: `Settings → Pages → Deploy from branch → main → / (root)`.
4. Подождите ~30–60 секунд — появится ссылка `https://<your-username>.github.io/<repo>/`

## Как подключить к боту (BotFather)
1. В Telegram откройте @BotFather
2. Используйте команду `/newapp` и следуйте инструкциям.
3. В поле URL вставьте ссылку GitHub Pages на `index.html`, например:
   `https://<your-username>.github.io/<repo>/index.html`
4. Сохраните — WebApp будет доступен внутри бота.

## Замечания и безопасность
- Данные хранятся в `localStorage` (на устройстве пользователя). Для централизованного хранения нужна серверная часть.
- WebApp использует `tg.sendData()` для отправки кратких сообщений в чат бота. Для полноценной интеграции можно добавить backend, который будет обрабатывать эти сообщения.
