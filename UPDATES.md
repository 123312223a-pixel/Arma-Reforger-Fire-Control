# Подписанные обновления

В проекте есть два сценария GitHub Actions:

- **Build Windows installer** — запускается автоматически при изменении main или вручную. Собирает обычный установщик Windows в разделе Actions → Artifacts. Этот вариант не получает автообновления и безопасен для проверки сборки.
- **Release signed Windows update** — работает только после создания твоего ключа Tauri и настройки секретов GitHub. Публикует релиз в Releases, а также `latest.json` для обновлений.

## Один раз настроить подпись

На своём компьютере Windows открой PowerShell из папки проекта:

```powershell
npm install
npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\reforger-updater.key"
```

При генерации задай пароль, сохрани приватный ключ и его пароль в надёжном месте. **Никогда не загружай `.key` на GitHub**.

На GitHub открой **Settings → Secrets and variables → Actions**:

**Secrets:**
- `TAURI_SIGNING_PRIVATE_KEY` — полное содержимое приватного ключа Tauri (или подходящий способ, поддерживаемый Tauri CLI).
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — пароль от ключа, если задан.

**Variables:**
- `TAURI_UPDATER_PUBLIC_KEY` — содержимое файла `reforger-updater.key.pub` (две строки).

> До добавления действительных ключей подписанные релизы не публикуются. Не используй фиктивные ключи.

## Выпуск версии

1. Измени приложение.
2. Обнови номера в `package.json`, `src-tauri/tauri.conf.json` и `Cargo.toml` командой `npm run version:set -- 3.6.1`.
3. Обнови CHANGELOG.
4. После коммита в main создай тег соответствующей версии (например, `v3.6.1`) и отправь тег в GitHub. Рабочий процесс **Release signed Windows update** запустится и создаст публичный установщик.

## Как пользователи получают обновления

Приложение один раз устанавливается из подписанного релиза. Далее оно может проверять `https://github.com/123312223a-pixel/Arma-Reforger-Fire-Control/releases/latest/download/latest.json` и при наличии новой версии предложит установку после подтверждения.

Все данные целей, батарей и задач хранятся локально; перед установкой создаётся JSON-резервная копия.
