(() => {
  'use strict';

  const APP_KEY = '__ZETA_CREATOR_PRIVATE_SAVER_V2_1__';
  const PANEL_ID = '__zeta_creator_private_saver_panel_v2_1__';

  if (window[APP_KEY]?.running) {
    alert('제작자 비캐 저장기가 이미 실행 중입니다.');
    return;
  }

  const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const text = (value) =>
    (value || '').replace(/\s+/g, ' ').trim();

  const visible = (el) => {
    if (!el || !el.isConnected) return false;

    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    );
  };

  const absoluteUrl = (url) => {
    try {
      return new URL(url, location.origin).href;
    } catch {
      return '';
    }
  };

  const pathnameOf = (url) => {
    try {
      return new URL(url, location.origin)
        .pathname
        .replace(/\/+$/, '');
    } catch {
      return '';
    }
  };

  const currentPath = () =>
    location.pathname.replace(/\/+$/, '');

  const routeKey = () =>
    location.pathname +
    location.search +
    location.hash;

  const isProfilePath = (path) =>
    /\/plots\/[^/]+\/profile$/.test(
      path.replace(/\/+$/, '')
    );

  const isProfilePage = () =>
    isProfilePath(currentPath());

  /* =====================================================
   * UI
   * =================================================== */

  document.getElementById(PANEL_ID)?.remove();

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

      * {
        box-sizing: border-box;
      }

      .panel {
        position: fixed;
        right: 16px;
        bottom: 18px;
        z-index: 2147483647;

        width: 280px;
        padding: 15px;

        border: 1px solid rgba(255,255,255,.12);
        border-radius: 16px;

        background: rgba(24,24,29,.97);
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
        color: #d8d1ff;
        font-size: 12px;
        font-weight: 700;
      }

      .bar {
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

      .status {
        min-height: 42px;
        margin-top: 10px;
        color: #ccc9d5;
        font-size: 11px;
        line-height: 1.55;
        word-break: keep-all;
      }

      button {
        width: 100%;
        height: 35px;
        margin-top: 10px;
        border: 0;
        border-radius: 9px;
        background: #3b3b45;
        color: white;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }

      button:hover {
        background: #484853;
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
    shadow.querySelector('.count');

  const fillEl =
    shadow.querySelector('.fill');

  const statusEl =
    shadow.querySelector('.status');

  const stopButton =
    shadow.querySelector('.stop');

  const state = {
    running: true,

    creatorUrl: location.href,
    creatorPath: currentPath(),

    repeat: 0,
    characters: [],

    total: 0,
    done: 0,
    success: 0,
    failed: 0,

    failures: []
  };

  window[APP_KEY] = state;

  const paint = (message) => {
    statusEl.textContent = message;

    if (state.total > 0) {
      countEl.textContent =
        `${state.done} / ${state.total}`;

      fillEl.style.transform =
        `scaleX(${Math.min(
          state.done / state.total,
          1
        )})`;
    }
  };

  const finish = (message) => {
    state.running = false;

    statusEl.textContent = message;
    stopButton.textContent = '닫기';

    if (state.total > 0) {
      countEl.textContent =
        `${state.done} / ${state.total}`;

      fillEl.style.transform =
        `scaleX(${Math.min(
          state.done / state.total,
          1
        )})`;
    }
  };

  stopButton.onclick = () => {
    if (state.running) {
      state.running = false;
      statusEl.textContent =
        '중지하는 중...';
      stopButton.textContent =
        '닫기';
    } else {
      host.remove();

      if (window[APP_KEY] === state) {
        delete window[APP_KEY];
      }
    }
  };

  const abortCheck = () => {
    if (!state.running) {
      throw new Error('__STOP__');
    }
  };

  const waitFor = async (
    finder,
    label,
    timeout = 20000,
    interval = 200
  ) => {
    const end =
      Date.now() + timeout;

    while (Date.now() < end) {
      abortCheck();

      try {
        const result = finder();

        if (result) {
          return result;
        }
      } catch {}

      await sleep(interval);
    }

    throw new Error(
      `${label} 대기 시간 초과`
    );
  };

  const waitForPath = async (
    targetPath,
    label,
    timeout = 30000
  ) => {
    const wanted =
      targetPath.replace(/\/+$/, '');

    return waitFor(
      () =>
        currentPath() === wanted,
      label,
      timeout,
      150
    );
  };

  const click = async (
    el,
    label
  ) => {
    abortCheck();

    if (!el || !el.isConnected) {
      throw new Error(
        `${label}을 찾지 못했습니다.`
      );
    }

    try {
      el.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'instant'
      });
    } catch {
      el.scrollIntoView({
        block: 'center',
        inline: 'center'
      });
    }

    await sleep(300);

    abortCheck();

    el.click();

    await sleep(250);
  };

  /* =====================================================
   * 제작자 페이지 캐릭터 수집
   * =================================================== */

  const CARD_SELECTOR =
    '[data-sentry-component="FrameProfileCard"]';

  const PROFILE_LINK_SELECTOR =
    'a[href*="/plots/"][href*="/profile"]';

  const characterFromCard = (card) => {
    const links = [
      ...card.querySelectorAll(
        PROFILE_LINK_SELECTOR
      )
    ];

    const link =
      links.find((a) =>
        isProfilePath(
          pathnameOf(a.href)
        )
      );

    if (!link) {
      return null;
    }

    const titleNode =
      card.querySelector(
        'span[title]'
      );

    const name =
      text(
        titleNode?.getAttribute(
          'title'
        )
      ) ||
      text(card.innerText)
        .split('\n')[0] ||
      '이름 없는 캐릭터';

    return {
      name,
      url:
        absoluteUrl(link.href),
      path:
        pathnameOf(link.href)
    };
  };

  const collectCurrentCards = () => {
    const result = new Map();

    const cards =
      document.querySelectorAll(
        CARD_SELECTOR
      );

    for (const card of cards) {
      const character =
        characterFromCard(card);

      if (!character) continue;

      result.set(
        character.path,
        character
      );
    }

    return result;
  };

  const collectAllCharacters =
    async () => {
      const found = new Map();

      let sameCount = 0;
      let previousCount = -1;
      let rounds = 0;

      paint(
        '캐릭터 전체 목록 수집 중...'
      );

      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });

      await sleep(500);

      while (rounds < 80) {
        abortCheck();

        const current =
          collectCurrentCards();

        for (
          const [path, character]
          of current
        ) {
          found.set(
            path,
            character
          );
        }

        paint(
          `캐릭터 목록 수집 중 · ${found.size}명 발견`
        );

        if (
          found.size ===
          previousCount
        ) {
          sameCount++;
        } else {
          sameCount = 0;
        }

        previousCount =
          found.size;

        const bottom =
          window.scrollY +
            window.innerHeight >=
          document.documentElement
            .scrollHeight - 120;

        if (
          bottom &&
          sameCount >= 4
        ) {
          break;
        }

        window.scrollTo({
          top:
            document.documentElement
              .scrollHeight,
          behavior: 'instant'
        });

        await sleep(800);

        rounds++;
      }

      const last =
        collectCurrentCards();

      for (
        const [path, character]
        of last
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

      await sleep(600);

      return [
        ...found.values()
      ];
    };

  /* =====================================================
   * 특정 캐릭터 카드 찾기
   * =================================================== */

  const matchingCharacterLink =
    (character) => {
      const links = [
        ...document.querySelectorAll(
          PROFILE_LINK_SELECTOR
        )
      ];

      return (
        links.find(
          (link) =>
            pathnameOf(
              link.href
            ) ===
            character.path
        ) || null
      );
    };

  const findCharacterLink =
    async (character) => {
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });

      await sleep(400);

      let previousHeight = 0;
      let stable = 0;

      for (
        let i = 0;
        i < 100;
        i++
      ) {
        abortCheck();

        const existing =
          matchingCharacterLink(
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
          stable++;
        } else {
          stable = 0;
        }

        previousHeight =
          height;

        window.scrollTo({
          top:
            document.documentElement
              .scrollHeight,
          behavior: 'instant'
        });

        await sleep(650);

        const afterScroll =
          matchingCharacterLink(
            character
          );

        if (afterScroll) {
          return afterScroll;
        }

        if (stable >= 6) {
          break;
        }
      }

      throw new Error(
        `${character.name} 카드 링크를 찾지 못했습니다.`
      );
    };

  const openCharacter =
    async (character) => {
      abortCheck();

      if (
        currentPath() ===
        character.path
      ) {
        return;
      }

      if (
        currentPath() !==
        state.creatorPath
      ) {
        throw new Error(
          '제작자 페이지가 아닌 곳에서 캐릭터 이동을 시도했습니다.'
        );
      }

      paint(
        `${character.name} · 프로필 찾는 중`
      );

      const link =
        await findCharacterLink(
          character
        );

      paint(
        `${character.name} · 프로필 이동`
      );

      await click(
        link,
        `${character.name} 프로필`
      );

      await waitForPath(
        character.path,
        `${character.name} 프로필 이동`,
        30000
      );

      await sleep(800);
    };

  /* =====================================================
   * 프로필 메뉴
   * =================================================== */

  const privateSnapshotButton =
    () => {
      const byId =
        document.querySelector(
          '#create-private-snapshot'
        );

      if (
        byId &&
        visible(byId) &&
        !byId.disabled
      ) {
        return byId;
      }

      const candidates = [
        ...document.querySelectorAll(
          'button, [role="menuitem"], [role="button"]'
        )
      ];

      return (
        candidates.find((el) => {
          if (!visible(el)) {
            return false;
          }

          const t = text(
            el.innerText ||
            el.textContent
          );

          return (
            t ===
              '비공개로 전환' ||
            t.includes(
              '비공개로 전환'
            )
          );
        }) || null
      );
    };

  const exactButton =
    (wanted) =>
      [
        ...document.querySelectorAll(
          'button'
        )
      ].find((button) => {
        if (
          !visible(button) ||
          button.disabled
        ) {
          return false;
        }

        return (
          text(
            button.innerText ||
            button.textContent
          ) === wanted
        );
      }) || null;

  const confirmButton = () =>
    exactButton('전환');

  const menuButton = () => {
    const ariaCandidates = [
      'button[aria-label="More"]',
      'button[aria-label="더보기"]',
      'button[aria-label="More options"]',
      'button[aria-label="Open menu"]',
      'button[aria-label="메뉴"]'
    ];

    for (
      const selector
      of ariaCandidates
    ) {
      const el =
        document.querySelector(
          selector
        );

      if (
        el &&
        visible(el) &&
        !el.disabled
      ) {
        return el;
      }
    }

    const buttons = [
      ...document.querySelectorAll(
        'button'
      )
    ].filter((button) => {
      if (
        !visible(button) ||
        button.disabled
      ) {
        return false;
      }

      if (
        button.closest(
          '[role="dialog"], [role="menu"]'
        )
      ) {
        return false;
      }

      const rect =
        button.getBoundingClientRect();

      if (
        rect.top > 220 ||
        rect.right <
          window.innerWidth / 2
      ) {
        return false;
      }

      return !!button.querySelector(
        'svg'
      );
    });

    buttons.sort((a, b) => {
      const ar =
        a.getBoundingClientRect();

      const br =
        b.getBoundingClientRect();

      if (ar.top !== br.top) {
        return ar.top - br.top;
      }

      return br.right - ar.right;
    });

    return buttons[0] || null;
  };

  const openMenu = async () => {
    if (
      privateSnapshotButton()
    ) {
      return;
    }

    const button =
      await waitFor(
        menuButton,
        '프로필 메뉴 버튼',
        20000
      );

    await click(
      button,
      '프로필 메뉴'
    );

    await waitFor(
      privateSnapshotButton,
      '비공개 전환 메뉴',
      12000
    );
  };

  /* =====================================================
   * 원본 프로필 복귀
   *
   * ★ 수정된 부분
   * URL 비교만 하지 않고
   * 실제 프로필 DOM까지 확인함.
   * =================================================== */

  const backToProfile =
    async (character) => {
      abortCheck();

      history.back();

      await waitFor(
        () => {
          /*
           * 먼저 해당 캐릭터 프로필 URL인지 확인
           */
          if (
            currentPath() !==
            character.path
          ) {
            return false;
          }

          /*
           * URL만 돌아온 게 아니라
           * 실제 프로필 화면이 렌더링됐는지 확인
           */
          const menu =
            menuButton();

          const privateButton =
            document.querySelector(
              '#create-private-snapshot'
            );

          return (
            !!menu ||
            !!privateButton
          );
        },
        '원본 프로필 복귀',
        30000,
        150
      );

      await sleep(700);
    };

  /* =====================================================
   * 제작자 페이지 복귀
   * =================================================== */

  const backToCreator =
    async () => {
      abortCheck();

      history.back();

      await waitFor(
        () => {
          if (
            currentPath() !==
            state.creatorPath
          ) {
            return false;
          }

          return !!document.querySelector(
            CARD_SELECTOR
          );
        },
        '제작자 페이지 복귀',
        30000,
        150
      );

      await sleep(700);
    };

  /* =====================================================
   * 비공개 방 1개 생성
   * =================================================== */

  const saveOne = async (
    character,
    characterIndex,
    repeatIndex
  ) => {
    abortCheck();

    const prefix =
      `[${characterIndex + 1}/${state.characters.length}] ` +
      `${character.name} · ` +
      `${repeatIndex + 1}/${state.repeat}`;

    /*
     * 제작자 페이지
     * → 해당 캐릭터 프로필
     */
    await openCharacter(
      character
    );

    await waitFor(
      () =>
        isProfilePage() &&
        menuButton(),
      '캐릭터 프로필 로딩',
      25000
    );

    await sleep(500);

    const profileRoute =
      routeKey();

    paint(
      `${prefix} · 메뉴 열기`
    );

    await openMenu();

    const privateButton =
      await waitFor(
        privateSnapshotButton,
        '비공개로 전환',
        12000
      );

    paint(
      `${prefix} · 비공개로 전환`
    );

    await click(
      privateButton,
      '비공개로 전환'
    );

    const confirm =
      await waitFor(
        confirmButton,
        '전환 확인 버튼',
        12000
      );

    paint(
      `${prefix} · 전환 확인`
    );

    await click(
      confirm,
      '전환'
    );

    /*
     * 비공개 방으로 이동했는지 확인
     */
    await waitFor(
      () =>
        routeKey() !==
        profileRoute,
      '비공개 방 생성',
      20000,
      150
    );

    paint(
      `${prefix} · 생성 완료`
    );

    await sleep(800);

    /*
     * 비공개 방
     * ↓
     * 원본 캐릭터 프로필
     */
    paint(
      `${prefix} · 원본 프로필로 복귀`
    );

    await backToProfile(
      character
    );

    /*
     * 원본 캐릭터 프로필
     * ↓
     * 제작자 페이지
     */
    paint(
      `${prefix} · 제작자 페이지로 복귀`
    );

    await backToCreator();

    await sleep(500);
  };

  /* =====================================================
   * 실행
   * =================================================== */

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

      /*
       * 반복 횟수
       */
      const raw = prompt(
        '각 캐릭터를 몇 번씩 비공개로 저장할까요?\n\n예: 2 → 모든 캐릭터를 각각 2번 저장',
        '2'
      );

      if (raw === null) {
        finish('취소했습니다.');
        return;
      }

      const repeat =
        Number(raw);

      if (
        !Number.isInteger(repeat) ||
        repeat < 1
      ) {
        throw new Error(
          '1 이상의 정수를 입력해주세요.'
        );
      }

      state.repeat =
        repeat;

      /*
       * 캐릭터 전체 수집
       */
      state.characters =
        await collectAllCharacters();

      if (
        !state.characters.length
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

      /*
       * 캐릭터별 반복
       */
      for (
        let characterIndex = 0;
        characterIndex <
          state.characters.length;
        characterIndex++
      ) {
        const character =
          state.characters[
            characterIndex
          ];

        for (
          let repeatIndex = 0;
          repeatIndex <
            state.repeat;
          repeatIndex++
        ) {
          abortCheck();

          try {
            await saveOne(
              character,
              characterIndex,
              repeatIndex
            );

            state.success++;
          } catch (error) {
            if (
              error?.message ===
              '__STOP__'
            ) {
              throw error;
            }

            state.failed++;

            state.failures.push({
              character:
                character.name,

              repeat:
                repeatIndex + 1,

              error:
                error?.message ||
                String(error)
            });

            console.error(
              '[ZETA 제작자 비캐 저장기]',
              character.name,
              repeatIndex + 1,
              error
            );

            throw new Error(
              `${character.name} ` +
              `${repeatIndex + 1}회차 실패: ` +
              `${
                error?.message ||
                error
              }`
            );
          }

          state.done++;

          paint(
            `${character.name} · ` +
            `${repeatIndex + 1}/${state.repeat} 완료`
          );

          await sleep(700);
        }
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
          `중지됨 · 성공 ${state.success}개`
        );

        return;
      }

      console.error(
        '[ZETA 제작자 비캐 저장기]',
        error
      );

      finish(
        `중단 · ${
          error?.message ||
          String(error)
        }`
      );
    }
  })();

})();
