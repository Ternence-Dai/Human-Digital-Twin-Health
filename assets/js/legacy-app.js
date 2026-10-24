
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
  { key:'ai',       name:'症状资料',  en:'SYMPTOM SOURCES', icon:'ℹ' },
  { key:'report',   name:'健康报告', en:'REPORT',      icon:'' },
  { key:'me',       name:'我的',     en:'PROFILE',     icon:'' }
];

const TABBAR = ['home','body','ai','report','me'];

/* ---------------- 初始化 ---------------- */
window.addEventListener('load', async () => {
  try { window.HealthDomain = await import('../../src/domain/index.js?v=20261020-health-active-duplicate-v3'); }
  catch (error) {
    observationDomainUnavailable = true;
    console.error('Health domain core unavailable', error);
  }
  loadObservations();
  renderObservations();
  buildObservationAmendmentControls();
  buildNav();
  buildQuickGrid();buildHuman();
  buildLayerCtrl();
  buildPersonaRow();
  buildOrganGrid();
  buildVesselPage();
  buildMeridianPage();
  buildAcupointChips();
  renderAcupoints();
  buildSymptomChips();
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
function renderPersonalRecordSnapshot(){
  const host = document.getElementById('personalRecordSnapshot');
  if(!host) return;
  if(observationDomainUnavailable || !window.HealthDomain || typeof window.HealthDomain.normalizeObservationHistory !== 'function'){
    host.innerHTML = '<div class="personal-record-state is-warning" role="status"><strong>记录校验模块不可用</strong><span>为避免显示未经验证的记录，个人记录快照暂不可用；原始本机缓存未修改。</span><button type="button" class="btn sm ghost" onclick="go(\'records\')">查看恢复入口</button></div>';
    return;
  }
  if(observationStorageRecoveryRequired){
    host.innerHTML = '<div class="personal-record-state is-warning" role="alert"><strong>个人记录待恢复</strong><span>检测到本机记录缓存异常。当前空白不代表记录已丢失；请先导出恢复数据，再导入有效备份。</span><button type="button" class="btn sm" onclick="go(\'records\')">前往记录恢复</button></div>';
    return;
  }
  try{
    const rows = window.HealthDomain.normalizeObservationHistory(Array.isArray(window.healthObservations) ? window.healthObservations : []);
    const active = rows.filter(row => row.recordState === 'active');
    const supersededCount = rows.filter(row => row.recordState === 'superseded').length;
    const voidedCount = rows.filter(row => row.recordState === 'voided').length;
    const metricCount = new Set(active.map(row => row.metric.trim().toLocaleLowerCase())).size;
    const demoCount = active.filter(row => row.quality === 'demo').length;
    const recent = active.slice().sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0,3);
    const qualityLabels = {measured:'设备/仪器测量',reported:'手动自述',imported:'文件导入',demo:'示例数据'};
    const stats = [
      {label:'当前有效记录',value:active.length,detail:'通过来源与版本校验'},
      {label:'历史版本',value:supersededCount + voidedCount,detail:'已更正或已作废'},
      {label:'指标类别',value:metricCount,detail:'当前有效记录覆盖'},
      {label:'示例来源',value:demoCount,detail:'单独标记，不作真实测量'}
    ];
    const statsHtml = '<div class="personal-record-stats">' + stats.map(item =>
      '<div class="personal-record-stat"><span>' + item.label + '</span><strong>' + item.value + '</strong><small>' + item.detail + '</small></div>'
    ).join('') + '</div>';

    // FHIR-style provenance coverage: keep the observation's source, measurement time,
    // unit and optional record-entry time visible without assigning any health score.
    const qualityKinds = [
      {key:'measured',label:'设备 / 仪器测量'},
      {key:'reported',label:'手动自述'},
      {key:'imported',label:'文件导入'},
      {key:'demo',label:'示例数据'}
    ];
    const coverageChecks = [
      {key:'source',label:'来源与质量标记',count:active.filter(row =>
        typeof row.source === 'string' && !!row.source.trim() && !!qualityLabels[row.quality]).length},
      {key:'measured-at',label:'测量时间',count:active.filter(row =>
        Number.isFinite(Date.parse(row.observedAt))).length},
      {key:'unit',label:'计量单位',count:active.filter(row =>
        typeof row.unit === 'string' && !!row.unit.trim()).length},
      {key:'recorded-at',label:'记录创建时间',count:active.filter(row =>
        typeof row.recordedAt === 'string' && Number.isFinite(Date.parse(row.recordedAt))).length}
    ];
    const qualityHtml = qualityKinds.map(kind => {
      const count = active.filter(row => row.quality === kind.key).length;
      const rate = active.length ? count / active.length * 100 : 0;
      return '<div class="personal-record-quality" data-quality-kind="' + kind.key + '" data-count="' + count + '">' +
        '<div><span>' + kind.label + '</span><strong>' + count + '</strong></div>' +
        '<i><b style="width:' + rate.toFixed(1) + '%"></b></i></div>';
    }).join('');
    const coverageHtml = coverageChecks.map(check => {
      const rate = active.length ? check.count / active.length * 100 : 0;
      return '<div class="personal-record-coverage" data-integrity-metric="' + check.key +
        '" data-count="' + check.count + '" data-total="' + active.length + '">' +
        '<div><span>' + check.label + '</span><strong>' +
        (active.length ? rate.toFixed(0) + '%' : '—') + '</strong></div>' +
        '<i><b style="width:' + rate.toFixed(1) + '%"></b></i>' +
        '<small>' + check.count + ' / ' + active.length + ' 条' +
        (check.key === 'recorded-at' ? ' · 兼容旧版可选字段' : '') + '</small></div>';
    }).join('');
    const provenanceHtml = '<section class="personal-record-provenance" aria-label="数据来源与完整性">' +
      '<div class="personal-record-provenance__head"><div><strong>数据来源与完整性</strong>' +
      '<span>逐条校验来源类别、测量时间和计量单位；不推断医学意义。</span></div>' +
      '<span class="personal-record-provenance__badge">FHIR · Observation provenance</span></div>' +
      '<div class="personal-record-provenance__grid"><div><h4>来源类型分布</h4>' +
      (active.length ? qualityHtml : '<div class="personal-record-quality-empty">暂无当前有效记录</div>') +
      '</div><div><h4>字段覆盖率</h4>' +
      (active.length ? coverageHtml : '<div class="personal-record-quality-empty">录入或导入观察值后显示来源、时间与单位覆盖情况。</div>') +
      '</div></div><p class="personal-record-provenance__note">覆盖率只描述记录字段是否齐全；不代表测量准确性、健康风险、临床有效性或诊断结论。</p></section>';

    const recentHtml = '<div class="personal-record-recent">' +
      (recent.length ? '<div class="personal-record-recent__head"><strong>最近测量</strong><span>按测量时间排序 · 最多显示 3 条</span></div>' +
        recent.map(row => {
          const measuredAt = new Date(row.observedAt);
          const observedLabel = Number.isFinite(measuredAt.getTime()) ? measuredAt.toLocaleString('zh-CN',{hour12:false}) : row.observedAt;
          const provenance = qualityLabels[row.quality] || row.quality;
          return '<article class="personal-record-row"><div class="personal-record-row__main"><strong>' + escHTML(row.metric) + '</strong><b>' + escHTML(row.value) + ' <small>' + escHTML(row.unit) + '</small></b></div>' +
            '<div class="personal-record-row__meta"><span>测量 ' + escHTML(observedLabel) + '</span><span>来源 ' + escHTML(row.source) + '</span><span>质量 ' + escHTML(provenance) + '</span></div></article>';
        }).join('') :
        '<div class="personal-record-empty personal-record-empty--first-run"><div class="personal-record-first-copy">' +
          '<span class="personal-record-first-kicker">FIRST VERIFIED OBSERVATION</span>' +
          '<strong>' + (rows.length ? '当前没有有效观察值' : '从第一条可追溯观察开始') + '</strong>' +
          '<p>' + (rows.length ? '历史版本已保留。核对更正或作废原因后，可按流程创建新的有效版本。' : '先选择来源类别，再填写指标、数值、计量单位与实际测量时间。系统会保留记录来源与版本，不会自动填入演示体征。') + '</p>' +
          (!rows.length ? '<ol class="personal-record-first-steps"><li><b>01 · 来源</b><span>区分设备测量、本人报告或文件导入</span></li>' +
            '<li><b>02 · 测量信息</b><span>填写指标、数值、单位和观察时间</span></li>' +
            '<li><b>03 · 可追溯记录</b><span>保留来源说明与版本历史</span></li></ol>' : '') +
          '</div><button type="button" class="btn sm" onclick="go(\'records\')">' +
          (rows.length ? '查看历史版本' : '新增第一条观察记录') + '</button></div>') +
      '</div>';
    host.innerHTML = '<div class="personal-record-panel">' + statsHtml + provenanceHtml + recentHtml +
      '<div class="personal-record-foot">只读取浏览器本机的已验证观察记录；不把演示体征、器官示例分值或健康教育内容混入个人记录。</div></div>';
  }catch(error){
    observationStorageRecoveryRequired = true;
    try{ const raw = localStorage.getItem(OBSERVATION_STORAGE_KEY); if(raw !== null) preserveInvalidObservationStorage(raw); }catch(storageError){ console.error('无法读取个人健康记录恢复副本',storageError); }
    console.error('个人记录快照校验失败；已暂停常规写入。',error);
    host.innerHTML = '<div class="personal-record-state is-warning" role="alert"><strong>个人记录校验失败</strong><span>已暂停显示和写入以保护原始记录。请前往健康记录页面导出恢复数据。</span><button type="button" class="btn sm" onclick="go(\'records\')">前往恢复</button></div>';
  }
}
function renderObservations(){
  renderTrend();
  const host = document.getElementById('observationList');
  const count = document.getElementById('observationCount');
  const filter = document.getElementById('observationStateFilter');
  const filterSummary = document.getElementById('observationFilterSummary');
  if(!host || !count) return;
  renderPersonalRecordSnapshot();
  if(observationDomainUnavailable){
    if(filter) filter.disabled = true;
    if(filterSummary) filterSummary.textContent = '列表校验不可用';
    count.textContent = '校验模块不可用';
    host.innerHTML = '<div class="empty">健康记录校验模块尚未加载。为避免显示未经校验的数据，当前记录列表暂不可用；原始浏览器缓存未修改。请刷新页面后重试。常规写入与导出已暂停。</div>';
    return;
  }
  if(observationStorageRecoveryRequired){
    if(filter) filter.disabled = true;
    if(filterSummary) filterSummary.textContent = '恢复后可筛选';
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
    const stateCounts = {
      active: rows.filter(row => row.recordState === 'active').length,
      superseded: rows.filter(row => row.recordState === 'superseded').length,
      voided: rows.filter(row => row.recordState === 'voided').length
    };
    count.textContent = stateCounts.active + ' 条有效 / ' + rows.length + ' 个版本';
    const allowedFilters = ['all','active','superseded','voided'];
    const selectedFilter = filter && allowedFilters.includes(filter.value) ? filter.value : 'all';
    if(filter){
      filter.disabled = false;
      filter.innerHTML =
        '<option value="all">全部版本（' + rows.length + '）</option>' +
        '<option value="active">当前有效（' + stateCounts.active + '）</option>' +
        '<option value="superseded">已被更正（' + stateCounts.superseded + '）</option>' +
        '<option value="voided">已作废（' + stateCounts.voided + '）</option>';
      filter.value = selectedFilter;
    }
    const visibleRows = selectedFilter === 'all'
      ? rows : rows.filter(row => row.recordState === selectedFilter);
    if(filterSummary) filterSummary.textContent = '显示 ' + visibleRows.length + ' / ' + rows.length + ' 个版本';
    if(!rows.length){ host.innerHTML='<div class="empty">暂无记录。新增测量后会显示在这里。</div>'; return; }
    if(!visibleRows.length){
      host.innerHTML = '<div class="empty">当前状态没有记录。切换到“全部版本”可查看完整审计历史。</div>';
      return;
    }
    const stateLabels = {active:'当前有效',superseded:'已被更正',voided:'已作废'};
    host.innerHTML = visibleRows.map(row=>{
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
    renderPersonalRecordSnapshot();
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
    const baseObservation = window.HealthDomain.createObservation(replacement);
    const observation = Object.freeze({
      ...baseObservation,
      id:createObservationRecordId(),
      recordState:'active'
    });
    if(window.HealthDomain.hasActiveObservationDuplicate(existing,observation)){
      alert('这条测量记录与已有记录重复（指标、数值、单位、测量时间、来源和质量标记一致），未重复保存。');
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
    <button type="button" class="nav-item ${p.key==='home'?'active':''}" data-nav="${p.key}" aria-current="${p.key==='home'?'page':'false'}" onclick="go('${p.key}')">
      <span class="ic" aria-hidden="true">${p.icon}</span><span>${p.name}</span>
    </button>`).join('');

  const tb = document.getElementById('tabbar');
  tb.innerHTML = TABBAR.map(k => {
    const p = PAGES_META.find(x => x.key === k);
    return `<button type="button" class="tb ${k==='home'?'active':''}" data-nav="${k}" aria-current="${k==='home'?'page':'false'}" onclick="go('${k}')">
      <span class="i" aria-hidden="true">${p.icon}</span><span>${p.name}</span></button>`;
  }).join('');
}

function go(page){
  const meta = PAGES_META.find(p => p.key === page);
  const target = document.querySelector(`.page[data-page="${CSS.escape(page)}"]`);
  if (!meta || !target) {
    console.warn('Ignored navigation to an unknown health workspace page:', page);
    return false;
  }
  state.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p === target));
  document.querySelectorAll('[data-nav]').forEach(b => {
    const active = b.dataset.nav === page;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.getElementById('pageTitle').innerHTML = `${meta.name}<small>${meta.en}</small>`;
  const pages = document.getElementById('pages');
  if (pages) pages.scrollTo({ top: 0, behavior: 'instant' });
  if (page === 'report') renderTrend();
  return true;
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
    const anatomyStroke = '#63c3d1';
    const draw = (cx, cy) => `
      <g class="organ-node" data-organ="${o.id}" onclick="openOrgan('${o.id}')">
        <ellipse cx="${cx}" cy="${cy}" rx="${o.rx}" ry="${o.ry}" fill="url(#organGrad)"
                 stroke="${anatomyStroke}" stroke-width="1.3" opacity=".92"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${o.rx}" ry="${o.ry}" class="hit"/>
        <title>${o.name} · 解剖结构示意</title>
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

/* ---------------- 器官解剖知识库 ---------------- */
function buildOrganGrid(){
  const host = document.getElementById('organGrid');
  if(!host) return;
  host.innerHTML = ORGANS.map(o => `
    <button type="button" class="organ-card glass" onclick="openOrgan('${escHTML(o.id)}')">
      <div class="oc-top">
        <div class="oc-icon">${escHTML(o.icon)}</div>
        <div><div class="oc-name">${escHTML(o.name)}</div><div class="oc-en">${escHTML(o.en)}</div></div>
      </div>
      <div class="organ-card__system">${escHTML(o.sys)}</div>
      <div class="organ-card__function">${escHTML(o.fn)}</div>
      <span class="tag cy">解剖知识</span>
    </button>`).join('');
}


let healthModalReturnFocus = null;

function showModal(){
  const modal = document.getElementById('modal');
  if(!modal) return;
  healthModalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  const closeButton = modal.querySelector('.modal-close');
  if(closeButton) closeButton.focus({preventScroll:true});
}

function closeModal(){
  const modal = document.getElementById('modal');
  if(!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  const target = healthModalReturnFocus;
  healthModalReturnFocus = null;
  if(target && target.isConnected && typeof target.focus === 'function'){
    target.focus({preventScroll:true});
  }
}
window.closeModal = closeModal;

function openOrgan(id){
  const o = ORGANS.find(x => x.id === id);
  if(!o) return;
  document.getElementById('modalCard').innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div class="health-knowledge-modal__head">
      <div class="health-knowledge-modal__icon">${escHTML(o.icon)}</div>
      <div><h3>${escHTML(o.name)} <small>${escHTML(o.en)}</small></h3><span>${escHTML(o.sys)}</span></div>
      <span class="tag cy">结构知识</span>
    </div>
    <p class="health-knowledge-modal__description">${escHTML(o.desc)}</p>
    <section class="health-knowledge-modal__function">
      <small>主要生理功能 · 教育参考</small><strong>${escHTML(o.fn)}</strong>
    </section>
    <section class="health-knowledge-modal__boundary">
      <strong>与个人健康记录分开</strong>
      <p>此卡片描述一般解剖与生理知识，不包含器官检测结果、健康指数、疾病风险或个体化改善建议。当前没有可验证的器官级临床数据输入。</p>
      <button type="button" class="btn primary" onclick="closeModal();go('records')">查看本机观察记录</button>
    </section>
    <div class="health-knowledge-modal__source">解剖知识示意 · 非医学影像 · 非诊断结果</div>
  `;
  showModal();
}

/* ---------------- 循环系统观察与结构参考 ---------------- */
function renderVesselMetrics(){
  const host = document.getElementById('vesselMetrics');
  if(!host) return;
  if(observationDomainUnavailable || observationStorageRecoveryRequired){
    host.innerHTML = '<div class="health-observation-empty">记录校验暂不可用，已暂停显示观察值以保护本机数据。</div>';
    return;
  }
  const keywords = /blood.?pressure|systolic|diastolic|heart.?rate|resting.?heart|pulse|spo2|oxygen.?saturation|hrv|血压|心率|脉搏|血氧|血氧饱和|心率变异/i;
  const rows = (Array.isArray(window.healthObservations) ? window.healthObservations : [])
    .filter(row => row && row.recordState === 'active' &&
      typeof row.metric === 'string' && keywords.test(row.metric) &&
      Number.isFinite(row.value) && typeof row.unit === 'string' && row.unit.trim())
    .sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
    .slice(0,8);
  if(!rows.length){
    host.innerHTML = '<div class="health-observation-empty"><strong>暂无循环系统相关的有效观察值</strong><span>录入或导入具备来源、测量时间和单位的记录后，这里会显示原始值；不会填入默认血压、血氧或心率。</span><button type="button" class="btn sm" onclick="go(\'records\')">新增观察记录</button></div>';
    return;
  }
  const labels = {measured:'实测',reported:'本人报告',imported:'文件导入',demo:'演示'};
  host.innerHTML = rows.map(row => {
    const date = new Date(row.observedAt);
    const dateText = Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN',{hour12:false}) : row.observedAt;
    return '<article class="metric-card glass health-observation-metric">' +
      '<span class="lb">' + escHTML(row.metric) + '</span>' +
      '<strong class="vv">' + escHTML(row.value) + '<small>' + escHTML(row.unit) + '</small></strong>' +
      '<span class="health-observation-metric__meta">' + escHTML(dateText) + ' · ' +
      escHTML(labels[row.quality] || row.quality || '来源未分类') + '</span>' +
      '<span class="health-observation-metric__source">来源：' + escHTML(row.source) + '</span></article>';
  }).join('');
}

function buildVesselPage(){
  const host = document.getElementById('vesselMap');
  if(!host) return;
  const structures = [
    ['主动脉','将血液从左心室输送至全身循环。'],
    ['冠状动脉','为心肌组织提供血液供应。'],
    ['颈动脉','为头颈部提供主要动脉供血。'],
    ['脑血管','参与脑组织的动脉供血与静脉回流。'],
    ['肺循环','连接右心与肺部气体交换血管床。'],
    ['静脉系统','将外周血液回流至心脏。']
  ];
  host.innerHTML = '<div class="health-vessel-structure-grid">' + structures.map((item,index) =>
    '<article><span>0' + (index + 1) + '</span><strong>' + escHTML(item[0]) +
    '</strong><p>' + escHTML(item[1]) + '</p></article>'
  ).join('') + '</div><p class="health-vessel-structure-note">结构描述仅用于解剖教育；本图不显示狭窄、钙化、血流速度或其他未由影像/检测报告证实的个体状态。</p>';
}

/* ---------------- 经络路径教育参考 ---------------- */
function buildMeridianPage(){
  renderMeridianHeat();
  const renderList = (rows, category) => rows.map(m =>
    '<button type="button" class="list-item meridian-reference-row" onclick="openMeridian(' +
      "'" + escHTML(m.name) + "','" + escHTML(m.path) + "','" + escHTML(category === '十二正经' ? m.time : '奇经八脉') + "','" +
      escHTML(m.organ || '传统理论分类') + "'" + ')">' +
      '<span class="li-icon">〰️</span><span class="li-main"><strong>' + escHTML(m.name) + '</strong>' +
      '<small>' + escHTML(m.time || m.path.slice(0,42) + '…') + '</small></span>' +
      '<span class="tag cy">理论路径</span></button>'
  ).join('');
  document.getElementById('meridianList12').innerHTML = renderList(MERIDIANS_12,'十二正经');
  document.getElementById('meridianList8').innerHTML = renderList(MERIDIANS_8,'奇经八脉');
}

function renderMeridianHeat(){
  const host = document.getElementById('meridianHeat');
  if(!host) return;
  const items = [
    ...MERIDIANS_12.map(m => ({name:m.name,group:'十二正经'})),
    ...MERIDIANS_8.map(m => ({name:m.name,group:'奇经八脉'}))
  ];
  host.innerHTML = '<div class="health-meridian-reference-grid">' + items.map((item,index) =>
    '<article><span>0' + (index + 1) + '</span><strong>' + escHTML(item.name) +
    '</strong><small>' + item.group + '</small></article>'
  ).join('') + '</div><p class="health-meridian-reference-note">此处为传统医学经脉名称索引，不存在“能量值”“堵塞分数”或基于个人体征推断的经络状态。</p>';
}

function openMeridian(name,path,time,organ){
  document.getElementById('modalCard').innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div class="health-knowledge-modal__head">
      <div class="health-knowledge-modal__icon">〰️</div>
      <div><h3>${escHTML(name)}</h3><span>${escHTML(time)}</span></div>
      <span class="tag cy">传统理论</span>
    </div>
    <section class="health-knowledge-modal__function"><small>关联脏腑 · 理论分类</small><strong>${escHTML(organ)}</strong></section>
    <p class="health-knowledge-modal__description">${escHTML(path)}</p>
    <section class="health-knowledge-modal__boundary"><strong>医学边界说明</strong><p>经脉循行属于传统中医理论内容。本页面用于资料浏览与学习，不把经络概念解释为已经验证的解剖结构、实时生理能量或疾病诊断结果。</p></section>
  `;
  showModal();
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
  showModal();
}

/* ---------------- 症状参考 ---------------- */
function buildSymptomChips(){
  const topics = ['头痛','胸痛','头晕','呼吸困难','失眠','胃痛','心悸','咳嗽','疲劳','便秘','皮疹','发热'];
  const host = document.getElementById('symptomChips');
  if (!host) return;
  host.innerHTML = topics.map(topic =>
    '<button type="button" class="chip" onclick="quickAsk(\'' + escHTML(topic) + '\')">' +
    escHTML(topic) + '</button>'
  ).join('');
}

function initChat(){
  if (state.chatStarted) return;
  state.chatStarted = true;
  pushMsg('ai',
    '<strong>症状资料导航 · 不做症状分析</strong><p>本页面不会把症状描述映射为器官、经络、疾病或风险等级，也不生成个体化诊疗建议。你输入的内容只用于本机显示，不发送到远程服务。</p>' +
    '<p>请打开下方 MedlinePlus 或 NHS 官方资料目录自行查阅。严重、突发或迅速加重的症状，请及时联系所在地的急救或医疗服务，不要等待网页查询。</p>'
  );
}

function pushMsg(role, html){
  const chat = document.getElementById('chat');
  if (!chat) return null;
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const avatar = document.createElement('div');
  avatar.className = 'av';
  avatar.textContent = role === 'ai' ? 'i' : '你';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  // User-entered text is always text. Only fixed, authored navigation markup is HTML.
  if(role === 'user') bubble.textContent = String(html == null ? '' : html);
  else bubble.innerHTML = String(html == null ? '' : html);
  div.appendChild(avatar);
  div.appendChild(bubble);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function quickAsk(topic){
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = String(topic == null ? '' : topic);
  sendMsg();
}

function sendMsg(){
  const input = document.getElementById('chatInput');
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;
  input.value = '';
  initChat();
  pushMsg('user', query);
  runAnalysis(query);
}

function runAnalysis(query){
  const text = String(query == null ? '' : query).trim();
  const holder = pushMsg('ai', '');
  if (!holder) return;
  const bubble = holder.querySelector('.bubble');
  const sources = Array.isArray(SYMPTOM_REFERENCE_SOURCES) ? SYMPTOM_REFERENCE_SOURCES : [];
  const links = sources.map(source =>
    '<a class="symptom-reference-link" href="' + escHTML(source.url) +
    '" target="_blank" rel="noopener noreferrer">' +
    '<strong>' + escHTML(source.label) + ' ↗</strong>' +
    '<small>' + escHTML(source.organization) + '</small>' +
    '<span>' + escHTML(source.description) + '</span></a>'
  ).join('');
  bubble.innerHTML =
    '<div class="symptom-reference-result">' +
      '<span class="eyebrow">OFFICIAL PUBLIC INFORMATION</span>' +
      '<h3>症状资料入口</h3>' +
      '<p>本地记录的查询词：<strong>' + escHTML(text) + '</strong></p>' +
      '<p>未执行疾病识别或风险评估。请在官方资料网站内自行搜索相关词条，并核对页面的适用人群、更新时间和求助指引。</p>' +
      '<div class="symptom-reference-result__links">' + links + '</div>' +
      '<p class="symptom-reference-result__boundary">这些链接是公共健康信息入口，不是对你输入内容的判断，也不构成诊断或治疗建议。</p>' +
    '</div>';
  const chat = document.getElementById('chat');
  if (chat) chat.scrollTop = chat.scrollHeight;
}

/* ---------------- 个人观察趋势报告（不计算未经验证的总分） ---------------- */

function buildObservationTrendGroups(history) {
  if (!Array.isArray(history)) return [];
  const groups = new Map();
  history.forEach(row => {
    if (!row || row.recordState !== 'active' ||
        !Number.isFinite(row.value) ||
        typeof row.metric !== 'string' || !row.metric.trim() ||
        typeof row.unit !== 'string' || !row.unit.trim()) return;
    const observedAt = typeof row.observedAt === 'string' ? row.observedAt : '';
    const timestamp = Date.parse(observedAt);
    if (!Number.isFinite(timestamp)) return;
    const metric = row.metric.trim();
    const unit = row.unit.trim();
    const quality = typeof row.quality === 'string' && row.quality.trim() ? row.quality.trim() : 'unknown';
    const source = typeof row.source === 'string' && row.source.trim() ? row.source.trim() : '来源未标记';
    // Keep different provenance streams separate: a manually reported value must
    // not silently become a point in a wearable-measured trend of the same metric.
    const key = JSON.stringify([metric, unit, quality, source]);
    if (!groups.has(key)) groups.set(key, {key, metric, unit, quality, source, points: []});
    groups.get(key).points.push({
      value: row.value,
      observedAt,
      timestamp,
      label: new Date(timestamp).toISOString().slice(5,10)
    });
  });
  return [...groups.values()]
    .map(group => ({...group, points: group.points.sort((a,b) => a.timestamp - b.timestamp)}))
    .filter(group => group.points.length >= 2)
    .sort((a,b) => {
      const latestA = a.points[a.points.length - 1].timestamp;
      const latestB = b.points[b.points.length - 1].timestamp;
      return latestB - latestA || b.points.length - a.points.length ||
        a.metric.localeCompare(b.metric, 'zh-CN');
    });
}

function buildObservationTrendSeries(history, limit = 3, selectionKey = '') {
  if (!Number.isSafeInteger(limit) || limit < 2 || limit > 30) {
    throw new RangeError('observation trend limit must be an integer from 2 to 30');
  }
  const catalogue = buildObservationTrendGroups(history);
  const selected = selectionKey
    ? catalogue.find(group => group.key === selectionKey)
    : catalogue[0];
  if (!selected) return null;
  return {...selected, points:selected.points.slice(-limit)};
}

function renderTrend(){
  const host = document.getElementById('trendSvg');
  const summary = document.getElementById('trendSummary');
  if (!host) return;
  const metricSelect = document.getElementById('observationTrendMetric');
  const limitSelect = document.getElementById('observationTrendLimit');
  const clear = message => {
    if (summary) summary.textContent = message;
    host.setAttribute('aria-label', '当前没有足够的有效观察记录绘制趋势');
    host.innerHTML = '<text x="360" y="128" text-anchor="middle" font-size="15" fill="#607b75">同一指标、单位与来源至少需要 2 次有效记录</text>';
  };
  if (observationDomainUnavailable || observationStorageRecoveryRequired) {
    if (metricSelect) metricSelect.disabled = true;
    if (limitSelect) limitSelect.disabled = true;
    clear('记录校验或恢复状态不可用，暂不绘制趋势。');
    return;
  }
  const history = Array.isArray(window.healthObservations) ? window.healthObservations : [];
  const catalogue = buildObservationTrendGroups(history);
  const previousSelection = metricSelect ? metricSelect.value : '';
  if (metricSelect) {
    metricSelect.innerHTML = catalogue.length
      ? catalogue.map(group => {
          const qualityLabels = {
            measured:'实测', reported:'本人报告', estimated:'估算',
            imported:'文件导入', demo:'示例数据', unknown:'来源未分类'
          };
          const label = group.metric + ' · ' + group.unit + ' · ' +
            (qualityLabels[group.quality] || group.quality) + ' · ' + group.source +
            '（' + group.points.length + ' 次）';
          return '<option value="' + escHTML(group.key) + '">' + escHTML(label) + '</option>';
        }).join('')
      : '<option value="">暂无可比较序列</option>';
    metricSelect.disabled = catalogue.length === 0;
    metricSelect.value = catalogue.some(group => group.key === previousSelection)
      ? previousSelection : (catalogue[0]?.key || '');
  }
  if (limitSelect) limitSelect.disabled = catalogue.length === 0;
  if (!catalogue.length) {
    clear('暂无可绘制的有效趋势。选择同一指标、单位、来源类别和来源名称，并至少录入 2 次当前有效观察值后，才会生成趋势。');
    return;
  }
  const rawLimit = limitSelect ? Number(limitSelect.value) : 3;
  const limit = Number.isSafeInteger(rawLimit) && rawLimit >= 2 && rawLimit <= 30 ? rawLimit : 3;
  const series = buildObservationTrendSeries(history, limit, metricSelect?.value || '');
  if (!series) {
    clear('所选来源序列暂不可用；切换指标或来源后重试。');
    return;
  }
  const data = series.points;
  const values = data.map(point => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue;
  const padding = Number.isFinite(span) && span > 0
    ? span * 0.18 : Math.max(Math.abs(maxValue) * 0.08, 1);
  const minV = minValue - padding;
  const maxV = maxValue + padding;
  const w = 720, h = 260, left = 72, right = 24, top = 28, bottom = 48;
  if (!Number.isFinite(minV) || !Number.isFinite(maxV) || maxV <= minV) {
    clear('这组数值跨度超出图表可显示范围；原始记录未修改。');
    return;
  }
  const px = i => left + i * ((w - left - right) / Math.max(data.length - 1, 1));
  const py = value => h - bottom - ((value - minV) / (maxV - minV)) * (h - top - bottom);
  const pts = data.map((point, i) => [px(i), py(point.value)]);
  const line = pts.map(point => point.join(',')).join(' ');
  const area = left + ',' + (h-bottom) + ' ' + line + ' ' + (w-right) + ',' + (h-bottom);
  const formatTick = value => {
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return value.toFixed(digits);
  };
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const y = top + ratio * (h-top-bottom);
    const tick = maxV - ratio * (maxV-minV);
    grid += '<line x1="' + left + '" y1="' + y + '" x2="' + (w-right) + '" y2="' + y +
      '" stroke="#e2ece8" stroke-width="1"/>' +
      '<text x="' + (left-12) + '" y="' + (y+4) + '" text-anchor="end" font-size="11" fill="#607b74">' +
      escHTML(formatTick(tick)) + '</text>';
  }
  let dots = '';
  pts.forEach((point, i) => {
    const valueLabel = escHTML(String(data[i].value));
    const dateLabel = escHTML(data[i].label);
    const pointTitle = escHTML(data[i].observedAt + ' · ' + data[i].value + ' ' + series.unit);
    dots += '<circle cx="' + point[0] + '" cy="' + point[1] + '" r="5.5" fill="#fff" stroke="#187f74" stroke-width="3">' +
      '<title>' + pointTitle + '</title></circle>' +
      '<text x="' + point[0] + '" y="' + Math.max(top+2,point[1]-13) +
      '" text-anchor="middle" font-size="12" fill="#185e58" font-weight="750">' + valueLabel + '</text>' +
      '<text x="' + point[0] + '" y="' + (h-15) +
      '" text-anchor="middle" font-size="10" fill="#58756d">' + dateLabel + '</text>';
  });
  const qualityLabels = {
    measured:'设备/仪器测量', reported:'本人报告', estimated:'估算',
    imported:'文件导入', demo:'示例数据', unknown:'来源未标记'
  };
  const sourceSummary = (qualityLabels[series.quality] || series.quality) + ' · ' + series.source;
  const firstDate = data[0].label;
  const lastDate = data[data.length-1].label;
  if (summary) summary.textContent =
    series.metric + '（' + series.unit + '） · ' + sourceSummary +
    ' · ' + data.length + ' 次有效记录 · ' + firstDate + ' 至 ' + lastDate;
  host.setAttribute('aria-label',
    series.metric + '，单位 ' + series.unit + '，来源 ' + sourceSummary +
    '，展示最近 ' + data.length + ' 次有效记录。该图表只呈现数值变化，不作临床解释。');
  host.innerHTML =
    '<defs><linearGradient id="healthTrendArea" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#2caa98" stop-opacity=".22"/>' +
      '<stop offset="100%" stop-color="#2caa98" stop-opacity="0"/></linearGradient></defs>' +
    grid +
    '<polygon points="' + area + '" fill="url(#healthTrendArea)"/>' +
    '<polyline points="' + line + '" fill="none" stroke="#187f74" stroke-width="3" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' + dots;
}

document.addEventListener('change', event => {
  if (event.target && (event.target.id === 'observationTrendMetric' ||
      event.target.id === 'observationTrendLimit')) renderTrend();
});

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
  if (page === 'vessel') renderVesselMetrics();
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
