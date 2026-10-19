
/* =========================================================
   戴煜的疗养健康助手 · 人体数字孪生健康平台
   © 2025 戴煜的疗养健康助手 Platform. All Rights Reserved.
   ========================================================= */

// Escape data-derived text before it is inserted into HTML templates.
function escHTML(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

/* ---------------- 状态 ---------------- */
const state = {
  page: 'home',
  persona: '成年男性',
  layers: { organ: true, vessel: true, meridian: true, acupoint: true },
  angle: 0,
  autoRotate: false,
  acuFilter: '全部',
  chatStarted: false
};

const PAGES_META = [
  { key:'home',     name:'健康总览', en:'DASHBOARD',   icon:'' },
  { key:'body',     name:'数字人体', en:'DIGITAL TWIN',icon:'溺' },
  { key:'organ',    name:'器官中心', en:'ORGANS',      icon:'變' },
  { key:'vessel',   name:'血管循环', en:'CIRCULATION', icon:'喝' },
  { key:'meridian', name:'经络中心', en:'MERIDIANS',   icon:'〰️' },
  { key:'acupoint', name:'穴位中心', en:'ACUPOINTS',   icon:'' },
  { key:'records',   name:'健康记录', en:'OBSERVATIONS', icon:'' },
  { key:'ai',       name:'症状参考',  en:'SYMPTOM GUIDE',  icon:'烙' },
  { key:'report',   name:'健康报告', en:'REPORT',      icon:'' },
  { key:'me',       name:'我的',     en:'PROFILE',     icon:'' }
];

const TABBAR = ['home','body','ai','report','me'];

/* ---------------- 初始化 ---------------- */
window.addEventListener('load', async () => {
  try { window.HealthDomain = await import('../../src/domain/index.js'); }
  catch (error) {
    observationDomainUnavailable = true;
    console.error('Health domain core unavailable', error);
  }
  loadObservations();
  renderObservations();
  buildObservationAmendmentControls();
  buildNav();
  buildQuickGrid();
  buildHomeMetrics();
  buildHuman();
  buildLayerCtrl();
  buildPersonaRow();
  buildOrganGrid();
  buildVesselPage();
  buildMeridianPage();
  buildAcupointChips();
  renderAcupoints();
  buildSymptomChips();
  renderScoreBars();
  renderRadar();
  renderTrend();
  renderAdvice();
  renderVesselMetrics();

  setTimeout(() => {
    document.getElementById('splash').classList.add('hide');
    document.getElementById('login').classList.remove('hide');
  }, 2300);
});

/* ---------------- 可追溯健康记录 ---------------- */
const OBSERVATION_STORAGE_KEY = 'health-observations-v1';
let observationStorageRecoveryRequired = false;
let observationDomainUnavailable = false;
function preserveInvalidObservationStorage(raw){
  if(!raw) return false;
  try{
    const key = OBSERVATION_STORAGE_KEY + '_recovery_' + Date.now();
    localStorage.setItem(key, raw);
    console.warn('健康记录原始缓存已保存在恢复项：' + key);
    return true;
  }catch(error){
    console.error('无法创建健康记录恢复副本。请勿清理浏览器站点数据。', error);
    return false;
  }
}
function loadObservations(){
  let raw = null;
  try{
    raw = localStorage.getItem(OBSERVATION_STORAGE_KEY);
    if(raw === null){
      window.healthObservations = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed)) throw new TypeError('health observations cache must be an array');
    if(!window.HealthDomain || typeof window.HealthDomain.createObservation !== 'function'){
      observationDomainUnavailable = true;
      window.healthObservations = [];
      console.error('健康记录校验模块不可用；原始缓存保持不变，记录读取与写入已暂停。');
      return;
    }
    window.healthObservations = window.HealthDomain.normalizeObservationHistory(parsed);
  }catch(error){
    observationStorageRecoveryRequired = true;
    if(raw !== null) preserveInvalidObservationStorage(raw);
    console.error('健康记录缓存无法安全读取；已阻止后续保存覆盖原始数据。', error);
    window.healthObservations = [];
  }
}
function renderObservations(){
  const host = document.getElementById('observationList');
  const count = document.getElementById('observationCount');
  if(!host || !count) return;
  if(observationDomainUnavailable){
    count.textContent = '校验模块不可用';
    host.innerHTML = '<div class="empty">健康记录校验模块尚未加载。为避免显示未经校验的数据，当前记录列表暂不可用；原始浏览器缓存未修改。请刷新页面后重试。常规写入与导出已暂停。</div>';
    return;
  }
  if(observationStorageRecoveryRequired){
    count.textContent = '待恢复';
    host.innerHTML = '<div class="empty">检测到健康记录缓存异常。当前列表为空不代表原记录已丢失；常规记录写入和导出已暂停。请先导出原始恢复数据并妥善保管，再导入有效 JSON 备份或可读取的恢复包。<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="exportObservationRecovery()">导出原始恢复数据</button><button class="btn primary" onclick="importObservations()">导入备份并恢复</button></div></div>';
    return;
  }
  try{
    const rows = window.HealthDomain.normalizeObservationHistory(
      Array.isArray(window.healthObservations) ? window.healthObservations : []
    ).slice().sort((a,b) =>
      Date.parse(b.recordedAt || b.amendedAt || b.observedAt) -
      Date.parse(a.recordedAt || a.amendedAt || a.observedAt)
    );
    window.healthObservations = rows;
    const activeCount = rows.filter(row => row.recordState === 'active').length;
    count.textContent = activeCount + ' 条有效 / ' + rows.length + ' 个版本';
    if(!rows.length){ host.innerHTML='<div class="empty">暂无记录。新增测量后会显示在这里。</div>'; return; }
    const stateLabels = {active:'当前有效',superseded:'已被更正',voided:'已作废'};
    host.innerHTML = rows.map(row=>{
      const stateLabel=stateLabels[row.recordState] || '状态未知';
      const previous=row.previousVersionId
        ? '<div class="observation-version__audit">更正自：'+escHTML(row.previousVersionId)+' · 原因：'+escHTML(row.amendmentReason)+' · 操作人：'+escHTML(row.amendedBy)+' · 时间：'+escHTML(row.amendedAt)+'</div>'
        : '';
      const voidAudit=row.recordState==='voided'
        ? '<div class="observation-version__audit">作废原因：'+escHTML(row.voidReason)+' · 操作人：'+escHTML(row.voidedBy)+' · 时间：'+escHTML(row.voidedAt)+'</div>'
        : '';
      const actions=row.recordState==='active'
        ? '<div class="observation-version__actions"><button type="button" class="btn sm" data-observation-action="amend" data-observation-id="'+escHTML(row.id)+'">更正并保留旧版本</button><button type="button" class="btn sm ghost" data-observation-action="void" data-observation-id="'+escHTML(row.id)+'">作废</button></div>'
        : '';
      return '<article class="observation-version '+escHTML(row.recordState)+'" data-observation-version="'+escHTML(row.id)+'">'+
        '<div class="observation-version__main">'+
          '<div class="observation-version__title"><strong>'+escHTML(row.metric)+'：'+escHTML(row.value)+' '+escHTML(row.unit)+'</strong>'+
          '<span class="observation-version__state '+escHTML(row.recordState)+'">'+stateLabel+'</span></div>'+
          '<div class="li-s">测量时间：'+escHTML(row.observedAt)+' · 来源：'+escHTML(row.source)+'</div>'+
          (row.recordedAt ? '<div class="li-s">录入时间：'+escHTML(row.recordedAt)+'</div>' : '')+
          '<div class="li-s">质量标记：'+escHTML(row.quality)+'</div>'+
          previous+voidAudit+
          '<div class="observation-version__id">记录 ID：'+escHTML(row.id)+'</div>'+
        '</div>'+actions+'</article>';
    }).join('');
    host.querySelectorAll('[data-observation-action]').forEach(button=>{
      button.addEventListener('click',()=>{
        const id=button.dataset.observationId;
        if(button.dataset.observationAction==='amend') beginObservationAmendment(id);
        else if(button.dataset.observationAction==='void') voidObservationRecord(id);
      });
    });
  }catch(error){
    observationStorageRecoveryRequired = true;
    preserveInvalidObservationStorage(localStorage.getItem(OBSERVATION_STORAGE_KEY));
    window.healthObservations = [];
    count.textContent = '待恢复';
    host.textContent = '健康记录版本关系无法通过校验，已暂停写入以保护原始数据。请导出恢复数据并核查版本链。错误：' + error.message;
  }
}
function exportObservationRecovery(){
  if(!observationStorageRecoveryRequired){
    alert('当前没有待恢复的健康记录缓存。');
    return false;
  }
  try{
    const copies = [];
    const prefix = OBSERVATION_STORAGE_KEY + '_recovery_';
    for(let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      if(key && key.indexOf(prefix) === 0){
        copies.push({key, raw:localStorage.getItem(key)});
      }
    }
    const payload = {
      schemaVersion:1,
      exportedAt:new Date().toISOString(),
      storage:'local-browser-recovery',
      originalRaw:localStorage.getItem(OBSERVATION_STORAGE_KEY),
      recoveryCopies:copies
    };
    if(payload.originalRaw === null && !copies.length){
      alert('未找到可导出的原始缓存或恢复副本。请勿清理浏览器站点数据，并寻求数据恢复帮助。');
      return false;
    }
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'health-observations-recovery-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    alert('已导出原始恢复数据。该文件可能包含敏感健康信息，请妥善保管；它尚未完成修复或验证。');
    return true;
  }catch(error){
    alert('原始恢复数据导出失败：' + (error && error.message ? error.message : '浏览器存储不可用'));
    return false;
  }
}
function exportObservations(){
  if(observationDomainUnavailable){
    alert('健康记录校验模块尚未加载，暂不能安全导出。原始浏览器缓存未修改，请刷新页面后重试。');
    return false;
  }
  if(observationStorageRecoveryRequired){
    alert('健康记录缓存异常，当前空列表不是有效备份。为避免导出空文件掩盖原始数据，请先保留浏览器站点数据并恢复记录。');
    return false;
  }
  const rows = Array.isArray(window.healthObservations) ? window.healthObservations : [];
  if(!rows.length){ alert('暂无健康记录可导出。'); return false; }
  try{
    const payload = {
      schemaVersion:1,
      exportedAt:new Date().toISOString(),
      storage:'local-browser',
      observations:rows
    };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'health-observations-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    alert('已导出 ' + rows.length + ' 条记录。备份文件可能包含敏感健康信息，请妥善保管。');
    return true;
  }catch(error){
    alert('备份导出失败：' + (error && error.message ? error.message : '浏览器无法创建下载文件'));
    return false;
  }
}
async function importObservations(){
  if(observationDomainUnavailable || !window.HealthDomain || typeof window.HealthDomain.createObservation !== 'function'){
    alert('健康记录校验模块不可用，暂不能导入。原始浏览器缓存未修改。');
    return false;
  }
  const recovering = observationStorageRecoveryRequired;
  if(recovering && !confirm('当前健康记录缓存异常。建议先点击“导出原始恢复数据”保留现场。继续导入后，已损坏的缓存内容将由验证通过的备份替换；未能解析的原始内容仍保留在独立恢复项中。确定继续吗？')){
    return false;
  }
  const picker = document.getElementById('observationImportFile');
  if(!picker) return false;
  picker.value = '';
  picker.onchange = async () => {
    const file = picker.files && picker.files[0];
    if(!file) return;
    try{
      if(file.size > 5 * 1024 * 1024) throw new RangeError('备份文件不能超过 5 MB。');
      const payload = JSON.parse(await file.text());
      let imported;
      const isRecoveryEnvelope = payload && typeof payload === 'object' &&
        !Array.isArray(payload) && payload.schemaVersion === 1 &&
        payload.storage === 'local-browser-recovery';
      if(isRecoveryEnvelope){
        const rawCandidates = [];
        if(typeof payload.originalRaw === 'string') rawCandidates.push(payload.originalRaw);
        if(Array.isArray(payload.recoveryCopies)){
          payload.recoveryCopies.forEach(copy=>{
            if(copy && typeof copy.raw === 'string') rawCandidates.push(copy.raw);
          });
        }
        let restored = null;
        for(const raw of rawCandidates){
          try{
            const stored = JSON.parse(raw);
            const rows = Array.isArray(stored) ? stored
              : stored && stored.schemaVersion === 1 && Array.isArray(stored.observations)
                ? stored.observations : null;
            if(!rows || rows.length > 10000) continue;
            restored = window.HealthDomain.normalizeObservationHistory(rows);
            break;
          }catch(candidateError){
            // Keep searching other preserved raw copies; never write an
            // unvalidated candidate into the active observation store.
          }
        }
        if(!restored){
          throw new TypeError('恢复包中的原始内容无法通过健康记录校验；请改用最近一次有效的 JSON 备份。');
        }
        imported = restored;
      }else{
        if(!payload || typeof payload !== 'object' || Array.isArray(payload) ||
           payload.schemaVersion !== 1 || !Array.isArray(payload.observations)){
          throw new TypeError('备份格式无效或版本不受支持；需要 schemaVersion 1 和 observations 数组。');
        }
        if(payload.observations.length > 10000) throw new RangeError('单个备份最多允许 10000 条记录。');
        imported = window.HealthDomain.normalizeObservationHistory(payload.observations);
      }
      const existing = recovering ? [] :
        window.HealthDomain.normalizeObservationHistory(
          Array.isArray(window.healthObservations) ? window.healthObservations : []
        );
      const next = recovering ? imported :
        window.HealthDomain.mergeObservationHistories(existing, imported);
      if(next.length > 10000) throw new RangeError('合并后的健康记录不能超过 10000 条；请先导出并整理旧记录。');
      const additions = next.filter(row=>!existing.some(old=>old.id===row.id)).length;
      localStorage.setItem(OBSERVATION_STORAGE_KEY,JSON.stringify(next));
      window.healthObservations = next;
      // Release the recovery lock only after the validated replacement is durable.
      observationStorageRecoveryRequired = false;
      renderObservations();
      alert((recovering ? '恢复完成：' : '导入校验完成：') +
        '读取 ' + imported.length + ' 个版本，新增 ' + additions +
        ' 个版本，当前共保留 ' + next.length + ' 个版本。');
      return true;
    }catch(error){
      alert('导入失败，未写入任何记录：' + (error && error.message ? error.message : '备份校验失败'));
      return false;
    }finally{
      picker.value = '';
    }
  };
  picker.click();
  return true;
}

