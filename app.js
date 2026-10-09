// 번역 전에 한 번 더 — 화면 동작
// 입력한 글은 이 페이지의 메모리 안에서만 다루며, 네트워크로 보내거나 저장하지 않습니다.
import {
  PAPER,
  CATEGORIES,
  EXAMPLES,
  MAX_LEN,
  detectPII,
  tagCategories,
  maskText,
  unmaskText,
  countByType,
} from './detect.js';

const $ = (id) => document.getElementById(id);
const els = {
  input: $('input'),
  count: $('input-count'),
  check: $('check'),
  clear: $('clear'),
  result: $('result'),
  detail: $('result-detail'),
  highlight: $('highlight'),
  findings: $('findings'),
  cats: $('cats'),
  rate: $('rate'),
  mask: $('mask'),
  maskStatus: $('mask-status'),
  maskArea: $('mask-area'),
  masked: $('masked'),
  mapBody: $('map-body'),
  translated: $('translated'),
  unmask: $('unmask'),
  unmaskStatus: $('unmask-status'),
  restoredArea: $('restored-area'),
  restored: $('restored'),
  copyRestored: $('copy-restored'),
};

const LIST_LIMIT = 300;

const state = {
  checkedText: null, // 마지막으로 점검한 글
  findings: [], // {type,label,start,end,value,on}
  cats: [],
  rtype: null,
  table: [],
};

const fmt = (n) => n.toFixed(2);
const numKo = (n) => n.toLocaleString('ko-KR');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

/* ---------------- 1. 점검하기 ---------------- */

function updateCount() {
  const len = els.input.value.length;
  els.count.textContent =
    len > MAX_LEN
      ? `${numKo(len)}자 · 너무 길어서 앞의 ${numKo(MAX_LEN)}자만 점검합니다.`
      : `${numKo(len)}자`;
}

function runCheck() {
  const text = els.input.value;
  const prevOff = new Set(state.findings.filter((f) => !f.on).map((f) => `${f.start}:${f.value}`));
  state.checkedText = text;
  state.findings = detectPII(text).map((f) => ({ ...f, on: !prevOff.has(`${f.start}:${f.value}`) }));
  state.cats = tagCategories(text);
  renderResult();
  renderRate();
}

function renderResult() {
  const text = state.checkedText || '';
  els.result.replaceChildren();
  if (!text.trim()) {
    els.result.append(el('p', { class: 'empty', text: '점검할 글이 비어 있습니다. 글을 붙여 넣거나 「예시 글 넣기」를 눌러 보세요.' }));
    els.detail.hidden = true;
    return;
  }
  const n = state.findings.length;
  if (n === 0) {
    els.result.append(
      el('p', { class: 'count', text: '규칙으로 찾을 수 있는 개인정보는 보이지 않습니다.' }),
      el('p', { class: 'hint', text: '그래도 이름이나 사정이 담긴 문장이 있는지 보내기 전에 한 번 더 읽어 보세요.' }),
    );
  } else {
    const by = countByType(state.findings);
    const parts = Object.entries(by).map(([k, v]) => `${k} ${v}곳`).join(', ');
    els.result.append(
      el('p', { class: 'count', text: `개인정보로 보이는 부분을 ${numKo(n)}곳 찾았습니다.` }),
      el('p', { class: 'hint', text: `${parts}. 아래에서 표시된 부분을 확인하세요.` }),
    );
  }
  els.detail.hidden = false;
  renderHighlight();
  renderFindings();
  renderCats();
}

function renderHighlight() {
  const text = state.checkedText || '';
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const f of state.findings) {
    if (f.start > pos) frag.append(text.slice(pos, f.start));
    const mark = el('mark', { class: `t-${f.type}${f.on ? '' : ' off'}`, title: f.label }, text.slice(f.start, f.end));
    mark.append(el('span', { class: 'tag', text: f.label, 'aria-hidden': 'true' }));
    frag.append(mark);
    pos = f.end;
  }
  if (pos < text.length) frag.append(text.slice(pos));
  els.highlight.replaceChildren(frag);
}

function renderFindings() {
  const frag = document.createDocumentFragment();
  state.findings.slice(0, LIST_LIMIT).forEach((f, i) => {
    const id = `f-${i}`;
    const box = el('input', { type: 'checkbox', id });
    box.checked = f.on;
    box.addEventListener('change', () => {
      f.on = box.checked;
      renderHighlight();
    });
    const label = el(
      'label',
      { for: id },
      box,
      el('span', { class: `kind t-${f.type}`, text: f.label }),
      el('span', { class: 'val', text: f.value.length > 120 ? `${f.value.slice(0, 120)}…` : f.value }),
    );
    frag.append(el('li', {}, label));
  });
  if (state.findings.length > LIST_LIMIT) {
    frag.append(el('li', { class: 'more', text: `그 밖에 ${numKo(state.findings.length - LIST_LIMIT)}곳이 더 있습니다. 모두 가려서 복사됩니다.` }));
  }
  els.findings.replaceChildren(frag);
}

