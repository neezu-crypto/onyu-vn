// admin-center가 관리하는 공개 RTDB devbarLinks를 읽어 devbar를 갱신한다.
// onyu-vn은 Firebase 앱을 사용하지 않는 정적 게임이므로 REST 읽기를 사용한다.
(function () {
  var DATABASE_URL = 'https://soop-stock-market-default-rtdb.firebaseio.com';
  var SELF_GAME_ID = 'onyuVn';
  var track = document.getElementById('devbar-track');
  if (!track) return;

  fetch(DATABASE_URL + '/devbarLinks.json')
    .then(function (response) {
      if (!response.ok) throw new Error('devbar 링크 조회 HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      if (!data || typeof data !== 'object') return;
      var links = Object.keys(data)
        .filter(function (id) { return id !== SELF_GAME_ID && data[id] && data[id].url; })
        .map(function (id) { return Object.assign({ id: id }, data[id]); })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      if (!links.length) return;

      // 조회 실패·빈 목록 때는 위의 하드코딩 폴백을 유지한다. 유효한 RTDB
      // 목록이 확인된 경우에만 동적 링크를 교체한다.
      track.querySelectorAll('a[data-game-id]').forEach(function (el) { el.remove(); });
      links.forEach(function (link) {
        var a = document.createElement('a');
        a.className = 'dev-game-link';
        a.dataset.gameId = link.id;
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = link.label || link.id;
        track.appendChild(a);
      });
      // 동적 링크로 폭이 바뀌었으므로 마퀴를 다시 계산한다.
      window.dispatchEvent(new Event('resize'));
    })
    .catch(function (error) {
      // 정적 폴백이 이미 화면에 있으므로 조회 실패는 치명적인 오류가 아니다.
      console.error('devbar 링크 조회 실패(기존 링크 유지):', error);
    });
}());
