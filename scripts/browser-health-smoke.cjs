'use strict';

const { chromium } = require('playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 30000 });
    const referenceStylesheet = page.locator('link[rel="stylesheet"][href*="reference-platform-v4.css"]');
    if (await referenceStylesheet.count() !== 1) throw new Error('FHIR clinical workspace stylesheet is not linked');
    const referenceCssResponse = await page.request.get(await referenceStylesheet.evaluate(node => node.href));
    const referenceCssText = await referenceCssResponse.text();
    if (!referenceCssResponse.ok() || !referenceCssText.includes('--hr-bg:#eef4f3')) {
      throw new Error('FHIR clinical workspace stylesheet could not be loaded');
    }
    await page.waitForFunction(() => !!window.HealthDomain &&
      document.querySelector('#login:not(.hide)'));
    const preLoginShell = await page.locator('#shell').evaluate(node => ({
      visible: getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0,
      authenticatedDemo: node.classList.contains('show')
    }));
    if (preLoginShell.visible || preLoginShell.authenticatedDemo) {
      throw new Error('Health workspace must remain hidden until the demo entry action is selected');
    }
    if (!(await page.locator('#login').textContent()).includes('短信验证码')) {
      throw new Error('Health demo login must disclose that real identity verification is not connected');
    }
    await page.locator('.login-actions button').click();
    await page.waitForFunction(() => document.querySelector('#shell')?.classList.contains('show'));
    const semanticNavigation = await page.evaluate(() => ({
      sidebarButtons: [...document.querySelectorAll('#navList [data-nav]')].every(node => node.tagName === 'BUTTON'),
      mobileButtons: [...document.querySelectorAll('#tabbar [data-nav]')].every(node => node.tagName === 'BUTTON'),
      homeCurrent: document.querySelector('#navList [data-nav="home"]')?.getAttribute('aria-current') === 'page'
    }));
    if (!semanticNavigation.sidebarButtons || !semanticNavigation.mobileButtons || !semanticNavigation.homeCurrent) {
      throw new Error('Health navigation must use keyboard-operable buttons with current-page semantics: ' +
        JSON.stringify(semanticNavigation));
    }
    const navigationBeforeInvalidRoute = await page.evaluate(() => ({
      page: document.querySelector('#pages .page.active')?.dataset.page,
      title: document.querySelector('#pageTitle')?.innerText
    }));
    const invalidRouteResult = await page.evaluate(() => window.go('not-a-health-page'));
    const navigationAfterInvalidRoute = await page.evaluate(() => ({
      page: document.querySelector('#pages .page.active')?.dataset.page,
      title: document.querySelector('#pageTitle')?.innerText
    }));
    if (invalidRouteResult !== false ||
        JSON.stringify(navigationBeforeInvalidRoute) !== JSON.stringify(navigationAfterInvalidRoute)) {
      throw new Error('Unknown health navigation target must be rejected without blanking the active workspace');
    }
    const clinicalHome = await page.evaluate(() => {
      const home = document.querySelector('#pages .page.active[data-page="home"]');
      const text = home?.innerText || '';
      return {
        command: !!home?.querySelector('.clinical-reference-board'),
        recordSnapshot: !!home?.querySelector('#personalRecordSnapshot'),
        dashboard: !!home?.querySelector('.health-home-dashboard'),
        provenanceRules: !!home?.querySelector('.health-home-trust'),
        moduleGrid: !!home?.querySelector('#quickGrid .quick-item'),
        fabricatedData: /今日体征|综合健康总分|126\/82|72 bpm|84 分/.test(text),
        oldScoreRing: !!home?.querySelector('.score-card')
      };
    });
    const referenceBoard = await page.locator('.clinical-reference-board').count();
    if (referenceBoard !== 1) {
      throw new Error('Health reference clinical command board is not mounted: ' + referenceBoard);
    }
    if (!clinicalHome.command || !clinicalHome.recordSnapshot || !clinicalHome.dashboard ||
        !clinicalHome.provenanceRules || !clinicalHome.moduleGrid ||
        clinicalHome.fabricatedData || clinicalHome.oldScoreRing) {
      throw new Error('Health home is not the record-first personal data workspace: ' + JSON.stringify(clinicalHome));
    }
    const healthLayout = await page.locator('#shell').evaluate(node => ({
      display: getComputedStyle(node).display,
      columns: getComputedStyle(node).gridTemplateColumns
    }));
    if (healthLayout.display !== 'grid' || !healthLayout.columns.startsWith('254px')) {
      throw new Error('FHIR clinical record layout was not applied: ' + JSON.stringify(healthLayout));
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    const wideHealth = await page.evaluate(() => {
      const main = document.querySelector('#main-content');
      const pages = document.querySelector('#pages');
      const active = document.querySelector('#pages .page.active');
      const rect = node => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      };
      return { main: rect(main), pages: rect(pages), active: rect(active) };
    });
    if (wideHealth.pages.width < wideHealth.main.width * 0.88 ||
        wideHealth.active.width < wideHealth.pages.width * 0.92 ||
        wideHealth.active.left < wideHealth.pages.left - 1 ||
        wideHealth.active.right > wideHealth.pages.right + 2) {
      throw new Error('Health dashboard remains boxed into a narrow centered column: ' + JSON.stringify(wideHealth));
    }
    const homeSnapshotDesktop = await page.evaluate(() => {
      const host = document.querySelector('#personalRecordSnapshot');
      const panel = host?.querySelector('.personal-record-panel');
      const stats = panel?.querySelector('.personal-record-stats');
      const provenance = panel?.querySelector('.personal-record-provenance');
      const recent = panel?.querySelector('.personal-record-recent');
      const empty = recent?.querySelector('.personal-record-empty--first-run');
      const rect = node => {
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width};
      };
      return {
        hostDisplay:host ? getComputedStyle(host).display : '',
        panelDisplay:panel ? getComputedStyle(panel).display : '',
        columns:panel ? getComputedStyle(panel).gridTemplateColumns : '',
        host:rect(host),panel:rect(panel),stats:rect(stats),provenance:rect(provenance),recent:rect(recent),
        panelPaddingLeft:panel ? parseFloat(getComputedStyle(panel).paddingLeft) : 0,
        panelPaddingRight:panel ? parseFloat(getComputedStyle(panel).paddingRight) : 0,
        firstRun:!!empty,
        firstSteps:empty?.querySelectorAll('.personal-record-first-steps li').length || 0,
        action:empty?.querySelector('button')?.textContent || ''
      };
    });
    if (homeSnapshotDesktop.hostDisplay !== 'block' || homeSnapshotDesktop.panelDisplay !== 'grid' ||
        !homeSnapshotDesktop.stats || !homeSnapshotDesktop.provenance || !homeSnapshotDesktop.recent ||
        homeSnapshotDesktop.stats.right >= homeSnapshotDesktop.provenance.left ||
        homeSnapshotDesktop.recent.left > homeSnapshotDesktop.panel.left + homeSnapshotDesktop.panelPaddingLeft + 3 ||
        homeSnapshotDesktop.recent.right < homeSnapshotDesktop.panel.right - homeSnapshotDesktop.panelPaddingRight - 3 ||
        !homeSnapshotDesktop.firstRun || homeSnapshotDesktop.firstSteps !== 3 ||
        !homeSnapshotDesktop.action.includes('新增第一条')) {
      throw new Error('Health home record snapshot still leaves an empty grid column or omits the first-record path: ' +
        JSON.stringify(homeSnapshotDesktop));
    }
    fs.mkdirSync('artifacts', { recursive:true });
    await page.locator('#personalRecordSnapshot .personal-record-panel').screenshot({
      path:'artifacts/health-home-record-snapshot-desktop.png'
    });
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => document.activeElement?.id === 'skipMain'))) {
      throw new Error('After demo login, skip navigation is not the first keyboard focus target');
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'main-content');

    await page.locator('#navList .nav-item[data-nav="records"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="records"]'));
    if (await page.locator('.w5-module-context').count() !== 0) {
      throw new Error('Generic module-header overlay must remain removed; module hierarchy is native to the product');
    }
    if (!(await page.locator('#pages .page.active').innerText()).includes('健康测量记录')) {
      throw new Error('Observation records workspace did not render');
    }
    if (!(await page.locator('#observationList').count()) ||
        !(await page.locator('#observationCount').count())) {
      throw new Error('Observation list and record count are missing');
    }

    const promptAnswers = [];
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') await dialog.accept(promptAnswers.shift() || 'Synthetic Playwright operator');
      else await dialog.accept();
    });
    const observationForm = page.locator('#observationForm');
    const submitObservation = async (value, observedAt) => {
      await observationForm.locator('[name="metric"]').fill('browser-smoke-heart-rate');
      await observationForm.locator('[name="value"]').fill(String(value));
      await observationForm.locator('[name="unit"]').fill('bpm');
      await observationForm.locator('[name="observedAt"]').fill(observedAt);
      await observationForm.locator('[name="source"]').fill('Synthetic Playwright fixture');
      await observationForm.locator('[name="quality"]').selectOption('demo');
      await observationForm.locator('button[type="submit"]').click();
    };
    await submitObservation(68, '2026-10-19T09:00');
    await page.waitForFunction(() => {
      const rows = JSON.parse(localStorage.getItem('health-observations-v1') || '[]');
      return rows.length === 1 && rows[0].metric === 'browser-smoke-heart-rate';
    });
    await submitObservation(72, '2026-10-20T09:00');
    await page.waitForFunction(() => {
      const rows = JSON.parse(localStorage.getItem('health-observations-v1') || '[]');
      return rows.length === 2 && rows.every(row => row.quality === 'demo');
    });

    // The same record (including source, timestamp and quality) must be rejected as a duplicate.
    await submitObservation(72, '2026-10-20T09:00');
    await page.waitForTimeout(150);
    const storedObservations = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('health-observations-v1') || '[]'));
    if (storedObservations.length !== 2) {
      throw new Error('Duplicate observation was persisted: ' + storedObservations.length + ' rows');
    }
    const recordListText = await page.locator('#observationList').innerText();
    if (!recordListText.includes('browser-smoke-heart-rate') || !recordListText.includes('Synthetic Playwright fixture')) {
      throw new Error('Saved synthetic observation and provenance were not rendered in the records list');
    }
    await page.locator('#navList .nav-item[data-nav="home"]').click();
    await page.waitForFunction(() => {
      const summary = document.querySelector('#trendSummary')?.textContent || '';
      return summary.includes('browser-smoke-heart-rate') && summary.includes('2 次有效记录');
    });
    if (await page.locator('#trendSvg circle').count() < 2) {
      throw new Error('Two valid same-metric observations did not produce a two-point trend');
    }
    const provenanceEvidence = await page.evaluate(() => {
      const root = document.querySelector('#personalRecordSnapshot .personal-record-provenance');
      const integrity = key => root?.querySelector('[data-integrity-metric="' + key + '"]');
      const source = key => root?.querySelector('[data-quality-kind="' + key + '"]');
      return {
        visible: !!root && root.innerText.includes('数据来源与完整性'),
        sourceCount: Number(integrity('source')?.dataset.count),
        timestampCount: Number(integrity('measured-at')?.dataset.count),
        unitCount: Number(integrity('unit')?.dataset.count),
        demoCount: Number(source('demo')?.dataset.count),
        disclaimer: root?.innerText.includes('不代表测量准确性') || false
      };
    });
    if (!provenanceEvidence.visible || provenanceEvidence.sourceCount !== 2 ||
        provenanceEvidence.timestampCount !== 2 || provenanceEvidence.unitCount !== 2 ||
        provenanceEvidence.demoCount !== 2 || !provenanceEvidence.disclaimer) {
      throw new Error('Observation provenance dashboard did not reflect the two validated synthetic records: ' +
        JSON.stringify(provenanceEvidence));
    }

    await page.locator('#navList .nav-item[data-nav="report"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="report"]'));
    const trendExplorer = await page.evaluate(() => {
      const metric = document.querySelector('#observationTrendMetric');
      const limit = document.querySelector('#observationTrendLimit');
      const panel = document.querySelector('.health-trend-panel');
      return {
        panel: !!panel,
        metricEnabled: !!metric && !metric.disabled,
        metricOptions: metric?.options.length || 0,
        selectedSource: metric?.selectedOptions[0]?.textContent || '',
        limitValues: limit ? [...limit.options].map(option => option.value) : [],
        summary: document.querySelector('#trendSummary')?.textContent || '',
        points: document.querySelectorAll('#trendSvg circle').length
      };
    });
    if (!trendExplorer.panel || !trendExplorer.metricEnabled || trendExplorer.metricOptions !== 1 ||
        !trendExplorer.selectedSource.includes('示例数据') ||
        !trendExplorer.selectedSource.includes('Synthetic Playwright fixture') ||
        !trendExplorer.summary.includes('2 次有效记录') || trendExplorer.points < 2 ||
        trendExplorer.limitValues.join(',') !== '3,6,12') {
      throw new Error('Source-aware observation trend explorer did not bind its validated record series: ' +
        JSON.stringify(trendExplorer));
    }
    await page.locator('#observationTrendLimit').selectOption('12');
    await page.waitForFunction(() => (document.querySelector('#trendSummary')?.textContent || '').includes('2 次有效记录'));
    fs.mkdirSync('artifacts', { recursive: true });
    await page.evaluate(() => document.activeElement?.blur());
    await page.locator('.health-trend-panel').screenshot({ path: 'artifacts/health-observation-trend-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileTrend = await page.evaluate(() => {
      const shell = document.querySelector('#shell')?.getBoundingClientRect();
      const main = document.querySelector('#main-content')?.getBoundingClientRect();
      const panel = document.querySelector('.health-trend-panel')?.getBoundingClientRect();
      const pages = document.querySelector('#pages')?.getBoundingClientRect();
      const controls = document.querySelector('.health-trend-controls');
      const select = document.querySelector('#observationTrendMetric');
      const chart = document.querySelector('.health-trend-chart-wrap');
      return {
        viewport: innerWidth, shellWidth: shell?.width, mainWidth: main?.width,
        panelLeft: panel?.left, panelRight: panel?.right, panelWidth: panel?.width,
        pagesWidth: pages?.width, controlsColumns: controls ? getComputedStyle(controls).gridTemplateColumns : '',
        selectWidth: select?.getBoundingClientRect().width,
        chartClientWidth: chart?.clientWidth, chartScrollWidth: chart?.scrollWidth
      };
    });
    if (!mobileTrend.shellWidth || mobileTrend.shellWidth < 380 ||
        !mobileTrend.mainWidth || mobileTrend.mainWidth < 380 ||
        !mobileTrend.pagesWidth || mobileTrend.pagesWidth < 360 ||
        !mobileTrend.panelWidth || mobileTrend.panelWidth < 340 ||
        mobileTrend.panelLeft < 0 || mobileTrend.panelRight > 391 ||
        !mobileTrend.selectWidth || mobileTrend.selectWidth < 300 ||
        mobileTrend.chartScrollWidth <= mobileTrend.chartClientWidth) {
      throw new Error('Mobile observation trend controls or chart are clipped: ' + JSON.stringify(mobileTrend));
    }
    await page.evaluate(() => {
      document.activeElement?.blur();
      document.querySelector('.health-trend-chart-wrap')?.scrollTo(0, 0);
    });
    await page.locator('.health-trend-panel').screenshot({ path: 'artifacts/health-observation-trend-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Amend the latest observation as a new version; the original must remain immutable in history.
    await page.locator('#navList .nav-item[data-nav="records"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="records"]'));
    const originalObservation = storedObservations.find(row => row.value === 72);
    if (!originalObservation) throw new Error('Synthetic observation selected for amendment is missing');
    await page.locator('#observationList [data-observation-action="amend"][data-observation-id="' + originalObservation.id + '"]').click();
    await page.waitForFunction(() =>
      document.querySelector('#observationAmendmentFields') &&
      !document.querySelector('#observationAmendmentFields').hidden
    );
    await observationForm.locator('[name="value"]').fill('75');
    await page.locator('#observationAmendmentReason').fill('Synthetic correction after source cross-check');
    await page.locator('#observationAmendmentActor').fill('Playwright amendment operator');
    await observationForm.locator('button[type="submit"]').click();
    await page.waitForFunction(id => {
      const rows = JSON.parse(localStorage.getItem('health-observations-v1') || '[]');
      return rows.length === 3 &&
        rows.some(row => row.id === id && row.recordState === 'superseded') &&
        rows.some(row => row.value === 75 && row.recordState === 'active');
    }, originalObservation.id, { timeout: 10000 });
    let versionedObservations = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('health-observations-v1') || '[]'));
    const supersededObservation = versionedObservations.find(row => row.id === originalObservation.id);
    const amendedObservation = versionedObservations.find(row => row.value === 75 && row.recordState === 'active');
    if (!supersededObservation || !amendedObservation ||
        amendedObservation.previousVersionId !== originalObservation.id ||
        amendedObservation.amendmentReason !== 'Synthetic correction after source cross-check' ||
        amendedObservation.amendedBy !== 'Playwright amendment operator') {
      throw new Error('Observation amendment did not preserve the original version and audit metadata');
    }
    await page.locator('#observationStateFilter').selectOption('superseded');
    await page.waitForFunction(() =>
      document.querySelectorAll('#observationList [data-observation-version]').length === 1 &&
      document.querySelector('#observationList')?.textContent.includes('已被更正')
    );
    await page.locator('#observationStateFilter').selectOption('all');

    // Void the corrected active version and verify that the audit chain is preserved rather than deleted.
    promptAnswers.push('Synthetic void reason: source record withdrawn', 'Playwright void operator');
    await page.locator('#observationList [data-observation-action="void"][data-observation-id="' + amendedObservation.id + '"]').click();
    await page.waitForFunction(() => {
      const rows = JSON.parse(localStorage.getItem('health-observations-v1') || '[]');
      return rows.length === 3 && rows.some(row =>
        row.value === 75 && row.recordState === 'voided' &&
        row.voidReason === 'Synthetic void reason: source record withdrawn' &&
        row.voidedBy === 'Playwright void operator'
      );
    }, undefined, { timeout: 10000 });
    versionedObservations = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('health-observations-v1') || '[]'));
    const voidedObservation = versionedObservations.find(row => row.id === amendedObservation.id);
    if (!voidedObservation || !supersededObservation ||
        versionedObservations.filter(row => row.recordState === 'active').length !== 1) {
      throw new Error('Voiding an observation deleted history or left the voided version active');
    }
    await page.locator('#observationStateFilter').selectOption('voided');
    await page.waitForFunction(() =>
      document.querySelector('#observationList')?.textContent.includes('已作废') &&
      document.querySelector('#observationList')?.textContent.includes('Synthetic void reason: source record withdrawn') &&
      document.querySelector('#observationList')?.textContent.includes('Playwright void operator')
    );
    await page.locator('#observationStateFilter').selectOption('all');

    await page.locator('#navList .nav-item[data-nav="report"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="report"]'));
    const reportText = await page.locator('#pages .page.active').innerText();
    if (!reportText.includes('有效观察趋势分析') ||
        !reportText.includes('指标与数据来源') ||
        !reportText.includes('展示记录数量') ||
        reportText.includes('综合健康总分（演示）') || reportText.includes('六维能力雷达（演示）') || /综合健康总分\s*84|84\s*分/.test(reportText)) {
      throw new Error('Health report still relies on synthetic scorecards instead of valid observation trends');
    }

    await page.locator('#navList .nav-item[data-nav="body"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="body"]'));
    if (!(await page.locator('#pages .page.active').innerText()).trim()) {
      throw new Error('Digital human educational view did not render');
    }
    const organNavCount = await page.locator('#navList .nav-item[data-nav="organ"]').count();
    if (!organNavCount) throw new Error('Anatomy knowledge workspace navigation is missing');
    await page.locator('#navList .nav-item[data-nav="organ"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#pages .page.active .organ-card').length === 12);
    await page.locator('#pages .page.active .organ-card').first().click();
    const organModalText = await page.locator('#modalCard').innerText();
    if (!organModalText.includes('主要生理功能') ||
        /健康指数\s*[:：]\s*\d|风险评分\s*[:：]\s*\d|\b84\s*分/.test(organModalText)) {
      throw new Error('Organ education details still display fabricated personal scores: ' + organModalText);
    }
    await page.locator('#modal .modal-close').click();
    await page.locator('#navList .nav-item[data-nav="meridian"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#pages .page.active .meridian-reference-row').length >= 20);
    const meridianText = await page.locator('#pages .page.active').innerText();
    if (meridianText.includes('能量值') || meridianText.includes('堵塞风险') ||
        meridianText.includes('轻度堵塞') ||
        !meridianText.includes('WHO ICD-11') ||
        !meridianText.includes('不代表对任何传统医学实践科学有效性')) {
      throw new Error('Meridian education reference must remain separate from physiology and disclose WHO classification scope');
    }

    // The symptom page is an official-source directory, not a local symptom
    // classifier. Verify a chest-symptom query cannot produce an organ/meridian
    // attribution, risk label, or fabricated advice.
    await page.locator('#navList .nav-item[data-nav="ai"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="ai"]'));
    const symptomQuery = '胸痛 <img src=x onerror=alert(1)>';
    await page.locator('#chatInput').fill(symptomQuery);
    await page.locator('#pages .page.active button').filter({ hasText: '查看资料入口' }).click();
    await page.waitForSelector('#chat .symptom-reference-result');
    const symptomEvidence = await page.evaluate(() => {
      const result = document.querySelector('#chat .symptom-reference-result');
      return {
        text: result?.innerText || '',
        links: [...(result?.querySelectorAll('a[href]') || [])].map(node => node.href),
        injectedImages: result?.querySelectorAll('img').length || 0
      };
    });
    if (!symptomEvidence.text.includes('胸痛') ||
        !symptomEvidence.links.includes('https://medlineplus.gov/symptoms.html') ||
        !symptomEvidence.links.includes('https://www.nhs.uk/symptoms/') ||
        symptomEvidence.injectedImages !== 0 ||
        /相关器官|相关经络|风险等级|中风险|低风险|关键词匹配完成|穴位建议/.test(symptomEvidence.text)) {
      throw new Error('Symptom source directory produced classifications or failed safe official navigation: ' +
        JSON.stringify(symptomEvidence));
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => {
      const nav = document.querySelector('#tabbar');
      return {
        width: window.innerWidth,
        visible: !!nav && getComputedStyle(nav).display !== 'none' &&
          nav.getBoundingClientRect().width >= 300,
        items: nav ? nav.querySelectorAll('[data-nav]').length : 0
      };
    });
    if (!mobile.visible || mobile.items < 5) {
      throw new Error('Mobile health navigation did not expose all primary tabs: ' + JSON.stringify(mobile));
    }
    await page.locator('#tabbar [data-nav="home"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="home"]'));
    const mobileSnapshot = await page.evaluate(() => {
      const panel = document.querySelector('#personalRecordSnapshot .personal-record-panel');
      const stats = panel?.querySelector('.personal-record-stats');
      const provenance = panel?.querySelector('.personal-record-provenance');
      const recent = panel?.querySelector('.personal-record-recent');
      return {
        viewport:innerWidth,
        documentWidth:document.documentElement.scrollWidth,
        panelWidth:panel?.getBoundingClientRect().width || 0,
        statsTop:stats?.getBoundingClientRect().top || 0,
        provenanceTop:provenance?.getBoundingClientRect().top || 0,
        recentTop:recent?.getBoundingClientRect().top || 0
      };
    });
    if (mobileSnapshot.viewport !== 390 || mobileSnapshot.documentWidth > 391 ||
        mobileSnapshot.panelWidth < 340 || mobileSnapshot.provenanceTop <= mobileSnapshot.statsTop ||
        mobileSnapshot.recentTop <= mobileSnapshot.provenanceTop) {
      throw new Error('Mobile health record snapshot does not stack into a full-width single column: ' +
        JSON.stringify(mobileSnapshot));
    }
    await page.screenshot({path:'artifacts/health-home-record-snapshot-mobile.png',fullPage:true,animations:'disabled'});
    await page.locator('#tabbar [data-nav="report"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="report"]'));
    if (pageErrors.length) throw new Error('Health browser runtime errors: ' + pageErrors.join(' | '));
    console.log('Health data-space browser acceptance passed: local demo disclosure, HealthDomain initialization, observation workspace, report provenance, educational body view and mobile navigation passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
