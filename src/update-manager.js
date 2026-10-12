import { check } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';

// This UI runs in WebView2 and gracefully disables itself in ordinary HTML/unsigned builds.
// Actual downloads and signature verification are handled by the official Rust updater plugin.
const SETTINGS_KEY = 'reforger_update_preferences_v1';
const $ = (id) => document.getElementById(id);
const els = {
  panel: $('fcUpdatePanel'), status: $('fcUpdateStatus'), notes: $('fcUpdateReleaseNotes'),
  progress: $('fcUpdateProgress'), check: $('fcCheckUpdateButton'),
  install: $('fcInstallUpdateButton'), later: $('fcLaterUpdateButton'),
  automatic: $('fcAutomaticUpdates'), version: $('fcInstalledVersion'), badge: $('fcUpdateBadge')
};
let enabled = false;
let busy = false;
let candidate = null;
let autoCheck = true;
let ignoredVersion = null;

function status(message) { els.status.textContent = message; }
function setBusy(b) {
  busy = b; els.check.disabled = b; els.install.disabled = b; els.later.disabled = b;
}
function hideCandidate() {
  candidate?.close?.().catch(() => {});
  candidate = null;
  els.notes.textContent = ''; els.notes.classList.add('fc-update-hidden');
  els.install.classList.add('fc-update-hidden');
  els.later.classList.add('fc-update-hidden');
  els.progress.classList.add('fc-update-hidden');
  els.progress.removeAttribute('value');
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({autoCheck, ignoredVersion})); }
  catch (_) { /* AppLocalData is still backed up separately. */ }
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    autoCheck = s.autoCheck !== false;
    ignoredVersion = typeof s.ignoredVersion === 'string' ? s.ignoredVersion : null;
  } catch (_) { autoCheck = true; ignoredVersion = null; }
  els.automatic.checked = autoCheck;
}
async function checkNow(silent=false) {
  if (busy || !enabled) {
    if (!enabled && !silent) status('Обновления ещё не настроены в этой сборке. Настройте публичный ключ и репозиторий, затем соберите установщик с подписанными обновлениями.');
    return;
  }
  setBusy(true);
  hideCandidate();
  status('Проверка подписанных релизов…');
  try {
    const update = await check();
    if (!update) {
      status('Установлена последняя доступная версия.');
      els.badge.textContent = '';
      return;
    }
    if (silent && ignoredVersion === update.version) {
      await update.close();
      status(`Версия ${update.version} доступна, напоминание отложено.`);
      return;
    }
    candidate = update;
    status(`Доступно обновление ${update.version}. Ваша версия: ${els.version.textContent}.`);
    els.notes.textContent = update.body?.trim() || 'Разработчик не приложил описание изменений.';
    els.notes.classList.remove('fc-update-hidden');
    els.install.classList.remove('fc-update-hidden');
    els.later.classList.remove('fc-update-hidden');
    els.badge.textContent = '●';
    if (silent) {
      // Only notify, never automatically download or install.
      const el = $('opFeedback');
      if (el) el.textContent = `Есть обновление ${update.version}. Откройте «История и аудит» → «Обновления».`;
    }
  } catch (error) {
    status(`Не удалось проверить обновления: ${String(error)}. Проверьте интернет и доступность релизов.`);
  } finally { setBusy(false); }
}
function later() {
  if (!candidate || busy) return;
  ignoredVersion = candidate.version;
  saveSettings();
  hideCandidate();
  status(`Напоминание отложено. Проверить вручную можно в любой момент.`);
  els.badge.textContent = '';
}
async function installNow() {
  if (busy || !candidate) return;
  const version = candidate.version;
  const approved = window.confirm(`Установить подписанное обновление ${version}?\nПриложение сохранит резервную копию и завершит работу для установки.`);
  if (!approved) return;
  setBusy(true);
  const update = candidate;
  try {
    status('Создание резервной копии целей, орудий и задач…');
    if (typeof window.backupBeforeUpdate !== 'function') throw new Error('Функция резервного копирования отсутствует');
    const backup = await window.backupBeforeUpdate();
    status(`Резервная копия: ${backup}\nПодготовка к загрузке…`);
    els.progress.classList.remove('fc-update-hidden');
    els.progress.removeAttribute('value');
    let downloaded = 0, total = 0;
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') { total = event.data.contentLength || 0; downloaded = 0; }
      if (event.event === 'Progress') downloaded += event.data.chunkLength;
      if (event.event === 'Finished') status('Загрузка завершена. Проверка подписи и запуск установщика…');
      else {
        const mb = (downloaded / 1048576).toFixed(1);
        status(`Загрузка ${version}: ${mb}${total ? ` из ${(total / 1048576).toFixed(1)}` : ''} МБ`);
        if (total) { els.progress.value = Math.min(100, downloaded / total * 100); }
        else els.progress.removeAttribute('value');
      }
    });
    // On Windows, updater launches installer and exits the application.
    status('Установщик запущен. Приложение будет перезапущено после установки.');
  } catch (error) {
    status(`Обновление не выполнено: ${String(error)}. Текущая версия сохранена.`);
    els.progress.classList.add('fc-update-hidden');
  } finally { setBusy(false); }
}
function open() {
  const el = document.getElementById('archive');
  if (el && !el.classList.contains('active')) {
    const btn = [...document.querySelectorAll('.sidebar-btn')]
      .find((b) => (b.getAttribute('onclick') || '').includes("'archive'"));
    btn?.click();
  }
  els.panel?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function init() {
  loadSettings();
  els.check.addEventListener('click', () => checkNow(false));
  els.install.addEventListener('click', installNow);
  els.later.addEventListener('click', later);
  els.automatic.addEventListener('change', () => {
    autoCheck = els.automatic.checked; saveSettings();
    status(autoCheck ? 'Проверка при запуске включена.' : 'Автопроверка выключена; вручную проверить можно всегда.');
  });
  window.fireControlUpdater = {open, check: () => checkNow(false)};
  if (typeof window.__TAURI__?.core?.invoke !== 'function') {
    els.version.textContent = 'Веб-режим';
    status('Обновления доступны только внутри подписанной Windows-сборки.');
    els.check.disabled = true;
    return;
  }
  try {
    els.version.textContent = await getVersion();
    enabled = await window.__TAURI__.core.invoke('updater_available');
    if (!enabled) {
      status('Эта сборка работает офлайн без автообновлений. Для включения требуется конфигурация подписанного канала и новая сборка.');
      els.check.disabled = true;
      return;
    }
  } catch (error) {
    status('Модуль обновлений недоступен: ' + String(error));
    els.check.disabled = true;
    return;
  }
  status('Система подписанных обновлений готова.');
  if (autoCheck) setTimeout(() => checkNow(true), 2500);
}
// The toolbar uses an inline onclick handler and can fire before the ES module executes.
window.fireControlUpdater = {open, check: () => checkNow(false)};
init();
