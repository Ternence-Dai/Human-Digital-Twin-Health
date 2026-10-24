'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const profileButton = html.match(/<button\b[^>]*class="avatar"[^>]*>/s)?.[0] || '';
assert.ok(profileButton, 'profile navigation must use a native button');
assert.match(profileButton, /type="button"/, 'profile button must not submit surrounding forms');
assert.match(profileButton, /aria-label="打开数据与隐私页面"/, 'profile button must have an accessible name');
assert.match(profileButton, /onclick="go\('me'\)"/, 'profile button must route to the privacy page');
assert.doesNotMatch(html, /<div\b[^>]*class="avatar"[^>]*onclick=/,
  'profile navigation must not be a clickable non-semantic div');
console.log('Health profile navigation semantics passed.');
