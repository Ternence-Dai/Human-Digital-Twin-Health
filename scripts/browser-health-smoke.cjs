'use strict';

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => !!window.HealthDomain &&
      document.querySelector('#login:not(.hide)'));
    if (!(await page.locator('#login').textContent()).includes('短信验证码')) {
      throw new Error('Health demo login must disclose that real identity verification is not connected');
    }
    await page.locator('.login-actions button').click();
    await page.waitForFunction(() => document.querySelector('#shell')?.classList.contains('show'));

    await page.locator('#navList .nav-item[data-nav="records"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="records"]'));
    if (!(await page.locator('#pages .page.active').innerText()).includes('健康测量记录')) {
      throw new Error('Observation records workspace did not render');
    }
    if (!(await page.locator('#observationList').count()) ||
        !(await page.locator('#observationCount').count())) {
      throw new Error('Observation list and record count are missing');
    }

    await page.locator('#navList .nav-item[data-nav="report"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="report"]'));
    const reportText = await page.locator('#pages .page.active').innerText();
    if (!reportText.includes('数据') || !reportText.includes('示例')) {
      throw new Error('Health report must retain its example-data and provenance context');
    }

    await page.locator('#navList .nav-item[data-nav="body"]').click();
    await page.waitForFunction(() => document.querySelector('#pages .page.active[data-page="body"]'));
    if (!(await page.locator('#pages .page.active').innerText()).trim()) {
      throw new Error('Digital human educational view did not render');
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
