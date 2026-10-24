'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /<button\\b(?=[^>]*class="avatar")(?=[^>]*type="button")(?=[^>]*aria-label="打开数据与隐私页面")[^>]*onclick="go\\('me'\\)"/s,
  'profile navigation must be a named native button that routes to the privacy page');
assert.doesNotMatch(html, /<div\\b[^>]*class="avatar"[^>]*onclick=/,
  'profile navigation must not be a clickable non-semantic div');
console.log('Health profile navigation semantics passed.');
