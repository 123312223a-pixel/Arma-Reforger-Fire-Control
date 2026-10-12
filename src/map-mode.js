/* 3.7.0 — режим наведения по карте. Баллистика не изменяется. */
(()=>{'use strict';
const SIZE=12800,BASE=800,NS='http://www.w3.org/2000/svg',SERVER='https://enfumap.com';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const initial=()=>({tool:'gun',layer:'topo',zoom:1,cx:400,cy:400,image:'',refs:[{px:0,py:0,x:0,y:SIZE},{px:BASE,py:BASE,x:SIZE,y:0}]});
let initialized=false,drag=null,mapData=null,mapStatus='loading';
function state(){if(!opState.mapAim||typeof opState.mapAim!=='object')opState.mapAim=initial();const a=opState.mapAim;
 if(!Array.isArray(a.refs)||a.refs.length!==2)a.refs=initial().refs;
 if(typeof a.image!=='string'||a.image.length>1800000||a.image&&!a.image.startsWith('data:image/jpeg;base64,'))a.image='';
 if(!['topo','satellite','fogless','grid'].includes(a.layer))a.layer='topo';
 a.zoom=clamp(Number(a.zoom)||1,1,16);a.cx=clamp(Number(a.cx)||400,0,800);a.cy=clamp(Number(a.cy)||400,0,800);
 return a;}
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=SIZE&&p.y>=0&&p.y<=SIZE;
function refs(){const r=state().refs,p=r[0],q=r[1],dx=q.px-p.px,dy=q.py-p.py,sx=(q.x-p.x)/dx,sy=(q.y-p.y)/dy;
 if(!Number.isFinite(sx)||!Number.isFinite(sy)||Math.abs(dx)<15||Math.abs(dy)<15||sx<=0||sy>=0||Math.abs(q.x-p.x)<50||Math.abs(q.y-p.y)<50)return null;return{p,sx,sy};}
function world(p){const r=refs();return r?{x:r.p.x+(p.x-r.p.px)*r.sx,y:r.p.y+(p.y-r.p.py)*r.sy}:null;}
function pixel(p){const r=refs();return r?{x:r.p.px+(p.x-r.p.x)/r.sx,y:r.p.py+(p.y-r.p.y)/r.sy}:null;}
function point(kind){const ids=kind==='gun'?['artX','artY']:['tgtX','tgtY'],x=Number($(ids[0]).value),y=Number($(ids[1]).value);return valid({x,y})?{x,y}:null;}
const format=p=>p?Math.round(p.x).toString().padStart(5,'0')+' / '+Math.round(p.y).toString().padStart(5,'0'):'—';
function element(name,attrs={},body){const e=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(body!=null)e.textContent=body;return e;}
function message(t,id='mapAimInstruction'){if($(id))$(id).textContent=t;}
function frame(){const a=state(),size=BASE/a.zoom;a.cx=clamp(a.cx,size/2,BASE-size/2);a.cy=clamp(a.cy,size/2,BASE-size/2);return{x:a.cx-size/2,y:a.cy-size/2,size};}
function label(){const a=state();$('mapAimTileState').textContent=a.image?'Своя карта · локально':a.layer==='grid'?'Сетка · офлайн':mapStatus==='ready'?'Enfumap · карта подключена':mapStatus==='loading'?'Загрузка тайлов…':'Нет связи с картой · GRID';}
function tiles(svg,a,f){if(a.image||a.layer==='grid'||mapStatus!=='ready'||!mapData?.tiles)return;
 const t=mapData.tiles,pattern=a.layer==='topo'?(t.layers?.topo||t.url):t.layers?.[a.layer];if(typeof pattern!=='string'||!pattern.includes('{z}')||!pattern.includes('{x}')||!pattern.includes('{y}'))return;
 let u;try{u=new URL(pattern,SERVER);}catch{return;}if(u.origin!==SERVER)return;
 const limit=a.layer==='topo'?t.maxNativeZoom:(t.satelliteMaxNativeZoom??t.maxNativeZoom),zoom=clamp(Math.round(Math.log2(a.zoom))+2,0,Number.isInteger(limit)?Math.min(limit,7):5),n=2**zoom,size=BASE/n;
 const x1=clamp(Math.floor(f.x/size),0,n-1),x2=clamp(Math.floor((f.x+f.size)/size),0,n-1),y1=clamp(Math.floor(f.y/size),0,n-1),y2=clamp(Math.floor((f.y+f.size)/size),0,n-1);
 for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)svg.append(element('image',{x:x*size,y:y*size,width:size+.06,height:size+.06,href:u.href.replaceAll('{z}',String(zoom)).replaceAll('{x}',String(x)).replaceAll('{y}',String(y)),preserveAspectRatio:'none','pointer-events':'none'}));
}
function render(){const svg=$('mapAimSvg');if(!svg)return;const a=state(),f=frame(),z=a.zoom;svg.setAttribute('viewBox',[f.x,f.y,f.size,f.size].join(' '));
 svg.replaceChildren(element('rect',{x:0,y:0,width:BASE,height:BASE,fill:'#1b3129'}));tiles(svg,a,f);
 if(a.image)svg.append(element('image',{x:0,y:0,width:BASE,height:BASE,href:a.image,preserveAspectRatio:'none','pointer-events':'none'}));
 const tick=z>=8?250:z>=4?500:1000;
 for(let n=0;n<=SIZE;n+=tick){const px=pixel({x:n,y:0}),py=pixel({x:0,y:n});if(!px||!py)continue;
 const major=n%1000===0,style={stroke:'#d8e9c1','stroke-opacity':major?.32:.13,'stroke-width':1/z};
 svg.append(element('line',{x1:px.x,y1:0,x2:px.x,y2:BASE,...style}),element('line',{x1:0,y1:py.y,x2:BASE,y2:py.y,...style}));
 if(major){if(px.x>=f.x&&px.x<=f.x+f.size)svg.append(element('text',{x:px.x+5/z,y:f.y+16/z,fill:'#e9f2d5','font-size':11/z,'paint-order':'stroke',stroke:'#182720','stroke-width':2/z},String(n)));
 if(py.y>=f.y&&py.y<=f.y+f.size)svg.append(element('text',{x:f.x+5/z,y:py.y-4/z,fill:'#e9f2d5','font-size':11/z,'paint-order':'stroke',stroke:'#182720','stroke-width':2/z},String(n)));}}
 svg.append(element('rect',{x:0,y:0,width:BASE,height:BASE,fill:'none',stroke:'#e1f1ce','stroke-opacity':.5,'stroke-width':2/z}));
 const g=point('gun'),t=point('target'),p=g&&pixel(g),q=t&&pixel(t);
 if(p&&q)svg.append(element('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,stroke:'#70c7f7','stroke-width':2.6/z,'stroke-dasharray':(7/z)+' '+(5/z)}));
 for(const[name,v,color]of[['ОРУДИЕ',p,'#96e7a4'],['ЦЕЛЬ',q,'#ff957e']]){if(!v)continue;
 svg.append(element('circle',{cx:v.x,cy:v.y,r:11/z,fill:color,stroke:'#10251b','stroke-width':2/z,'pointer-events':'none'}));
 svg.append(element('circle',{cx:v.x,cy:v.y,r:17/z,fill:'none',stroke:color,'stroke-width':2/z,'pointer-events':'none'}));
 svg.append(element('text',{x:v.x+20/z,y:v.y-8/z,fill:color,'font-size':16/z,'font-weight':'bold',stroke:'#0b150e','stroke-width':3/z,'paint-order':'stroke','pointer-events':'none'},name));}
 svg.append(element('text',{x:f.x+f.size-12/z,y:f.y+35/z,fill:'#eff8e2','font-size':13/z,'text-anchor':'end','paint-order':'stroke',stroke:'#132017','stroke-width':3/z},'СЕВЕР ↑'));
 $('mapZoomLabel').textContent=z+'×';svg.classList.toggle('is-pan',a.tool==='pan');
 for(const[k,id]of[['gun','mapModeGun'],['target','mapModeTarget'],['pan','mapModePan']]){$(id).classList.toggle('is-selected',a.tool===k);$(id).setAttribute('aria-pressed',String(a.tool===k));}}
function stats(){const g=point('gun'),t=point('target');$('mapGunGrid').textContent=format(g);$('mapTargetGrid').textContent=format(t);
 $('mapWeaponType').value=$('weaponType').value;$('mapGunZ').value=$('artZ').value;$('mapTargetZ').value=$('tgtZ').value;
 if(!g||!t){for(const id of ['mapDistance','mapBearingDegrees','mapBearingMils'])$(id).textContent='—';return;}
 const dx=t.x-g.x,dy=t.y-g.y,az=(Math.atan2(dx,dy)*180/Math.PI+360)%360,weapon=$('weaponType').value;
 $('mapDistance').textContent=Math.round(Math.hypot(dx,dy))+' м';$('mapBearingDegrees').textContent=az.toFixed(2)+'°';$('mapBearingMils').textContent=degreesToMils(az,weapon)+' / '+milsPerCircle(weapon);}
function solve(){const g=point('gun'),t=point('target');stats();if(!g||!t||Math.hypot(t.x-g.x,t.y-g.y)<1){message('Выберите разные точки орудия и цели.','mapAimStatus');return;}
 window.calculateCoords();const ok=opValid('coords');$('mapResultElev').textContent=ok?$('cResElev').textContent.trim()+' тыс.':'—';$('mapResultCharge').textContent=ok?$('cResCharge').textContent.trim():'—';$('mapResultTof').textContent=ok?$('cResTof').textContent.trim()+' с':'—';
 message(ok?'✓ Решение рассчитано по проверенной таблице.':'Для этой дальности и выбранного орудия табличное решение не найдено.','mapAimStatus');}
function svgPoint(e){const svg=$('mapAimSvg'),m=svg.getScreenCTM();if(!m)return null;const v=svg.createSVGPoint();v.x=e.clientX;v.y=e.clientY;const p=v.matrixTransform(m.inverse());return{x:p.x,y:p.y};}
function clickPosition(tool,p){const q=world(p);if(!valid(q)){message('Точка вне игровой карты. Проверьте привязку.');return;}const ids=tool==='gun'?['artX','artY']:['tgtX','tgtY'];
 ids.forEach((id,i)=>{const e=$(id);e.value=String(Math.round(i?q.y:q.x)).padStart(5,'0');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
 render();solve();if(tool==='gun')window.mapAimSetTool('target');message(tool==='gun'?'Орудие отмечено. Теперь кликните по цели.':'Цель отмечена. Решение рассчитано автоматически.');}
function calibrate(tool,p){if(!state().image){message('Калибровка нужна только собственной картинке.','mapCalibrationStatus');return;}
 const i=tool==='ref1'?0:1,x=Number($('mapRef'+(i+1)+'X').value),y=Number($('mapRef'+(i+1)+'Y').value),a=state();if(!valid({x,y})){message('Введите корректные GRID-координаты.','mapCalibrationStatus');return;}
 const old=a.refs[i];a.refs[i]={px:p.x,py:p.y,x,y};if(!refs()){a.refs[i]=old;message('Нужны две точки с разными координатами, севером вверх.','mapCalibrationStatus');return;}
 opPersist();render();stats();message('Точка '+(i+1)+' откалибрована.','mapCalibrationStatus');window.mapAimSetTool(i===0?'ref2':'gun');}
function pointerDown(e){if(e.button!==0&&e.button!==1)return;const a=state();drag={x:e.clientX,y:e.clientY,cx:a.cx,cy:a.cy,pan:e.button===1||a.tool==='pan',moved:false};$('mapAimSvg').setPointerCapture?.(e.pointerId);e.preventDefault();}
function pointerMove(e){const p=svgPoint(e);if(p){const q=world(p);$('mapPointerCoords').textContent=valid(q)?'GRID '+format(q):'Вне карты';}
 if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;
 if(drag.pan&&drag.moved){const a=state(),b=$('mapAimSvg').getBoundingClientRect(),size=BASE/a.zoom;a.cx=clamp(drag.cx-dx/b.width*size,size/2,BASE-size/2);a.cy=clamp(drag.cy-dy/b.height*size,size/2,BASE-size/2);render();}}
function pointerUp(e){if(!drag)return;const d=drag;drag=null;if(d.pan){if(d.moved)opPersist();return;}if(d.moved)return;const p=svgPoint(e);if(!p||p.x<0||p.x>BASE||p.y<0||p.y>BASE)return;
 const tool=state().tool;if(tool==='ref1'||tool==='ref2')calibrate(tool,p);else if(tool==='gun'||tool==='target')clickPosition(tool,p);}
window.mapAimSetTool=tool=>{if(!['gun','target','pan','ref1','ref2'].includes(tool))return;if(tool.startsWith('ref')&&!state().image){message('Сначала загрузите изображение карты.');return;}
 state().tool=tool;opPersist();render();message(({gun:'Кликните на позицию орудия.',target:'Кликните на цель.',pan:'Перетащите карту мышью.',ref1:'Отметьте первую контрольную точку.',ref2:'Отметьте вторую контрольную точку.'})[tool]);};
window.mapAimZoom=f=>{state().zoom=clamp(Math.round(state().zoom*f*100)/100,1,16);render();opPersist();};
window.mapAimResetView=()=>{Object.assign(state(),{zoom:1,cx:400,cy:400});render();opPersist();};
window.mapAimChangeWeapon=t=>{if(!['m777','m252','2b14'].includes(t))return;$('weaponType').value=t;updateWeaponUI('weaponType');$('weaponType').dispatchEvent(new Event('change',{bubbles:true}));render();solve();};
window.mapAimSetHeight=(kind,z)=>{const e=$(kind==='gun'?'artZ':'tgtZ');e.value=z;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));solve();};
window.mapAimRecalculate=solve;window.mapAimRefresh=()=>{state();render();stats();label();};
window.mapAimSelectLayer=layer=>{if(!['topo','satellite','fogless','grid'].includes(layer))return;state().layer=layer;opPersist();render();label();};
window.mapAimSaveTarget=()=>{if(!point('target'))return message('Сначала поставьте цель.');solve();if(typeof window.tacSaveCurrentTarget==='function')window.tacSaveCurrentTarget();};
window.mapAimSaveWeapon=()=>{if(!point('gun'))return message('Сначала поставьте орудие.');solve();if(typeof window.tacSaveCurrentWeapon==='function')window.tacSaveCurrentWeapon();};
window.mapAimClearImage=()=>{const a=state();a.image='';a.refs=initial().refs;$('mapAimImage').value='';opPersist();render();stats();label();};
window.mapAimClearCalibration=()=>{state().refs=initial().refs;for(let i=0;i<2;i++){$('mapRef'+(i+1)+'X').value=state().refs[i].x;$('mapRef'+(i+1)+'Y').value=state().refs[i].y;}opPersist();render();stats();message('Стандартная привязка восстановлена.','mapCalibrationStatus');};
window.mapAimLoadImage=async input=>{const file=input.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000){message('Нужен JPG, PNG или WebP до 20 МБ.');input.value='';return;}
 const url=URL.createObjectURL(file);try{const pic=new Image();await new Promise((res,rej)=>{pic.onload=res;pic.onerror=()=>rej(Error('Изображение повреждено'));pic.src=url;});
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1600;canvas.getContext('2d').drawImage(pic,0,0,1600,1600);let data='';
 for(const q of [.82,.7,.55,.4]){data=canvas.toDataURL('image/jpeg',q);if(data.length<1200000)break;}if(data.length>=1200000)throw Error('Изображение слишком велико');
 const a=state();a.image=data;a.refs=initial().refs;for(let i=0;i<2;i++){$('mapRef'+(i+1)+'X').value=a.refs[i].x;$('mapRef'+(i+1)+'Y').value=a.refs[i].y;}opPersist();render();stats();label();message('Карта загружена. При необходимости откалибруйте её по двум точкам.');
 }catch(e){message('Ошибка: '+e.message);}finally{URL.revokeObjectURL(url);input.value='';}};
async function loadTiles(){mapStatus='loading';label();try{const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);let r;try{r=await fetch(SERVER+'/api/v1/maps/everon',{signal:c.signal,cache:'force-cache'});}finally{clearTimeout(timer);}if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(!j?.data?.tiles||Number(j.data.worldSize)!==SIZE)throw Error('Метаданные карты несовместимы');mapData=j.data;mapStatus='ready';}
 catch(e){mapStatus='error';console.info('Онлайн-карта недоступна: '+e.message);}label();render();}
window.mapAimInit=()=>{if(initialized)return;const svg=$('mapAimSvg');if(!svg)return;initialized=true;
 svg.addEventListener('pointerdown',pointerDown);svg.addEventListener('pointermove',pointerMove);svg.addEventListener('pointerup',pointerUp);svg.addEventListener('pointercancel',()=>{drag=null;});svg.addEventListener('contextmenu',e=>e.preventDefault());
 svg.addEventListener('wheel',e=>{if(!svg.closest('.tab-content.active'))return;e.preventDefault();window.mapAimZoom(e.deltaY<0?2:.5);},{passive:false});
 ['input','change'].forEach(ev=>$('coords').addEventListener(ev,()=>{if($('mapaim').classList.contains('active')){render();stats();}},true));
 state().refs.forEach((r,i)=>{$('mapRef'+(i+1)+'X').value=r.x;$('mapRef'+(i+1)+'Y').value=r.y;});$('mapAimLayer').value=state().layer;render();stats();loadTiles();};
})();
