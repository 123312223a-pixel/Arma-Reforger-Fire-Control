import { check } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';

// Tauri verifies digital signatures; JavaScript only presents and controls updates.
const SETTINGS_KEY='reforger_update_preferences_v1';
const $=(id)=>document.getElementById(id);
const els={
 panel:$('fcUpdatePanel'),status:$('fcUpdateStatus'),notes:$('fcUpdateReleaseNotes'),
 progress:$('fcUpdateProgress'),check:$('fcCheckUpdateButton'),
 install:$('fcInstallUpdateButton'),later:$('fcLaterUpdateButton'),
 automatic:$('fcAutomaticUpdates'),version:$('fcInstalledVersion'),badge:$('fcUpdateBadge')
};
let enabled=false,busy=false,candidate=null,autoCheck=true,ignoredVersion=null;
function status(message){els.status.textContent=message;}
function busySet(value){busy=value;els.check.disabled=value;els.install.disabled=value;els.later.disabled=value;}
function hideUpdate(){
 candidate?.close?.().catch(()=>{});
 candidate=null;
 els.notes.textContent='';
 els.notes.classList.add('fc-update-hidden');
 els.install.classList.add('fc-update-hidden');
 els.later.classList.add('fc-update-hidden');
 els.progress.classList.add('fc-update-hidden');
 els.progress.removeAttribute('value');
}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({autoCheck,ignoredVersion}));}catch(_){}}
function loadSettings(){
 try{const o=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');autoCheck=o.autoCheck!==false;ignoredVersion=typeof o.ignoredVersion==='string'?o.ignoredVersion:null;}catch(_){}
 els.automatic.checked=autoCheck;
}
async function checkNow(silent=false){
 if(busy||!enabled){
  if(!enabled&&!silent)status('Канал подписанных обновлений ещё не настроен. Используйте подписанный релиз приложения.');
  return;
 }
 busySet(true);hideUpdate();status('Проверка подписанных обновлений…');
 try{
  const update=await check();
  if(!update){status('Установлена последняя доступная версия.');els.badge.textContent='';return;}
  if(silent&&ignoredVersion===update.version){await update.close();status('Напоминание об обновлении '+update.version+' отложено.');return;}
  candidate=update;
  status('Доступно обновление '+update.version+'. Установлено: '+els.version.textContent+'.');
  els.notes.textContent=update.body?.trim()||'Описание изменений отсутствует.';
  els.notes.classList.remove('fc-update-hidden');
  els.install.classList.remove('fc-update-hidden');
  els.later.classList.remove('fc-update-hidden');
  els.badge.textContent='●';
  if(silent&&$('opFeedback'))$('opFeedback').textContent='Новое обновление '+update.version+' — откройте «Обновления».';
 }catch(e){status('Не удалось проверить обновления: '+String(e));}
 finally{busySet(false);}
}
function later(){if(!candidate||busy)return;ignoredVersion=candidate.version;saveSettings();hideUpdate();status('Напоминание отложено.');els.badge.textContent='';}
async function installNow(){
 if(busy||!candidate)return;
 const update=candidate,version=update.version;
 if(!window.confirm('Установить подписанную версию '+version+'? Сначала создаётся резервная копия.'))return;
 busySet(true);
 try{
  if(typeof window.backupBeforeUpdate!=='function')throw Error('Нет функции резервного копирования');
  status('Сохраняются цели, орудия и задачи…');
  const backup=await window.backupBeforeUpdate();
  status('Резервная копия: '+backup+'\nЗагрузка обновления…');
  els.progress.classList.remove('fc-update-hidden');
  let downloaded=0,total=0;
  await update.downloadAndInstall((event)=>{
   if(event.event==='Started'){total=event.data.contentLength||0;downloaded=0;}
   if(event.event==='Progress')downloaded+=event.data.chunkLength;
   if(event.event==='Finished')status('Проверка цифровой подписи и запуск установщика…');
   else{
    status('Загрузка '+version+': '+(downloaded/1048576).toFixed(1)+' МБ'+(total?' / '+(total/1048576).toFixed(1)+' МБ':''));
    if(total)els.progress.value=Math.min(100,downloaded/total*100);
    else els.progress.removeAttribute('value');
   }
  });
  status('Установщик запущен. Приложение завершит работу для установки.');
 }catch(e){status('Обновление не выполнено: '+String(e));els.progress.classList.add('fc-update-hidden');}
 finally{busySet(false);}
}
function open(){
 const el=$('archive');
 if(el&&!el.classList.contains('active'))[...document.querySelectorAll('.sidebar-btn')].find(b=>(b.getAttribute('onclick')||'').includes("'archive'"))?.click();
 els.panel?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function init(){
 loadSettings();
 els.check.addEventListener('click',()=>checkNow(false));
 els.install.addEventListener('click',installNow);
 els.later.addEventListener('click',later);
 els.automatic.addEventListener('change',()=>{autoCheck=els.automatic.checked;saveSettings();status(autoCheck?'Автопроверка включена.':'Автопроверка выключена.');});
 window.fireControlUpdater={open,check:()=>checkNow(false)};
 if(typeof window.__TAURI__?.core?.invoke!=='function'){
  els.version.textContent='HTML';
  status('Обновления доступны только в Windows-приложении.');
  els.check.disabled=true;return;
 }
 try{
  els.version.textContent=await getVersion();
  enabled=await window.__TAURI__.core.invoke('updater_available');
  if(!enabled){status('Автообновления отключены в этой сборке. Для активации нужен подписанный релиз.');els.check.disabled=true;return;}
 }catch(e){status('Модуль обновлений недоступен: '+String(e));els.check.disabled=true;return;}
 status('Система подписанных обновлений готова.');
 if(autoCheck)setTimeout(()=>checkNow(true),2500);
}
window.fireControlUpdater={open,check:()=>checkNow(false)};
init();
