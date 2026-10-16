import {mountCourseBuilder,disposeMap} from './course-builder.js';
import {attachmentsHTML,placePhotos,installPhotoViewer} from './place-media.js';
import {curatedCourses,createCourse} from './domain.js';
import {
  places,
  totals,
  recommend,
  escapeHTML as e,
  loadState,
} from "./domain.js";
const app = document.querySelector("#app");
installPhotoViewer(app);
let curatedRegion="전체", detailMap=null;
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem: () => null,
    setItem: () => {
      throw Error("저장 차단");
    },
  };
}
let state = loadState(storage),
  results = [],
  searchTerm = "",
  courseFilter = "all",
  calendarOffset = 0,
  pendingConfirm;
state.profile ??= { name: "나", partner: "너", connected: false };
state.preferences ??= {
  activities: ["식사", "카페", "산책"],
  mood: "여유로운",
  transport: "도보",
};
state.notifications ??= false;
const money = (n) => new Intl.NumberFormat("ko-KR").format(n) + "원";
const today = () => new Date().toLocaleDateString("sv-SE");
const id = () => crypto.randomUUID();
const route = () => {
  const [page = "home", ...parts] = location.hash.slice(1).split("/");
  return { page: page || "home", key: parts.join("/") };
};
const currentCourse = () => state.courses.find((c) => c.id === route().key);
const currentMemory = () => state.memories.find((m) => m.id === route().key);
const go = (target) => {
  if (location.hash === `#${target}`) render();
  else location.hash = target;
};
const link = (target, label, cls = "button") =>
  `<a class="${cls}" href="#${target}">${label}</a>`;
const btn = (action, label, extra = "", cls = "") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const heading = (eyebrow, title, subtitle = "", action = "") =>
  `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${action}</div>`;
const note = (text, peach = false) =>
  `<div class="callout ${peach ? "peach" : ""}"><span>ⓘ</span><div>${text}</div></div>`;
const empty = (title, text, target, label) =>
  `<div class="card empty"><div class="circle-icon">♡</div><h3>${title}</h3><p>${text}</p>${target ? link(target, label, "button secondary") : ""}</div>`;
const scene = (kind = "garden", badge = "") =>
  `<div class="scene scene-${kind}" role="img" aria-label="${{ garden: "산책길", cafe: "카페", gallery: "전시", night: "달빛" }[kind]} 분위기 일러스트">${badge ? `<span class="scene-badge">${badge}</span>` : ""}</div>`;
const art = () =>
  `<div class="hero-art" aria-hidden="true"><div class="sticker">♡</div><div class="postcard">${scene("garden")}<p>our little moments</p></div></div>`;
const steps = (active) =>
  `<div class="steps"><span class="${active === 1 ? "current" : ""}"><b>1</b>조건 설정</span><i></i><span class="${active === 2 ? "current" : ""}"><b>2</b>코스 선택</span><i></i><span class="${active === 3 ? "current" : ""}"><b>3</b>우리의 코스</span></div>`;
