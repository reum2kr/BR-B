// 번역 전에 한 번 더 — 개인정보 찾기·가리기·되돌리기 (순수 함수 모음)
// 브라우저와 Node 양쪽에서 그대로 쓸 수 있도록 DOM 에 기대지 않습니다.
// 모든 정규식은 반복 횟수에 상한을 두어 긴 입력에서도 느려지지 않게 했습니다.

export const MAX_LEN = 500000;

/* ------------------------------------------------------------------ */
/* 논문 수치                                                            */
/* ------------------------------------------------------------------ */

export const PAPER = {
  title:
    'AI 챗봇 대화에서 요청 유형에 따른 개인정보(PII) 노출 확률 비교 — 번역 요청과 코드 수정 요청을 중심으로',
  source: 'Trust No Bot 공개 주석 데이터(WildChat-1M 기반) 재분석',
  fisherP: '1.69×10⁻⁴⁰',
  oddsRatio: 26.77,
  types: {
    translate: {
      label: '번역',
      n: 212,
      hit: 116,
      rate: 54.72,
      ci: [47.99, 61.27],
      name: { hit: 20, rate: 9.43, ci: [6.19, 14.12] },
    },
    code: {
      label: '코드 수정',
      n: 301,
      hit: 13,
      rate: 4.32,
      ci: [2.54, 7.25],
      name: { hit: 0, rate: 0.0, ci: [0, 1.26] },
    },
  },
};

// 논문의 범주별 비율(%). 순서는 번역 요청에서 높은 순서입니다.
export const CATEGORIES = [
  { key: 'edu', label: '학업·교육', translate: 51.42, code: 3.99 },
  { key: 'email', label: '인용된 이메일·메시지', translate: 13.68, code: 1.33 },
  { key: 'finance', label: '재정·기업', translate: 13.21, code: 0.66 },
  { key: 'fandom', label: '팬덤', translate: 9.91, code: 0.33 },
  { key: 'hobby', label: '취미·습관', translate: 8.96, code: 1.66 },
  { key: 'sexual', label: '성적 콘텐츠', translate: 7.08, code: 0 },
  { key: 'relation', label: '인간관계', translate: 6.13, code: 0 },
  { key: 'health', label: '건강', translate: 4.72, code: 0.66 },
  { key: 'job', label: '구직·이민·지원서', translate: 4.25, code: 0 },
  { key: 'emotion', label: '감정·정신건강', translate: 3.3, code: 0 },
  { key: 'politics', label: '정치·종교', translate: 1.89, code: 0.33 },
];

/* ------------------------------------------------------------------ */
/* 범주 키워드                                                          */
/* ------------------------------------------------------------------ */