function parseLocalObservationDateTime(value){
  if(typeof value!=='string')throw new TypeError('测量时间格式无效');
  const match=/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/.exec(value);
  if(!match)throw new TypeError('测量时间必须是有效的本地日期时间');
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]||0);
  const millisecond=Number((match[7]||'').padEnd(3,'0')||0);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(month<1||month>12||day<1||day>days[month-1]){
    throw new TypeError('测量时间包含无效的日历日期');
  }
  const parsed=new Date(value);
  if(!Number.isFinite(parsed.getTime())||
     parsed.getFullYear()!==year||parsed.getMonth()+1!==month||parsed.getDate()!==day||
     parsed.getHours()!==hour||parsed.getMinutes()!==minute||
     parsed.getSeconds()!==second||parsed.getMilliseconds()!==millisecond){
    throw new TypeError('测量时间无效或落在本地时区不存在的时间段');
  }
  return parsed.toISOString();
}

let observationEditingId = null;
function createObservationRecordId(){
  const token = window.crypto && typeof window.crypto.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,12);
  return 'obs-' + token;
}
function buildObservationAmendmentControls(){
  const form=document.getElementById('observationForm');
  if(!form || document.getElementById('observationAmendmentFields')) return;
  const audit=document.createElement('section');
  audit.id='observationAmendmentFields';
  audit.className='observation-amendment-fields';
  audit.hidden=true;
  const note=document.createElement('p');
  note.className='observation-amendment-note';
  note.textContent='更正会新增一个版本，并将原版本保留为“已被更正”；不会覆盖原始测量。操作人由录入者自填，本地演示环境不提供身份认证。';
  const reasonLabel=document.createElement('label');
  reasonLabel.textContent='更正原因（必填）';
  const reason=document.createElement('textarea');
  reason.id='observationAmendmentReason';
  reason.rows=2;
  reason.maxLength=1000;
  reason.placeholder='说明更正依据，例如核对原始报告后发现录入数值有误';
  reasonLabel.append(reason);
  const actorLabel=document.createElement('label');
  actorLabel.textContent='操作人（自填，必填）';
  const actor=document.createElement('input');
  actor.id='observationAmendmentActor';
  actor.maxLength=120;
  actor.placeholder='姓名 / 工号';
  actorLabel.append(actor);
  const cancel=document.createElement('button');
  cancel.type='button';
  cancel.className='btn sm ghost';
  cancel.textContent='取消更正';
  cancel.addEventListener('click',cancelObservationAmendment);
  audit.append(note,reasonLabel,actorLabel,cancel);
  const submit=form.querySelector('button[type="submit"]');
  if(submit) form.insertBefore(audit,submit);
}
function localObservationInputTime(iso){
  const date=new Date(iso);
  const pad=value=>String(value).padStart(2,'0');
  return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+
    'T'+pad(date.getHours())+':'+pad(date.getMinutes());
}
function beginObservationAmendment(id){
  const row=(window.healthObservations||[]).find(item=>item.id===id);
  if(!row || row.recordState!=='active'){
    alert('只能更正当前有效版本。');
    return false;
  }
  const form=document.getElementById('observationForm');
  buildObservationAmendmentControls();
  if(!form) return false;
  observationEditingId=id;
  form.elements.namedItem('metric').value=row.metric;
  form.elements.namedItem('value').value=String(row.value);
  form.elements.namedItem('unit').value=row.unit;
  form.elements.namedItem('observedAt').value=localObservationInputTime(row.observedAt);
  form.elements.namedItem('source').value=row.source;
  form.elements.namedItem('quality').value=row.quality;
  const audit=document.getElementById('observationAmendmentFields');
  audit.hidden=false;
  document.getElementById('observationAmendmentReason').required=true;
  document.getElementById('observationAmendmentActor').required=true;
  const submit=form.querySelector('button[type="submit"]');
  if(submit) submit.textContent='保存更正版本';
  form.scrollIntoView({behavior:'smooth',block:'center'});
  return true;
}
function cancelObservationAmendment(){
  observationEditingId=null;
  const form=document.getElementById('observationForm');
  if(!form) return;
  form.reset();
  const audit=document.getElementById('observationAmendmentFields');
  if(audit){
    audit.hidden=true;
    const reason=document.getElementById('observationAmendmentReason');
    const actor=document.getElementById('observationAmendmentActor');
    if(reason){reason.required=false;reason.value='';}
    if(actor){actor.required=false;actor.value='';}
  }
  const submit=form.querySelector('button[type="submit"]');
  if(submit) submit.textContent='保存记录';
}
function voidObservationRecord(id){
  const row=(window.healthObservations||[]).find(item=>item.id===id);
  if(!row || row.recordState!=='active'){
    alert('只能作废当前有效版本。');
    return false;
  }
  const reason=window.prompt('请填写作废原因；原记录会保留在历史中。');
  if(!reason || !reason.trim()) return false;
  const actor=window.prompt('请填写实际操作人姓名 / 工号（本地自填，不代表身份认证）。');
  if(!actor || !actor.trim()) return false;
  if(!window.confirm('确认将此记录标记为已作废？不会删除原始记录。')) return false;
  try{
    const next=window.HealthDomain.voidObservation(
      window.healthObservations,id,reason,actor,new Date().toISOString()
    );
    localStorage.setItem(OBSERVATION_STORAGE_KEY,JSON.stringify(next));
    window.healthObservations=next;
    renderObservations();
    alert('记录已标记为作废，历史内容与原因仍然保留。');
    return true;
  }catch(error){
    alert('作废失败：'+error.message);
    return false;
  }
}
function saveObservation(event){
  if(event) event.preventDefault();
  if(observationDomainUnavailable){
    alert('健康记录校验模块尚未加载，暂不能保存。原始浏览器缓存未修改，请刷新页面后重试。');
    return false;
  }
  if(observationStorageRecoveryRequired){
    alert('检测到原健康记录缓存异常，已阻止保存以保护原始数据。请先保留浏览器恢复项并进行数据恢复。');
    return false;
  }
  const form = document.getElementById('observationForm');
  if(!form || !window.HealthDomain){ alert('健康记录校验模块尚未加载，请刷新页面后重试。'); return false; }
  const fields = new FormData(form);
  const valueText = String(fields.get('value') || '').trim();
  const value = Number(valueText);
  const localDate = String(fields.get('observedAt') || '');
  try{
    const observedAt = parseLocalObservationDateTime(localDate);
    const recordedAt = new Date().toISOString();
    const replacement = {
      metric:String(fields.get('metric') || ''),
      value,
      unit:String(fields.get('unit') || ''),
      observedAt,
      recordedAt,
      source:String(fields.get('source') || ''),
      quality:String(fields.get('quality') || '')
    };
    const existing = window.HealthDomain.normalizeObservationHistory(
      Array.isArray(window.healthObservations) ? window.healthObservations : []
    );
    if(observationEditingId){
      const reason=document.getElementById('observationAmendmentReason')?.value || '';
      const actor=document.getElementById('observationAmendmentActor')?.value || '';
      const next=window.HealthDomain.amendObservation(
        existing,observationEditingId,replacement,reason,actor,recordedAt,createObservationRecordId()
      );
      if(next.length>10000) throw new RangeError('本地健康记录最多保存 10000 个版本；请先导出并整理旧记录。');
      localStorage.setItem(OBSERVATION_STORAGE_KEY,JSON.stringify(next));
      window.healthObservations=next;
      cancelObservationAmendment();
      renderObservations();
      alert('更正已保存为新版本。旧版本未被覆盖，且已保留更正原因、操作人和时间。');
      return false;
    }
    const observation = window.HealthDomain.createObservation({
      ...replacement,
      id:createObservationRecordId(),
      recordState:'active'
    });
    const identity = window.HealthDomain.observationIdentity;
    if(existing.some(row => identity(row) === identity(observation))){
      alert('这条测量记录与已有记录完全相同（指标、数值、单位、时间和来源均一致），未重复保存。');
      return false;
    }
    const next = window.HealthDomain.normalizeObservationHistory([...existing, observation]);
    if(next.length > 10000) throw new RangeError('本地健康记录最多保存 10000 个版本；请先导出并整理旧记录。');
    localStorage.setItem(OBSERVATION_STORAGE_KEY, JSON.stringify(next));
    window.healthObservations = next;
    form.reset();
    renderObservations();
    alert('健康记录已保存在当前浏览器。');
  }catch(error){
    alert('记录未保存：' + (error && error.message ? error.message : '数据校验失败'));
  }
  return false;
}

