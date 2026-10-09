import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { detectPII, maskText, unmaskText, tagCategories, PAPER, EXAMPLES } from '../detect.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = (f) => new Set(f.map((x) => x.type));

test('예시 업무 메일에서 이메일·전화·주소·이름을 찾는다', () => {
  const f = detectPII(EXAMPLES.email.text);
  const t = types(f);
  for (const k of ['email', 'phone', 'address', 'name', 'url']) assert.ok(t.has(k), `${k} 없음`);
  assert.ok(f.some((x) => x.value === 'hong@example.com'));
  assert.ok(f.some((x) => x.value === '010-1234-5678'));
});

test('가리기 후 되돌리기를 하면 원문과 같아진다', () => {
  const src = EXAMPLES.email.text;
  const { masked, table } = maskText(src, detectPII(src));
  assert.ok(!masked.includes('hong@example.com'));
  assert.ok(!masked.includes('010-1234-5678'));
  assert.ok(table.length > 0);
  const back = unmaskText(masked, table);
  assert.equal(back.text, src);
  assert.deepEqual(back.missing, []);
});

test('같은 값은 같은 표시로 바뀐다', () => {
  const src = 'hong@example.com 으로 보내고, 다시 hong@example.com 확인';
  const { masked, table } = maskText(src, detectPII(src));
  assert.equal(table.length, 1);
  assert.equal(masked.split(table[0].token).length - 1, 2);
});

test('빈 입력과 이상한 입력에도 멈추지 않는다', () => {
  for (const v of ['', null, undefined, 123, {}, '   ', '\u0000\u0000']) {
    assert.doesNotThrow(() => detectPII(v));
    assert.doesNotThrow(() => tagCategories(v));
  }
  assert.deepEqual(detectPII(''), []);
  assert.deepEqual(maskText('', []), { masked: '', table: [] });
  assert.doesNotThrow(() => unmaskText(null, null));
});

test('10만 자 입력을 1초 안에 처리한다', () => {
  const big = (EXAMPLES.email.text + '\n').repeat(Math.ceil(100000 / EXAMPLES.email.text.length)).slice(0, 100000);
  const t0 = performance.now();
  const f = detectPII(big);
  maskText(big, f);
  assert.ok(performance.now() - t0 < 1000);
});

test('논문 수치가 논문과 같다', () => {
  assert.equal(PAPER.types.translate.n, 212);
  assert.equal(PAPER.types.translate.hit, 116);
  assert.equal(PAPER.types.code.n, 301);
  assert.equal(PAPER.types.code.hit, 13);
  assert.equal(Math.round((116 / 212) * 10000) / 100, PAPER.types.translate.rate);
  assert.equal(Math.round((13 / 301) * 10000) / 100, PAPER.types.code.rate);
});

test('앱 파일에 실제처럼 보이는 비밀값이 없다', () => {
  const pats = [/sk-[A-Za-z0-9]{20,}/, /ghp_[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /AIza[0-9A-Za-z_-]{30,}/, /xox[bp]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
  for (const file of ['index.html', 'app.js', 'detect.js', 'style.css']) {
    const s = readFileSync(join(ROOT, file), 'utf8');
    for (const p of pats) assert.ok(!p.test(s), `${file}: ${p}`);
  }
});