function renderCats() {
  const frag = document.createDocumentFragment();
  if (state.cats.length === 0) {
    frag.append(el('li', { text: '논문의 범주에 해당하는 말은 보이지 않습니다.' }));
  } else {
    for (const c of state.cats) {
      frag.append(el('li', {}, `${c.label} `, el('span', { class: 'why', text: `(${c.hits.slice(0, 4).join(', ')})` })));
    }
  }
  els.cats.replaceChildren(frag);
}

/* ---------------- 2. 요청 유형 ---------------- */

function renderRate() {
  const t = state.rtype;
  els.rate.replaceChildren();
  if (!t) {
    els.rate.append(el('p', { class: 'empty', text: '요청 유형을 고르면 논문에서 같은 유형의 요청에 개인정보가 얼마나 자주 들어 있었는지 보여 드립니다.' }));
    return;
  }
  if (t === 'other') {
    els.rate.append(
      el('p', { class: 'big', text: '논문은 번역 요청과 코드 수정 요청만 비교했기 때문에, 그 밖의 요청에 대해서는 보여 드릴 수치가 없습니다.' }),
      el('p', { class: 'note', text: '다만 남의 메일이나 메시지를 옮겨 붙이는 요청이라면 번역 요청과 비슷하게 개인정보가 섞이기 쉬우니, 위에서 찾은 항목을 가리고 보내는 편이 안전합니다.' }),
    );
    return;
  }
  const p = PAPER.types[t];
  const big = el('p', { class: 'big' });
  big.append(`논문에서 ${p.label} 요청 ${numKo(p.n)}건 중 ${numKo(p.hit)}건(`, el('strong', { text: `${fmt(p.rate)}%` }), ')에 개인정보성 내용이 있었습니다.');
  els.rate.append(
    big,
    el('p', { class: 'ci', text: `95% 신뢰구간은 ${fmt(p.ci[0])}~${fmt(p.ci[1])}%입니다. 실명이 직접 들어 있던 경우는 ${fmt(p.name.rate)}%(${numKo(p.n)}건 중 ${p.name.hit}건, 신뢰구간 ${fmt(p.name.ci[0])}~${fmt(p.name.ci[1])}%)였습니다.` }),
  );
  if (t === 'translate') {
    els.rate.append(el('p', { class: 'note', text: `번역 요청은 코드 수정 요청보다 개인정보가 들어 있을 가능성이 훨씬 컸습니다(오즈비 ${PAPER.oddsRatio}, 피셔 정확검정 p = ${PAPER.fisherP}). 번역을 맡기기 전에 꼭 가려 주세요.` }));
  } else {
    els.rate.append(el('p', { class: 'note', text: '코드 수정 요청에는 개인정보가 드물었습니다. 그래도 설정 파일, 로그, 테스트 데이터에 실제 연락처나 계정이 섞여 있지 않은지 확인하세요.' }));
  }

  const mine = new Set(state.cats.map((c) => c.key));
  const matched = CATEGORIES.filter((c) => mine.has(c.key));
  const top3 = [...CATEGORIES].sort((a, b) => b[t] - a[t]).slice(0, 3).map((c) => c.key);
  const caption = el('p', { class: 'note' });
  if (state.checkedText === null) {
    caption.textContent = '아래는 논문에서 범주별로 나온 비율입니다. 글을 점검하면 내 글에 있는 범주를 따로 표시해 드립니다.';
  } else if (matched.length === 0) {
    caption.textContent = '아래는 논문에서 범주별로 나온 비율입니다. 내 글에서는 겹치는 범주가 보이지 않습니다.';
  } else {
    const inTop = matched.filter((c) => top3.includes(c.key)).map((c) => c.label);
    caption.textContent =
      `내 글에서 보이는 범주는 ${matched.map((c) => c.label).join(', ')}입니다.` +
      (inTop.length ? ` 이 가운데 ${inTop.join(', ')}은(는) 논문의 ${p.label} 요청에서 가장 흔했던 세 범주에 듭니다.` : '');
  }
  els.rate.append(el('h3', { class: 'sub', text: `${p.label} 요청에서 범주별로 개인정보가 나온 비율` }), caption);

  const max = Math.max(...CATEGORIES.map((c) => c.translate));
  const list = el('ul', { class: 'bars', 'aria-label': `${p.label} 요청의 범주별 비율` });
  for (const c of CATEGORIES) {
    const v = c[t];
    const hit = mine.has(c.key);
    const name = el('span', { class: 'name' }, c.label);
    if (hit) name.append(el('span', { class: 'mine', text: '내 글에도 있음' }));
    const fill = el('div', { class: 'fill' });
    fill.style.width = `${(v / max) * 100}%`;
    list.append(
      el(
        'li',
        { class: hit ? 'hit' : '' },
        name,
        el('span', { class: 'pct', text: `${fmt(v)}%` }),
        el('div', { class: 'track', 'aria-hidden': 'true' }, fill),
      ),
    );
  }
  els.rate.append(list);
  els.rate.append(el('p', { class: 'note', text: '막대의 길이는 두 요청 유형을 같은 눈금으로 비교할 수 있도록 번역 요청의 가장 높은 값(51.42%)에 맞췄습니다.' }));
}