function toast(text) {
  const t = document.querySelector("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3500);
}
function save(change) {
  const previous = structuredClone(state);
  change();
  try {
    storage.setItem("dulgil-v1", JSON.stringify(state));
    return true;
  } catch {
    state = previous;
    toast(
      "저장하지 못했어요. 브라우저 저장 설정이나 사진 용량을 확인해주세요.",
    );
    return false;
  }
}
function confirmAction(title, text, fn) {
  document.querySelector("#confirm-title").textContent = title;
  document.querySelector("#confirm-text").textContent = text;
  pendingConfirm = fn;
  document.querySelector("#confirm-dialog").showModal();
}
document.querySelector("#confirm-dialog").addEventListener("close", (ev) => {
  if (ev.target.returnValue === "confirm") pendingConfirm?.();
  pendingConfirm = null;
});
const meta = (stops) => {
  const t = totals(stops);
  return `<div class="meta-row"><span>◷ ${t.minutes}분</span><span>${stops.some(p=>p.needsEstimate)?"비용 확인 필요":money(t.cost)}</span><span>♧ ${stops.length}곳</span></div>`;
};
const countStats = () =>
  `<div class="stats"><div class="stat"><span class="stat-icon">↗</span><div><span class="stat-label">저장한 코스</span> <b>${state.courses.length}</b><small>함께할 다음 여정</small></div></div><div class="stat"><span class="stat-icon">▧</span><div><span class="stat-label">남긴 추억</span> <b>${state.memories.length}</b><small>다시 보고 싶은 순간</small></div></div><div class="stat"><span class="stat-icon">♡</span><div><span class="stat-label">우리의 기념일</span> <b>${state.anniversaries.length}</b><small>기억할 특별한 날</small></div></div></div>`;
function courseCard(c, i = 0, preview = false) {
  return `<article class="card course-card">${scene(["garden", "cafe", "gallery"][i % 3], preview ? "추천 코스" : c.completed ? "다녀온 코스" : "예정된 데이트")}<div class="course-content"><span class="pill">${e(c.region)}</span><span class="pill peach">${preview ? "취향을 담은 하루" : e(c.date)}</span><h3>${e(c.name || `${c.region}, 함께 걷는 하루`)}</h3><p>${c.stops.map((p) => e(p.name)).join(" → ")}</p>${meta(c.stops)}${link(preview ? `recommendation/${i}` : `course/${c.id}`, preview ? "코스 자세히 보기 ↗" : "우리 코스 살펴보기 ↗", "button outline full")}</div></article>`;
}
function mapView(stops, large = false) {
 if(stops.some(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)))return '<div id="actual-course-map" class="real-map"></div><p class="map-caption">실제 위치 지도 · 연결선은 방문 순서이며 실제 길찾기가 아닙니다.</p>';
 if(stops.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return note('좌표 없는 장소는 첨부한 지도 링크에서 위치를 확인해주세요.');
  return `<div class="map-wrap"><svg class="map ${large ? "large" : ""}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="가상 장소 순서도, 실제 지도 아님"><rect class="map-bg" width="100" height="100"/><path class="map-water" d="M0 80 Q45 62 100 89 L100 100 L0 100Z"/><path class="map-park" d="M62 3 H96 V51 Q67 64 62 3Z"/><path class="map-road" d="M-5 22L105 58M14 -10L40 100M69 -10L57 100M-5 66L105 23"/><polyline class="map-route" points="${stops.map((p) => `${p.x},${p.y}`).join(" ")}"/>${stops.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="4.8"/><text x="${p.x}" y="${p.y + 0.3}">${i + 1}</text>`).join("")}</svg><span class="map-label">♧ 둘이 걷는 길 · DEMO MAP</span></div><p class="map-caption">가상 장소 순서도예요. 실제 지도·교통 경로가 아니며 이동은 구간당 15분으로 가정해요.</p>`;
}
function stopList(c, editable = false) {
  return c.stops
    .map(
      (p, i) =>
        `<div class="stop"><span class="stop-number">${i + 1}</span><div class="stop-content"><span class="pill">${e(p.category)}</span><h3>${e(p.name)}</h3><p>머무는 시간 ${p.minutes}분 · 두 명 ${money(p.cost)}</p>${i < c.stops.length - 1 ? `<p class="tiny">↓ 다음 장소까지 약 ${c.stops[i+1].travelMinutes??15}분 (예상)</p>` : ""}</div>${editable ? `<div class="stop-actions">${btn("up", "↑", `data-index="${i}" aria-label="${e(p.name)} 위로" ${i === 0 ? "disabled" : ""}`, "secondary small")}${btn("down", "↓", `data-index="${i}" aria-label="${e(p.name)} 아래로" ${i === c.stops.length - 1 ? "disabled" : ""}`, "secondary small")}${btn("remove-stop", "삭제", `data-index="${i}"`, "ghost small")}</div>` : ""}</div>`,
    )
    .join("");
}
function home() {
  const upcoming = state.courses
    .filter((c) => !c.completed)
    .sort((a, b) => a.date.localeCompare(b.date));
  app.innerHTML =
    heading(
      "OUR LITTLE JOURNEY",
      `${e(state.profile.name)}님, 오늘도 둘이서. ♡`,
      "어디로 갈지 고민하는 순간부터, 우리의 데이트는 시작돼요.",
      link("plan", "새 데이트 만들기 +"),
    ) +
    `<section class="hero"><div class="hero-copy"><span class="eyebrow">A DAY JUST FOR TWO</span><h2>취향은 다르지만,<br>좋은 하루는 함께.</h2><p>우리에게 딱 맞는 코스를 찾고<br>함께한 순간을 차곡차곡 남겨요.</p>${link("plan", "우리의 데이트 찾기 ↗")}</div>${art()}</section>${countStats()}<div class="two-col"><section><div class="section-head"><h2>다음엔 여기, 어때요?</h2><a href="#courses">모두 보기 →</a></div>${
      upcoming.length
        ? `<div class="grid">${upcoming
            .slice(0, 2)
            .map((c, i) => courseCard(c, i))
            .join("")}</div>`
        : `<div class="card between"><div><span class="pill">첫 번째 여정</span><h3>아직 정해지지 않은 하루</h3><p class="sub">지역과 예산만 정하면 시작할 수 있어요.</p>${link("plan", "첫 데이트 계획하기 →", "button secondary")}</div><span class="circle-icon">↗</span></div>`
    }<div class="section-head"><h2>우리의 순간들</h2><a href="#memories">추억 보관함 →</a></div>${state.memories.length ? memoryCard(state.memories.at(-1), 0) : `<div class="card between"><div><h3>처음의 설렘도, 익숙한 편안함도.</h3><p class="sub">다녀온 코스에서 첫 추억을 남겨보세요.</p></div><span class="circle-icon">▧</span></div>`}</section><section><div class="section-head"><h2>곧, 특별한 날</h2><a href="#anniversaries">전체 →</a></div><div class="card">${
      state.anniversaries.length
        ? state.anniversaries
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 3)
            .map(anniversaryItem)
            .join("")
        : `<div class="circle-icon">♡</div><h3>기억하고 싶은 날이 있나요?</h3><p class="sub">생일, 처음 만난 날, 작은 약속까지.<br>우리의 달력에 담아두세요.</p>${link("anniversaries", "기념일 추가하기", "button secondary full")}`
    }</div><div class="card mt18"><span class="eyebrow">BETTER TOGETHER</span><h3>서로의 취향을 알아가는 중</h3><p class="sub">좋아하는 것과 피하고 싶은 것을<br>먼저 골라두면 계획이 쉬워져요.</p>${link("preferences", "취향 설정하기 →", "button ghost")}</div></section></div>`;
}
function onboarding() {
  app.innerHTML = `<section class="onboarding"><span class="eyebrow">EVERY DAY, OUR WAY</span><h1>둘이 가는 길 위에<br>우리의 이야기를.</h1><p class="sub">데이트를 정하는 순간부터 추억을 꺼내보는 날까지.<br>둘길에서, 우리다운 하루를 만들어보세요.</p>${art()}<div class="actions">${link("login", "둘길 시작하기 →")}${link("home", "먼저 둘러보기", "button outline")}</div></section><div class="grid mt22">${[
    ["01", "취향이 만나는 코스", "우리의 시간과 예산에 맞춰요."],
    ["02", "함께 다듬는 하루", "장소와 순서를 자유롭게 바꿔요."],
    ["03", "오래 남는 순간", "사진과 마음을 차곡차곡 담아요."],
  ]
    .map(
      ([n, t, s]) =>
        `<div class="card"><span class="eyebrow">${n}</span><h3>${t}</h3><p class="sub">${s}</p></div>`,
    )
    .join("")}</div>`;
}
function auth(signup = false) {
  app.innerHTML = `<div class="auth-layout"><section class="auth-intro"><span class="eyebrow">WELCOME TO DULGIL</span><h1>함께할 오늘이<br>조금 더 설레도록.</h1><p class="sub">계획도, 추억도.<br>우리 둘을 위한 작은 공간.</p>${art()}</section><section class="auth-form"><h2>${signup ? "둘길에 오신 걸 환영해요" : "다시 만나 반가워요"}</h2><p class="sub">${signup ? "어떤 이름으로 불러드릴까요?" : "오늘은 어떤 하루를 만들어볼까요?"}</p>${note("로그인 화면 미리보기예요. 실제 계정·인증 정보는 수집하지 않아요.")}<form id="auth-form" class="mt23"><label>닉네임<input name="name" maxlength="20" value="${signup ? "" : e(state.profile.name)}" placeholder="예: 도희" required></label><button class="full">${signup ? "데모 프로필 만들기" : "데모로 시작하기"} →</button></form><div class="divider">소셜 로그인 디자인</div><button class="social full" disabled>카카오로 시작하기 · 연동 예정</button><div class="auth-links">${link(signup ? "login" : "signup", signup ? "이미 계정이 있나요? 로그인" : "처음이신가요? 회원가입", "")}${link("home", "먼저 둘러보기", "")}</div><p class="tiny">실제 이메일·비밀번호 입력 없이 화면 흐름을 체험할 수 있어요.</p></section></div>`;
}
function couple() {
  app.innerHTML =
    heading(
      "JUST THE TWO OF US",
      "둘만의 공간을 연결해요",
      "초대하고, 취향을 나누고, 함께 하루를 만들어가요.",
    ) +
    `<div class="two-equal"><section class="card invite-card"><div class="avatar-pair"><span>${e(state.profile.name.slice(0, 1))}</span><span>♡</span></div><h2>${state.profile.connected ? "우리의 데모 공간" : "함께할 사람을 초대해요"}</h2><p class="sub">${state.profile.connected ? e(state.profile.name) + " · " + e(state.profile.partner) + "의 연결 미리보기" : "초대 코드 하나로 시작하는<br>우리만의 작은 이야기."}</p><div class="code-box">DULGIL</div>${btn("copy-invite", "초대 코드 복사하기", "", "full")}<div class="actions">${link("accept", "초대 수락 화면 보기", "button outline full")}</div></section><section class="card"><span class="eyebrow">HAVE AN INVITATION?</span><h2>초대를 받으셨나요?</h2><p class="sub">데모 코드 <b>DULGIL</b>을 입력해 흐름을 확인해보세요.</p><form id="invite-form"><label>초대 코드<input name="code" placeholder="초대 코드 입력" maxlength="20" required autocomplete="off"></label><button class="full">초대 확인하기 →</button></form><div class="mt25">${note("현재는 화면 체험용 연결이에요. 다른 기기의 사용자와 연결되거나 기록이 공유되지 않아요.")}</div>${link("disconnect", "연결 해제 안내", "button ghost")}</section></div>`;
}
function accept() {
  app.innerHTML = `<section class="card invite-card"><span class="eyebrow">YOU ARE INVITED</span><div class="avatar-pair"><span>나</span><span>너</span></div><h1>우리, 둘길에서 만나요.</h1><p class="sub">함께 코스를 고르고<br>둘만의 추억을 쌓아갈 공간이 기다려요.</p><form id="accept-form"><label>상대방 닉네임<input name="partner" value="${e(state.profile.partner)}" maxlength="20" required></label><button class="full">데모 초대 수락하기 ♡</button></form><p class="tiny">실제 초대 전송·사용자 인증·공유는 연결되지 않았어요.</p>${link("couple", "돌아가기", "button ghost")}</section>`;
}
function preferences() {
  const pref = state.preferences;
  app.innerHTML =
    heading(
      "GET TO KNOW US",
      "우리의 취향을 모아볼까요?",
      "같은 취향도, 다른 취향도. 서로를 알아가는 작은 시작.",
    ) +
    `<div class="two-col"><form id="preferences-form" class="card"><div class="tabs"><span class="active tab-label">나의 취향</span><span class="tiny pad10">상대 취향은 실제 연결 후 제공 예정</span></div><fieldset><legend>우리가 좋아하는 데이트</legend><div class="chips">${["식사", "카페", "문화", "산책"].map((v) => `<label><input type="checkbox" name="activities" value="${v}" ${pref.activities.includes(v) ? "checked" : ""}>${v}</label>`).join("")}</div></fieldset><fieldset><legend>어떤 분위기가 좋아요?</legend><div class="chips">${["여유로운", "새로운", "로맨틱한", "활동적인"].map((v) => `<label><input type="radio" name="mood" value="${v}" ${pref.mood === v ? "checked" : ""}>${v}</label>`).join("")}</div></fieldset><label>주로 어떻게 이동하나요?<select name="transport">${["도보", "대중교통", "자동차"].map((v) => `<option ${pref.transport === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>피하고 싶은 것 / 메모<textarea name="avoid" rows="3" maxlength="300" placeholder="예: 사람이 너무 붐비는 곳은 피하고 싶어요.">${e(pref.avoid || "")}</textarea></label><div class="form-foot"><span class="tiny">이 기기에서 다음 계획에 활용돼요.</span><button>취향 저장하기 ♡</button></div></form><section class="card"><div class="circle-icon">♧</div><h3>나답게, 또 우리답게.</h3><p class="sub">선택한 활동은 데이트 조건의 기본값으로 불러와요. 분위기·이동 수단·메모는 보관되며 추천 반영은 준비 중이에요.</p><hr class="rule"><span class="eyebrow">MY PICKS</span>${pref.activities.map((v) => `<span class="pill">${v}</span>`).join("")}<p class="tiny">서로의 공통 취향 비교는 실제 커플 연동 후 제공할 예정이에요.</p>${link("plan", "이 취향으로 데이트 만들기 →", "button secondary full")}</section></div>`;
}
function plan() {
  const p = state.preferences;
  app.innerHTML =
    heading(
      "PLAN OUR NEXT DATE",
      "어떤 하루를 보내고 싶나요?",
      "지역부터 취향까지. 오늘의 우리에게 맞는 조건을 골라요.",
    ) +
    steps(1) +
    `<div class="two-col"><form id="plan-form" class="card"><section class="form-section"><h3><span>01</span>언제, 어디서 만날까요?</h3><div class="row"><label>데이트 지역<select name="region"><option>성수</option><option>연남</option></select></label><label>데이트 날짜<input type="date" name="date" required value="${today()}"></label></div></section><section class="form-section"><h3><span>02</span>여유로운 시간과 예산</h3><div class="row"><label>두 명의 총예산 (원)<input type="number" name="budget" required min="0" max="10000000" step="1000" value="80000"></label><label>함께할 시간<select name="hours">${[1, 2, 3, 4, 5, 6, 8].map((v) => `<option value="${v}" ${v === 4 ? "selected" : ""}>${v}시간</option>`).join("")}</select></label></div></section><section class="form-section"><h3><span>03</span>무엇을 하면 좋을까요?</h3><fieldset><legend class="tiny">한 가지 이상 골라주세요</legend><div class="chips">${["식사", "카페", "문화", "산책"].map((v) => `<label><input type="checkbox" name="activities" value="${v}" ${p.activities.includes(v) ? "checked" : ""}>${v}</label>`).join("")}</div></fieldset></section><div class="form-foot"><a href="#preferences" class="tiny">취향 설정 변경 →</a><button>우리에게 맞는 코스 찾기 ↗</button></div></form><div class="stack sticky"><section class="card"><div class="circle-icon">↗</div><h3>좋은 하루의 시작은<br>작은 선택에서.</h3><p class="sub">예산과 시간 안에서 선택한 활동을 조합해, 최대 세 가지 코스를 제안해요.</p><dl class="summary-list"><div><dt>대상 지역</dt><dd>성수 · 연남</dd></div><div><dt>장소 데이터</dt><dd>가상 장소 8곳</dd></div><div><dt>비용 기준</dt><dd>두 명 총액</dd></div></dl></section>${note("실제 영업 정보·교통·비용은 연결되지 않은 디자인 데모예요.")}</div></div>`;
}
function recommendations() {
  app.innerHTML =
    heading(
      "A DAY MADE FOR US",
      "이런 하루는 어때요?",
      "우리의 조건을 담은 코스예요. 마음에 드는 하루를 골라보세요.",
      link("plan", "조건 다시 설정", "button outline"),
    ) +
    steps(2) +
    (results.length
      ? `<div class="toolbar"><div><span class="pill">${e(results[0].region)}</span><span class="pill">${e(results[0].date)}</span><span class="pill peach">${results[0].hours}시간 · ${money(results[0].budget)} 이내</span></div><span class="tiny">${results.length}개의 추천</span></div><div class="grid">${results.map((c, i) => courseCard(c, i, true)).join("")}</div><div class="mt22">${note("선택한 활동과 시간·예산을 기준으로 조합했어요. 장소와 가격은 데모 데이터예요.")}</div>`
      : empty(
          "아직 추천받은 코스가 없어요",
          "조건에 맞는 결과가 없거나 새로고침으로 추천 목록이 초기화됐어요.",
          "plan",
          "조건 설정하고 추천받기",
        ));
}
function recommendation() {
  const c = results[Number(route().key)];
  if (!c) {
    recommendations();
    return;
  }
  app.innerHTML =
    heading(
      "THIS COULD BE OUR DAY",
      `${e(c.region)}, 함께 걷는 하루`,
      "마음에 드는 코스는 저장하고, 우리답게 다듬어보세요.",
      link("recommendations", "← 추천 목록", "button outline"),
    ) +
    `<div class="two-col"><section class="card">${mapView(c.stops)}<h2>이렇게 하루를 보내요</h2>${stopList(c)}</section><section class="card sticky"><span class="pill">우리 조건에 맞는 코스</span><h2>${e(c.region)}에서 보내는 하루</h2><p class="sub">선택한 활동 ${c.activities.map(e).join(" · ")}을 즐길 수 있어요.</p><dl class="summary-list"><div><dt>예상 소요 시간</dt><dd>${totals(c.stops).minutes}분</dd></div><div><dt>두 명 예상 비용</dt><dd>${money(totals(c.stops).cost)}</dd></div><div><dt>방문 장소</dt><dd>${c.stops.length}곳</dd></div></dl>${btn("save-course", "이 코스 저장하기 ♡", `data-index="${route().key}"`, "full")}<div class="actions">${link("plan", "다른 조건으로 추천받기", "button outline full")}</div><p class="tiny">저장 후 장소와 방문 순서를 바꿀 수 있어요.</p></section></div>`;
}
function courses() {
  const list = state.courses.filter(
    (c) =>
      courseFilter === "all" ||
      (courseFilter === "done" ? c.completed : !c.completed),
  );
  app.innerHTML =
    heading(
      "OUR DATE COLLECTION",
      "함께할 하루를 담아뒀어요",
      "계획 중인 코스부터 다녀온 데이트까지, 여기에서 만나요.",
      link("plan", "새 코스 만들기 +"),
    ) +
    `<div class="tabs">${[
      ["all", "전체"],
      ["planned", "예정된 데이트"],
      ["done", "다녀온 코스"],
    ]
      .map(([v, t]) =>
        btn(
          "course-filter",
          t,
          `data-value="${v}"`,
          courseFilter === v ? "active" : "",
        ),
      )
      .join("")}</div>${
      list.length
        ? `<div class="grid">${list
            .slice()
            .reverse()
            .map((c, i) => courseCard(c, i))
            .join("")}</div>`
        : empty(
            "우리의 다음 데이트를 기다려요",
            "아직 이 목록에 담긴 코스가 없어요.<br>좋아하는 활동으로 첫 코스를 만들어볼까요?",
            "plan",
            "데이트 만들기 ↗",
          )
    }`;
}
function detail() {
  const c = currentCourse();
  if (!c) {
    app.innerHTML = empty(
      "코스를 찾을 수 없어요",
      "삭제되었거나 다른 기기에 저장된 코스일 수 있어요.",
      "courses",
      "목록으로",
    );
    return;
  }
  app.innerHTML =
    heading(
      "OUR PLAN, OUR WAY",
      e(c.name),
      `${e(c.date)} · ${e(c.region)} · ${c.completed ? "다녀온 코스" : "예정된 데이트"}`,
      link(`edit/${c.id}`, "코스 편집하기", "button outline"),
    ) +
    `<div class="two-col"><section class="card">${mapView(c.stops)}<div class="between"><h2>우리의 방문 순서</h2>${link(`map/${c.id}`, "경로 크게 보기 ↗", "button ghost small")}</div>${stopList(c)}</section><div class="stack sticky"><section class="card"><span class="eyebrow">DATE AT A GLANCE</span><h2>우리 하루 한눈에</h2><dl class="summary-list"><div><dt>날짜</dt><dd>${e(c.date)}</dd></div><div><dt>총 소요 시간</dt><dd>${totals(c.stops).minutes}분</dd></div><div><dt>두 명 총예산</dt><dd>${c.stops.some(p=>p.needsEstimate)?"비용 확인 필요":money(totals(c.stops).cost)}</dd></div><div><dt>방문 장소</dt><dd>${c.stops.length}곳</dd></div></dl>${c.completed ? link(`record/${c.id}`, "오늘의 추억 남기기 ♡", "button full") : btn("complete", "데이트 완료하기 ✓", `data-id="${e(c.id)}"`, "full")}<p class="tiny">완료한 데이트에 사진과 소감을 남길 수 있어요.</p></section>${note("저장한 코스는 이 브라우저에서만 확인할 수 있어요. 실제 연인과 공유하는 기능은 준비 중이에요.")}${link("courses", "← 저장한 코스로", "button outline")}</div></div>`;
}
function openBuilder(course){mountCourseBuilder(app,{course,toast,savedPlaces:state.courses.flatMap(c=>c.stops),onCancel:()=>go('courses'),onSave:result=>{const ok=save(()=>{const index=state.courses.findIndex(c=>c.id===result.id);if(index<0)state.courses.push(result);else state.courses[index]=result;});if(ok){toast('코스를 저장했어요');go('course/'+result.id);}return ok;},onDelete:key=>confirmAction('코스를 삭제할까요?','작성한 추억은 남아요.',()=>{if(save(()=>state.courses=state.courses.filter(c=>c.id!==key)))go('courses');})});}
function editor() {
  const c = currentCourse();
  if (!c) {
    detail();
    return;
  }
  openBuilder(c);
}

function placeSearch() {
  const c = currentCourse();
  if (!c) {
    detail();
    return;
  }
  app.innerHTML =
    heading(
      "A NEW LITTLE STOP",
      "어디를 더 들러볼까요?",
      "코스에 넣을 장소를 검색해보세요.",
      link(`edit/${c.id}`, "← 편집으로", "button outline"),
    ) +
    `<div class="card"><label>장소 검색<input id="place-search" type="search" placeholder="장소명 또는 활동 검색" value=""></label><div id="place-results"></div></div>`;
  drawPlaces("");
}
function drawPlaces(q) {
  const c = currentCourse();
  document.querySelector("#place-results").innerHTML =
    places
      .filter((p) => p.region === c.region && (p.name + p.category).includes(q))
      .map(
        (p) =>
          `<div class="list-item"><div><span class="pill">${e(p.category)}</span><h3>${e(p.name)}</h3><p>${p.minutes}분 · ${money(p.cost)} / 두 명 · 가상 장소</p></div>${c.stops.some((s) => s.id === p.id) ? '<span class="tiny">추가됨 ✓</span>' : btn("add-stop", "추가 +", `data-id="${p.id}"`, "secondary small")}</div>`,
      )
      .join("") ||
    '<p class="sub">검색 결과가 없어요. 다른 이름으로 찾아보세요.</p>';
}
function mapPage() {
  const c = currentCourse();
  if (!c) {
    detail();
    return;
  }
  app.innerHTML =
    heading(
      "THE WAY WE GO",
      "둘이 걷는 길",
      "장소의 순서와 하루의 흐름을 확인해보세요.",
      link(`course/${c.id}`, "← 코스 상세", "button outline"),
    ) +
    `<div class="two-col"><section class="card">${mapView(c.stops, true)}${meta(c.stops)}</section><section class="card"><h2>오늘의 경유지</h2>${stopList(c)}</section></div>`;
}
function saved() {
  const c = currentCourse();
  app.innerHTML = `<section class="card invite-card"><div class="success-icon">✓</div><span class="eyebrow">READY FOR OUR NEXT DAY</span><h1>우리의 코스에 담았어요.</h1><p class="sub">${c ? e(c.name) : "함께할 다음 데이트"}<br>마음에 드는 하루를 우리답게 다듬어보세요.</p><div class="actions">${link(c ? `course/${c.id}` : "courses", "저장한 코스 확인하기", "button full")}${link(c ? `edit/${c.id}` : "courses", "장소·순서 편집하기", "button outline full")}</div><p class="tiny">데이트를 마친 후 코스에서 ‘완료하기’를 눌러 추억을 남겨요.</p></section>`;
}
function memoryCard(m, i) {
  return `<article class="card memory-card">${m.photo ? `<img src="${e(m.photo)}" alt="${e(m.name)} 사진">` : scene(["garden", "cafe", "night"][i % 3])}<div class="memory-copy"><span class="date">${e(m.date)}</span><h3>${e(m.name)}</h3><p>${e(m.text.length > 70 ? m.text.slice(0, 70) + "…" : m.text)}</p><div class="between"><span class="pill">${m.visibility === "private" ? "나만의 기록" : "우리의 기록"}</span>${link(`memory/${m.id}`, "다시 꺼내보기 →", "tiny")}</div></div></article>`;
}
function memories() {
  app.innerHTML =
    heading(
      "MOMENTS TO KEEP",
      "우리의 순간을 꺼내봐요",
      "별일 없던 하루도, 함께여서 소중한 기억이 되니까요.",
      link("record", "추억 남기기 +"),
    ) +
    `<div class="toolbar"><span class="tiny">${state.memories.length}개의 소중한 기록</span><label class="m0"><span class="tiny">기록 검색</span><input id="memory-search" type="search" placeholder="제목 · 소감으로 찾아보기" value="${e(searchTerm)}"></label></div><div id="memory-list"></div>`;
  drawMemories();
}
function drawMemories() {
  const list = state.memories
    .filter((m) => (m.name + " " + m.text).includes(searchTerm))
    .sort((a, b) => b.date.localeCompare(a.date));
  document.querySelector("#memory-list").innerHTML = list.length
    ? `<div class="grid">${list.map(memoryCard).join("")}</div>`
    : empty(
        "아직 비어 있는 우리의 앨범",
        "완료한 코스에서 추억을 남기거나,<br>기억하고 싶은 하루를 바로 적어보세요.",
        "record",
        "첫 추억 남기기 ♡",
      );
}
function record() {
  const c = currentCourse();
  if (c && !c.completed) {
    app.innerHTML = empty(
      "먼저 데이트를 완료해주세요",
      "완료한 코스에서 실제 데이트 기록을 작성할 수 있어요.",
      `course/${c.id}`,
      "코스 확인하기",
    );
    return;
  }
  app.innerHTML =
    heading(
      "KEEP THIS DAY CLOSE",
      "오늘을 오래 기억해요",
      "함께한 하루에 사진 한 장과 마음 한 줄을 더해주세요.",
    ) +
    `<div class="two-col"><form class="card" id="memory-form"><label class="photo-upload"><span>▧</span><b>오늘의 한 장을 골라주세요</b><small class="tiny">JPEG · PNG · WebP / 최대 500KB</small><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"><img id="photo-preview" class="photo-preview" alt="선택한 사진 미리보기" hidden></label><label>어떤 하루였나요?<input name="name" required maxlength="80" placeholder="예: 가을 햇살 따라 걸었던 성수" value="${e(c?.name || "")}"></label><div class="row"><label>실제 데이트 날짜<input type="date" name="date" required value="${e(c?.date || today())}"></label><label>오늘의 만족도<select name="rating">${[5, 4, 3, 2, 1].map((v) => `<option value="${v}">${"★".repeat(v)} ${v}점</option>`).join("")}</select></label></div><label>기억하고 싶은 순간<textarea name="text" rows="5" required maxlength="3000" placeholder="어떤 순간이 가장 좋았나요?"></textarea></label><fieldset><legend>기록 범위</legend><div class="chips"><label><input type="radio" name="visibility" value="couple" checked>우리의 기록</label><label><input type="radio" name="visibility" value="private">나만의 기록</label></div></fieldset><div class="form-foot"><span class="tiny">이 브라우저에 저장돼요.</span><button>오늘의 추억 저장하기 ♡</button></div></form><div class="stack sticky"><section class="card"><span class="eyebrow">A LITTLE REMINDER</span><h3>완벽한 하루가 아니어도,<br>우리의 순간이니까.</h3><p class="sub">맛있었던 음식, 우연히 들어간 골목,<br>둘이 한참 웃었던 이야기.<br>작은 것부터 남겨봐요.</p>${c ? `<span class="pill">연결된 코스</span><p class="sub">${e(c.name)}</p>${meta(c.stops)}` : ""}</section>${note("‘나만/우리’는 디자인용 표시예요. 실제 계정별 접근 제어와 공유는 아직 연결되지 않았어요.")}</div></div>`;
}
function memoryDetail() {
  const m = currentMemory();
  if (!m) {
    app.innerHTML = empty(
      "기록을 찾을 수 없어요",
      "삭제된 기록이거나 이 브라우저에 저장되지 않았어요.",
      "memories",
      "추억 보관함으로",
    );
    return;
  }
  const c = state.courses.find((c) => c.id === m.courseId);
  app.innerHTML =
    heading(
      "ONE OF OUR FAVORITE DAYS",
      e(m.name),
      e(m.date),
      link("memories", "← 추억 보관함", "button outline"),
    ) +
    `<div class="two-col"><article class="card memory-detail">${m.photo ? `<img class="photo-preview" src="${e(m.photo)}" alt="${e(m.name)} 사진">` : scene("garden")}<div class="actions"><span class="pill">${m.visibility === "private" ? "나만의 기록" : "우리의 기록"}</span><span class="stars">${"★".repeat(m.rating)}</span></div><p class="body-text">${e(m.text)}</p></article><div class="stack"><section class="card"><span class="eyebrow">OUR LITTLE FOOTPRINTS</span><h3>그날의 발자취</h3>${c ? `${mapView(c.stops)}${link(`course/${c.id}`, "그날의 코스 보기 →", "button secondary full")}` : '<p class="sub">코스 없이 남긴 자유 기록이에요.</p>'}</section>${btn("delete-memory", "이 기록 삭제", `data-id="${e(m.id)}"`, "danger")}</div></div>`;
}
function anniversaryItem(a) {
  return `<div class="list-item"><div class="flex12"><span class="date-block"><small>${e(a.date.slice(5, 7))}월</small>${e(a.date.slice(8))}</span><div><h3>${e(a.name)}</h3><p>${e(a.date)}</p></div></div><a href="#anniversary-edit/${e(a.id)}" class="tiny">수정 →</a></div>`;
}
function calendar() {
  const now = new Date();
  now.setDate(1);
  now.setMonth(now.getMonth() + calendarOffset);
  const y = now.getFullYear(),
    m = now.getMonth();
  const offset = now.getDay(),
    days = new Date(y, m + 1, 0).getDate();
  return `<div class="calendar-heading">${btn("prev-month", "‹", 'aria-label="이전 달"', "ghost small")}<h3>${y}년 ${m + 1}월</h3>${btn("next-month", "›", 'aria-label="다음 달"', "ghost small")}</div><div class="calendar">${["일", "월", "화", "수", "목", "금", "토"].map((d) => `<span class="weekday">${d}</span>`).join("")}${'<span class="blank"></span>'.repeat(offset)}${Array.from(
    { length: days },
    (_, i) => {
      const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return `<span class="day ${date === today() ? "today" : ""} ${state.anniversaries.some((a) => a.date === date) || state.courses.some((c) => c.date === date) ? "event" : ""}">${i + 1}</span>`;
    },
  ).join("")}</div>`;
}
function anniversaries() {
  app.innerHTML =
    heading(
      "OUR SPECIAL DAYS",
      "기억하고 싶은 날들",
      "큰 기념일도, 작은 약속도. 우리의 달력에 담아둬요.",
      link("anniversary-new", "기념일 추가 +"),
    ) +
    `<div class="two-col"><section class="card">${calendar()}<p class="tiny mt25">● 등록한 기념일 / 데이트</p></section><div class="stack"><section class="card"><div class="between"><h2>우리의 기념일</h2><span class="pill">${state.anniversaries.length}</span></div>${
      state.anniversaries.length
        ? state.anniversaries
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(anniversaryItem)
            .join("")
        : '<p class="sub">처음 만난 날부터 등록해볼까요?</p>'
    }${link("anniversary-new", "특별한 날 추가하기 +", "button secondary full")}</section><section class="card"><h3>다가오는 데이트</h3>${
      state.courses
        .filter((c) => !c.completed)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3)
        .map(
          (c) =>
            `<a class="settings-link" href="#course/${e(c.id)}"><div>${e(c.name)}<small>${e(c.date)}</small></div>→</a>`,
        )
        .join("") || '<p class="sub">아직 예정된 데이트가 없어요.</p>'
    }${link("plan", "기념일 코스 계획하기 →", "button ghost")}</section></div></div>`;
}
function anniversaryForm() {
  const a = state.anniversaries.find((a) => a.id === route().key);
  if (route().page === "anniversary-edit" && !a) {
    go("anniversaries");
    return;
  }
  app.innerHTML =
    heading(
      "SAVE A SPECIAL DAY",
      a ? "특별한 날을 수정해요" : "새로운 기념일을 담아요",
      "잊고 싶지 않은 날, 둘길이 함께 기억할게요.",
    ) +
    `<div class="two-col"><form class="card" id="anniversary-form"><label>어떤 날인가요?<input name="name" value="${e(a?.name || "")}" maxlength="80" placeholder="예: 우리의 첫 만남" required></label><label>날짜<input type="date" name="date" value="${e(a?.date || today())}" required></label><div class="list-item"><div><h3>기념일 알림</h3><p>알림 발송은 실제 연동 후 제공 예정이에요.</p></div><label class="switch"><input type="checkbox" disabled aria-label="기념일 알림 연동 예정"></label></div><div class="actions"><button>기념일 저장하기 ♡</button>${link("anniversaries", "취소", "button outline")}${a ? btn("delete-anniversary", "삭제", `data-id="${e(a.id)}"`, "danger") : ""}</div></form><section class="card"><div class="circle-icon">♡</div><h3>우리에게만 특별한 날</h3><p class="sub">만난 날, 첫 여행, 서로의 생일.<br>작은 이유라도 충분해요.</p><p class="tiny">반복 일정·알림 발송은 준비 중이며 현재는 입력한 날짜 한 건을 저장해요.</p></section></div>`;
}
function settings() {
  app.innerHTML =
    heading(
      "OUR SPACE, OUR RULES",
      "나와 우리의 설정",
      "우리의 정보를 살펴보고 편안한 공간을 만들어요.",
    ) +
    `<div class="profile-banner"><span class="avatar">${e(state.profile.name.slice(0, 1))}</span><div><h2>${e(state.profile.name)}님의 둘길</h2><p>${state.profile.connected ? e(state.profile.partner) + "님과 데모 연결 중" : "아직 연결 전 · 혼자 둘러보는 중"}</p></div></div><div class="two-equal"><section class="card"><h2>프로필</h2><form id="profile-form"><label>닉네임<input name="name" value="${e(state.profile.name)}" required maxlength="20"></label><button class="secondary">프로필 저장</button></form><div class="section-head"><h2>우리의 공간</h2></div>${settingsLink("couple", "커플 공간 관리", state.profile.connected ? "데모 연결 상태 살펴보기" : "초대하고 연결해보기")}${settingsLink("preferences", "취향 설정", "좋아하는 데이트와 분위기")}</section><section class="card"><h2>개인정보와 서비스</h2>${settingsLink("privacy", "개인정보·권한", "기록 범위와 데이터 관리")}${settingsLink("disconnect", "커플 연결 해제", "기록은 남기고 데모 연결 해제")}${settingsLink("delete-account", "이 기기의 데이터 삭제", "코스·추억·설정 초기화")}${settingsLink("onboarding", "시작 화면", "서비스 소개와 로그인 디자인")}${settingsLink("pages", "전체 페이지 둘러보기", "문서 기반 화면 목록")}${settingsLink("admin", "관리자 화면 미리보기", "가상 신고 데이터만 사용")}</section></div>`;
}
function settingsLink(to, title, sub) {
  return `<a class="settings-link" href="#${to}"><div>${title}<small>${sub}</small></div><span>›</span></a>`;
}
function privacy() {
  app.innerHTML =
    heading(
      "YOUR MEMORIES, YOUR CHOICE",
      "편안하게 기록할 수 있도록",
      "이 데모에서 저장되는 정보와 권한을 확인해요.",
    ) +
    `<div class="two-col"><section class="card"><h2>권한과 공유</h2><div class="list-item"><div><h3>위치 정보</h3><p>기기 위치를 수집하지 않아요. 지역을 직접 선택해요.</p></div><span class="pill">사용 안 함</span></div><div class="list-item"><div><h3>사진</h3><p>직접 고른 파일 한 장만 브라우저에 보관해요.</p></div><span class="pill">직접 선택</span></div><div class="list-item"><div><h3>실제 커플 공유</h3><p>로그인·서버 접근 제어를 연결한 후 제공해요.</p></div><span class="pill peach">준비 중</span></div><div class="list-item"><div><h3>알림 설정 미리보기</h3><p>설정만 이 기기에 보관돼요. 알림은 발송되지 않아요.</p></div><label class="switch"><input type="checkbox" id="notifications" ${state.notifications ? "checked" : ""} aria-label="알림 설정 미리보기"></label></div></section><div class="stack"><section class="card"><h3>기록은 어디에 있나요?</h3><p class="sub">코스, 추억, 사진과 프로필은 현재 브라우저 저장소에만 있어요. 다른 PC와 동기화되지 않고 브라우저 데이터를 지우면 복구할 수 없어요.</p>${link("delete-account", "이 기기의 데이터 삭제", "button danger full")}</section>${link("settings", "← 설정으로", "button outline")}</div></div>`;
}
function disconnect() {
  app.innerHTML = `<section class="card invite-card"><div class="circle-icon center-auto">♡</div><h1>데모 연결을 해제할까요?</h1><p class="sub">${e(state.profile.partner)}님과의 연결 표시를 해제해요.<br>이 기기에 저장한 코스와 추억은 남아 있어요.</p>${note("실제 사용자 연결이나 상대방의 데이터에는 영향을 주지 않아요.")}<div class="actions">${btn("disconnect", "데모 연결 해제하기", "", "danger full")}${link("settings", "그대로 유지하기", "button outline full")}</div></section>`;
}
function deleteAccount() {
  app.innerHTML = `<section class="card invite-card"><span class="eyebrow">BEFORE YOU GO</span><h1>이 기기의 기록을 지울까요?</h1><p class="sub">저장한 코스 ${state.courses.length}개, 추억 ${state.memories.length}개,<br>기념일 ${state.anniversaries.length}개와 프로필·설정이 삭제돼요.<br>삭제하면 복구할 수 없어요.</p>${note("실제 서버 계정 삭제가 아닌, 이 브라우저의 둘길 데이터 초기화예요.", true)}<div class="actions">${btn("reset", "모든 데모 데이터 삭제", "", "danger full")}${link("settings", "조금 더 함께할게요", "button outline full")}</div></section>`;
}
function admin() {
  const reports = state.reports ?? [
    {
      id: "sample-1",
      type: "장소",
      title: "가상 장소 영업 정보 확인 요청",
      date: today(),
      status: "대기",
    },
    {
      id: "sample-2",
      type: "기록",
      title: "예시 신고 기록 검토 요청",
      date: today(),
      status: "대기",
    },
  ];
  app.innerHTML =
    heading(
      "ADMIN WORKSPACE",
      "신고 검토 대시보드",
      "실제 사용자 데이터 없이, 관리자 화면을 미리 살펴봐요.",
    ) +
    note(
      "화면 설계용 샘플 데이터예요. 관리자 인증·실제 신고 조회·조치는 연결되지 않았어요.",
    ) +
    `<div class="stats"><div class="stat"><div><span class="stat-label">샘플 신고</span><b>${reports.length}</b><small>전체</small></div></div><div class="stat"><div><span class="stat-label">검토 대기</span><b>${reports.filter((r) => r.status === "대기").length}</b><small>확인이 필요해요</small></div></div><div class="stat"><div><span class="stat-label">처리 완료</span><b>${reports.filter((r) => r.status === "완료").length}</b><small>데모 조치</small></div></div></div><section class="card"><h2>신고 항목</h2><div class="table-scroll"><table><thead><tr><th>유형</th><th>신고 내용</th><th>접수일</th><th>상태</th><th>검토</th></tr></thead><tbody>${reports.map((r) => `<tr><td>${r.type}</td><td>${e(r.title)}</td><td>${r.date}</td><td><span class="pill">${r.status}</span></td><td>${btn("review-report", r.status === "대기" ? "데모 검토 완료" : "검토 완료", `data-id="${r.id}" ${r.status === "완료" ? "disabled" : ""}`, "secondary small")}</td></tr>`).join("")}</tbody></table></div></section>`;
}
const pageList = [
  ["onboarding", "시작 / 온보딩"],
  ["login", "로그인"],
  ["signup", "회원가입"],
  ["couple", "커플 초대"],
  ["accept", "초대 수락 확인"],
  ["home", "홈 대시보드"],
  ["preferences", "취향 설정"],
  ["plan", "데이트 조건 설정"],
  ["recommendations", "추천 코스 목록"],
  ["courses", "저장한 코스"],
  ["memories", "추억 타임라인"],
  ["record", "데이트 기록 작성"],
  ["anniversaries", "기념일·일정"],
  ["anniversary-new", "기념일 추가"],
  ["settings", "프로필·설정"],
  ["privacy", "개인정보·권한"],
  ["disconnect", "연결 해제 확인"],
  ["delete-account", "데이터 삭제 확인"],
  ["admin", "관리자 대시보드"],
];
function pages() {
  const c = state.courses[0],
    m = state.memories[0];
  app.innerHTML =
    heading(
      "EVERY PAGE OF OUR STORY",
      "둘길의 모든 화면",
      "MD 문서의 사용자 흐름에 맞춰 구성한 페이지들이에요.",
    ) +
    `<div class="page-index">${pageList.map(([r, n]) => link(r, `${n}<span>↗</span>`, "")).join("")}</div><div class="section-head"><h2>데이터와 연결되는 화면</h2></div>${
      c
        ? `<div class="page-index">${[
            ["course", "코스 상세"],
            ["edit", "코스 편집"],
            ["search", "장소 검색"],
            ["map", "코스 지도"],
            ["saved", "코스 저장 확인"],
          ]
            .map(([r, n]) => link(`${r}/${c.id}`, `${n}<span>↗</span>`, ""))
            .join(
              "",
            )}${m ? link(`memory/${m.id}`, "추억 상세 ↗", "") : ""}</div>`
        : note(
            "코스를 한 개 저장하면 상세·편집·장소 검색·지도·저장 확인 화면으로 이동할 수 있어요.",
          )
    }<div class="mt23">${link("plan", "코스 만들어 화면 살펴보기 →")}</div>`;
}
function courseCover(c){const photo=c.stops.flatMap(placePhotos)[0];if(photo)return `<div class="course-cover photo-cover"><img src="${e(photo)}" alt="${e(c.name)} 코스 사진" loading="lazy"><span class="cover-label">${e(c.region)} · ${c.completed?'함께한 하루':'기다리는 하루'}</span></div>`;return `<div class="course-cover ${c.region==='연남'?'yeonnam':''}"><span class="cover-label">${e(c.region)} · ${c.completed?'함께한 하루':'기다리는 하루'}</span><svg viewBox="0 0 400 140" aria-hidden="true"><circle cx="330" cy="32" r="55" fill="#ffffff40"/><path d="M0 133Q90 70 183 128T400 107V140H0" fill="#fff4f7"/><rect x="207" y="38" width="78" height="78" rx="9" fill="#fff9f2"/><path d="M203 41h86l-8-15h-70z" fill="#d987a3"/><path d="M210 43h72" stroke="#e9b6c9" stroke-width="11" stroke-dasharray="10 6"/><rect x="222" y="67" width="19" height="24" rx="3" fill="#efc1d3"/><rect x="251" y="67" width="19" height="48" rx="4" fill="#e5adc3"/><path d="M307 108V77m34 43V89" stroke="#c29d90" stroke-width="5"/><circle cx="307" cy="67" r="22" fill="#d1b6c1"/><circle cx="341" cy="83" r="18" fill="#e0c1cb"/><path d="M112 92c-25-17-22-36-9-36 6 0 11 4 13 9 3-5 8-8 14-6 16 4 10 22-18 33" fill="#d87c9e"/></svg></div>`;}
function curatedCard(c){const t=totals(c.stops);return `<article class="card course-card curated-card">${courseCover(c)}<div class="course-content"><span class="eyebrow">가까운 곳끼리 · ${e(c.region)}</span><h3>${e(c.name)}</h3><p class="sub">${e(c.description)}</p><p class="course-path">${c.stops.map(p=>e(p.name)).join(' → ')}</p><span class="pill">약 ${Math.floor(t.minutes/60)}시간 ${t.minutes%60}분</span><span class="pill">직선거리 합계 ${c.distanceKm}km</span><span class="pill">비용 확인 필요</span>${c.alternatives?.length?`<label class="template-alternative">공방 선택<select id="alternative-${c.id}"><option value="original">${e(c.stops[c.alternatives[0].replaceIndex].name)}</option>${c.alternatives.map((a,i)=>`<option value="${i}">${e(a.stop.name)}</option>`).join('')}</select></label>`:''}<details class="course-place-details"><summary>활동·주소·네이버지도 보기</summary><p class="template-notes">${e(c.notes)}</p>${c.stops.map(p=>`<section class="place-detail-block"><h4>${e(p.name)}</h4><p>${e(p.address)}</p>${attachmentsHTML(p)}</section>`).join('')}${c.alternatives?.map(a=>`<section class="place-detail-block"><h4>다른 선택: ${e(a.stop.name)}</h4><p>${e(a.stop.address)}</p>${attachmentsHTML(a.stop)}</section>`).join('')||''}</details><div class="actions"><button data-action="use-curated" data-id="${c.id}">♡ 내 코스에 담기</button></div></div></article>`;}
function curatedList(){return `<section id="curated-section"><div class="section-heading"><h2>가까운 곳끼리 추천 코스</h2><span class="pill">${curatedCourses.length}개 코스</span></div><p class="sub">보내주신 장소를 현재 검색 주소로 묶었어요. 시간·이동은 계획용 추정이며, 비용과 예약은 장소 링크에서 확인해주세요.</p><div class="curated-filters">${['전체',...new Set(curatedCourses.map(c=>c.region))].map(region=>`<button class="${region===curatedRegion?'':'secondary'}" data-action="filter-curated" data-region="${e(region)}" aria-pressed="${region===curatedRegion}">${e(region)}</button>`).join('')}</div><div class="course-list">${curatedCourses.filter(c=>curatedRegion==='전체'||c.region===curatedRegion).map(curatedCard).join('')}</div><p class="map-help">내 코스에 담으면 오늘 날짜로 저장돼요. 편집 화면에서 날짜·시작 시간·예산을 바꿀 수 있어요. 실제 이동 경로는 네이버지도에서 확인하세요.</p></section>`;}
const views = {
  home,
  "new-course":()=>openBuilder(),
  onboarding,
  login: () => auth(),
  signup: () => auth(true),
  couple,
  accept,
  preferences,
  plan,
  recommendations,
  recommendation,
  courses,
  course: detail,
  edit: editor,
  search: placeSearch,
  map: mapPage,
  saved,
  memories,
  record,
  memory: memoryDetail,
  anniversaries,
  "anniversary-new": anniversaryForm,
  "anniversary-edit": anniversaryForm,
  settings,
  privacy,
  disconnect,
  "delete-account": deleteAccount,
  admin,
  pages,
};
function render() {
  disposeMap();
  if(detailMap){detailMap.remove();detailMap=null;}
  const { page } = route();
  (views[page] || pages)();
  if(page==='courses')app.insertAdjacentHTML('beforeend',curatedList());
  if(page==='home'||page==='courses'||page==='plan')app.insertAdjacentHTML('afterbegin',link('new-course','+ 직접 코스 만들기','button outline'));
  const actualMap=app.querySelector('#actual-course-map');
  if(actualMap&&window.L){detailMap=L.map(actualMap);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(detailMap);const points=currentCourse().stops.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)).map(p=>[p.lat,p.lng]);points.forEach((p,i)=>L.marker(p).addTo(detailMap).bindPopup(String(i+1)));L.polyline(points).addTo(detailMap);detailMap.fitBounds(L.latLngBounds(points).pad(.2),{maxZoom:16});}
  if(page==='course'){const c=currentCourse();if(c)app.insertAdjacentHTML('beforeend','<section class="card"><h2>장소 사진·활동·링크</h2>'+c.stops.map(p=>'<section class="place-detail-block"><h3>'+e(p.name)+'</h3><p>'+e(p.address||'')+'</p>'+attachmentsHTML(p)+'</section>').join('')+'</section>');}
  const group =
    {
      recommendation: "plan",
      recommendations: "plan",
      preferences: "plan",
      "new-course": "courses",
      course: "courses",
      edit: "courses",
      search: "courses",
      map: "courses",
      saved: "courses",
      memory: "memories",
      record: "memories",
      "anniversary-new": "anniversaries",
      "anniversary-edit": "anniversaries",
      privacy: "settings",
      couple: "settings",
      disconnect: "settings",
      "delete-account": "settings",
    }[page] || page;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === group);
    a.setAttribute("aria-current", a.dataset.nav === group ? "page" : "false");
  });
  document
    .querySelectorAll("[data-mobile]")
    .forEach((a) => a.classList.toggle("active", a.dataset.mobile === group));
  document.querySelector("#breadcrumb").textContent =
    pageList.find(([r]) => r === page)?.[1] || "우리의 이야기";
  document.title = `${document.querySelector("#app h1")?.textContent || "둘이 만드는 하루"} · 둘길`;
  document
    .querySelectorAll(".avatar")
    .forEach((a) => (a.textContent = state.profile.name.slice(0, 1)));
}
app.addEventListener("input", (ev) => {
  if (ev.target.id === "memory-search") {
    searchTerm = ev.target.value;
    drawMemories();
  }
  if (ev.target.id === "place-search") drawPlaces(ev.target.value);
});
app.addEventListener("change", (ev) => {
  if (ev.target.id === "notifications") {
    const value = ev.target.checked;
    if (save(() => (state.notifications = value)))
      toast("데모 설정을 저장했어요. 실제 알림은 발송되지 않아요.");
    else ev.target.checked = state.notifications;
  }
  if (ev.target.name === "photo") {
    const file = ev.target.files[0],
      preview = document.querySelector("#photo-preview");
    preview.hidden = true;
    if (!file) return;
    if (
      file.size > 500 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      ev.target.value = "";
      toast("JPEG/PNG/WebP 사진 500KB 이하만 가능해요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.hidden = false;
    };
    reader.readAsDataURL(file);
  }
});
app.addEventListener("click", async (ev) => {
 const button=ev.target.closest('[data-action]');
 if(button?.dataset.action==='filter-curated'){curatedRegion=button.dataset.region;render();return;}
 if(button?.dataset.action==='use-curated'){
  const template=curatedCourses.find(c=>c.id===button.dataset.id);if(!template)return;
  const stops=structuredClone(template.stops),choice=document.querySelector('#alternative-'+template.id)?.value;
  if(choice&&choice!=='original'){const alt=template.alternatives[Number(choice)];if(alt)stops[alt.replaceIndex]=structuredClone(alt.stop);}
  const course=createCourse({...template,date:today(),stops},id());
  if(save(()=>state.courses.push(course))){toast('코스를 담았어요');go('edit/'+course.id);}return;
 }
  const b = ev.target.closest("[data-action]");
  if (!b) return;
  const { action, id: key, index, value } = b.dataset;
  const c = currentCourse();
  if (action === "course-filter") {
    courseFilter = value;
    render();
    return;
  }
  if (action === "prev-month" || action === "next-month") {
    calendarOffset += action === "prev-month" ? -1 : 1;
    render();
    return;
  }
  if (action === "copy-invite") {
    try {
      await navigator.clipboard.writeText("DULGIL");
      toast("데모 코드 DULGIL을 복사했어요");
    } catch {
      toast("데모 코드: DULGIL — 직접 복사해주세요.");
    }
    return;
  }
  if (action === "save-course") {
    const r = results[Number(index)];
    if (!r) return;
    const courseId = id();
    if (
      save(() =>
        state.courses.push({
          ...structuredClone(r),
          id: courseId,
          name: `${r.region}, 함께 걷는 하루`,
          completed: false,
        }),
      )
    )
      go(`saved/${courseId}`);
    return;
  }
  if (action === "complete") {
    confirmAction(
      "오늘의 데이트를 마쳤나요?",
      "완료 상태로 바꾸고 추억을 작성할 수 있어요.",
      () => {
        if (
          save(() => {
            const course = state.courses.find((c) => c.id === key);
            if (course) course.completed = true;
          })
        ) {
          toast("함께한 하루를 기록해보세요");
          go(`record/${key}`);
        }
      },
    );
    return;
  }
  if (action === "disconnect") {
    confirmAction(
      "데모 연결을 해제할까요?",
      "코스와 추억은 이 기기에 유지돼요.",
      () => {
        if (save(() => (state.profile.connected = false))) {
          go("couple");
          toast("데모 연결을 해제했어요");
        }
      },
    );
    return;
  }
  if (action === "reset") {
    confirmAction(
      "모든 데모 데이터를 삭제할까요?",
      "사진과 기록을 포함한 모든 둘길 데이터가 이 브라우저에서 삭제돼요. 복구할 수 없어요.",
      () => {
        if (
          save(() => {
            state = {
              courses: [],
              memories: [],
              anniversaries: [],
              profile: { name: "나", partner: "너", connected: false },
              preferences: {
                activities: ["식사", "카페", "산책"],
                mood: "여유로운",
                transport: "도보",
              },
              notifications: false,
            };
          })
        ) {
          results = [];
          go("onboarding");
          toast("이 기기의 둘길 데이터를 삭제했어요");
        }
      },
    );
    return;
  }
  if (action === "review-report") {
    if (
      save(() => {
        state.reports ??= [
          {
            id: "sample-1",
            type: "장소",
            title: "가상 장소 영업 정보 확인 요청",
            date: today(),
            status: "대기",
          },
          {
            id: "sample-2",
            type: "기록",
            title: "예시 신고 기록 검토 요청",
            date: today(),
            status: "대기",
          },
        ];
        const r = state.reports.find((r) => r.id === key);
        if (r) r.status = "완료";
      })
    ) {
      render();
      toast("샘플 상태를 변경했어요. 실제 조치는 수행되지 않아요.");
    }
    return;
  }
  if (action.startsWith("delete-")) {
    const table = {
      "delete-course": "courses",
      "delete-memory": "memories",
      "delete-anniversary": "anniversaries",
    }[action];
    if (!table) return;
    confirmAction(
      "정말 삭제할까요?",
      table === "courses"
        ? "코스만 삭제되며 이미 작성한 추억은 남아요."
        : "삭제한 데이터는 복구할 수 없어요.",
      () => {
        if (
          save(() => (state[table] = state[table].filter((x) => x.id !== key)))
        )
          go(table);
      },
    );
    return;
  }
  if (!c) return;
  if (action === "add-stop") {
    const p = places.find((p) => p.id === key && p.region === c.region);
    if (!p || c.stops.some((s) => s.id === key)) return;
    if (save(() => c.stops.push({ ...p }))) {
      drawPlaces(document.querySelector("#place-search").value);
      toast("코스에 장소를 추가했어요");
    }
    return;
  }
  if (["up", "down", "remove-stop"].includes(action)) {
    const i = Number(index);
    if (action === "remove-stop" && c.stops.length === 1) {
      toast("코스에는 최소 한 장소가 필요해요");
      return;
    }
    if (
      save(() => {
        if (action === "remove-stop") c.stops.splice(i, 1);
        else {
          const j = i + (action === "up" ? -1 : 1);
          if (j >= 0 && j < c.stops.length)
            [c.stops[i], c.stops[j]] = [c.stops[j], c.stops[i]];
        }
      })
    )
      render();
  }
});
app.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target,
    f = new FormData(form),
    name = String(f.get("name") || "").trim();
  if (["auth-form", "profile-form"].includes(form.id)) {
    if (!name) {
      toast("닉네임을 입력해주세요");
      return;
    }
    if (save(() => (state.profile.name = name))) {
      toast("데모 프로필을 저장했어요");
      if (form.id === "auth-form") go("couple");
      else render();
    }
    return;
  }
  if (form.id === "invite-form") {
    if (String(f.get("code")).trim().toUpperCase() === "DULGIL") go("accept");
    else toast("데모 코드 DULGIL을 입력해주세요.");
    return;
  }
  if (form.id === "accept-form") {
    const partner = String(f.get("partner")).trim();
    if (!partner) {
      toast("닉네임을 입력해주세요");
      return;
    }
    if (
      save(() => {
        state.profile.partner = partner;
        state.profile.connected = true;
      })
    ) {
      go("home");
      toast("데모 연결을 완료했어요");
    }
    return;
  }
  if (form.id === "preferences-form") {
    const activities = f.getAll("activities");
    if (!activities.length) {
      toast("활동을 한 개 이상 골라주세요");
      return;
    }
    if (
      save(
        () =>
          (state.preferences = {
            activities,
            mood: f.get("mood") || "여유로운",
            transport: f.get("transport"),
            avoid: f.get("avoid"),
          }),
      )
    ) {
      toast("취향을 저장했어요");
      render();
    }
    return;
  }
  if (form.id === "plan-form") {
    const conditions = {
      region: f.get("region"),
      date: f.get("date"),
      budget: Number(f.get("budget")),
      hours: Number(f.get("hours")),
      activities: f.getAll("activities"),
    };
    try {
      results = recommend(conditions).map((r) => ({ ...r, ...conditions }));
      go("recommendations");
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  if (form.id === "edit-form") {
    if (!name) {
      toast("코스 이름을 입력해주세요");
      return;
    }
    const c = currentCourse();
    if (
      save(() => {
        c.name = name;
        c.date = f.get("date");
      })
    )
      toast("코스 정보를 저장했어요");
    return;
  }
  if (form.id === "anniversary-form") {
    if (!name) {
      toast("기념일 이름을 입력해주세요");
      return;
    }
    const a = state.anniversaries.find((a) => a.id === route().key);
    if (
      save(() => {
        if (a) {
          a.name = name;
          a.date = f.get("date");
        } else
          state.anniversaries.push({ id: id(), name, date: f.get("date") });
      })
    ) {
      go("anniversaries");
      toast("특별한 날을 저장했어요");
    }
    return;
  }
  if (form.id === "memory-form") {
    if (!name || !String(f.get("text")).trim()) {
      toast("제목과 소감을 입력해주세요");
      return;
    }
    const button = form.querySelector(
      'button[type="submit"], button:not([type])',
    );
    button.disabled = true;
    const courseId = route().key;
    try {
      const file = f.get("photo");
      let photo = "";
      if (file?.size) {
        if (
          file.size > 500 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        )
          throw Error("JPEG/PNG/WebP 사진 500KB 이하만 가능해요.");
        photo = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () =>
            reject(Error("사진을 읽지 못했어요. 다시 골라주세요."));
          reader.readAsDataURL(file);
        });
      }
      const memoryId = id();
      if (
        save(() =>
          state.memories.push({
            id: memoryId,
            courseId,
            name,
            date: f.get("date"),
            text: String(f.get("text")).trim(),
            rating: Number(f.get("rating")),
            visibility: f.get("visibility"),
            photo,
          }),
        )
      ) {
        go(`memory/${memoryId}`);
        toast("우리의 순간을 저장했어요");
      }
    } catch (err) {
      toast(err.message);
    } finally {
      button.disabled = false;
    }
  }
});
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  app.focus({ preventScroll: true });
});
render();