// 한글 키워드는 부분 일치, 영문 키워드는 단어 경계와 대소문자 무시로 찾습니다.
const CATEGORY_KEYWORDS = {
  edu: ['과제', '논문', '수업', '학점', '교수님', '교수', '강의', '시험', '중간고사', '기말고사', '레포트', '리포트', '졸업', '학위', '대학원', '수강', '학기', '숙제', 'assignment', 'thesis', 'homework', 'professor', 'lecture', 'semester', 'essay', 'exam'],
  email: ['드림', '올림', '배상', '보낸 사람', '받는 사람', '보내는 사람', '참조', '회신 부탁', '메일 드립니다', '메일을 드립니다', '안녕하십니까', 'Dear', 'Best regards', 'Kind regards', 'Regards', 'Sincerely', 'Subject:', 'From:', 'To:'],
  finance: ['계약', '견적', '매출', '계좌', '송금', '입금', '대금', '결제', '세금계산서', '청구서', '투자', '주식회사', '거래처', '단가', '발주', 'invoice', 'contract', 'quotation', 'revenue', 'payment', 'bank account'],
  fandom: ['팬클럽', '팬덤', '덕질', '최애', '아이돌', '콘서트', '팬레터', '굿즈', 'fandom', 'fanfic', 'idol'],
  hobby: ['취미', '여행', '캠핑', '등산', '낚시', '게임', '운동', '요리', '독서 모임', '동호회', 'hobby', 'travel'],
  sexual: ['19금', '성인용', '야한', '음란', 'nsfw', 'sexual', 'erotic'],
  relation: ['남자친구', '여자친구', '남친', '여친', '애인', '연애', '이별', '헤어졌', '결혼', '남편', '아내', '시어머니', '부모님', 'boyfriend', 'girlfriend', 'husband', 'wife', 'breakup'],
  health: ['진단', '병원', '처방', '증상', '수술', '입원', '통원', '복용', '진료', '검진', '질환', 'diagnosis', 'prescription', 'symptom', 'hospital'],
  job: ['이력서', '자기소개서', '자소서', '면접', '지원서', '입사', '채용', '경력기술서', '비자', '이민', '추천서', 'resume', 'cover letter', 'interview', 'visa', 'application'],
  emotion: ['우울', '불안', '스트레스', '외롭', '상담', '공황', '힘들어요', '힘듭니다', 'depressed', 'anxiety', 'lonely'],
  politics: ['정치', '선거', '정당', '대통령', '국회', '종교', '교회', '성당', '사찰', '신앙', 'election', 'religion', 'church'],
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const CATEGORY_MATCHERS = Object.fromEntries(
  Object.entries(CATEGORY_KEYWORDS).map(([key, words]) => {
    const ko = words.filter((w) => /[가-힣]/.test(w));
    const en = words.filter((w) => !/[가-힣]/.test(w));
    return [
      key,
      {
        ko,
        en: en.map((w) => ({ word: w, re: new RegExp(`(?<![A-Za-z])${escapeRe(w)}(?![A-Za-z])`, 'i') })),
      },
    ];
  }),
);

/** 글에 들어 있는 논문 범주를 찾습니다. 각 범주마다 걸린 키워드를 돌려줍니다. */
export function tagCategories(text) {
  const src = typeof text === 'string' ? text.slice(0, MAX_LEN) : '';
  if (!src.trim()) return [];
  const out = [];
  for (const cat of CATEGORIES) {
    const m = CATEGORY_MATCHERS[cat.key];
    const hits = [];
    for (const w of m.ko) if (src.includes(w)) hits.push(w);
    for (const { word, re } of m.en) if (re.test(src)) hits.push(word);
    if (hits.length) out.push({ key: cat.key, label: cat.label, hits: [...new Set(hits)] });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 개인정보 찾기                                                        */
/* ------------------------------------------------------------------ */

export const TYPE_LABEL = {
  rrn: '주민번호',
  card: '카드',
  email: '이메일',
  url: '링크',
  phone: '전화',
  address: '주소',
  org: '소속',
  name: '이름',
};

// 겹칠 때 먼저 남길 순서(숫자가 작을수록 우선)
const PRIORITY = { rrn: 0, card: 1, email: 2, url: 3, phone: 4, address: 5, org: 6, name: 7 };

const RE = {
  email: /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}/g,
  url: /(?:https?:\/\/|www\.)[^\s<>"'()[\]{}]{1,2000}/gi,
  rrn: /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[-\s]?[1-8]\d{6}(?!\d)/g,
  card: /(?<!\d)\d{4}(?:[-\s]?\d{4}){3}(?!\d)/g,
  // 휴대전화·지역번호, +82 국가번호 표기 포함
  phone:
    /(?<![\d+])(?:\+82[-.\s]?(?:0)?|0)(?:1[016789]|2|[3-6][1-5]|70|50\d?)[-.\s)]{0,2}\d{3,4}[-.\s]?\d{4}(?!\d)/g,
  address:
    /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|충청북|충청남|전북|전남|전라북|전라남|경북|경남|경상북|경상남|제주)(?:특별시|광역시|특별자치시|특별자치도|도|시)?\s{1,3}(?:[가-힣]{1,10}(?:시|군|구)\s{1,3}){1,2}(?:[가-힣]{1,10}(?:동|읍|면)\s{1,3})?[가-힣0-9]{1,20}(?:로|길)\s?\d{1,5}(?:-\d{1,5})?(?:[,\s]{1,3}\d{1,5}(?:층|호))?/g,
  orgKoPrefix: /(?:\(주\)|㈜|주식회사)\s?[가-힣A-Za-z0-9]{1,20}/g,
  orgKoSuffix: /[가-힣A-Za-z0-9]{1,20}\s?(?:주식회사|\(주\)|㈜)/g,
  orgKoInst: /(?<![가-힣])[가-힣]{2,15}(?:대학교|대학원|병원|의원|연구소|연구원|재단|협회|은행|공사|고등학교|중학교|초등학교)/g,
  orgEn:
    /(?<![A-Za-z])(?:[A-Z][A-Za-z&-]{0,30}\s){1,4}(?:Inc|Corp|Co|Ltd|LLC|Corporation|Company|University|Hospital|College)\b\.?/g,
  koNameTitle:
    /(?<![가-힣])([가-힣]{2,4})\s?(?:선생님|선생|교수님|교수|과장님|과장|대리님|대리|팀장님|팀장|부장님|부장|차장님|차장|실장님|실장|사장님|사장|이사님|상무님|상무|전무님|전무|대표님|대표|사원|주임|박사님|박사|매니저님|매니저|원장님|원장|연구원님|선배님|선배|후배|님|씨|드림|올림|배상)(?!된|되|하|해|스럽|적)/g,
  label:
    /(?:보내는 ?사람|받는 ?사람|보낸 ?사람|받는 ?분|작성자|담당자|성명|이름|발신인?|수신인?|From|To|Name)\s{0,3}[:：]\s{0,3}([가-힣]{2,4}(?![가-힣])|[A-Z][a-z]{1,20}(?:\s[A-Z][a-z]{1,20}){1,2})/gd,
  enCapRun: /(?<![A-Za-z])[A-Z][a-z]{1,20}(?:[ \t]+(?:[A-Z]\.[ \t]+)?[A-Z][a-z]{1,20}){1,5}(?![A-Za-z])/g,
};

// 이름 앞에 오기 쉬운 일반 명사(이름으로 보지 않음)
const KO_NAME_STOP = new Set([
  '고객', '회원', '부모', '손님', '담당자', '관리자', '여러분', '학생', '선생', '교수', '기사', '작가',
  '사장', '팀장', '과장', '부장', '대표', '이사', '실장', '원장', '어머', '아버', '어르신', '환자', '보호자',
  '지원자', '참가자', '구독자', '시청자', '사용자', '이용자', '작성자', '선배', '후배', '친구', '동료',
  '감사', '안녕', '수고', '하나', '모든', '우리', '저희', '각자', '본인', '당신', '상대', '거래처', '협력사',
  '신입', '경력', '지도', '담임', '주임', '영업', '인사', '총무', '기획', '개발', '마케팅', '이번', '다음',
  '여러', '박사', '연구', '매니저', '사원', '대리', '차장', '상무', '전무', '그분', '이분', '저분', '그리고',
  '오늘', '내일', '아저', '아주머', '아가', '지난주', '이번주', '다소', '확인', '요청', '부탁', '말씀', '연락', '드림', '올림', '배상', '귀하', '귀사', '당사',
]);
const KO_NAME_BAD_END = /(?:팀|부|과|실|센터|본부|회사|학교|병원|님|들)$/;

const EN_STOP = new Set([
  'Dear', 'Best', 'Regards', 'Kind', 'Warm', 'Sincerely', 'Thanks', 'Thank', 'Hello', 'Hi', 'Hey',
  'Please', 'The', 'This', 'That', 'These', 'Those', 'We', 'Our', 'You', 'Your', 'They', 'And', 'But',
  'For', 'With', 'From', 'Subject', 'Re', 'Fwd', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
  'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December', 'Korea', 'Korean', 'Seoul', 'English', 'Python',
  'Java', 'JavaScript', 'Type', 'Error', 'Script', 'Traceback', 'File', 'Line', 'True', 'False', 'None',
  'Team', 'Manager', 'Director', 'Sales', 'Department', 'Office', 'Inc', 'Corp', 'Ltd', 'Company',
  'University', 'Hospital', 'College', 'Street', 'Road', 'Avenue', 'Mr', 'Mrs', 'Ms', 'Dr', 'Prof',
  'Good', 'Morning', 'Afternoon', 'Evening', 'Looking', 'Forward', 'Let', 'Could', 'Would', 'Can',
  'New', 'York', 'United', 'States', 'Translate', 'Translation', 'Fix', 'Code', 'Bug', 'Here', 'There',
  'It', 'Is', 'In', 'On', 'At', 'Of', 'To', 'As', 'If', 'My', 'I', 'All', 'Any', 'Some', 'Note', 'Attached',
]);

// 이름이나 소속 끝에 붙은 조사를 떼어 냅니다.
const PARTICLE = /(?:에서|에게|께서|으로|이랑|하고|은|는|이|가|을|를|에|의|와|과|로|께|도|만)$/;
function trimParticle(s) {
  if (s.length <= 3) return s;
  const t = s.replace(PARTICLE, '');
  return t.length >= 2 ? t : s;
}

function push(list, type, start, value) {
  if (!value) return;
  list.push({ type, start, end: start + value.length, value });
}

function collectAll(re, src, fn) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    fn(m);
  }
}