/* ---------------- 导航 ---------------- */
function buildNav(){
  const nav = document.getElementById('navList');
  nav.innerHTML = PAGES_META.map(p => `
    <div class="nav-item ${p.key==='home'?'active':''}" data-nav="${p.key}" onclick="go('${p.key}')">
      <span class="ic">${p.icon}</span><span>${p.name}</span>
    </div>`).join('');

  const tb = document.getElementById('tabbar');
  tb.innerHTML = TABBAR.map(k => {
    const p = PAGES_META.find(x => x.key === k);
    return `<div class="tb ${k==='home'?'active':''}" data-nav="${k}" onclick="go('${k}')">
      <span class="i">${p.icon}</span><span>${p.name}</span></div>`;
  }).join('');
}

function go(page){
  state.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === page));
  const meta = PAGES_META.find(p => p.key === page);
  document.getElementById('pageTitle').innerHTML = `${meta.name}<small>${meta.en}</small>`;
  document.getElementById('pages').scrollTop = 0;
}

/* ---------------- 登录 ---------------- */
function doLogin(){
  document.getElementById('login').classList.add('hide');
  document.getElementById('shell').classList.add('show');
}

/* ---------------- 首页 ---------------- */
function buildQuickGrid(){
  const items = [
    { k:'body', i:'溺', t:'数字人体' },
    { k:'organ', i:'變', t:'器官图谱' },
    { k:'vessel', i:'喝', t:'血管循环' },
    { k:'meridian', i:'〰️', t:'经络系统' },
    { k:'acupoint', i:'', t:'穴位中心' },
    { k:'ai', i:'烙', t:'症状参考' },
    { k:'report', i:'', t:'健康报告' },
    { k:'me', i:'', t:'健康档案' }
  ];
  document.getElementById('quickGrid').innerHTML = items.map(it => `
    <div class="quick-item glass" onclick="go('${it.k}')">
      <div class="qi">${it.i}</div>
      <div class="qt">${it.t}</div>
    </div>`).join('');
}

