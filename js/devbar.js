// 상단 devbar(사이트명 + 다른 게임 링크)가 화면 폭보다 넓으면
// 자동으로 가로 스크롤(마퀴)되게 한다.
(function () {
  var viewport = document.getElementById('devbar-viewport');
  var track = document.getElementById('devbar-track');
  if (!viewport || !track) return;

  // .screen은 fixed 레이아웃이라 일반 문서 흐름의 devbar 높이를 자동으로
  // 반영하지 못한다. 실제 높이를 CSS 변수로 전달해 저장/불러오기·갤러리·설정
  // 화면의 sticky 상단바가 devbar 아래에서 시작하도록 한다.
  var devbar = document.getElementById('devbar');
  function syncDevbarHeight() {
    if (!devbar) return;
    document.documentElement.style.setProperty('--devbar-height', devbar.getBoundingClientRect().height + 'px');
  }

  function setup() {
    track.classList.remove('auto-scroll');
    track.querySelectorAll('[data-clone]').forEach(function (el) { el.remove(); });

    var overflowing = track.scrollWidth > viewport.clientWidth + 4;
    if (!overflowing) return;

    var originalWidth = track.scrollWidth;
    var originalChildren = Array.prototype.slice.call(track.children);
    originalChildren.forEach(function (child) {
      var clone = child.cloneNode(true);
      clone.setAttribute('data-clone', '');
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      track.appendChild(clone);
    });

    var pxPerSecond = 40;
    var duration = Math.max(originalWidth / pxPerSecond, 8);
    track.style.setProperty('--devbar-duration', duration + 's');
    track.classList.add('auto-scroll');
  }

  setup();
  syncDevbarHeight();
  window.addEventListener('resize', function () {
    clearTimeout(window.__devbarResizeTimer);
    window.__devbarResizeTimer = setTimeout(function () {
      setup();
      syncDevbarHeight();
    }, 200);
  });
}());