/**
 * 글에서 개인정보로 보이는 부분을 찾습니다.
 * @returns {{type:string,label:string,start:number,end:number,value:string}[]}
 */
export function detectPII(text) {
  if (typeof text !== 'string' || !text) return [];
  const src = text.length > MAX_LEN ? text.slice(0, MAX_LEN) : text;
  const raw = [];

  collectAll(RE.email, src, (m) => push(raw, 'email', m.index, m[0]));
  collectAll(RE.url, src, (m) => push(raw, 'url', m.index, m[0].replace(/[.,;:!?]+$/, '')));
  collectAll(RE.rrn, src, (m) => push(raw, 'rrn', m.index, m[0]));
  collectAll(RE.card, src, (m) => push(raw, 'card', m.index, m[0]));
  collectAll(RE.phone, src, (m) => push(raw, 'phone', m.index, m[0]));
  collectAll(RE.address, src, (m) => push(raw, 'address', m.index, m[0].replace(/[,\s]+$/, '')));

  collectAll(RE.orgKoPrefix, src, (m) => push(raw, 'org', m.index, trimParticle(m[0])));
  collectAll(RE.orgKoSuffix, src, (m) => push(raw, 'org', m.index, m[0]));
  collectAll(RE.orgKoInst, src, (m) => push(raw, 'org', m.index, m[0]));
  collectAll(RE.orgEn, src, (m) => push(raw, 'org', m.index, m[0].trimEnd()));

  collectAll(RE.koNameTitle, src, (m) => {
    const name = m[1];
    if (KO_NAME_STOP.has(name) || KO_NAME_BAD_END.test(name)) return;
    push(raw, 'name', m.index, name);
  });
  collectAll(RE.label, src, (m) => {
    const name = m[1];
    const start = m.indices ? m.indices[1][0] : m.index + m[0].lastIndexOf(name);
    if (KO_NAME_STOP.has(name)) return;
    push(raw, 'name', start, name);
  });
  collectAll(RE.enCapRun, src, (m) => {
    // 대문자로 시작하는 단어 묶음을 흔한 단어 기준으로 잘라, 2~3 단어 조각만 이름으로 봅니다.
    const parts = [];
    const wordRe = /[A-Z]\.|[A-Z][a-z]{1,20}/g;
    let w;
    while ((w = wordRe.exec(m[0])) !== null) parts.push({ word: w[0], at: m.index + w.index });
    let seg = [];
    const flush = () => {
      const words = seg.filter((p) => !p.word.endsWith('.'));
      if (words.length >= 2 && words.length <= 3) {
        const first = seg[0];
        const last = seg[seg.length - 1];
        push(raw, 'name', first.at, src.slice(first.at, last.at + last.word.length));
      }
      seg = [];
    };
    for (const p of parts) {
      if (EN_STOP.has(p.word)) flush();
      else seg.push(p);
    }
    flush();
  });

  // 겹침 정리: 우선순위 → 길이 → 앞선 위치 순으로 남깁니다.
  raw.sort(
    (a, b) => PRIORITY[a.type] - PRIORITY[b.type] || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept = [];
  const taken = []; // 정렬된 구간 목록
  for (const f of raw) {
    if (overlaps(taken, f.start, f.end)) continue;
    insertRange(taken, f.start, f.end);
    kept.push(f);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept.map((f) => ({ ...f, label: TYPE_LABEL[f.type] }));
}

function lowerBound(arr, start) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid][0] < start) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function overlaps(arr, s, e) {
  const i = lowerBound(arr, s);
  if (i < arr.length && arr[i][0] < e) return true;
  if (i > 0 && arr[i - 1][1] > s) return true;
  return false;
}
function insertRange(arr, s, e) {
  arr.splice(lowerBound(arr, s), 0, [s, e]);
}

