/*
 * 계절별 낙하 파티클(벚꽃/빗방울/낙엽/눈). UI 목업의 .petal 패턴을 4계절로 일반화.
 * 모양 차이는 CSS 클래스(particle--spring 등)로, 낙하 자체는 공용 keyframe 하나를 공유한다.
 */

var ONYU_PARTICLE_COUNT = 14;

function onyuClearParticles(container) {
  container.querySelectorAll('.particle').forEach(function (el) { el.remove(); });
}

function onyuSpawnParticles(container, season) {
  onyuClearParticles(container);
  if (window.ONYU_STATE.settings.reduceMotion) return; // 모션 줄이기 켜지면 파티클 생략

  for (var i = 0; i < ONYU_PARTICLE_COUNT; i++) {
    var el = document.createElement('div');
    el.className = 'particle particle--' + season;
    el.style.left = Math.random() * 100 + '%';
    var duration = 7 + Math.random() * 5;
    el.style.animationDuration = duration.toFixed(2) + 's';
    el.style.animationDelay = (Math.random() * duration).toFixed(2) + 's';
    container.appendChild(el);
  }
}