function buildHomeMetrics(){
  const metrics = [
    { lb:'心率', v:'72', u:'bpm', d:'+3', c:'var(--wn)', spark:[60,64,62,70,68,72,72] },
    { lb:'血压', v:'126/82', u:'mmHg', d:'正常', c:'var(--ok)', spark:[118,120,124,122,126,124,126] },
    { lb:'血氧', v:'98', u:'%', d:'稳定', c:'var(--ok)', spark:[97,98,98,97,98,99,98] },
    { lb:'睡眠', v:'7.2', u:'h', d:'+0.4', c:'var(--ok)', spark:[6.2,6.8,6.5,7.0,6.9,7.1,7.2] }
  ];
  document.getElementById('homeMetrics').innerHTML = metrics.map(m => `
    <div class="metric-card glass">
      <div class="lb">${m.lb}</div>
      <div class="delta" style="color:${m.c}">示例 · ${m.d}</div>
      <div class="vv">${m.v}<small>${m.u}</small></div>
      <div class="spark">${sparkSVG(m.spark, m.c)}</div>
    </div>`).join('');
}

function sparkSVG(data, color){
  const w = 120, h = 22;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
  </svg>`;
}

/* ---------------- 数字人体 ---------------- */
function buildPersonaRow(){
  const list = ['成年男性','成年女性','儿童','老年人'];
  document.getElementById('personaRow').innerHTML = list.map(p => `
    <div class="persona ${p===state.persona?'active':''}" onclick="setPersona('${p}', this)">${p}</div>
  `).join('');
}
function setPersona(p, el){
  state.persona = p;
  document.querySelectorAll('.persona').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('personaLabel').textContent = p;
  buildHuman();
}

function buildLayerCtrl(){
  const layers = [
    { k:'organ', i:'變', n:'器官系统' },
    { k:'vessel', i:'喝', n:'血管循环' },
    { k:'meridian', i:'〰️', n:'经络系统' },
    { k:'acupoint', i:'', n:'穴位标记' }
  ];
  document.getElementById('layerCtrl').innerHTML = layers.map(l => `
    <div class="ctrl-row" onclick="toggleLayer('${l.k}', this)">
      <span class="ci">${l.i}</span>
      <span class="cn">${l.n}</span>
      <span class="switch ${state.layers[l.k]?'on':''}"></span>
    </div>`).join('');
  updateLayerCount();
}

function toggleLayer(k, el){
  state.layers[k] = !state.layers[k];
  el.querySelector('.switch').classList.toggle('on', state.layers[k]);
  applyLayers();
  updateLayerCount();
}

function updateLayerCount(){
  const n = Object.values(state.layers).filter(Boolean).length;
  document.getElementById('layerCount').textContent = `${n} 层可见`;
}

function applyLayers(){
  const svg = document.getElementById('humanSvg');
  const map = { organ:'.layer-organ', vessel:'.layer-vessel', meridian:'.layer-meridian', acupoint:'.layer-acu' };
  Object.entries(map).forEach(([k, sel]) => {
    const g = svg.querySelector(sel);
    if (g) g.style.display = state.layers[k] ? '' : 'none';
  });
}

function buildHuman(){
  const svg = document.getElementById('humanSvg');
  const isChild = state.persona === '儿童';
  const isElder = state.persona === '老年人';
  const isFemale = state.persona === '成年女性';

  let html = `
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="organGrad">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity=".22"/>
    </radialGradient>
  </defs>`;

  // 人体轮廓
  const headR = isChild ? 17 : 20;
  const headY = isChild ? 34 : 40;
  const torsoTop = isChild ? 60 : 68;
  const torsoBot = isChild ? 132 : 150;
  const legBot = isChild ? 280 : 318;
  const shoulder = isChild ? 16 : 22;

  html += `<g class="layer-body">
    <circle cx="100" cy="${headY}" r="${headR}" class="body-line"/>
    <path d="M${100-shoulder},${torsoTop} Q100,${torsoTop-8} ${100+shoulder},${torsoTop}
             L${100+shoulder+5},${torsoBot} Q100,${torsoBot+13} ${100-shoulder-5},${torsoBot} Z" class="body-line"/>
    <path d="M${100-shoulder+2},${torsoTop+6} L${100-shoulder-18},${torsoTop+38} L${100-shoulder-24},${torsoTop+78}"
          class="limb-line" stroke-width="11"/>
    <path d="M${100+shoulder-2},${torsoTop+6} L${100+shoulder+18},${torsoTop+38} L${100+shoulder+24},${torsoTop+78}"
          class="limb-line" stroke-width="11"/>
    <path d="M88,${torsoBot+4} L84,${(torsoBot+legBot)/2} L82,${legBot}" class="limb-line" stroke-width="14"/>
    <path d="M112,${torsoBot+4} L116,${(torsoBot+legBot)/2} L118,${legBot}" class="limb-line" stroke-width="14"/>
  </g>`;

  // 血管系统
  html += `<g class="layer-vessel">
    <path d="M97,103 L100,132 M97,103 L92,74 L94,56" stroke="#f87171" stroke-width="2.2" class="vessel-line"/>
    <path d="M97,103 L82,86 L64,112 L58,150" stroke="#f87171" stroke-width="2" class="vessel-line"/>
    <path d="M97,103 L112,86 L136,112 L142,150" stroke="#60a5fa" stroke-width="2" class="vessel-line"/>
    <path d="M100,132 L88,176 L84,246 L82,316" stroke="#f87171" stroke-width="2" class="vessel-line"/>
    <path d="M100,132 L112,176 L116,246 L118,316" stroke="#60a5fa" stroke-width="2" class="vessel-line"/>
    <path d="M97,103 L108,96 L120,104" stroke="#f87171" stroke-width="1.6" class="vessel-line"/>
    <circle cx="97" cy="103" r="3" fill="#f87171" opacity=".9">
      <animate attributeName="r" values="3;5;3" dur="1.4s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values=".9;.3;.9" dur="1.4s" repeatCount="indefinite"/>
    </circle>
  </g>`;

  // 经络系统
  const meridianPaths = [
    'M84,92 L78,112 L70,140 L64,168 L60,196',       // 肺经
    'M118,95 L128,120 L138,148 L144,176',            // 大肠经
    'M95,70 L92,100 L88,132 L86,168 L84,210 L82,252 L80,296 L78,316', // 胃经
    'M106,70 L109,102 L111,140 L109,178 L107,214 L105,256 L103,296 L101,316', // 脾经
    'M100,104 L118,112 L132,140 L140,168',           // 心经
    'M100,112 L82,124 L66,148 L58,172',              // 小肠经
    'M92,44 L88,72 L86,104 L88,140 L90,180 L88,224 L86,272 L84,314', // 膀胱经
    'M108,44 L112,72 L114,104 L112,140 L110,180 L112,224 L114,272 L116,314' // 肾经
  ];
  html += `<g class="layer-meridian">` + meridianPaths.map((d, i) =>
    `<path d="${d}" stroke="${i % 2 ? '#fbbf24' : '#22d3ee'}" stroke-width="1.2" opacity=".72" class="meridian-line"/>`
  ).join('') + `</g>`;

  // 器官
  html += `<g class="layer-organ">`;
  ORGANS.forEach(o => {
    const riskColor = o.lv === 1 ? '#34d399' : o.lv === 2 ? '#fbbf24' : '#f87171';
    const draw = (cx, cy) => `
      <g class="organ-node" data-organ="${o.id}" onclick="openOrgan('${o.id}')">
        <ellipse cx="${cx}" cy="${cy}" rx="${o.rx}" ry="${o.ry}" fill="url(#organGrad)"
                 stroke="${riskColor}" stroke-width="1.3" opacity=".92"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${o.rx}" ry="${o.ry}" class="hit"/>
        <title>${o.name} · 健康指数 ${o.score}</title>
      </g>`;
    html += draw(o.x, o.y);
    if (o.dual) html += draw(o.x + (o.dualDx || 34), o.y);
  });
  // 心脏脉冲
  html += `<circle cx="97" cy="103" r="9" fill="none" stroke="#22d3ee" stroke-width="1" opacity=".6">
    <animate attributeName="r" values="8;14;8" dur="1.6s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values=".6;0;.6" dur="1.6s" repeatCount="indefinite"/>
  </circle>`;
  html += `</g>`;

  // 穴位
  const acuPts = [
    [100,25],[100,52],[84,80],[118,80],[86,104],[116,104],[88,132],[112,132],
    [92,156],[108,156],[84,200],[116,200],[84,250],[116,250],[82,290],[118,290],[82,314],[118,314]
  ];
  html += `<g class="layer-acu">` + acuPts.map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="1.7" fill="#67e8f9" opacity=".85" filter="url(#glow)"/>`
  ).join('') + `</g>`;

  svg.innerHTML = html;
  applyLayers();
}

