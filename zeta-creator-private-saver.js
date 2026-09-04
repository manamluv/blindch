(() => {
  'use strict';

  const APP_KEY = '__ZETA_CREATOR_SELECT_PRIVATE_SAVER_V1__';
  const PANEL_ID = '__zeta_creator_select_private_saver_panel__';
  const SELECT_CLASS = '__zeta_private_select_button__';

  const CARD_SELECTOR =
    '[data-sentry-component="FrameProfileCard"]';

  const PROFILE_LINK_SELECTOR =
    'a[href*="/plots/"][href*="/profile"]';

  /* ========================================================
   * 중복 실행
   * ====================================================== */

  const previous = window[APP_KEY];

  if (previous?.running) {
    previous.stop?.();
    return;
  }

  document.getElementById(PANEL_ID)?.remove();

  document
    .querySelectorAll(`.${SELECT_CLASS}`)
    .forEach((el) => el.remove());

  /* ========================================================
   * 기본 함수
   * ====================================================== */

  const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const normalize = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizePath = (value) =>
    (value || '').replace(/\/+$/, '');

  const currentPath = () =>
    normalizePath(location.pathname);

  const routeKey = () =>
    `${location.pathname}${location.search}${location.hash}`;

  const pathOf = (url) => {
    try {
      return normalizePath(
        new URL(url, location.origin).pathname
      );
    } catch (_) {
      return '';
    }
  };

  const visible = (element) => {
    if (!element || !element.isConnected) return false;

    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    );
  };

  /* ========================================================
   * 상태
   * ====================================================== */

  const state = {
    running: true,
    mode: 'select',

    creatorUrl: location.href,
    creatorPath: currentPath(),

    selected: new Map(),

    repeat: 0,
    total: 0,
    done: 0,

    observer: null,

    stop: null
  };

  window[APP_KEY] = state;

  const abort = () => {
    if (!state.running) {
      throw new Error('__STOP__');
    }
  };

  /* ========================================================
   * UI
   * ====================================================== */

  const host = document.createElement('div');
  host.id = PANEL_ID;

  document.body.appendChild(host);

  const shadow = host.attachShadow({
    mode: 'open'
  });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      .panel {
        position: fixed;
        right: 14px;
        bottom: 18px;
        z-index: 2147483647;

        width: min(280px, calc(100vw - 28px));
        padding: 14px;

        border: 1px solid rgba(255,255,255,.13);
        border-radius: 15px;

        background: rgba(25,24,30,.97);
        color: white;

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

      .status {
        min-height: 38px;
        margin-top: 9px;

        color: #cbc8d2;

        font-size: 11px;
        line-height: 1.55;

        word-break: keep-all;
      }

      .bar {
        display: none;

        height: 6px;
        margin-top: 10px;

        overflow: hidden;
        border-radius: 999px;

        background: rgba(255,255,255,.1);
      }

      .fill {
        width: 100%;
        height: 100%;

        transform: scaleX(0);
        transform-origin: left;

        background: #9688f6;

        transition: transform .2s ease;
      }

      .buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 7px;

        margin-top: 10px;
      }

      button {
        min-height: 34px;

        padding: 7px 8px;

        border: 0;
        border-radius: 9px;

        background: #3b3a44;
        color: white;

        font-size: 11px;
        font-weight: 700;

        cursor: pointer;
      }

      button:hover {
        background: #494852;
      }

      .start {
        grid-column: 1 / -1;
        background: #7667e8;
      }

      .start:hover {
        background: #8274ef;
      }

      .stop {
        grid-column: 1 / -1;
      }

      button:disabled {
        opacity: .45;
        cursor: default;
      }
    </style>

    <div class="panel">

      <div class="title">
        선택 비캐 저장기
      </div>

      <div class="count">
        선택됨 0명
      </div>

      <div class="bar">
        <div class="fill"></div>
      </div>

      <div class="status">
        저장할 캐릭터의 체크 버튼을 눌러주세요.
        아래로 스크롤하면 새 카드에도 체크 버튼이 생깁니다.
      </div>

      <div class="buttons">

        <button class="select-visible">
          현재 화면 전체 선택
        </button>

        <button class="clear">
          선택 해제
        </button>

        <button class="start">
          선택한 캐릭터 저장
        </button>

        <button class="stop">
          닫기
        </button>

      </div>

    </div>
  `;

  const countEl =
    shadow.querySelector('.count');

  const statusEl =
    shadow.querySelector('.status');

  const barEl =
    shadow.querySelector('.bar');

  const fillEl =
    shadow.querySelector('.fill');

  const selectVisibleButton =
    shadow.querySelector('.select-visible');

  const clearButton =
    shadow.querySelector('.clear');

  const startButton =
    shadow.querySelector('.start');

  const stopButton =
    shadow.querySelector('.stop');

  const paint = (message) => {
    statusEl.textContent = message;

    if (state.mode === 'select') {
      countEl.textContent =
        `선택됨 ${state.selected.size}명`;
    } else {
      countEl.textContent =
        `${state.done} / ${state.total}`;

      if (state.total > 0) {
        fillEl.style.transform =
          `scaleX(${Math.min(
            state.done / state.total,
            1
          )})`;
      }
    }
  };

  const refreshSelectionUI = () => {
    if (state.mode !== 'select') return;

    countEl.textContent =
      `선택됨 ${state.selected.size}명`;

    startButton.disabled =
      state.selected.size === 0;

    document
      .querySelectorAll(`.${SELECT_CLASS}`)
      .forEach((button) => {
        const path = button.dataset.profilePath;

        const selected =
          state.selected.has(path);

        button.dataset.selected =
          String(selected);

        button.textContent =
          selected ? '✓' : '';
      });
  };

  /* ========================================================
   * 카드 정보
   * ====================================================== */

  const characterFromCard = (card) => {
    const links = [
      ...card.querySelectorAll(PROFILE_LINK_SELECTOR)
    ];

    const link = links.find((a) =>
      /\/plots\/[^/]+\/profile$/.test(
        pathOf(a.href)
      )
    );

    if (!link) return null;

    const titleNode =
      card.querySelector('span[title]');

    let name =
      normalize(
        titleNode?.getAttribute('title')
      );

    if (!name) {
      const image = card.querySelector('img[alt]');

      const alt =
        normalize(image?.getAttribute('alt'));

      if (alt) {
        name = alt.replace(
          /^.+?의\s+/,
          ''
        );
      }
    }

    if (!name) {
      name =
        normalize(card.innerText)
          .split('\n')[0] ||
        '이름 없는 캐릭터';
    }

    return {
      name,
      url: new URL(
        link.href,
        location.origin
      ).href,
      path: pathOf(link.href)
    };
  };

  /* ========================================================
   * 카드 체크 버튼
   * ====================================================== */

  const addSelectionButton = (card) => {
    if (
      card.querySelector(`.${SELECT_CLASS}`)
    ) {
      return;
    }

    const character =
      characterFromCard(card);

    if (!character) return;

    const style =
      getComputedStyle(card);

    if (style.position === 'static') {
      card.style.position = 'relative';
    }

    const button =
      document.createElement('button');

    button.className =
      SELECT_CLASS;

    button.type = 'button';

    button.dataset.profilePath =
      character.path;

    button.title =
      `${character.name} 선택`;

    Object.assign(
      button.style,
      {
        position: 'absolute',
        top: '7px',
        right: '7px',

        zIndex: '2147483000',

        width: '26px',
        height: '26px',

        minWidth: '26px',
        minHeight: '26px',

        margin: '0',
        padding: '0',

        display: 'grid',
        placeItems: 'center',

        border:
          '2px solid rgba(255,255,255,.95)',

        borderRadius: '7px',

        background:
          state.selected.has(character.path)
            ? '#7667e8'
            : 'rgba(20,20,24,.72)',

        color: '#fff',

        boxShadow:
          '0 2px 8px rgba(0,0,0,.35)',

        fontSize: '17px',
        fontWeight: '900',

        lineHeight: '1',

        cursor: 'pointer',

        userSelect: 'none',

        WebkitTapHighlightColor:
          'transparent'
      }
    );

    if (
      state.selected.has(
        character.path
      )
    ) {
      button.textContent = '✓';
      button.dataset.selected = 'true';
    } else {
      button.textContent = '';
      button.dataset.selected = 'false';
    }

    button.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (
          typeof event.stopImmediatePropagation ===
          'function'
        ) {
          event.stopImmediatePropagation();
        }

        if (state.mode !== 'select') {
          return;
        }

        if (
          state.selected.has(
            character.path
          )
        ) {
          state.selected.delete(
            character.path
          );
        } else {
          state.selected.set(
            character.path,
            character
          );
        }

        const selected =
          state.selected.has(
            character.path
          );

        button.textContent =
          selected ? '✓' : '';

        button.dataset.selected =
          String(selected);

        button.style.background =
          selected
            ? '#7667e8'
            : 'rgba(20,20,24,.72)';

        refreshSelectionUI();
      },

      true
    );

    card.appendChild(button);
  };

  const decorateCards = () => {
    if (state.mode !== 'select') return;

    document
      .querySelectorAll(CARD_SELECTOR)
      .forEach(addSelectionButton);

    refreshSelectionUI();
  };

  /*
   * 스크롤해서 새로운 카드가 DOM에 생겨도
   * 자동으로 체크 버튼을 붙인다.
   */

  state.observer =
    new MutationObserver(() => {
      if (state.mode !== 'select') return;

      requestAnimationFrame(
        decorateCards
      );
    });

  state.observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  decorateCards();

  /* ========================================================
   * 전체 선택 / 해제
   * ====================================================== */

  selectVisibleButton.onclick = () => {
    if (state.mode !== 'select') return;

    const cards =
      document.querySelectorAll(
        CARD_SELECTOR
      );

    let added = 0;

    for (const card of cards) {
      const character =
        characterFromCard(card);

      if (!character) continue;

      if (
        !state.selected.has(
          character.path
        )
      ) {
        state.selected.set(
          character.path,
          character
        );

        added += 1;
      }
    }

    refreshSelectionUI();

    paint(
      `${added}명 추가 선택 · 총 ${state.selected.size}명`
    );
  };

  clearButton.onclick = () => {
    if (state.mode !== 'select') return;

    state.selected.clear();

    document
      .querySelectorAll(`.${SELECT_CLASS}`)
      .forEach((button) => {
        button.textContent = '';
        button.dataset.selected = 'false';
        button.style.background =
          'rgba(20,20,24,.72)';
      });

    refreshSelectionUI();

    paint(
      '선택을 모두 해제했습니다.'
    );
  };

  /* ========================================================
   * 원본 1.5.1 클릭
   * ====================================================== */

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
            pointerType: 'mouse',
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
            pointerType: 'mouse',
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

  /* ========================================================
   * waitFor
   * ====================================================== */

  const waitFor = async (
    finder,
    label,
    timeout = 20000,
    interval = 150
  ) => {
    const end =
      Date.now() + timeout;

    while (Date.now() < end) {
      abort();

      try {
        const result = finder();

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

  /* ========================================================
   * 프로필 메뉴
   * 원본 1.5.1 방식
   * ====================================================== */

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

  const profileMenuButton = () => {
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
        hasVerticalDotsIcon(button)
    );

    candidates.sort(
      (left, right) => {
        const a =
          left.getBoundingClientRect();

        const b =
          right.getBoundingClientRect();

        return (
          a.top - b.top ||
          b.right - a.right
        );
      }
    );

    return candidates[0] || null;
  };

  /* ========================================================
   * historyBack
   * ====================================================== */

  const historyBack = (
    timeout = 45000
  ) =>
    new Promise(
      (resolve, reject) => {
        let finished = false;

        const beforeUrl =
          location.href;

        const beforeState =
          history.state;

        let timer;
        let poller;

        const complete = () => {
          if (finished) return;

          finished = true;

          clearTimeout(timer);
          clearInterval(poller);

          removeEventListener(
            'popstate',
            onPopState
          );

          resolve();
        };

        const onPopState = () =>
          complete();

        addEventListener(
          'popstate',
          onPopState,
          { once: true }
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
            if (finished) return;

            clearInterval(poller);

            removeEventListener(
              'popstate',
              onPopState
            );

            reject(
              new Error(
                '뒤로가기 시간 초과'
              )
            );
          }, timeout);
      }
    );

  /* ========================================================
   * 새 비캐 이동 확인
   * ====================================================== */

  const waitForNewRoom =
    async (
      profileRoute,
      jobIndex,
      attempt,
      timeout = 6000
    ) => {
      const startedAt =
        Date.now();

      let confirmRetries = 0;

      let nextConfirmRetry =
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
            nextConfirmRetry &&
          confirmRetries < 2
        ) {
          const confirm =
            confirmButton();

          if (confirm) {
            confirmRetries += 1;

            paint(
              `${jobIndex}/${state.total} · 전환 재확인`
            );

            await click(
              confirm,
              '전환'
            );

            nextConfirmRetry =
              Date.now() + 1200;
          }
        }

        await sleep(100);
      }

      throw new Error(
        '새 비공개 방 이동 시간 초과'
      );
    };

  /* ========================================================
   * 메뉴 열기
   *
   * 연속 저장 중 클릭이 한 번 씹혀도
   * 바로 전체 작업이 죽지 않도록 재시도.
   * ====================================================== */

  const openProfileMenu =
    async (jobIndex) => {
      if (
        privateSnapshotButton()
      ) {
        return;
      }

      const maxAttempts = 4;

      for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt += 1
      ) {
        abort();

        paint(
          `${jobIndex}/${state.total} · ` +
          `프로필 메뉴 열기` +
          (
            attempt > 1
              ? ` · 재시도 ${attempt}/${maxAttempts}`
              : ''
          )
        );

        if (attempt > 1) {
          document.dispatchEvent(
            new KeyboardEvent(
              'keydown',
              {
                key: 'Escape',
                code: 'Escape',
                bubbles: true,
                cancelable: true
              }
            )
          );

          await sleep(700);
        }

        const menu =
          await waitFor(
            profileMenuButton,
            '프로필의 점 3개 메뉴',
            15000
          );

        await click(
          menu,
          '프로필의 점 3개 메뉴'
        );

        const started =
          Date.now();

        while (
          Date.now() - started <
          7000
        ) {
          abort();

          if (
            privateSnapshotButton()
          ) {
            return;
          }

          await sleep(150);
        }

        await sleep(700);
      }

      throw new Error(
        '비공개로 전환 메뉴를 4회 열어봤지만 나타나지 않음'
      );
    };

  /* ========================================================
   * 1회 비캐 저장
   * ====================================================== */

  const convertAttempt =
    async (
      jobIndex,
      attempt,
      profileUrl
    ) => {
      const profileRoute =
        routeKey();

      const anchorId =
        `${Date.now()}_${jobIndex}_${attempt}`;

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
        `${jobIndex}/${state.total} · 비공개로 전환`
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
        `${jobIndex}/${state.total} · 전환 확인`
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
          error.retryNewRoom = true;
          error.anchorId = anchorId;
        }

        throw error;
      }

      await sleep(900);

      paint(
        `${jobIndex}/${state.total} · 프로필 복귀`
      );

      await historyBack();

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

      await sleep(1000);
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
            !error?.retryNewRoom
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

              '재시도 전 프로필 복귀',

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
            `저장 재시도 ${attempt + 1}/${maxAttempts}`
          );

          await sleep(1000);
        }
      }
    };

  /* ========================================================
   * 제작자 페이지에서 선택 캐릭터 카드 찾기
   *
   * 선택 당시 카드가 DOM에서 사라졌을 수 있으므로
   * 스크롤하면서 다시 찾는다.
   * ====================================================== */

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

  const findScrollableAncestors =
    () => {
      const results = [];

      const cards =
        document.querySelectorAll(
          CARD_SELECTOR
        );

      const firstCard =
        cards[0];

      let current =
        firstCard?.parentElement;

      while (current) {
        const style =
          getComputedStyle(current);

        if (
          /auto|scroll/.test(
            style.overflowY
          ) &&
          current.scrollHeight >
            current.clientHeight + 50
        ) {
          results.push(current);
        }

        current =
          current.parentElement;
      }

      if (
        document.scrollingElement
      ) {
        results.push(
          document.scrollingElement
        );
      }

      return [
        ...new Set(results)
      ];
    };

  const scrollToTop = (
    scrollers
  ) => {
    for (const scroller of scrollers) {
      if (
        scroller ===
        document.scrollingElement
      ) {
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        });
      } else {
        scroller.scrollTop = 0;
      }
    }
  };

  const scrollFurther = (
    scrollers
  ) => {
    for (const scroller of scrollers) {
      if (
        scroller ===
        document.scrollingElement
      ) {
        window.scrollBy({
          top: Math.max(
            window.innerHeight * .7,
            450
          ),
          behavior: 'instant'
        });
      } else {
        scroller.scrollTop +=
          Math.max(
            scroller.clientHeight * .7,
            450
          );

        scroller.dispatchEvent(
          new Event('scroll', {
            bubbles: true
          })
        );
      }
    }
  };

  const findCharacterLink =
    async (character) => {
      let existing =
        findCharacterLinkNow(
          character
        );

      if (existing) {
        return existing;
      }

      const scrollers =
        findScrollableAncestors();

      scrollToTop(scrollers);

      await sleep(700);

      for (
        let round = 0;
        round < 150;
        round += 1
      ) {
        abort();

        existing =
          findCharacterLinkNow(
            character
          );

        if (existing) {
          return existing;
        }

        scrollFurther(
          scrollers
        );

        await sleep(450);
      }

      throw new Error(
        `${character.name} 카드를 다시 찾지 못했습니다.`
      );
    };

  /* ========================================================
   * 제작자 → 캐릭터
   * ====================================================== */

  const openCharacter =
    async (
      character,
      index,
      totalCharacters
    ) => {
      await waitFor(
        () =>
          currentPath() ===
          state.creatorPath,

        '제작자 페이지',

        30000
      );

      paint(
        `[${index}/${totalCharacters}] ` +
        `${character.name} · 카드 찾는 중`
      );

      const link =
        await findCharacterLink(
          character
        );

      paint(
        `[${index}/${totalCharacters}] ` +
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

        `${character.name} 프로필`,

        30000
      );

      await sleep(800);
    };

  /* ========================================================
   * 프로필 → 제작자
   * ====================================================== */

  const backToCreator =
    async (
      character,
      index,
      totalCharacters
    ) => {
      paint(
        `[${index}/${totalCharacters}] ` +
        `${character.name} · 제작자 페이지 복귀`
      );

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

      await sleep(1000);
    };

  /* ========================================================
   * 선택 UI 제거
   * ====================================================== */

  const removeSelectionButtons =
    () => {
      document
        .querySelectorAll(
          `.${SELECT_CLASS}`
        )
        .forEach(
          (button) =>
            button.remove()
        );
    };

  /* ========================================================
   * 저장 시작
   * ====================================================== */

  startButton.onclick =
    async () => {
      if (
        state.mode !==
        'select'
      ) {
        return;
      }

      if (
        state.selected.size ===
        0
      ) {
        alert(
          '저장할 캐릭터를 먼저 선택해주세요.'
        );

        return;
      }

      const raw =
        prompt(
          `선택한 ${state.selected.size}명의 캐릭터를 각각 몇 번씩 저장할까요?`,
          '2'
        );

      if (raw === null) {
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
        alert(
          '1 이상의 정수를 입력해주세요.'
        );

        return;
      }

      /*
       * 선택 순서를 그대로 고정.
       * 이후 DOM이 바뀌어도 Map에 저장된
       * 이름/URL/path는 유지됨.
       */

      const characters = [
        ...state.selected.values()
      ];

      state.repeat =
        repeat;

      state.total =
        characters.length *
        repeat;

      state.done = 0;

      state.mode =
        'running';

      state.observer?.disconnect();

      removeSelectionButtons();

      selectVisibleButton.style.display =
        'none';

      clearButton.style.display =
        'none';

      startButton.style.display =
        'none';

      barEl.style.display =
        'block';

      stopButton.textContent =
        '중지';

      paint(
        `${characters.length}명 × ${repeat}회 · 저장 시작`
      );

      try {
        let jobIndex = 0;

        for (
          let characterIndex = 0;
          characterIndex <
            characters.length;
          characterIndex += 1
        ) {
          abort();

          const character =
            characters[
              characterIndex
            ];

          /*
           * 제작자 페이지
           * → 선택 캐릭터 프로필
           */

          await openCharacter(
            character,
            characterIndex + 1,
            characters.length
          );

          /*
           * 실제 ZETA가 표시하고 있는
           * 정확한 현재 URL 사용
           */

          const profileUrl =
            location.href;

          /*
           * 선택한 횟수만큼 같은
           * 캐릭터에서 연속 저장
           */

          for (
            let repeatIndex = 0;
            repeatIndex < repeat;
            repeatIndex += 1
          ) {
            abort();

            jobIndex += 1;

            paint(
              `[${characterIndex + 1}/${characters.length}] ` +
              `${character.name} · ` +
              `${repeatIndex + 1}/${repeat}회 저장`
            );

            await convertFromProfile(
              jobIndex,
              profileUrl
            );

            state.done =
              jobIndex;

            paint(
              `[${characterIndex + 1}/${characters.length}] ` +
              `${character.name} · ` +
              `${repeatIndex + 1}/${repeat}회 완료`
            );

            /*
             * 연속 작업 시 UI 반응이
             * 밀리는 것을 줄이기 위해
             * 기존보다 조금 여유를 둠.
             */

            await sleep(1500);
          }

          /*
           * 이 캐릭터가 전부 끝났을 때만
           * 제작자 페이지로 복귀
           */

          await backToCreator(
            character,
            characterIndex + 1,
            characters.length
          );
        }

        state.running = false;
        state.mode = 'done';

        countEl.textContent =
          `${state.done} / ${state.total}`;

        fillEl.style.transform =
          'scaleX(1)';

        statusEl.textContent =
          `완료 · ${characters.length}명 × ${repeat}회 = ${state.done}개`;

        stopButton.textContent =
          '닫기';

      } catch (error) {
        if (
          error?.message ===
          '__STOP__'
        ) {
          state.mode = 'done';

          statusEl.textContent =
            `중지됨 · ${state.done}/${state.total}`;

          stopButton.textContent =
            '닫기';

          return;
        }

        console.error(
          '[ZETA 선택 비캐 저장기]',
          error
        );

        state.running = false;
        state.mode = 'done';

        statusEl.textContent =
          `중단 · ${error?.message || error}`;

        stopButton.textContent =
          '닫기';
      }
    };

  /* ========================================================
   * 종료
   * ====================================================== */

  stopButton.onclick = () => {
    if (
      state.mode ===
      'running'
    ) {
      state.running = false;

      statusEl.textContent =
        '중지하는 중...';

      return;
    }

    state.running = false;

    state.observer?.disconnect();

    removeSelectionButtons();

    host.remove();

    if (
      window[APP_KEY] ===
      state
    ) {
      delete window[APP_KEY];
    }
  };

  refreshSelectionUI();

})();
