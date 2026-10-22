/* Reference shell v4: clinical record command board using the existing validated observation store. */
(function () {
  'use strict';
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function mount() {
    const page = document.querySelector('.page[data-page="home"]');
    const anchor = page && page.querySelector('.health-data-command');
    if (!page || !anchor || page.querySelector('.clinical-reference-board')) return;
    const rows = Array.isArray(window.healthObservations) ? window.healthObservations.filter(row => row && row.recordState === 'active') : [];
    const latest = rows.slice().sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
    const metricKinds = new Set(rows.map(row => String(row.metric || '').trim().toLowerCase()).filter(Boolean)).size;
    const sourceKinds = new Set(rows.map(row => row.quality || 'unknown')).size;
    const board = document.createElement('section');
    board.className = 'clinical-reference-board';
    board.setAttribute('aria-label','临床记录优先工作台');
    board.innerHTML =
      '<div class="clinical-reference-board__head">' +
        '<div><span class="eyebrow">CLINICAL RECORD / OBSERVATION WORKSPACE</span>' +
        '<h2>健康记录指挥台</h2><p>从当前有效 Observation 出发组织记录、来源、时间线与下一步操作；不再使用综合健康评分作为首页主视觉。</p></div>' +
        '<div class="clinical-reference-board__actions"><button type="button" class="primary" onclick="go(\'records\')">＋ 新增观察</button><button type="button" onclick="go(\'records\')">查看全部记录</button><button type="button" onclick="go(\'report\')">打开趋势</button></div>' +
      '</div>' +
      '<div class="clinical-reference-board__grid">' +
        '<div class="clinical-reference-board__summary">' +
          '<div class="clinical-reference-board__metric"><span>当前有效记录</span><strong>'+rows.length+'</strong><small>通过版本与来源校验</small></div>' +
          '<div class="clinical-reference-board__metric"><span>指标类别</span><strong>'+metricKinds+'</strong><small>不同观测指标</small></div>' +
          '<div class="clinical-reference-board__metric"><span>来源类型</span><strong>'+sourceKinds+'</strong><small>实测 / 自述 / 导入 / 示例</small></div>' +
          '<div class="clinical-reference-board__metric clinical-reference-board__metric--latest"><span>最新观测</span><strong>'+(latest ? escapeHtml(latest.value)+' '+escapeHtml(latest.unit || '') : '—')+'</strong><small>'+(latest ? escapeHtml(latest.metric)+' · '+escapeHtml(latest.observedAt) : '暂无有效观测')+'</small></div>' +
        '</div>' +
        '<aside class="clinical-reference-board__rail">' +
          '<span class="eyebrow">TRACEABILITY</span><h3>记录边界</h3>' +
          '<div>每条记录保留来源、单位与观测时间。</div><div>更正与作废不覆盖历史版本。</div><div>无临床验证模型，不生成个人风险分。</div>' +
          '<button type="button" onclick="go(\'records\')">管理记录 ↗</button>' +
        '</aside>' +
      '</div>';
    anchor.replaceWith(board);
  }
  window.addEventListener('load', () => {
    window.setTimeout(mount, 350);
  }, { once: true });
})();