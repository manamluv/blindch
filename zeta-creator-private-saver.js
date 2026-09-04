(() => {
  'use strict';

  /*
   * ZETA Creator Private Saver
   *
   * 제작자 페이지
   * → 모든 캐릭터 수집
   * → 캐릭터 프로필 진입
   * → 기존 1.5.1 방식으로 N회 비캐 생성
   * → 제작자 페이지 복귀
   * → 다음 캐릭터
   */

  const APP_KEY =
    '__ZETA_CREATOR_PRIVATE_SAVER_V3__';

  const PANEL_ID =
    '__zeta_creator_private_saver_panel_v3__';

  const CARD_SELECTOR =
    '[data-sentry-component="FrameProfileCard"]';

  const PROFILE_LINK_SELECTOR =
    'a[href*="/plots/"][href*="/profile"]';

  /* =========================================================
   * 중복 실행 방지
   * ======================================================= */

  const oldState = window[APP_KEY];

  if (oldState?.running) {
    oldState.stop?.();
    return;
  }

  if (oldState) {
    delete window[APP_KEY];
  }

  /* =========================================================
   * 기본 함수
   * ======================================================= */

  const sleep = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  const normalize = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

  const visible = (element) => {
    if (
      !element ||
      !element.isConnected
    ) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    const style =
      getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    );
  };

  const pathOf = (url) => {
    try {
      return new URL(
        url,
        location.origin
      ).pathname.replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  };

  const currentPath = () =>
    location.pathname.replace(
      /\/+$/,
      ''
    );

  const routeKey = () =>
    `${location.pathname}${location.search}${location.hash}`;

  const isProfilePath = (path) =>
    /\/plots\/[^/]+\/profile$/.test(
      path || ''
    );

  /* =========================================================
   * 상태
   * ======================================================= */

  const state = {
    running: true,

    creatorUrl:
      location.href,

    creatorPath:
      currentPath(),

    repeat: 0,

    characters: [],

    total: 0,

    done: 0,

    success: 0,

    currentCharacter: 0,

    currentRepeat: 0,

    stop: null
  };

  window[APP_KEY] = state;

  const abort = () => {
    if (!state.running) {
      throw new Error('__STOP__');
    }
  };

  /* =========================================================
   * 패널
   * ======================================================= */

  document
    .getElementById(PANEL_ID)
    ?.remove();

  const host =
    document.createElement('div');

  host.id = PANEL_ID;

  document.body.appendChild(host);

  const shadow =
    host.attachShadow({
      mode: 'open'
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

        width: 275px;
        padding: 14px;

        border: 1px solid rgba(255,255,255,.13);
        border-radius: 15px;

        background: rgba(25,24,30,.97);
        color: #fff;

        box-shadow:
          0 12px 35px rgba(0,0,0,.4);

        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Noto Sans KR",
          sans-serif;
      }

      .title {
        font-size: 14px;
        font-weight: 800;
      }

      .count {
        margin-top: 7px;
        color: #d7d0ff;
        font-size: 12px;
        font-weight: 700;
      }

      .bar {
        height: 6px;
        margin-top: 10px;

        overflow: hidden;

        background:
          rgba(255,255,255,.1);

        border-radius: 999px;
      }

      .fill {
        width: 100%;
        height: 100%;

        transform: scaleX(0);
        transform-origin: left;

        background: #9688f6;

        transition:
          transform .2s ease;
      }

      .status {
        min-height: 42px;
        margin-top: 10px;

        color: #cbc8d2;

        font-size: 11px;
        line-height: 1.55;

        word-break: keep-all;
      }

      button {
        width: 100%;
        height: 34px;

        margin-top: 10px;

        border: 0;
        border-radius: 9px;

        background: #3b3a44;
        color: white;

        font-size: 11px;
        font-weight: 700;

        cursor: pointer;
      }

      button:hover {
        background: #484752;
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

  const countEl =
    shadow.querySelector(
      '.count'
    );

  const statusEl =
    shadow.querySelector(
      '.status'
    );

  const fillEl =
    shadow.querySelector(
      '.fill'
    );

  const stopButton =
    shadow.querySelector(
      '.stop'
    );

  const paint = (message) => {
    statusEl.textContent =
      message;

    if (state.total > 0) {
      countEl.textContent =
        `${state.done} / ${state.total}`;

      fillEl.style.transform =
        `scaleX(${Math.min(
          state.done /
            state.total,
          1
        )})`;
    }
  };

  const finish = (message) => {
    state.running = false;

    statusEl.textContent =
      message;

    stopButton.textContent =
      '닫기';

    if (state.total > 0) {
      countEl.textContent =
        `${state.done} / ${state.total}`;

      fillEl.style.transform =
        `scaleX(${Math.min(
          state.done /
            state.total,
          1
        )})`;
    }
  };

  state.stop = () => {
    state.running = false;
  };

  stopButton.onclick = () => {
    if (state.running) {
      state.running = false;

      statusEl.textContent =
        '중지하는 중...';

      stopButton.textContent =
        '닫기';

      return;
    }

    host.remove();

    if (
      window[APP_KEY] === state
    ) {
      delete window[APP_KEY];
    }
  };

  /* =========================================================
   * waitFor
   * ======================================================= */

  const waitFor = async (
    finder,
    label,
    timeout = 20000,
    interval = 150
  ) => {
    const started =
      Date.now();

    while (
      Date.now() - started <
      timeout
    ) {
      abort();

      try {
        const result =
          finder();

        if (result) {
          return result;
        }
      } catch (_) {}

      await sleep(interval);
    }

    throw new Error(
      `${label} 대기 시간 초과`
    );
  };

  /* =========================================================
   * 원본 1.5.1 방식 클릭
   * ======================================================= */

  const click = async (
    element,
    label
  ) => {
    abort();

    if (
      !element ||
      !element.isConnected ||
      element.disabled
    ) {
      throw new Error(
        `${label} 버튼을 누를 수 없음`
      );
    }

    try {
      element.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'instant'
      });
    } catch (_) {
      element.scrollIntoView({
        block: 'center',
        inline: 'center'
      });
    }

    await sleep(350);

    if (
      !element.isConnected ||
      element.disabled ||
      !visible(element)
    ) {
      throw new Error(
        `${label} 버튼이 화면에서 변경됨`
      );
    }

    try {
      element.focus({
        preventScroll: true
      });
    } catch (_) {
      element.focus();
    }

    const rect =
      element.getBoundingClientRect();

    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,

      clientX:
        rect.left +
        rect.width / 2,

      clientY:
        rect.top +
        rect.height / 2,

      button: 0
    };

    if (
      typeof PointerEvent ===
      'function'
    ) {
      element.dispatchEvent(
        new PointerEvent(
          'pointerdown',
          {
            ...eventOptions,

            pointerId: 1,
            pointerType:
              'mouse',

            isPrimary: true,
            buttons: 1
          }
        )
      );
    }

    element.dispatchEvent(
      new MouseEvent(
        'mousedown',
        {
          ...eventOptions,
          buttons: 1
        }
      )
    );

    if (
      typeof PointerEvent ===
      'function'
    ) {
      element.dispatchEvent(
        new PointerEvent(
          'pointerup',
          {
            ...eventOptions,

            pointerId: 1,
            pointerType:
              'mouse',

            isPrimary: true,
            buttons: 0
          }
        )
      );
    }

    element.dispatchEvent(
      new MouseEvent(
        'mouseup',
        {
          ...eventOptions,
          buttons: 0
        }
      )
    );

    element.click();

    await sleep(120);
  };

  /* =========================================================
   * 원본 1.5.1 프로필 버튼 탐색
   * ======================================================= */

  const exactButton = (
    wanted,
    root = document
  ) =>
    [
      ...root.querySelectorAll(
        'button'
      )
    ].find(
      (element) =>
        visible(element) &&
        !element.disabled &&
        normalize(
          element.innerText ||
            element.textContent
        ) === wanted
    ) || null;

  const privateSnapshotButton =
    () => {
      const element =
        document.querySelector(
          '#create-private-snapshot'
        );

      return (
        visible(element) &&
        !element.disabled
          ? element
          : null
      );
    };

  const confirmButton = () =>
    exactButton('전환');

  const compactPath = (path) =>
    (
      path.getAttribute('d') ||
      ''
    )
      .replace(/[\s,]/g, '')
      .toLowerCase();

  /*
   * 원본 1.5.1에서 사용하던
   * 세로 점 3개 SVG 판정 그대로.
   */
  const hasVerticalDotsIcon =
    (button) =>
      [
        ...button.querySelectorAll(
          'svg path'
        )
      ].some((path) => {
        const data =
          compactPath(path);

        return (
          data.includes(
            'm10.7512.5'
          ) &&
          data.includes(
            'm10.7519.5'
          ) &&
          data.includes(
            'm10.755.5'
          )
        );
      });

  const profileMenuButton =
    () => {
      const candidates = [
        ...document.querySelectorAll(
          'button'
        )
      ].filter(
        (button) =>
          visible(button) &&
          !button.disabled &&
          !button.closest(
            '[role="dialog"], [role="menu"]'
          ) &&
          hasVerticalDotsIcon(
            button
          )
      );

      candidates.sort(
        (left, right) => {
          const leftRect =
            left.getBoundingClientRect();

          const rightRect =
            right.getBoundingClientRect();

          return (
            leftRect.top -
              rightRect.top ||
            rightRect.right -
              leftRect.right
          );
        }
      );

      return (
        candidates[0] ||
        null
      );
    };

  /* =========================================================
   * 원본 1.5.1 historyBack
   * ======================================================= */

  const historyBack = (
    timeout = 45000
  ) =>
    new Promise(
      (resolve, reject) => {
        let finished = false;
        let timer = 0;
        let poller = 0;

        const beforeUrl =
          location.href;

        const beforeState =
          history.state;

        const complete = () => {
          if (finished) {
            return;
          }

          finished = true;

          clearTimeout(timer);
          clearInterval(poller);

          removeEventListener(
            'popstate',
            onPopState
          );

          resolve();
        };

        const onPopState =
          () => complete();

        addEventListener(
          'popstate',
          onPopState,
          {
            once: true
          }
        );

        history.back();

        poller =
          setInterval(() => {
            if (
              location.href !==
                beforeUrl ||
              history.state !==
                beforeState
            ) {
              complete();
            }
          }, 100);

        timer =
          setTimeout(() => {
            if (finished) {
              return;
            }

            clearInterval(
              poller
            );

            removeEventListener(
              'popstate',
              onPopState
            );

            reject(
              new Error(
                '히스토리 뒤로가기 시간 초과'
              )
            );
          }, timeout);
      }
    );

  /* =========================================================
   * 비캐 이동 확인
   * 원본 1.5.1 로직
   * ======================================================= */

  const waitForNewRoom =
    async (
      profileRoute,
      jobIndex,
      attempt,
      timeout = 5000
    ) => {
      const startedAt =
        Date.now();

      let shownSeconds = -1;

      let confirmRetries = 0;

      let nextConfirmRetryAt =
        startedAt + 1200;

      while (
        Date.now() - startedAt <
        timeout
      ) {
        abort();

        if (
          routeKey() !==
          profileRoute
        ) {
          return;
        }

        if (
          Date.now() >=
            nextConfirmRetryAt &&
          confirmRetries < 2
        ) {
          const pendingConfirm =
            confirmButton();

          if (pendingConfirm) {
            confirmRetries += 1;

            paint(
              `${jobIndex}/${state.total} · ` +
              `남아 있는 전환 버튼 다시 누르기 ` +
              `${confirmRetries}/2`
            );

            await click(
              pendingConfirm,
              '남아 있는 전환'
            );

            nextConfirmRetryAt =
              Date.now() +
              1200;

            continue;
          }
        }

        const remainingSeconds =
          Math.max(
            1,
            Math.ceil(
              (
                timeout -
                (
                  Date.now() -
                  startedAt
                )
              ) /
                1000
            )
          );

        if (
          remainingSeconds !==
          shownSeconds
        ) {
          shownSeconds =
            remainingSeconds;

          paint(
            `${jobIndex}/${state.total} · ` +
            `새 비공개 방 확인 중 ` +
            `${remainingSeconds}초` +
            (
              attempt > 1
                ? ` (${attempt}/4차 시도)`
                : ''
            )
          );
        }

        await sleep(100);
      }

      throw new Error(
        '새 비공개 방 이동 시간 초과'
      );
    };

  /* =========================================================
   * 프로필 메뉴 열기
   * 원본 1.5.1 방식
   * ======================================================= */

  const openProfileMenu =
    async (jobIndex) => {
      if (
        privateSnapshotButton()
      ) {
        return;
      }

      paint(
        `${jobIndex}/${state.total} · ` +
        `프로필 메뉴 열기`
      );

      const menuButton =
        await waitFor(
          profileMenuButton,
          '프로필의 점 3개 메뉴',
          30000
        );

      await click(
        menuButton,
        '프로필의 점 3개 메뉴'
      );

      await waitFor(
        privateSnapshotButton,
        '비공개로 전환 메뉴',
        20000
      );
    };

  /* =========================================================
   * ★ 핵심
   *
   * 원본 1.5.1의 convertAttempt 방식.
   *
   * profileUrl만 현재 작업 중인
   * 캐릭터 프로필 URL로 받음.
   * ======================================================= */

  const convertAttempt =
    async (
      jobIndex,
      attempt,
      profileUrl
    ) => {
      const profileRoute =
        routeKey();

      const anchorId =
        `${Date.now()}_` +
        `${jobIndex}_` +
        `${attempt}`;

      /*
       * 원본 1.5.1처럼
       * 같은 프로필 URL에
       * 히스토리 anchor 생성.
       */
      history.pushState(
        {
          ...(
            history.state &&
            typeof history.state ===
              'object'
              ? history.state
              : {}
          ),

          __zetaSavedProfile:
            anchorId
        },

        '',

        profileUrl
      );

      await openProfileMenu(
        jobIndex
      );

      paint(
        `${jobIndex}/${state.total} · ` +
        `비공개로 전환 선택`
      );

      await click(
        await waitFor(
          privateSnapshotButton,
          '비공개로 전환 메뉴',
          20000
        ),

        '비공개로 전환'
      );

      paint(
        `${jobIndex}/${state.total} · ` +
        `전환 확인`
      );

      await click(
        await waitFor(
          confirmButton,
          '전환 확인창',
          20000
        ),

        '전환'
      );

      try {
        await waitForNewRoom(
          profileRoute,
          jobIndex,
          attempt
        );
      } catch (error) {
        if (
          routeKey() ===
          profileRoute
        ) {
          error.retryNewRoom =
            true;

          error.anchorId =
            anchorId;
        }

        throw error;
      }

      await sleep(700);

      /*
       * 새 비캐
       * ↓
       * pushState로 만든 프로필 anchor
       */
      paint(
        `${jobIndex}/${state.total} · ` +
        `저장한 프로필로 복귀`
      );

      await historyBack();

      /*
       * 여기가 앞에서 우리가
       * 새로 만든 판정과 다른 부분.
       *
       * 원본 1.5.1의 조건 그대로:
       * - URL 동일
       * - route 동일
       * - 실제 점 3개 메뉴 존재
       */
      await waitFor(
        () =>
          location.href ===
            profileUrl &&
          routeKey() ===
            profileRoute &&
          profileMenuButton(),

        '저장한 프로필 복귀',

        45000
      );

      /*
       * pushState anchor에
       * 실제로 도착했다면
       * 한 번 더 뒤로 가서
       * 원래 프로필 history entry로 복귀.
       */
      if (
        history.state
          ?.__zetaSavedProfile ===
        anchorId
      ) {
        await historyBack();

        await waitFor(
          () =>
            location.href ===
              profileUrl &&
            profileMenuButton(),

          '저장한 프로필 원본 복귀',

          30000
        );
      }

      await sleep(700);
    };

  const convertFromProfile =
    async (
      jobIndex,
      profileUrl
    ) => {
      const maxAttempts = 4;

      for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt += 1
      ) {
        try {
          await convertAttempt(
            jobIndex,
            attempt,
            profileUrl
          );

          return;
        } catch (error) {
          if (
            !error
              ?.retryNewRoom
          ) {
            throw error;
          }

          if (
            history.state
              ?.__zetaSavedProfile ===
            error.anchorId
          ) {
            await historyBack(
              15000
            );

            await waitFor(
              () =>
                location.href ===
                  profileUrl &&
                profileMenuButton(),

              '재시도 전 저장한 프로필 복귀',

              20000
            );
          }

          if (
            attempt ===
            maxAttempts
          ) {
            throw new Error(
              '새 비공개 방으로 이동하지 않아 4회 시도 후 중단'
            );
          }

          paint(
            `${jobIndex}/${state.total} · ` +
            `이동 재시도 ` +
            `(${attempt + 1}/${maxAttempts})`
          );
        }
      }
    };

  /* =========================================================
   * 제작자 페이지 캐릭터 수집
   * ======================================================= */

  const characterFromCard =
    (card) => {
      const links = [
        ...card.querySelectorAll(
          PROFILE_LINK_SELECTOR
        )
      ];

      const link =
        links.find((element) =>
          isProfilePath(
            pathOf(element.href)
          )
        );

      if (!link) {
        return null;
      }

      const titleElement =
        card.querySelector(
          'span[title]'
        );

      const name =
        normalize(
          titleElement
            ?.getAttribute(
              'title'
            )
        ) ||
        normalize(
          card.innerText
        )
          .split('\n')[0] ||
        '이름 없는 캐릭터';

      return {
        name,

        url:
          new URL(
            link.href,
            location.origin
          ).href,

        path:
          pathOf(link.href)
      };
    };

  const collectCurrentCards =
    () => {
      const found =
        new Map();

      const cards =
        document.querySelectorAll(
          CARD_SELECTOR
        );

      for (
        const card of cards
      ) {
        const character =
          characterFromCard(
            card
          );

        if (!character) {
          continue;
        }

        found.set(
          character.path,
          character
        );
      }

      return found;
    };

  const collectAllCharacters =
    async () => {
      const found =
        new Map();

      let previousCount = -1;
      let stableCount = 0;
      let previousHeight = -1;
      let stableHeight = 0;

      paint(
        '캐릭터 목록 수집 중...'
      );

      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });

      await sleep(500);

      for (
        let round = 0;
        round < 100;
        round += 1
      ) {
        abort();

        const current =
          collectCurrentCards();

        for (
          const [
            path,
            character
          ] of current
        ) {
          found.set(
            path,
            character
          );
        }

        const height =
          document.documentElement
            .scrollHeight;

        if (
          found.size ===
          previousCount
        ) {
          stableCount += 1;
        } else {
          stableCount = 0;
        }

        if (
          height ===
          previousHeight
        ) {
          stableHeight += 1;
        } else {
          stableHeight = 0;
        }

        previousCount =
          found.size;

        previousHeight =
          height;

        paint(
          `캐릭터 목록 수집 중 · ` +
          `${found.size}명 발견`
        );

        const bottom =
          window.scrollY +
            window.innerHeight >=
          document.documentElement
            .scrollHeight -
            150;

        if (
          bottom &&
          stableCount >= 4 &&
          stableHeight >= 4
        ) {
          break;
        }

        window.scrollTo({
          top:
            document
              .documentElement
              .scrollHeight,

          behavior: 'instant'
        });

        await sleep(850);
      }

      /*
       * 마지막 렌더 후 재수집
       */
      const last =
        collectCurrentCards();

      for (
        const [
          path,
          character
        ] of last
      ) {
        found.set(
          path,
          character
        );
      }

      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });

      await sleep(700);

      return [
        ...found.values()
      ];
    };

  /* =========================================================
   * 제작자 페이지에서 특정 카드 찾기
   * ======================================================= */

  const findCharacterLinkNow =
    (character) =>
      [
        ...document.querySelectorAll(
          PROFILE_LINK_SELECTOR
        )
      ].find(
        (link) =>
          pathOf(link.href) ===
          character.path
      ) || null;

  const findCharacterLink =
    async (character) => {
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });

      await sleep(400);

      let previousHeight = -1;
      let sameHeight = 0;

      for (
        let round = 0;
        round < 100;
        round += 1
      ) {
        abort();

        const existing =
          findCharacterLinkNow(
            character
          );

        if (existing) {
          return existing;
        }

        const height =
          document.documentElement
            .scrollHeight;

        if (
          height ===
          previousHeight
        ) {
          sameHeight += 1;
        } else {
          sameHeight = 0;
        }

        previousHeight =
          height;

        window.scrollTo({
          top:
            document
              .documentElement
              .scrollHeight,

          behavior: 'instant'
        });

        await sleep(700);

        const found =
          findCharacterLinkNow(
            character
          );

        if (found) {
          return found;
        }

        if (
          sameHeight >= 6
        ) {
          break;
        }
      }

      throw new Error(
        `${character.name}의 프로필 카드를 찾지 못했습니다.`
      );
    };

  /* =========================================================
   * 제작자 → 캐릭터 프로필
   * ======================================================= */

  const openCharacter =
    async (
      character,
      characterIndex
    ) => {
      abort();

      if (
        currentPath() ===
        character.path
      ) {
        return;
      }

      /*
       * 반드시 제작자 페이지에서
       * 실제 카드 링크를 클릭.
       * location.href 사용하지 않음.
       */
      await waitFor(
        () =>
          currentPath() ===
            state.creatorPath &&
          document.querySelector(
            CARD_SELECTOR
          ),

        '제작자 페이지 준비',

        30000
      );

      paint(
        `[${characterIndex + 1}/${state.characters.length}] ` +
        `${character.name} · 카드 찾는 중`
      );

      const link =
        await findCharacterLink(
          character
        );

      paint(
        `[${characterIndex + 1}/${state.characters.length}] ` +
        `${character.name} · 프로필 이동`
      );

      await click(
        link,
        `${character.name} 프로필`
      );

      await waitFor(
        () =>
          currentPath() ===
            character.path &&
          profileMenuButton(),

        `${character.name} 프로필 로딩`,

        30000
      );

      await sleep(700);
    };

  /* =========================================================
   * 캐릭터 프로필 → 제작자 페이지
   * ======================================================= */

  const backToCreator =
    async (
      character,
      characterIndex
    ) => {
      paint(
        `[${characterIndex + 1}/${state.characters.length}] ` +
        `${character.name} · 제작자 페이지 복귀`
      );

      /*
       * 이제 현재 history entry는
       * 원본 캐릭터 프로필.
       *
       * 비캐 저장 과정에서 만든
       * anchor는 이미 1.5.1 방식으로
       * 제거된 상태이므로
       * 여기서 한 번만 back.
       */
      await historyBack();

      await waitFor(
        () =>
          currentPath() ===
            state.creatorPath &&
          document.querySelector(
            CARD_SELECTOR
          ),

        '제작자 페이지 복귀',

        45000
      );

      await sleep(700);
    };

  /* =========================================================
   * 실행
   * ======================================================= */

  (async () => {
    try {
      /*
       * 제작자 페이지 확인
       */
      await waitFor(
        () =>
          document.querySelector(
            CARD_SELECTOR
          ),

        '제작자 캐릭터 카드',

        15000
      );

      const raw =
        prompt(
          '각 캐릭터를 몇 번씩 비공개로 저장할까요?\n\n예: 2 → 모든 캐릭터를 각각 2번 저장',
          '2'
        );

      if (raw === null) {
        finish(
          '취소했습니다.'
        );

        return;
      }

      const repeat =
        Number(raw);

      if (
        !Number.isInteger(
          repeat
        ) ||
        repeat < 1
      ) {
        throw new Error(
          '1 이상의 정수를 입력해주세요.'
        );
      }

      state.repeat =
        repeat;

      /*
       * 제작자 캐릭터 전체 수집
       */
      state.characters =
        await collectAllCharacters();

      if (
        state.characters
          .length === 0
      ) {
        throw new Error(
          '캐릭터를 찾지 못했습니다.'
        );
      }

      state.total =
        state.characters.length *
        state.repeat;

      countEl.textContent =
        `0 / ${state.total}`;

      paint(
        `${state.characters.length}명 발견 · ` +
        `각 ${state.repeat}회 · ` +
        `총 ${state.total}개`
      );

      await sleep(1200);

      let jobIndex = 0;

      /*
       * 캐릭터 순회
       */
      for (
        let characterIndex = 0;
        characterIndex <
          state.characters.length;
        characterIndex += 1
      ) {
        abort();

        const character =
          state.characters[
            characterIndex
          ];

        state.currentCharacter =
          characterIndex;

        /*
         * 제작자 → 프로필
         *
         * 같은 캐릭터의 반복 작업은
         * 프로필에 머문 상태로 연속 실행한다.
         */
        await openCharacter(
          character,
          characterIndex
        );

        /*
         * SPA가 URL의 표현을 조금
         * 바꿀 수도 있으므로
         * 실제 현재 URL을 저장.
         */
        const profileUrl =
          location.href;

        for (
          let repeatIndex = 0;
          repeatIndex <
            state.repeat;
          repeatIndex += 1
        ) {
          abort();

          jobIndex += 1;

          state.currentRepeat =
            repeatIndex;

          paint(
            `[${characterIndex + 1}/${state.characters.length}] ` +
            `${character.name} · ` +
            `${repeatIndex + 1}/${state.repeat}회 시작`
          );

          /*
           * 여기부터는 기존 1.5.1의
           * 검증된 프로필 반복 저장 로직.
           */
          await convertFromProfile(
            jobIndex,
            profileUrl
          );

          state.done =
            jobIndex;

          state.success =
            jobIndex;

          paint(
            `[${characterIndex + 1}/${state.characters.length}] ` +
            `${character.name} · ` +
            `${repeatIndex + 1}/${state.repeat}회 완료`
          );

          await sleep(800);
        }

        /*
         * 이 캐릭터의 N회가
         * 모두 끝난 뒤에만
         * 제작자 페이지로 복귀.
         *
         * 예: 2회라면
         *
         * 캐릭터 A
         *   → 저장
         *   → 프로필
         *   → 저장
         *   → 프로필
         *   → 제작자
         *
         * 이렇게 움직인다.
         */
        await backToCreator(
          character,
          characterIndex
        );
      }

      finish(
        `완료 · ` +
        `${state.characters.length}명 × ` +
        `${state.repeat}회 = ` +
        `${state.success}개`
      );
    } catch (error) {
      if (
        error?.message ===
        '__STOP__'
      ) {
        finish(
          `중지됨 · ` +
          `${state.done}/${state.total}`
        );

        return;
      }

      console.error(
        '[ZETA 제작자 비캐 저장기 V3]',
        error
      );

      finish(
        `중단 · ` +
        `${error?.message || error}`
      );
    }
  })();
})();
