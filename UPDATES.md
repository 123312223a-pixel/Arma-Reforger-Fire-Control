# Подписанные обновления Windows / Arma Reforger Fire Control 3.6

## Принцип работы

Приложение проверяет `https://github.com/OWNER/REPO/releases/latest/download/latest.json`, **где OWNER/REPO — адрес вашего собственного GitHub-репозитория**. Публичный ключ подписи встроен в установщик, и Tauri откажется устанавливать релизы, подписанные другим закрытым ключом. Приватный ключ никогда не включается в архив и не загружается в репозиторий.

Это решение используется **только для установщиков, созданных после настройки канала**. Уже установленная версия 3.5 физически не умеет автоматически обновляться до 3.6: потребуется **однократная установка** версии 3.6 поверх старой (с тем же `identifier`). После этого последующие версии можно устанавливать из приложения. Для релизов нужен интернет; обычный калькулятор остаётся офлайн.

## Шаг 1. Создайте GitHub-репозиторий

Создайте публичный репозиторий (к примеру `yourname/reforger-fire-control`) и загрузите в его корень содержимое папки проекта. Публичные GitHub Releases нужны, чтобы клиенты без авторизации могли получить `latest.json`.

## Шаг 2. Сгенерируйте ключи ОДИН РАЗ на своём Windows-ПК

В PowerShell в папке проекта после `npm install`:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.tauri"
npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\reforger-updater.key"
```

Если CLI запрашивает пароль, используйте надёжный пароль. Храните приватный файл `reforger-updater.key` и пароль вне репозитория (например, в менеджере паролей); его утрата лишит вас возможности подписывать новые обновления для существующих установок. Публичный ключ находится в `.key.pub` и может быть распространён.

## Шаг 3. Включите подпись релизов GitHub Actions

Repository → Settings → Secrets and variables → Actions:

- **Variables:** `TAURI_UPDATER_PUBLIC_KEY` — полное содержимое `reforger-updater.key.pub`.
- **Secrets:** `TAURI_SIGNING_PRIVATE_KEY` — полное содержимое приватного файла `reforger-updater.key` (не путь на вашем ПК).
- **Secrets:** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — пароль, если задавали.

Не записывайте приватный ключ в исходный код, комментарии, публичные файлы или переписку. В GitHub должна лежать только защищённая копия в Actions Secrets.

## Шаг 4. Опубликуйте первый релиз с обновлениями

Проверьте, что версии в `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` совпадают (сейчас **3.6.0**). Затем:

```powershell
git tag v3.6.0
git push origin v3.6.0
```

GitHub Actions запустит `Release signed Windows update`. Конфигурация создаётся в CI из проверенного адреса `github.repository` и публичного ключа, собирается Windows NSIS установщик и его `.sig`, публикуется Release с `latest.json`. После успешной публикации убедитесь, что URL `https://github.com/OWNER/REPO/releases/latest/download/latest.json` открывается без авторизации и содержит платформу `windows-x86_64`.

Скачайте `setup.exe` из Releases и установите его один раз поверх текущей версии 3.5. Библиотека целей сохраняется в `%LOCALAPPDATA%` отдельно от установщика. Рекомендуется заранее выполнить экспорт JSON.

## Шаг 5. Выпустите следующую версию

Выполните `npm run version:set -- 3.6.1`, обновите `CHANGELOG.md`, затем запустите `npm run check`, закоммитьте изменения и опубликуйте тег `v3.6.1`. GitHub Actions подпишет обновление **тем же закрытым ключом** и создаст новый `latest.json`. Пользователь 3.6.0 увидит предложение обновиться до 3.6.1.

Не меняйте `identifier` и закрытый ключ между релизами. Не удаляйте предыдущие релизы до проверки обновления. Не используйте приватный репозиторий без отдельного механизма авторизации.

## Локальная сборка с обновлениями (без GitHub Actions)

В PowerShell (сначала нужно создать ключи):

```powershell
$env:FIRE_CONTROL_REPOSITORY='OWNER/REPO'
$env:TAURI_UPDATER_PUBLIC_KEY_FILE="$env:USERPROFILE\.tauri\reforger-updater.key.pub"
npm run configure:updates
$env:TAURI_SIGNING_PRIVATE_KEY="$env:USERPROFILE\.tauri\reforger-updater.key"
# Если ключ запаролен, задайте: $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD='...'
npm install
npm run check
npm run build:updates
```

Установщик и `.sig` появятся в `src-tauri\target\release\bundle\nsis`. **При локальной сборке GitHub Release и `latest.json` не создаются автоматически** — для автоматической публикации используйте workflow.

## Когда обновления не настроены

Обычная разработческая сборка через `build-windows.bat` продолжает работать без доступа к сети. Кнопка «Обновления» сообщает, что подписанный канал пока не включён. Приложение не пытается скачать произвольные файлы.

## Безопасность / ограничения

- Пакеты обновлений подписываются **ключом обновлений Tauri**, а не сертификатом Windows Authenticode. Это разные механизмы. Windows SmartScreen может показывать предупреждение без сертификата издателя.
- Установка NSIS обычно закрывает приложение, а затем перезапускает его. Для других систем требуется другая конфигурация.
- Конфигурация HTTP запрещена в production; только HTTPS GitHub Releases.
- Для проверки/загрузки обновлений нужен доступ к GitHub. Обычный калькулятор работает полностью офлайн.
- Старый установщик 3.5 не получает механизм обновлений задним числом.
- Если обновление не удалось, сохранённая JSON-копия останется в каталоге AppLocalData.

Официальная документация: https://v2.tauri.app/plugin/updater/ и https://v2.tauri.app/distribute/pipelines/github/.