function autoRotate(){
  state.autoRotate = !state.autoRotate;
  const rotor = document.getElementById('humanRotor');
  const slider = document.getElementById('angleSlider');

  if (state.autoRotate){
    const step = () => {
      if (!state.autoRotate) return;
      state.angle += 0.6;
      if (state.angle > 35) state.angle = -35;
      rotor.style.transform = `rotateY(${state.angle}deg)`;
      slider.value = state.angle;
      document.getElementById('angleLabel').textContent = Math.round(state.angle) + '°';
      requestAnimationFrame(step);
    };
    step();
  }
}

function resetView(){
  state.autoRotate = false;
  state.angle = 0;
  document.getElementById('humanRotor').style.transform = 'rotateY(0deg)';
  document.getElementById('angleSlider').value = 0;
  document.getElementById('angleLabel').textContent = '0°';
}

document.addEventListener('input', e => {
  if (e.target.id === 'angleSlider'){
    state.autoRotate = false;
    state.angle = parseFloat(e.target.value);
    document.getElementById('humanRotor').style.transform = `rotateY(${state.angle}deg)`;
    document.getElementById('angleLabel').textContent = Math.round(state.angle) + '°';
  }
});

/* ---------------- 器官中心 ---------------- */
function buildOrganGrid(){
  document.getElementById('organGrid').innerHTML = ORGANS.map(o => {
    const cls = o.lv === 1 ? 'ok' : o.lv === 2 ? 'wn' : 'dg';
    return `
    <div class="organ-card glass" onclick="openOrgan('${o.id}')">
      <div class="oc-top">
        <div class="oc-icon">${o.icon}</div>
        <div>
          <div class="oc-name">${o.name}</div>
          <div class="oc-en">${o.en}</div>
        </div>
      </div>
      <div class="oc-score"><b>${o.score}</b><span>/100</span></div>
      <div class="mini-bar"><i style="width:${o.score}%"></i></div>
      <div style="margin-top:9px"><span class="tag ${cls}">${o.risk}</span></div>
    </div>`;
  }).join('');
}