/* ---------------- 3. 가리기·복사·되돌리기 ---------------- */

async function copyText(text, textarea) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 방법으로 넘어갑니다 */
  }
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

function setStatus(node, msg, kind) {
  node.textContent = msg;
  node.className = `status${kind ? ` ${kind}` : ''}`;
}

async function runMask() {
  if (state.checkedText !== els.input.value) runCheck();
  const text = state.checkedText || '';
  if (!text.trim()) {
    setStatus(els.maskStatus, '가릴 글이 없습니다. 먼저 1단계에서 글을 붙여 넣으세요.', 'warn');
    els.maskArea.hidden = true;
    return;
  }
  const active = state.findings.filter((f) => f.on);
  const { masked, table } = maskText(text, active);
  state.table = table;
  els.masked.value = masked;
  renderTable();
  els.maskArea.hidden = false;
  els.restoredArea.hidden = true;
  setStatus(els.unmaskStatus, '');

  const ok = await copyText(masked, els.masked);
  const what = table.length ? `${table.length}가지 값을 가렸습니다.` : '가릴 항목이 없어 원래 글 그대로입니다.';
  if (ok) setStatus(els.maskStatus, `${what} 가린 글을 복사했습니다. AI 창에 붙여 넣으세요.`, 'ok');
  else setStatus(els.maskStatus, `${what} 자동 복사가 되지 않았습니다. 아래 글이 선택되어 있으니 Ctrl+C(맥은 ⌘+C)로 복사하세요.`, 'warn');
}

function renderTable() {
  const frag = document.createDocumentFragment();
  if (state.table.length === 0) {
    frag.append(el('tr', {}, el('td', { colspan: '3', text: '가린 항목이 없습니다.' })));
  }
  for (const row of state.table) {
    frag.append(el('tr', {}, el('td', { text: row.token }), el('td', { text: row.label }), el('td', { text: row.value })));
  }
  els.mapBody.replaceChildren(frag);
}

function runUnmask() {
  const src = els.translated.value;
  if (!src.trim()) {
    setStatus(els.unmaskStatus, '번역 결과를 먼저 붙여 넣으세요.', 'warn');
    return;
  }
  if (state.table.length === 0) {
    setStatus(els.unmaskStatus, '대응표가 비어 있어 되돌릴 값이 없습니다.', 'warn');
    return;
  }
  const { text, restored, missing } = unmaskText(src, state.table);
  els.restored.value = text;
  els.restoredArea.hidden = false;
  if (restored === 0) {
    setStatus(els.unmaskStatus, '번역 결과에서 [이름1] 같은 표시를 찾지 못했습니다. AI가 표시를 바꾸거나 번역했는지 확인하세요.', 'warn');
  } else if (missing.length) {
    setStatus(els.unmaskStatus, `${restored}곳을 되돌렸습니다. 다만 ${missing.join(', ')}은(는) 번역 결과에 없었습니다.`, 'warn');
  } else {
    setStatus(els.unmaskStatus, `${restored}곳을 모두 원래 값으로 되돌렸습니다.`, 'ok');
  }
}

/* ---------------- 연결 ---------------- */

document.querySelectorAll('[data-example]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const ex = EXAMPLES[btn.dataset.example];
    if (!ex) return;
    els.input.value = ex.text;
    updateCount();
    els.input.focus();
    els.input.setSelectionRange(0, 0);
    els.input.scrollTop = 0;
  });
});
els.input.addEventListener('input', updateCount);
els.check.addEventListener('click', runCheck);
els.clear.addEventListener('click', () => {
  els.input.value = '';
  els.translated.value = '';
  state.checkedText = null;
  state.findings = [];
  state.cats = [];
  state.table = [];
  els.result.replaceChildren(el('p', { class: 'empty', text: '글을 지웠습니다. 새 글을 붙여 넣고 「점검하기」를 누르세요.' }));
  els.detail.hidden = true;
  els.maskArea.hidden = true;
  setStatus(els.maskStatus, '');
  updateCount();
  renderRate();
  els.input.focus();
});
document.querySelectorAll('input[name="rtype"]').forEach((r) => {
  r.addEventListener('change', () => {
    state.rtype = r.value;
    renderRate();
  });
});
els.mask.addEventListener('click', runMask);
els.unmask.addEventListener('click', runUnmask);
els.copyRestored.addEventListener('click', async () => {
  const ok = await copyText(els.restored.value, els.restored);
  setStatus(els.unmaskStatus, ok ? '번역문을 복사했습니다.' : '자동 복사가 되지 않았습니다. 선택된 글을 Ctrl+C(맥은 ⌘+C)로 복사하세요.', ok ? 'ok' : 'warn');
});

updateCount();
