(() => {
  "use strict";

  const APP_KEY = "__ZETA_CREATOR_PRIVATE_SAVER_V1__";
  const PANEL_ID = "__zeta_creator_private_saver_panel__";

  /* =========================================================
   * 이미 실행 중인지 확인
   * ======================================================= */

  if (window[APP_KEY]?.running) {
    alert("제작자 비캐 저장기가 이미 실행 중입니다.");
    return;
  }

  /* =========================================================
   * 기본 유틸
   * ======================================================= */

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalize = (text) => (text || "").replace(/\s+/g, " ").trim();

  const visible = (el) => {
    if (!el || !el.isConnected) return false;

    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  };

  const routeKey = () => location.pathname + location.search + location.hash;

  const isProfileUrl = (url) => {
    try {
      return /\/plots\/[^/]+\/profile\/?$/.test(
        new URL(url, location.origin).pathname,
      );
    } catch (_) {
      return false;
    }
  };

  const isProfilePage = () =>
    /\/plots\/[^/]+\/profile\/?$/.test(location.pathname);

  const isStopped = () => !state.running;

  const abort = () => {
    if (isStopped()) {
      throw new Error("__STOP__");
    }
  };

  const waitFor = async (finder, label, timeout = 20000, interval = 250) => {
    const end = Date.now() + timeout;

    while (Date.now() < end) {
      abort();

      try {
        const result = finder();
        if (result) return result;
      } catch (_) {}

      await sleep(interval);
    }

    throw new Error(`${label} 대기 시간 초과`);
  };

  const clickElement = async (el, label) => {
    abort();

    if (!el || !el.isConnected) {
      throw new Error(`${label}을 찾을 수 없습니다.`);
    }

    try {
      el.scrollIntoView({
        block: "center",
        inline: "center",
        behavior: "instant",
      });
    } catch (_) {
      el.scrollIntoView({
        block: "center",
        inline: "center",
      });
    }

    await sleep(300);

    abort();

    if (!visible(el)) {
      throw new Error(`${label}이 화면에 없습니다.`);
    }

    el.click();

    await sleep(200);
  };

  /* =========================================================
   * 제작자 카드 찾기
   * ======================================================= */

  const getCharacterCards = () => {
    return [
      ...document.querySelectorAll(
        '[data-sentry-component="FrameProfileCard"]',
      ),
    ];
  };

  const getProfileFromCard = (card) => {
    const links = [
      ...card.querySelectorAll('a[href*="/plots/"][href*="/profile"]'),
    ];

    const link = links.find((a) => isProfileUrl(a.href));

    if (!link) return null;

    const title =
      card.querySelector("span[title]")?.getAttribute("title") ||
      card.querySelector(".body1.font-semibold")?.textContent ||
      "이름 없는 캐릭터";

    return {
      name: normalize(title),
      url: new URL(link.href, location.origin).href,
    };
  };

  const collectVisibleCharacters = () => {
    const result = new Map();

    for (const card of getCharacterCards()) {
      const character = getProfileFromCard(card);

      if (!character) continue;

      result.set(character.url, character);
    }

    return result;
  };

  /* =========================================================
   * 제작자 페이지 전체 스크롤
   * ======================================================= */

  const collectAllCharacters = async () => {
    paint("캐릭터 목록 찾는 중...");

    const found = new Map();

    let stableCount = 0;
    let previousCount = -1;
    let attempts = 0;

    while (attempts < 80) {
      abort();

      const current = collectVisibleCharacters();

      for (const [url, data] of current) {
        found.set(url, data);
      }

      paint(`캐릭터 수집 중 · ${found.size}명 발견`);

      if (found.size === previousCount) {
        stableCount += 1;
      } else {
        stableCount = 0;
      }

      previousCount = found.size;

      /*
       * 같은 개수가 여러 번 반복되고
       * 페이지 끝에 도달했다면 종료
       */
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 100;

      if (nearBottom && stableCount >= 4) {
        break;
      }

      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "instant",
      });

      await sleep(900);

      attempts += 1;
    }

    /*
     * 마지막으로 한 번 더 수집
     */
    const last = collectVisibleCharacters();

    for (const [url, data] of last) {
      found.set(url, data);
    }

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });

    await sleep(500);

    return [...found.values()];
  };

  /* =========================================================
   * 프로필 메뉴
   * ======================================================= */

  const exactButton = (text) =>
    [...document.querySelectorAll("button")].find(
      (button) =>
        visible(button) &&
        !button.disabled &&
        normalize(button.innerText || button.textContent) === text,
    ) || null;

  const privateSnapshotButton = () => {
    /*
     * 기존 제타 비캐 메뉴에서 사용되던 ID
     */
    const byId = document.querySelector("#create-private-snapshot");

    if (byId && visible(byId) && !byId.disabled) {
      return byId;
    }

    /*
     * ID가 바뀌었을 경우 텍스트로 보조 탐색
     */
    const candidates = [
      ...document.querySelectorAll('button, [role="menuitem"]'),
    ];

    return (
      candidates.find((el) => {
        if (!visible(el)) return false;

        const text = normalize(el.innerText || el.textContent);

        return text === "비공개로 전환" || text.includes("비공개로 전환");
      }) || null
    );
  };

  const confirmButton = () => exactButton("전환");

  /*
   * 점 3개 버튼 찾기
   */

  const profileMenuButton = () => {
    /*
     * aria-label이 존재하면 우선 사용
     */
    const ariaSelectors = [
      'button[aria-label="More"]',
      'button[aria-label="더보기"]',
      'button[aria-label="More options"]',
    ];

    for (const selector of ariaSelectors) {
      const el = document.querySelector(selector);

      if (el && visible(el) && !el.disabled) {
        return el;
      }
    }

    /*
     * 화면 상단의 SVG 버튼 중 점 3개 형태 추정
     */
    const buttons = [...document.querySelectorAll("button")].filter(
      (button) => {
        if (!visible(button) || button.disabled) {
          return false;
        }

        if (button.closest('[role="dialog"], [role="menu"]')) {
          return false;
        }

        const svg = button.querySelector("svg");

        if (!svg) return false;

        const text = normalize(button.innerText || button.textContent);

        /*
         * 텍스트 버튼은 제외
         */
        if (text.length > 2) return false;

        return true;
      },
    );

    /*
     * 오른쪽 위에 있는 버튼을 우선
     */
    buttons.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();

      return ar.top - br.top || br.right - ar.right;
    });

    /*
     * 후보 중 뒤로가기 버튼 등을 피하기 위해
     * 오른쪽 절반 버튼 우선
     */
    const rightSide = buttons.find((button) => {
      const rect = button.getBoundingClientRect();

      return rect.left > window.innerWidth / 2;
    });

    return rightSide || null;
  };

  /* =========================================================
   * SPA 이동
   * ======================================================= */

  const navigate = async (url, label = "페이지 이동") => {
    abort();

    const target = new URL(url, location.origin);

    /*
     * Next.js SPA 라우팅을 살리기 위해
     * 실제 링크가 있으면 클릭
     */
    const matchingLink = [...document.querySelectorAll("a[href]")].find((a) => {
      try {
        return new URL(a.href, location.origin).href === target.href;
      } catch (_) {
        return false;
      }
    });

    if (matchingLink && visible(matchingLink)) {
      matchingLink.click();
    } else {
      /*
       * 현재 DOM에 링크가 없으면 location 이동
       */
      location.href = target.href;
    }

    await waitFor(
      () => location.pathname === target.pathname,
      label,
      45000,
      200,
    );

    await sleep(800);
  };

  /* =========================================================
   * 새 비공개 방 생성
   * ======================================================= */

  const waitForRoomChange = async (profileRoute, timeout = 12000) => {
    const end = Date.now() + timeout;

    while (Date.now() < end) {
      abort();

      if (routeKey() !== profileRoute) {
        return true;
      }

      /*
       * 확인 버튼이 남아 있으면
       * 한 번 더 누름
       */
      const confirm = confirmButton();

      if (confirm) {
        await clickElement(confirm, "전환 확인");

        await sleep(600);
      }

      await sleep(200);
    }

    throw new Error("비공개 방으로 이동하지 않았습니다.");
  };

  const openProfileMenu = async () => {
    if (privateSnapshotButton()) {
      return;
    }

    const button = await waitFor(
      profileMenuButton,
      "프로필 점 3개 메뉴",
      25000,
    );

    await clickElement(button, "프로필 점 3개 메뉴");

    await waitFor(privateSnapshotButton, "비공개로 전환 메뉴", 15000);
  };

  const createPrivateRoom = async (character, characterIndex, repeatIndex) => {
    abort();

    const prefix =
      `[${characterIndex + 1}/${state.characters.length}] ` +
      `${character.name} · ${repeatIndex + 1}/${state.repeat}`;

    /*
     * 캐릭터 프로필로 이동
     */
    if (location.href !== character.url || !isProfilePage()) {
      paint(`${prefix} · 프로필 이동`);

      await navigate(character.url, "캐릭터 프로필 이동");
    }

    await waitFor(profileMenuButton, "캐릭터 프로필 로딩", 30000);

    await sleep(500);

    const profileRoute = routeKey();

    paint(`${prefix} · 메뉴 열기`);

    await openProfileMenu();

    paint(`${prefix} · 비공개로 전환`);

    const privateButton = await waitFor(
      privateSnapshotButton,
      "비공개로 전환 메뉴",
      15000,
    );

    await clickElement(privateButton, "비공개로 전환");

    paint(`${prefix} · 전환 확인`);

    const confirm = await waitFor(confirmButton, "전환 확인창", 15000);

    await clickElement(confirm, "전환");

    paint(`${prefix} · 비공개 방 생성 확인`);

    await waitForRoomChange(profileRoute, 12000);

    await sleep(700);

    /*
     * 새 비공개 방 → 원본 프로필 복귀
     *
     * URL을 직접 이용하므로 history 스택에
     * 의존하지 않음.
     */
    paint(`${prefix} · 프로필 복귀`);

    await navigate(character.url, "원본 캐릭터 프로필 복귀");

    await waitFor(profileMenuButton, "원본 프로필 로딩", 30000);

    await sleep(500);
  };

  /* =========================================================
   * UI
   * ======================================================= */

  document.getElementById(PANEL_ID)?.remove();

  const host = document.createElement("div");

  host.id = PANEL_ID;

  document.body.appendChild(host);

  const shadow = host.attachShadow({
    mode: "open",
  });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      * {
        box-sizing: border-box;
      }

      .panel {
        position: fixed;
        right: 14px;
        bottom: 18px;
        z-index: 2147483647;

        width: 260px;
        padding: 14px;

        border: 1px solid rgba(255,255,255,.12);
        border-radius: 16px;

        background: rgba(25,25,31,.96);
        color: white;

        box-shadow:
          0 12px 35px rgba(0,0,0,.35);

        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Noto Sans KR",
          sans-serif;
      }

      .title {
        font-size: 13px;
        font-weight: 800;
      }

      .count {
        margin-top: 6px;

        color: #d9d4ff;

        font-size: 12px;
        font-weight: 700;
      }

      .bar {
        height: 5px;

        margin-top: 11px;

        overflow: hidden;

        border-radius: 999px;

        background:
          rgba(255,255,255,.1);
      }

      .fill {
        width: 100%;
        height: 100%;

        transform: scaleX(0);
        transform-origin: left;

        background: #9688f6;

        transition:
          transform .25s ease;
      }

      .status {
        min-height: 36px;

        margin-top: 10px;

        color: #c5c3cc;

        font-size: 11px;
        line-height: 1.5;

        word-break: keep-all;
      }

      button {
        width: 100%;
        height: 34px;

        margin-top: 9px;

        border: 0;
        border-radius: 9px;

        background: #383842;
        color: white;

        font-size: 11px;
        font-weight: 700;

        cursor: pointer;
      }

      button:hover {
        background: #44444f;
      }
    </style>

    <div class="panel">

      <div class="title">
        제작자 비캐 일괄 저장기
      </div>

      <div class="count">
        준비 중
      </div>

      <div class="bar">
        <div class="fill"></div>
      </div>

      <div class="status">
        제작자 페이지 확인 중...
      </div>

      <button class="stop">
        중지
      </button>

    </div>
  `;

  const countEl = shadow.querySelector(".count");

  const fillEl = shadow.querySelector(".fill");

  const statusEl = shadow.querySelector(".status");

  const stopButton = shadow.querySelector(".stop");

  /* =========================================================
   * 상태
   * ======================================================= */

  const state = {
    running: true,

    creatorUrl: location.href,

    repeat: 0,

    characters: [],

    totalJobs: 0,

    done: 0,

    success: 0,

    failed: 0,

    failures: [],
  };

  window[APP_KEY] = state;

  const paint = (text) => {
    statusEl.textContent = text;

    if (state.totalJobs > 0) {
      countEl.textContent = `${state.done} / ${state.totalJobs}`;

      fillEl.style.transform = `scaleX(${Math.min(
        state.done / state.totalJobs,
        1,
      )})`;
    }
  };

  const finish = (text) => {
    state.running = false;

    statusEl.textContent = text;

    stopButton.textContent = "닫기";

    if (state.totalJobs > 0) {
      countEl.textContent = `${state.done} / ${state.totalJobs}`;

      fillEl.style.transform = `scaleX(${Math.min(
        state.done / state.totalJobs,
        1,
      )})`;
    }
  };

  stopButton.onclick = () => {
    if (state.running) {
      state.running = false;

      statusEl.textContent = "중지하는 중...";

      stopButton.textContent = "닫기";
    } else {
      host.remove();

      if (window[APP_KEY] === state) {
        delete window[APP_KEY];
      }
    }
  };

  /* =========================================================
   * 실행
   * ======================================================= */

  (async () => {
    try {
      /*
       * 제작자 페이지에 카드가 있는지 확인
       */
      const firstCard = await waitFor(
        () =>
          document.querySelector('[data-sentry-component="FrameProfileCard"]'),
        "제작자 캐릭터 목록",
        15000,
      );

      if (!firstCard) {
        throw new Error("제작자 페이지에서 실행해주세요.");
      }

      /*
       * 반복 횟수 입력
       */
      const raw = prompt("각 캐릭터를 몇 번씩 비공개로 저장할까요?", "2");

      if (raw === null) {
        finish("취소했습니다.");
        return;
      }

      const repeat = Number(raw);

      if (!Number.isInteger(repeat) || repeat < 1) {
        throw new Error("1 이상의 정수를 입력해주세요.");
      }

      state.repeat = repeat;

      /*
       * 전체 캐릭터 수집
       */
      state.characters = await collectAllCharacters();

      if (state.characters.length === 0) {
        throw new Error("캐릭터를 찾지 못했습니다.");
      }

      state.totalJobs = state.characters.length * state.repeat;

      countEl.textContent = `0 / ${state.totalJobs}`;

      paint(
        `${state.characters.length}명 발견 · ` +
          `각 ${state.repeat}회 · ` +
          `총 ${state.totalJobs}개`,
      );

      await sleep(1200);

      /*
       * 캐릭터 순회
       */
      for (
        let characterIndex = 0;
        characterIndex < state.characters.length;
        characterIndex += 1
      ) {
        abort();

        const character = state.characters[characterIndex];

        /*
         * 같은 캐릭터를 N회 반복
         */
        for (
          let repeatIndex = 0;
          repeatIndex < state.repeat;
          repeatIndex += 1
        ) {
          abort();

          try {
            await createPrivateRoom(character, characterIndex, repeatIndex);

            state.success += 1;
          } catch (error) {
            if (error?.message === "__STOP__") {
              throw error;
            }

            console.error("[ZETA 제작자 비캐 저장기]", character, error);

            state.failed += 1;

            state.failures.push({
              character: character.name,

              repeat: repeatIndex + 1,

              message: error?.message || String(error),
            });

            /*
             * 한 캐릭터에서 오류가 나도
             * 전체 작업은 계속 진행
             */
            try {
              if (location.href !== character.url) {
                await navigate(character.url, "오류 후 프로필 복귀");
              }
            } catch (_) {}
          }

          state.done += 1;

          paint(
            `[${characterIndex + 1}/${state.characters.length}] ` +
              `${character.name} · ` +
              `${repeatIndex + 1}/${state.repeat} 완료`,
          );

          await sleep(700);
        }
      }

      /*
       * 작업이 끝나면 제작자 페이지 복귀
       */
      try {
        paint("작업 완료 · 제작자 페이지로 돌아가는 중");

        await navigate(state.creatorUrl, "제작자 페이지 복귀");
      } catch (_) {}

      if (state.failed === 0) {
        finish(
          `완료 · ${state.characters.length}명 × ` +
            `${state.repeat}회 = ` +
            `${state.success}개 생성`,
        );
      } else {
        finish(`완료 · 성공 ${state.success}개 / ` + `실패 ${state.failed}개`);

        console.table(state.failures);
      }
    } catch (error) {
      if (error?.message === "__STOP__") {
        finish(`중지 · 성공 ${state.success}개 / ` + `실패 ${state.failed}개`);

        return;
      }

      console.error("[ZETA 제작자 비캐 저장기]", error);

      finish(`중단 · ${error?.message || String(error)}`);
    }
  })();
})();