function openOrgan(id){
  const o = ORGANS.find(x => x.id === id);
  if (!o) return;
  const cls = o.lv === 1 ? 'ok' : o.lv === 2 ? 'wn' : 'dg';
  const maxS = Math.max(...o.history.map(h => h.s));
  const minS = Math.min(...o.history.map(h => h.s));
  const spark = sparkSVG(o.history.map(h => h.s), o.lv === 1 ? '#34d399' : o.lv === 2 ? '#fbbf24' : '#f87171');

  document.getElementById('modalCard').innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div style="display:flex;align-items:center;gap:13px;margin-bottom:16px">
      <div style="width:50px;height:50px;border-radius:15px;display:grid;place-items:center;font-size:24px;background:linear-gradient(135deg,rgba(34,211,238,.16),rgba(99,102,241,.16));border:1px solid rgba(34,211,238,.25)">${o.icon}</div>
      <div>
        <div style="font-size:18px;font-weight:800">${o.name} <span style="font-size:10px;color:var(--tx3);letter-spacing:1.5px">${o.en}</span></div>
        <div style="font-size:11.5px;color:var(--tx3);margin-top:2px">${o.sys}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:27px;font-weight:800;background:linear-gradient(135deg,#67e8f9,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent">${o.score}</div>
        <div style="font-size:9.5px;color:var(--tx3);letter-spacing:1px">健康指数</div>
      </div>
    </div>

    <div style="margin-bottom:14px"><span class="tag ${cls}">${o.risk}</span></div>

    <div style="font-size:12.5px;line-height:1.8;color:var(--tx2);margin-bottom:14px">${o.desc}</div>

    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:6px">主要功能</div>
    <div style="font-size:12.5px;color:#a5f3fc;margin-bottom:16px;padding:10px 12px;border-radius:10px;background:rgba(34,211,238,.06);border:1px solid rgba(34,211,238,.14)">${o.fn}</div>

    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:8px">关键指标</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:16px">
      ${o.metrics.map(m => `
        <div style="padding:10px;border-radius:11px;background:rgba(255,255,255,.035);border:1px solid var(--line);text-align:center">
          <div style="font-size:10.5px;color:var(--tx3)">${m.k}</div>
          <div style="font-size:13.5px;font-weight:700;margin-top:4px;color:var(--cy)">${m.v}</div>
        </div>`).join('')}
    </div>

    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:8px">检测趋势</div>
    <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--line);margin-bottom:16px">
      <div style="height:36px">${spark}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--tx3);margin-top:6px">
        ${o.history.map(h => `<span>${h.d} · ${h.s}</span>`).join('')}
      </div>
    </div>

    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:8px">改善建议</div>
    ${o.advice.map(a => `
      <div style="display:flex;gap:8px;font-size:12.5px;line-height:1.7;color:var(--tx2);margin-bottom:7px">
        <span style="color:var(--cy)">▸</span><span>${a}</span>
      </div>`).join('')}

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);font-size:10px;color:#3d5570;text-align:center;line-height:1.7">
      数据来源：AI 健康分析引擎 · 本内容仅供健康参考
    </div>
  `;
  document.getElementById('modal').classList.add('show');
}

function closeModal(){
  document.getElementById('modal').classList.remove('show');
}

/* ---------------- 血管循环 ---------------- */
const VESSEL_METRICS = [
  { lb:'血压', v:'126/82', u:'mmHg', c:'var(--ok)', d:'正常' },
  { lb:'血氧', v:'98', u:'%', c:'var(--ok)', d:'稳定' },
  { lb:'脉搏', v:'72', u:'bpm', c:'var(--ok)', d:'规律' },
  { lb:'HRV', v:'46', u:'ms', c:'var(--wn)', d:'偏低' },
  { lb:'循环指数', v:'88', u:'', c:'var(--cy)', d:'良好' },
  { lb:'动脉硬化指数', v:'1.12', u:'', c:'var(--ok)', d:'正常' }
];

function renderVesselMetrics(){
  document.getElementById('vesselMetrics').innerHTML = VESSEL_METRICS.map(m => `
    <div class="metric-card glass">
      <div class="lb">${m.lb}</div>
      <div class="delta" style="color:${m.c}">${m.d}</div>
      <div class="vv">${m.v}<small>${m.u}</small></div>
    </div>`).join('');
}

function buildVesselPage(){
  const vessels = [
    { n:'脑血管', s:'血流速度 62 cm/s', st:'良好', lv:1 },
    { n:'冠状动脉', s:'钙化积分 12', st:'良好', lv:1 },
    { n:'主动脉', s:'内径 3.2 cm', st:'正常', lv:1 },
    { n:'静脉系统', s:'回流功能良好', st:'正常', lv:1 },
    { n:'微循环系统', s:'甲襞微循环 轻度异常', st:'需关注', lv:2 }
  ];
  document.getElementById('vesselMap').innerHTML = vessels.map(v => `
    <div style="display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--line)">
      <div style="width:7px;height:7px;border-radius:50%;background:${v.lv===1?'var(--ok)':'var(--wn)'};box-shadow:0 0 9px ${v.lv===1?'var(--ok)':'var(--wn)'}"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${v.n}</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:2px">${v.s}</div>
      </div>
      <span class="tag ${v.lv===1?'ok':'wn'}">${v.st}</span>
    </div>`).join('');
}

/* ---------------- 经络中心 ---------------- */
function buildMeridianPage(){
  renderMeridianHeat();

  document.getElementById('meridianList12').innerHTML = MERIDIANS_12.map(m => {
    const cls = m.energy >= 80 ? 'ok' : m.energy >= 72 ? 'wn' : 'dg';
    return `
    <div class="list-item" onclick="openMeridian('${m.name}', ${m.energy}, '${m.status}', '${m.path}', '${m.time}', '${m.organ}')">
      <div class="li-icon">〰️</div>
      <div class="li-main">
        <div class="li-t">${m.name} <span class="tag ${cls}">${m.status}</span></div>
        <div class="li-s">${m.time} · 关联器官：${m.organ}</div>
      </div>
      <div class="li-v" style="color:${m.energy>=80?'var(--ok)':m.energy>=72?'var(--wn)':'var(--dg)'}">${m.energy}</div>
    </div>`;
  }).join('');

  document.getElementById('meridianList8').innerHTML = MERIDIANS_8.map(m => {
    const cls = m.energy >= 80 ? 'ok' : m.energy >= 74 ? 'wn' : 'dg';
    return `
    <div class="list-item" onclick="openMeridian('${m.name}', ${m.energy}, '${m.status}', '${m.path}', '奇经八脉', '—')">
      <div class="li-icon"></div>
      <div class="li-main">
        <div class="li-t">${m.name} <span class="tag ${cls}">${m.status}</span></div>
        <div class="li-s">${m.path.slice(0, 30)}…</div>
      </div>
      <div class="li-v" style="color:${m.energy>=80?'var(--ok)':m.energy>=74?'var(--wn)':'var(--dg)'}">${m.energy}</div>
    </div>`;
  }).join('');
}

function renderMeridianHeat(){
  const el = document.getElementById('meridianHeat');
  const items = [...MERIDIANS_12.slice(0, 8).map(m => ({ n:m.name, e:m.energy })),
                 ...MERIDIANS_8.slice(0, 4).map(m => ({ n:m.name, e:m.energy }))];
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:9px">
      ${items.map(it => {
        const c = it.e >= 82 ? '#34d399' : it.e >= 74 ? '#22d3ee' : it.e >= 68 ? '#fbbf24' : '#f87171';
        return `<div style="padding:10px 4px;border-radius:11px;text-align:center;
            background:${c}1a;border:1px solid ${c}44;transition:.25s" title="能量值 ${it.e}">
          <div style="font-size:12px;font-weight:600;color:${c}">${it.n}</div>
          <div style="font-size:15px;font-weight:800;color:${c};margin-top:3px">${it.e}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:14px;margin-top:14px;font-size:10.5px;color:var(--tx3);flex-wrap:wrap">
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#34d399;margin-right:4px"></i>能量充足 ≥82</span>
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#22d3ee;margin-right:4px"></i>正常 74–81</span>
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#fbbf24;margin-right:4px"></i>需关注 68–73</span>
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#f87171;margin-right:4px"></i>堵塞风险 &lt;68</span>
    </div>`;
}

function openMeridian(name, energy, status, path, time, organ){
  const cls = energy >= 80 ? 'ok' : energy >= 72 ? 'wn' : 'dg';
  document.getElementById('modalCard').innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div style="display:flex;align-items:center;gap:13px;margin-bottom:16px">
      <div style="width:50px;height:50px;border-radius:15px;display:grid;place-items:center;font-size:23px;background:linear-gradient(135deg,rgba(251,191,36,.14),rgba(34,211,238,.14));border:1px solid rgba(251,191,36,.25)">〰️</div>
      <div>
        <div style="font-size:18px;font-weight:800">${name}</div>
        <div style="font-size:11.5px;color:var(--tx3);margin-top:2px">${time}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:26px;font-weight:800;color:var(--cy)">${energy}</div>
        <div style="font-size:9.5px;color:var(--tx3);letter-spacing:1px">演示能量值</div>
      </div>
    </div>
    <div style="margin-bottom:14px"><span class="tag ${cls}">${status}</span></div>
    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:6px">循行路线</div>
    <div style="font-size:12.5px;line-height:1.85;color:var(--tx2);padding:12px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid var(--line);margin-bottom:16px">${path}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="padding:12px;border-radius:11px;background:rgba(34,211,238,.06);border:1px solid rgba(34,211,238,.16)">
        <div style="font-size:10.5px;color:var(--tx3)">关联器官</div>
        <div style="font-size:14px;font-weight:700;margin-top:4px">${organ}</div>
      </div>
      <div style="padding:12px;border-radius:11px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2)">
        <div style="font-size:10.5px;color:var(--tx3)">预设堵塞提示</div>
        <div style="font-size:14px;font-weight:700;margin-top:4px;color:${cls==='dg'?'var(--dg)':cls==='wn'?'var(--wn)':'var(--ok)'}">
          ${energy < 68 ? '高' : energy < 74 ? '中' : '低'}
        </div>
      </div>
    </div>
    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:8px">调理建议</div>
    <div style="font-size:12.5px;line-height:1.8;color:var(--tx2)">
      ▸ 于当令时段（${time.split(' ')[0]}）保持静息或浅睡，利于经气运行<br>
      ▸ 每日沿经络走向推按 3–5 分钟，力度以微酸胀为宜<br>
      ▸ 配合对应原穴艾灸，每次 10–15 分钟<br>
      ▸ 避免寒凉饮食与情绪剧烈波动
    </div>
  `;
  document.getElementById('modal').classList.add('show');
}

/* ---------------- 穴位中心 ---------------- */
function buildAcupointChips(){
  const meris = ['全部', ...new Set(ACUPOINTS.map(a => a.meridian))];
  document.getElementById('acuChips').innerHTML = meris.map(m => `
    <div class="chip ${m==='全部'?'active':''}" onclick="setAcuFilter('${m}', this)">${m}</div>
  `).join('');
}