/* ------------------------------------------------------------------ */
/* 가리기·되돌리기                                                      */
/* ------------------------------------------------------------------ */

/**
 * 찾은 부분을 [이름1] 같은 표시로 바꿉니다. 같은 값은 같은 표시를 씁니다.
 * @returns {{masked:string, table:{token:string,value:string,type:string,label:string}[]}}
 */
export function maskText(text, findings) {
  if (typeof text !== 'string' || !text) return { masked: '', table: [] };
  const list = (Array.isArray(findings) ? findings : [])
    .filter((f) => f && Number.isInteger(f.start) && f.end > f.start && f.end <= text.length)
    .slice()
    .sort((a, b) => a.start - b.start);

  const counters = {};
  const byValue = new Map();
  const table = [];
  let out = '';
  let pos = 0;
  for (const f of list) {
    if (f.start < pos) continue; // 겹치는 항목은 건너뜁니다
    const value = text.slice(f.start, f.end);
    const label = TYPE_LABEL[f.type] || '정보';
    const key = `${f.type}\u0000${value}`;
    let token = byValue.get(key);
    if (!token) {
      do {
        counters[label] = (counters[label] || 0) + 1;
        token = `[${label}${counters[label]}]`;
      } while (text.includes(token)); // 원문에 이미 같은 표시가 있으면 번호를 건너뜁니다
      byValue.set(key, token);
      table.push({ token, value, type: f.type, label });
    }
    out += text.slice(pos, f.start) + token;
    pos = f.end;
  }
  out += text.slice(pos);
  return { masked: out, table };
}

/**
 * 번역 결과 속 표시를 원래 값으로 되돌립니다. "[ 이름1 ]"처럼 띄어 쓴 경우도 찾습니다.
 * @returns {{text:string, restored:number, missing:string[]}}
 */
export function unmaskText(text, table) {
  const src = typeof text === 'string' ? text : '';
  const rows = Array.isArray(table) ? table : [];
  let restored = 0;
  const missing = [];
  let out = src;
  for (const row of rows) {
    const m = /^\[(.+?)(\d+)\]$/.exec(row.token || '');
    if (!m) continue;
    const re = new RegExp(`[\\[［]\\s{0,2}${escapeRe(m[1])}\\s{0,2}${m[2]}\\s{0,2}[\\]］]`, 'g');
    let count = 0;
    out = out.replace(re, () => {
      count++;
      return row.value;
    });
    if (count === 0) missing.push(row.token);
    restored += count;
  }
  return { text: out, restored, missing };
}

/** 찾은 항목을 종류별로 셉니다. */
export function countByType(findings) {
  const out = {};
  for (const f of findings || []) out[f.label] = (out[f.label] || 0) + 1;
  return out;
}

/* ------------------------------------------------------------------ */
/* 예시 글 (모두 지어낸 값입니다)                                        */
/* ------------------------------------------------------------------ */

export const EXAMPLES = {
  email: {
    label: '번역할 업무 메일',
    type: 'translate',
    text: `받는 사람: Jane Doe
보내는 사람: 홍길동

Jane Doe 님께,

안녕하십니까. (주)가나다무역 해외영업팀 홍길동 과장입니다.
지난주 화상 회의에서 말씀하신 견적서와 계약서 초안을 첨부해 드립니다.
단가는 지난번 발주 기준으로 맞췄고, 대금은 계약 후 30일 안에 송금하겠습니다.

자세한 내용은 같은 팀 성춘향 대리에게 물어보셔도 됩니다.
- 이메일: hong@example.com
- 전화: 010-1234-5678 / 사무실 02-0000-0000
- 주소: 서울특별시 가나구 예시로 123, 4층
- 자료 링크: https://example.com/quote

다음 주 화요일까지 회신 부탁드립니다.

홍길동 드림

위 메일을 자연스러운 영어로 번역해 주세요.`,
  },
  code: {
    label: '코드 수정 요청',
    type: 'code',
    text: `아래 파이썬 함수가 빈 리스트를 넣으면 ZeroDivisionError 가 납니다. 고쳐 주세요.

def average(values):
    total = 0
    for v in values:
        total += v
    return total / len(values)

print(average([]))`,
  },
};