function setAcuFilter(m, el){
  state.acuFilter = m;
  document.querySelectorAll('#acuChips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderAcupoints();
}

function renderAcupoints(){
  const kw = (document.getElementById('acuSearch').value || '').trim();
  let list = ACUPOINTS;
  if (state.acuFilter !== '全部') list = list.filter(a => a.meridian === state.acuFilter);
  if (kw) list = list.filter(a =>
    a.name.includes(kw) || a.effect.includes(kw) || a.indications.includes(kw) || a.meridian.includes(kw)
  );

  document.getElementById('acuCount').textContent =
    `穴位库收录 361 个标准经穴 · 当前筛选显示 ${list.length} 个`;

  if (!list.length){
    document.getElementById('acuList').innerHTML = `<div class="empty">未找到匹配的穴位</div>`;
    return;
  }

  document.getElementById('acuList').innerHTML = list.map(a => `
    <div class="list-item" onclick="openAcupoint(${a.id})">
      <div class="li-icon"></div>
      <div class="li-main">
        <div class="li-t">${a.name} <span class="tag cy">${a.meridian}</span></div>
        <div class="li-s">${a.effect}</div>
      </div>
      <span class="arrow" style="color:var(--tx3)">›</span>
    </div>`).join('');
}

function openAcupoint(id){
  const a = ACUPOINTS.find(x => x.id === id);
  if (!a) return;
  const relOrgan = {
    '肺经':'肺','大肠经':'大肠','胃经':'胃','脾经':'脾','心经':'心脏','小肠经':'小肠',
    '膀胱经':'膀胱','肾经':'肾','心包经':'心包','三焦经':'三焦','胆经':'胆囊','肝经':'肝脏',
    '任脉':'任脉系统','督脉':'督脉系统'
  }[a.meridian] || '—';

  document.getElementById('modalCard').innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div style="display:flex;align-items:center;gap:13px;margin-bottom:16px">
      <div style="width:50px;height:50px;border-radius:15px;display:grid;place-items:center;font-size:23px;background:linear-gradient(135deg,rgba(34,211,238,.16),rgba(99,102,241,.16));border:1px solid rgba(34,211,238,.25)"></div>
      <div>
        <div style="font-size:18px;font-weight:800">${a.name}</div>
        <div style="font-size:11.5px;color:var(--tx3);margin-top:2px">${a.meridian} · 编号 HD-A${String(a.id).padStart(3,'0')}</div>
      </div>
    </div>

    <div style="margin-bottom:14px;display:flex;gap:7px;flex-wrap:wrap">
      <span class="tag cy">${a.meridian}</span>
      <span class="tag pu">关联器官：${relOrgan}</span>
    </div>

    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:6px">定位</div>
    <div style="font-size:12.5px;line-height:1.8;color:var(--tx2);padding:11px 13px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid var(--line);margin-bottom:14px">${a.position}</div>

    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:6px">功效</div>
    <div style="font-size:12.5px;line-height:1.8;color:#a5f3fc;padding:11px 13px;border-radius:11px;background:rgba(34,211,238,.06);border:1px solid rgba(34,211,238,.16);margin-bottom:14px">${a.effect}</div>

    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:6px">主治 / 适应症</div>
    <div style="font-size:12.5px;line-height:1.8;color:var(--tx2);padding:11px 13px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid var(--line);margin-bottom:16px">${a.indications}</div>

    <div style="font-size:11.5px;color:var(--tx3);margin-bottom:8px">操作方式</div>
    <div style="font-size:12.5px;line-height:1.85;color:var(--tx2)">
      ▸ 指压：拇指指腹垂直按压，力度由轻到重，保持 3–5 秒后放松<br>
      ▸ 按揉：顺时针按揉 2–3 分钟，以局部酸胀为度<br>
      ▸ 艾灸：每次 10–15 分钟，注意避免烫伤<br>
      ▸ 每日 1–2 次，孕妇及皮肤破损处慎用
    </div>

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);font-size:10px;color:#3d5570;text-align:center;line-height:1.7">
      穴位数据参考《针灸学》国家标准 GB/T 12346-2021<br>本内容仅供健康参考，不构成医疗建议
    </div>
  `;
  document.getElementById('modal').classList.add('show');
}

/* ---------------- 症状参考 ---------------- */
function buildSymptomChips(){
  const chips = ['头晕','失眠','胃胀','胸闷','乏力','头痛','心悸','便秘','眼干','耳鸣','焦虑','怕冷'];
  document.getElementById('symptomChips').innerHTML = chips.map(c =>
    `<div class="chip" onclick="quickAsk('${c}')">${c}</div>`
  ).join('');
}

function initChat(){
  if (state.chatStarted) return;
  state.chatStarted = true;
  pushMsg('ai', `您好，我是 <b style="color:var(--cy)">健康信息助手</b>。<br>
    我会根据本地预设的症状关键词条目提供一般性信息参考。此功能不是人工智能诊断，不会进行可靠的临床风险评估，也不能替代医生。<br><br>
    如有严重、突发或迅速加重的症状，请及时寻求医疗帮助。`);
}

function pushMsg(role, html){
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const avatar = document.createElement('div');
  avatar.className = 'av';
  avatar.textContent = role === 'ai' ? '烙' : '';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  // User-entered symptom text is untrusted: render it as text, never HTML.
  if(role === 'user') bubble.textContent = String(html == null ? '' : html);
  else bubble.innerHTML = String(html == null ? '' : html);
  div.appendChild(avatar);
  div.appendChild(bubble);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function quickAsk(txt){
  document.getElementById('chatInput').value = txt;
  sendMsg();
}

function sendMsg(){
  const input = document.getElementById('chatInput');
  const txt = input.value.trim();
  if (!txt) return;
  input.value = '';
  initChat();
  pushMsg('user', txt);
  runAnalysis(txt);
}

function matchSymptom(text){
  for (const s of SYMPTOM_DB){
    if (s.kw.some(k => text.includes(k))) return s;
  }
  return {
    organ:'需进一步评估', meridian:'待匹配', risk:'未评估', lv:0,
    note:'当前关键词规则未匹配到相关条目；这不代表风险较低，也不能排除疾病',
    advice:'可补充症状部位、持续时间和变化情况；如症状持续、加重或令人担忧，请咨询医疗专业人员；严重或突发症状应及时就医'
  };
}

function runAnalysis(text){
  const r = matchSymptom(text);
  const steps = [
    '症状语义解析…',
    '匹配人体器官图谱…',
    '匹配经络循行路径…',
    '检索症状关键词参考条目…',
    '展示一般健康提示（非个性化诊疗建议）…'
  ];

  const holder = pushMsg('ai', '');
  const bubble = holder.querySelector('.bubble');
  bubble.innerHTML = '<div style="font-size:12.5px;color:var(--tx3);margin-bottom:6px">关键词规则匹配中…</div>';

  steps.forEach((s, i) => {
    setTimeout(() => {
      const line = document.createElement('div');
      line.className = 'step-line';
      line.innerHTML = `<span class="dot2"></span><span>${s}</span>`;
      bubble.appendChild(line);
      document.getElementById('chat').scrollTop = 1e9;

      if (i === steps.length - 1){
        setTimeout(() => showResult(holder, r), 520);
      }
    }, 340 * (i + 1));
  });
}

function showResult(holder, r){
  const cls = r.lv === 1 ? 'ok' : r.lv === 2 ? 'wn' : 'dg';
  const json = {
    "相关器官": r.organ,
    "相关经络": r.meridian,
    "匹配条目参考级别（非风险评估）": r.risk,
    "建议": r.advice
  };

  holder.querySelector('.bubble').innerHTML = `
    <div style="font-size:13px;font-weight:700;margin-bottom:9px;color:#a5f3fc">关键词匹配完成 · 非医疗评估</div>

    <div class="kv"><b>相关器官</b><span>${escHTML(r.organ)}</span></div>
    <div class="kv"><b>相关经络</b><span>${escHTML(r.meridian)}</span></div>
    <div class="kv"><b>参考条目级别（非风险评估）</b><span class="tag ${cls}">${escHTML(r.risk)}</span></div>

    <div style="margin-top:11px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.035);border:1px solid var(--line);font-size:12px;line-height:1.7;color:var(--tx2)">
      <b style="color:var(--tx3);font-weight:500">规则条目说明：</b>${escHTML(r.note)}
    </div>

    <div style="margin-top:12px;font-size:11.5px;color:var(--tx3);margin-bottom:5px">结构化输出（JSON）</div>
    <pre>${escHTML(JSON.stringify(json, null, 2))}</pre>

    <div style="margin-top:12px;font-size:12px;line-height:1.8;color:var(--tx2)">
      <b style="color:#a5f3fc">健康建议：</b><br>▸ ${escHTML(r.advice)}<br>
      ▸ 保持规律作息，每日饮水量 1500–2000 mL<br>
      ▸ 若症状持续或加重，请及时就医
    </div>

    <div style="margin-top:13px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn sm" onclick="go('report')">查看健康报告</button>
      <button class="btn ghost sm" onclick="go('organ')">查看器官档案</button>
    </div>

    <div style="margin-top:12px;font-size:10px;color:#3d5570;line-height:1.6">
      ⚠️ 本结果由本地预设的症状关键词条目匹配生成，不是人工智能诊断，仅供一般健康参考，不能替代专业医疗诊断。
    </div>
  `;
  document.getElementById('chat').scrollTop = 1e9;
}

/* ---------------- 健康报告 ---------------- */
const SCORE_PARTS = [
  { k:'器官健康', v:28, max:30, c:'#22d3ee' },
  { k:'循环系统', v:16, max:20, c:'#3b82f6' },
  { k:'经络系统', v:17, max:20, c:'#8b5cf6' },
  { k:'睡眠质量', v:7,  max:10, c:'#34d399' },
  { k:'运动指数', v:8,  max:10, c:'#fbbf24' },
  { k:'心理压力', v:8,  max:10, c:'#f472b6' }
];

function renderScoreBars(){
  document.getElementById('scoreBars').innerHTML = SCORE_PARTS.map(p => `
    <div class="bar-row">
      <div class="br-top"><span>${p.k}</span><b>${p.v} / ${p.max}</b></div>
      <div class="bar-track"><i style="width:${(p.v / p.max * 100).toFixed(0)}%;background:linear-gradient(90deg,${p.c},${p.c}99);box-shadow:0 0 10px ${p.c}88"></i></div>
    </div>`).join('');
}

function renderRadar(){
  const cx = 120, cy = 108, R = 74;
  const labels = ['器官','循环','经络','睡眠','运动','心理'];
  const values = [0.93, 0.80, 0.85, 0.70, 0.80, 0.80];
  const n = labels.length;

  const pt = (i, r) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(k => {
    const pts = labels.map((_, i) => pt(i, R * k).join(',')).join(' ');
    grid += `<polygon points="${pts}" fill="none" stroke="rgba(64,200,255,${k === 1 ? .3 : .12})" stroke-width="1"/>`;
  });

  let axes = '';
  labels.forEach((l, i) => {
    const [x, y] = pt(i, R);
    axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(64,200,255,.14)" stroke-width="1"/>`;
    const [lx, ly] = pt(i, R + 17);
    axes += `<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-size="10.5" fill="#8aa3c4">${l}</text>`;
  });

  const poly = values.map((v, i) => pt(i, R * v).join(',')).join(' ');
  let dots = '';
  values.forEach((v, i) => {
    const [x, y] = pt(i, R * v);
    dots += `<circle cx="${x}" cy="${y}" r="3.2" fill="#22d3ee" stroke="#04070f" stroke-width="1.5"/>`;
  });

  document.getElementById('radarSvg').innerHTML = `
    <defs>
      <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity=".42"/>
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity=".32"/>
      </linearGradient>
    </defs>
    ${grid}${axes}
    <polygon points="${poly}" fill="url(#radarFill)" stroke="#22d3ee" stroke-width="1.8"
             style="filter:drop-shadow(0 0 7px rgba(34,211,238,.6))"/>
    ${dots}
  `;
}

function renderTrend(){
  const data = [80, 82, 84];
  const labels = ['05-12', '06-12', '07-12'];
  const w = 320, h = 120, pad = 26;
  const maxV = 92, minV = 74;

  const px = i => pad + i * ((w - pad * 2) / (data.length - 1));
  const py = v => h - pad - ((v - minV) / (maxV - minV)) * (h - pad * 2);

  const pts = data.map((v, i) => [px(i), py(v)]);
  const line = pts.map(p => p.join(',')).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  let dots = '', texts = '';
  pts.forEach((p, i) => {
    dots += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#22d3ee" stroke="#04070f" stroke-width="2"/>
             <text x="${p[0]}" y="${p[1] - 12}" text-anchor="middle" font-size="11" fill="#67e8f9" font-weight="700">${data[i]}</text>
             <text x="${p[0]}" y="${h - 8}" text-anchor="middle" font-size="9.5" fill="#5b7396">${labels[i]}</text>`;
  });

  let grid = '';
  for (let i = 0; i <= 3; i++){
    const y = pad + i * ((h - pad * 2) / 3);
    grid += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="rgba(64,200,255,.08)" stroke-width="1"/>`;
  }

  document.getElementById('trendSvg').innerHTML = `
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity=".35"/>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}
    <polygon points="${area}" fill="url(#areaGrad)"/>
    <polyline points="${line}" fill="none" stroke="#22d3ee" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round"
      style="filter:drop-shadow(0 0 6px rgba(34,211,238,.8))"/>
    ${dots}
  `;
}

function renderAdvice(){
  const list = [
    { i:'♥', t:'心血管健康', c:'wn', d:'可记录静息心率、血压与日常活动变化；如出现胸痛、呼吸困难或晕厥等症状，请及时寻求专业医疗帮助。' },
    { i:'☘', t:'均衡饮食', c:'cy', d:'优先选择多样化蔬果、全谷物和适量优质蛋白；具体饮食方案应结合个人疾病、药物与营养需求。' },
    { i:'⌁', t:'日常活动', c:'ok', d:'根据体能循序渐进增加活动量；有慢性病、运动禁忌或运动时不适，请先咨询专业人员。' },
    { i:'◷', t:'睡眠记录', c:'ok', d:'保持相对规律的作息，并记录睡眠时长与主观感受；持续严重睡眠问题建议就医评估。' },
    { i:'◎', t:'压力管理', c:'pu', d:'可尝试短时放松、呼吸练习或散步；若情绪困扰持续影响生活，请寻求专业支持。' }
  ];
  const host = document.getElementById('adviceList');
  if (!host) return;
  host.innerHTML = '<div role="note" style="padding:10px 12px;margin-bottom:12px;border:1px solid var(--line);border-radius:10px;color:var(--tx2);font-size:11px;line-height:1.6">以下为通用健康教育信息，不是基于个人检测数据生成的诊断或治疗建议。</div>' + list.map(a => `
    <div class="list-item" style="cursor:default">
      <div class="li-icon">${a.i}</div>
      <div class="li-main">
        <div class="li-t">${a.t} <span class="tag ${a.c}">健康科普</span></div>
        <div class="li-s" style="white-space:normal;line-height:1.6">${a.d}</div>
      </div>
    </div>`).join('');
}

/* ---------------- 页面切换钩子 ---------------- */
const _go = go;
go = function(page){
  _go(page);
  if (page === 'ai'){
    setTimeout(initChat, 260);
  }
  if (page === 'body'){
    setTimeout(() => {
      const rotor = document.getElementById('humanRotor');
      if (rotor) rotor.style.transform = `rotateY(${state.angle}deg)`;
    }, 60);
  }
};

/* ---------------- 键盘 ---------------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ---------------- 版权 ---------------- */
console.log('%c 戴煜的疗养健康助手 ',
  'background:linear-gradient(90deg,#0891b2,#6366f1);color:#fff;padding:6px 14px;border-radius:6px;font-weight:bold;font-size:14px');
console.log('%c 人体数字孪生健康平台 · V1.0.0\n%c © 2025 戴煜的疗养健康助手 Platform. All Rights Reserved.\n 本平台内容仅供健康参考，不能替代专业医疗诊断。',
  'color:#22d3ee;font-size:12px', 'color:#5b7396;font-size:11px');
