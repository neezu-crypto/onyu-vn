/*
 * 챕터 스크립트 데이터.
 * 대본 원본: onyu-vn-script.html (Artifact). CH01~CH27 전체 이식 완료(Phase 2).
 *
 * 줄 타입: 'narration' | 'line' | 'choice' | 'nameInput' | 'setAddressStage' | 'scoreGate'
 * line.speaker: 'player' | 'onyu' | 'teacher' 등 SPEAKER_LABELS의 키
 * line.expr: speaker가 'onyu'일 때만 의미 있음 — 스탠딩 표정 6종
 *   (calm/smile/surprised/shy/worried/pouty) 중 하나. 생략하면 직전 표정을 유지.
 * narration.sheAbsent: true면 그 나레이션이 보이는 동안만 스탠딩을 숨김(그녀가 그
 *   장면에 물리적으로 없는 순간용). line/choice가 나오면 항상 다시 보인다.
 *
 *   판단 기준(2026-09-13 확정, 실제 대본 CH05/07/12로 검증됨): 키워드("온이유"/
 *   "그녀") 유무가 아니라 "이 나레이션이 낭독되는 시점에 그녀가 이미 그 자리에
 *   있다고 확정할 수 있는가"로 판단한다. 예를 들어 CH02 "나란히 걷던 중이었다"는
 *   이름이 없어도 이미 같이 있는 상태라 숨기지 않는다(실제로 미태깅 상태 유지).
 *   반대로 대본은 원래부터 "장면 설명"과 "그녀 등장/확인"을 별개의 narration
 *   문단으로 써놓는 경우가 많다(CH05: 체육대회 스탠드 묘사 → 그녀가 혼자 앉아있다,
 *   CH12: "낯익은 뒷모습"이라는 정체를 숨긴 리빌 문장 → 그녀였다는 확인 문장) —
 *   이런 구조일 땐 앞 노드에만 sheAbsent:true를 달고, 그녀를 확인/등장시키는
 *   노드부터는 플래그 없이 그대로 둔다(기본값=보임이므로). 특히 CH12처럼 정체를
 *   숨기는 리빌 문장에서 스탠딩을 미리 보여주면 반전감이 죽으니 반드시 숨길 것.
 *   여러 나레이션 노드가 연속으로 부재 상태를 유지해야 하면 그 노드 각각에
 *   개별적으로 달아야 한다(엔진이 노드 단위로만 판단, 상태를 이어서 기억하지 않음).
 * choice.options[].branch: 'pos' | 'neg' — 각 옵션 안의 script가 해당 분기의 전개
 * setAddressStage.value: 화면 출력 없이 addressStage만 바꾸고 곧장 다음 노드로
 *   진행하는 순수 상태 노드(CH13 첫 데이트 후 0→1에 사용). 원래는 CH27 연인
 *   엔딩에서 애칭 단계(1→2)까지 있었으나, "사귀자마자 애칭부터 부르지는
 *   않는다"는 피드백으로 애칭 연출을 제거하고 담백한 고백 반응으로 대체했다
 *   (2026-09-14) — addressStage는 이제 0/1 두 단계만 쓰인다.
 * scoreGate.branches: [{ id, min, max, script }] — CH27 전용, 선택지 없이 최종
 *   호감도(window.ONYU_STATE.affection)만으로 그 구간에 맞는 script를 프레임으로
 *   push한다(min/max 생략 시 -Infinity/Infinity). 우정≤8 / 썸 9~64 / 연인≥65.
 *   id는 갤러리 엔딩 언락 키로 쓰인다(onyuUnlockGalleryItem('endings', id)).
 * chapter.cg: (선택) 이 챕터의 이벤트 CG 파일명(예: 'cg-02.png', assets/cg/ 기준).
 *   engine.js가 챕터 시작 시 "다음 챕터"의 cg를 미리 프리페치하는 데 쓴다 — 실제
 *   CG 32장이 생성되고 각 챕터에 배정되면(Phase 2) 채워 넣을 것, 지금은 비워둠.
 * chapter.bg: (선택) 재사용 배경(assets/backgrounds/ 기준) 중 이 챕터의 기본
 *   배경. 실제 대본 첫 나레이션(장소를 밝히는 문장)을 챕터마다 대조해 배정했다
 *   (2026-09-14) — 배경 프롬프트 시트의 예전 챕터 태그는 대본 완성 전에 쓰인
 *   거라 신뢰하지 않고, 최종 대본 원문 기준으로 재확인함. 처음엔 학교 안
 *   재사용 로케이션 13곳(b1~b13)만 있었는데, 그 13곳 중 어디에도 안 맞는
 *   장소는 b14(CH06 교외 단풍길 소풍)처럼 전용 배경을 새로 추가하는 쪽으로
 *   확장했다 — 정말 배경 자체가 불필요하거나 만들 가치가 없는 극히 예외적인
 *   경우에만 이 필드를 생략해 계절 그라데이션 워시만 쓴다.
 *   node.bg: 한 챕터 안에서 장소가 바뀌는 경우에만 개별 노드에 달아 오버라이드
 *   (expr과 동일하게 "다음 지정 전까지 유지"). CH27의 강당→교문, CH15의
 *   부스·복도(b15)→카페(b9) 두 곳에 씀 — 나머지 챕터는 chapter.bg 하나로 커버.
 *   화면에는 계절색 반투명 오버레이가 사진 위에 덧씌워진다(원화 자체는 중립
 *   조명, 계절감은 CSS color-mix()로 코드가 입힘 — 배경 프롬프트 시트 설계 그대로).
 *   같은 배경 키를 쓰는 여러 챕터 중 일부만 계절이 안 맞아 생기는 문제는
 *   main.js의 ONYU_BG_SEASON_VARIANTS(계절 자동 감지)로 해결하지만, CH04처럼
 *   "그 챕터만" 날씨가 특별한 경우는 계절 축이 아니라서 자동 감지를 안 쓰고
 *   chapter.bg 자체를 그 챕터 전용 변형 키로 직접 바꿔 쓴다(예: CH04는
 *   'b3'가 아니라 'b3-rain' — 같은 b3를 쓰는 CH02·CH21은 비와 무관해서 그대로 'b3').
 */

window.SPEAKER_LABELS = {
  player: null, // null이면 엔진이 state.playerName으로 치환
  onyu: '온이유',
  teacher: '담임',
  club: '부장',
  visitor: '구경 온 학생',
  ending: '엔딩',
};

window.ONYU_CHAPTERS = [
  {
    id: 'ch01', order: 1, grade: 1, season: 'spring', title: '새 학기', bg: 'b1',
    script: [
      { type: 'narration', text: '새 학기 첫날의 교실은 어수선했다. 다들 새로 만난 얼굴들과 떠드는 사이, 창가 자리만 유독 조용했다. 온이유가 스케치북을 펼쳐놓고 하품을 참으며 연필을 움직이고 있었다.' },
      { type: 'narration', text: '우연히 그 옆을 지나다 걸음이 멈췄다.' },
      {
        type: 'choice',
        situation: '우연히 스케치북 속 그림이 눈에 들어오는 순간',
        options: [
          {
            branch: 'pos', text: '진심으로 그림이 좋다고 말을 건다', affection: 2, tag: 'L01',
            script: [
              { type: 'line', speaker: 'player', text: '이거, 네가 그린 거야?' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(고개를 들며) 어... 응.' },
              { type: 'line', speaker: 'player', text: '진짜 잘 그렸다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '고마워. 그렇게 말해주는 사람, 별로 없었는데.' },
              { type: 'line', speaker: 'player', text: '뭐 그린 거야?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '그냥 창밖 풍경. 아직 다 못 그렸어.' },
              { type: 'line', speaker: 'player', text: '다 그리면 보여줘.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(살짝 웃으며) 그러든가.' },
              { type: 'line', speaker: 'player', text: '미술부야?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '아니, 디자인과 준비용. 좋아서 하는 건 아니고.' },
              { type: 'line', speaker: 'player', text: '그럼 뭘 좋아하는데?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '...그건 나중에.' },
            ],
          },
          {
            branch: 'neg', text: '대충 한 번 훑어보고 별말 없이 지나간다', affection: -1, tag: 'D01',
            script: [
              { type: 'narration', text: '별생각 없이 시선만 스치듯 던지고 지나쳤다. 등 뒤에서 소리 없이 스케치북을 덮는 기척이 들렸다. 그 뒤로 한동안 그 자리에선 연필 소리가 들리지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '딸랑, 종이 울리고 담임이 들어왔다. 어수선하던 교실이 순식간에 조용해졌다.' },
      { type: 'line', speaker: 'teacher', text: '자, 새 학기니까 한 명씩 일어나서 이름이랑 하고 싶은 말 크게 한마디씩 해볼까!' },
      { type: 'narration', text: '순서가 창가 쪽으로 다가올수록, 그녀의 어깨가 눈에 띄게 굳어가는 게 보였다.' },
      {
        type: 'choice',
        situation: '자기소개 순서가 다가오는데, 눈에 띄게 굳어 있는 그녀',
        options: [
          {
            branch: 'pos', text: '순서를 자연스럽게 조절해 부담을 줄여준다', affection: 2, tag: 'L02',
            script: [
              { type: 'line', speaker: 'player', text: '(손을 들며) 저 먼저 할게요!' },
              { type: 'narration', text: '일부러 시답잖은 농담을 살짝 섞었다. 다음 차례가 왔을 땐 다들 이미 다른 이야기에 정신이 팔려 있었다. 그녀는 이름만 담백하게 말하고 자리에 앉았다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(쉬는 시간, 다가와서) 아까, 고마워.' },
              { type: 'line', speaker: 'player', text: '뭐가?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '그냥. 먼저 나서준 거.' },
              { type: 'line', speaker: 'player', text: '별거 아니었어.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '그래도. ...그렇게 막 나서는 거, 은근 별로 안 싫더라.' },
            ],
          },
          {
            branch: 'neg', text: '오히려 더 길게 말해보라며 부추긴다', affection: -1, tag: 'D02',
            script: [
              { type: 'line', speaker: 'player', text: '더 말해봐요, 더!' },
              { type: 'narration', text: '몇몇이 장난스럽게 부추기는 데 슬쩍 편승했다. 얼굴이 붉어진 채로 이름만 겨우 말하고 서둘러 앉는 그녀 — 그 후로 한참 동안 고개를 들지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '쉬는 시간, 복도에서 다시 마주쳤다. 이번엔 그녀가 먼저 걸음을 멈췄다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '저기, 너 이름이 뭐야?' },
      { type: 'nameInput' },
      { type: 'line', speaker: 'player', text: '(이름을 말한다)' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '(되뇌며) 그렇구나. 알겠어.' },
      { type: 'line', speaker: 'player', text: '너는?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '온이유.' },
      { type: 'line', speaker: 'player', text: '이유... 이름 특이하다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '많이 듣는 말이야.' },
      { type: 'line', speaker: 'player', text: '왜, 무슨 뜻인데?' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(잠깐 생각하다가) ...나중에 알려줄게.' },
      { type: 'narration', text: '짧게 웃고는, 먼저 몸을 돌려 걸어갔다. 그뿐이었지만, 교실이 조금은 덜 낯설게 느껴졌다. 창밖으로 아직 여물지 않은 벚꽃 봉오리가 보였다.' },
    ],
  },

  {
    id: 'ch02', order: 2, grade: 1, season: 'spring', title: '벚꽃 스케치', bg: 'b3',
    script: [
      { type: 'narration', text: '등굣길, 어느새 벚꽃이 활짝 피어 있었다. 바람이 불 때마다 꽃잎이 골목 가득 흩날렸다. 나란히 걷던 중이었다.' },
      { type: 'line', speaker: 'player', text: '오늘 좀 늦었네.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '어젯밤에 게임하다 늦게 잤어.' },
      { type: 'line', speaker: 'player', text: '무슨 게임인데?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '비밀.' },
      { type: 'line', speaker: 'player', text: '표정 보니까 롤인 거 같은데.' },
      { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(움찔하며) ...어떻게 알았어.' },
      { type: 'narration', text: '앞서 걷던 온이유가 문득 걸음을 멈췄다. 고개를 살짝 젖힌 채, 떨어지는 꽃잎을 가만히 올려다보고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '예쁘다.' },
      { type: 'line', speaker: 'player', text: '(정말 그러네.)' },
      {
        type: 'choice',
        situation: '벚꽃 아래 멈춰 선 그녀, 재촉할까 같이 볼까',
        options: [
          {
            branch: 'pos', text: '같이 걸음을 멈추고 벚꽃을 바라본다', affection: 2, tag: 'L10',
            script: [
              { type: 'narration', text: '발걸음을 멈추고 옆에 나란히 섰다. 딱히 할 말은 없었지만, 그것만으로 충분했다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '너도 이런 거 볼 줄 아는구나.' },
              { type: 'line', speaker: 'player', text: '무슨 소리야, 나도 눈 있거든.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(피식) 그런 뜻 아니었는데.' },
              { type: 'line', speaker: 'player', text: '알아. 놀린 거야.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(살짝 웃으며) 여유 좀 있네.' },
              { type: 'line', speaker: 'player', text: '너도 여유 있어 보이는데.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '오늘만 그래.' },
            ],
          },
          {
            branch: 'neg', text: '지각한다고 빨리 가자며 재촉한다', affection: -1, tag: 'D3',
            script: [
              { type: 'line', speaker: 'player', text: '야, 지각한다. 빨리 가자.' },
              { type: 'narration', text: '손목을 슬쩍 잡아끌었다.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(흠칫 놀라며) ...어, 그래.' },
              { type: 'narration', text: '말없이 다시 걷기 시작했다. 발걸음이 아까보다 조금 빨라져 있었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '교문 앞, 아직 조회까지는 시간이 남아 있었다. 화단 옆 벤치에 앉은 그녀가 가방에서 스케치북을 꺼냈다.' },
      { type: 'line', speaker: 'player', text: '맨날 스케치북 들고 다녀?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '과제 마감이 코앞이라. 안 그러면 나도 안 들고 다녀.' },
      { type: 'line', speaker: 'player', text: '그럼 집에서는 뭐 해?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그건 비밀이라니까.' },
      {
        type: 'choice',
        situation: '스케치북을 꺼내 벚꽃을 그리기 시작하는 그녀',
        options: [
          {
            branch: 'pos', text: '말없이 옆에 앉아 그리는 모습을 지켜본다', affection: 2, tag: 'L03',
            script: [
              { type: 'narration', text: '굳이 말을 걸지 않고 옆에 조용히 앉았다. 연필이 사각거리는 소리만 벤치 주변을 채웠다. 한참 뒤, 그녀가 낮게 중얼거렸다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '가만히 있어 줘서 고마워.' },
              { type: 'line', speaker: 'player', text: '방해하는 것 같아서.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '아니야. 오히려 편해. ...이런 거 자꾸 말하게 하지 마.' },
              { type: 'line', speaker: 'player', text: '다행이네.' },
            ],
          },
          {
            branch: 'neg', text: '친구들을 불러 같이 사진 찍자고 소란을 만든다', affection: -1, tag: 'D4',
            script: [
              { type: 'line', speaker: 'player', text: '(친구들을 부르며) 야, 여기서 사진 찍자!' },
              { type: 'narration', text: '연필을 쥔 손이 뚝 멈췄다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(스케치북을 덮으며) 나 먼저 갈게.' },
              { type: 'narration', text: '뒤도 돌아보지 않고 교실 쪽으로 향했다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '종이 울리기 직전, 그녀가 스케치북을 가방에 넣었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '봄이 생각보다 짧네.' },
      { type: 'line', speaker: 'player', text: '그게 무슨 말이야?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그냥. 벚꽃이 빨리 지는 것 같아서.' },
      { type: 'line', speaker: 'player', text: '내년에도 같이 보면 되지.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(잠깐 이쪽을 보다가) ...그러네.' },
      { type: 'narration', text: '대수롭지 않게 넘긴 말이었지만, 그녀는 한동안 그 말을 곱씹는 얼굴이었다. 흩날리는 꽃잎 사이로, 올해 벚꽃이 유난히 빨리 지고 있다는 것만은 확실했다.' },
    ],
  },

  {
    id: 'ch03', order: 3, grade: 1, season: 'summer', title: '미술실 방과후', bg: 'b4',
    script: [
      { type: 'narration', text: '여름 방과후, 다들 빠져나간 교실은 후텁지근한 공기만 남아 있었다. 두고 온 준비물이 생각나 미술실로 돌아갔더니, 온이유가 혼자 이젤 앞에 앉아 있었다.' },
      { type: 'narration', text: '조용히 문을 밀고 들어섰다. 열린 창으로 들어오는 바람에 커튼이 흔들리고, 멀리서 매미 우는 소리가 들려왔다. 그녀는 고개도 들지 않고 붓을 움직였다.' },
      { type: 'line', speaker: 'player', text: '여기 있을 줄 알았어.' },
      { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(붓을 든 채) 어떻게 알았어?' },
      { type: 'line', speaker: 'player', text: '그냥 느낌이었어.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(피식) 신기한 느낌이네. ...뭐, 그렇게 자신 있게 찾아오는 거, 나쁘진 않아.' },
      { type: 'line', speaker: 'player', text: '과제야?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '어, 내일까지. 사실 집에서 하고 싶었는데.' },
      {
        type: 'choice',
        situation: '그림에 몰입한 그녀 옆에서 어떻게 시간을 보낼지',
        options: [
          {
            branch: 'pos', text: '말없이 옆자리에 앉아 그리는 모습을 지켜본다', affection: 2, tag: 'L05',
            script: [
              { type: 'narration', text: '말 걸지 않고 옆 의자에 조용히 앉았다. 붓이 캔버스를 스치는 소리, 이따금 물감을 헹구는 소리만 방 안을 채웠다. 한참 만에야 그녀가 붓을 든 채로 흘리듯 말했다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '너, 되게 안 지루해하네.' },
              { type: 'line', speaker: 'player', text: '딱히 할 것도 없는데 뭐.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '보통은 심심해하던데.' },
              { type: 'line', speaker: 'player', text: '구경하는 것도 나쁘지 않아.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(피식) 특이하네.' },
            ],
          },
          {
            branch: 'neg', text: '심심하다며 자꾸 말을 걸어 흐름을 끊는다', affection: -1, tag: 'D05',
            script: [
              { type: 'line', speaker: 'player', text: '야, 그거 뭐 그리는 거야? 다 됐어?' },
              { type: 'narration', text: '붓을 든 손이 몇 번이나 허공에서 멈췄다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '나중에, 다시 할게.' },
              { type: 'narration', text: '짧은 한숨과 함께 붓을 내려놓는 그녀의 표정에 아쉬움이 스쳤다.' },
            ],
          },
        ],
      },
      { type: 'line', speaker: 'player', text: '뭐 그리는 거야?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '(계속 그리며) 아직 몰라. 그리다 보면 알게 될 때도 있어.' },
      { type: 'line', speaker: 'player', text: '그게 무슨 소리야.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '나도 몰라. 그냥 그런 때가 있어.' },
      { type: 'narration', text: '얼마 뒤, 그녀가 붓을 씻고 캔버스를 이쪽으로 돌려 보여주었다.' },
      {
        type: 'choice',
        situation: '완성된 그림을 보여주며 감상을 묻는 순간',
        options: [
          {
            branch: 'pos', text: '어느 부분이 왜 좋았는지 구체적으로 짚어 말한다', affection: 2, tag: 'L06',
            script: [
              { type: 'line', speaker: 'player', text: '여기, 그림자 진 부분 — 이렇게 어둡게 눌러놓으니까 오히려 창밖 빛이 더 환해 보인다.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈을 크게 뜨며) 그거, 제일 신경 쓴 부분인데.' },
              { type: 'line', speaker: 'player', text: '진짜? 딱 눈에 들어오던데.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '알아봐 줄 줄은 몰랐어. 고마워. ...그렇다고 너무 잘난 척하지 말고.' },
              { type: 'line', speaker: 'player', text: '계속 이렇게 그려.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(표정이 살짝 상기되며) 그럴게.' },
            ],
          },
          {
            branch: 'neg', text: '"어, 잘 그렸네" 하고 건성으로 답한다', affection: -1, tag: 'D06',
            script: [
              { type: 'line', speaker: 'player', text: '어, 잘 그렸네.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '...그래.' },
              { type: 'narration', text: '캔버스를 슬그머니 다시 돌려놓는 표정이 살짝 굳어 있었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '창밖으로 노을이 번지기 시작했다. 붉게 물든 빛이 이젤 위로 길게 드리웠다. 물감 냄새와 매미 소리가 뒤섞인 미술실에 둘만 남아 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '사실 그렇게 좋아하는 시간은 아닌데, 다 하고 나니까 후련하네.' },
      { type: 'line', speaker: 'player', text: '그럼 이제 집에 가서 뭐 할 거야?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(눈이 반짝이며) 드디어 롤 할 수 있어.' },
      { type: 'line', speaker: 'player', text: '과제할 때랑 표정이 다르네.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그야 이게 진짜니까.' },
      { type: 'narration', text: '흘리듯 던진 말이었지만, 그 순간만큼은 정말 즐거워 보였다.' },
    ],
  },

  {
    id: 'ch04', order: 4, grade: 1, season: 'summer', title: '장마와 우산', bg: 'b3-rain',
    script: [
      { type: 'narration', text: '장마가 시작된 지 며칠째, 하늘은 아침부터 무겁게 가라앉아 있었다. 예보를 확인하지 않고 나선 게 화근이었다 — 하교 시간이 되자 예고도 없이 비가 쏟아지기 시작했다. 처마 밑에 서 있는데, 온이유도 우산을 안 챙긴 모양이었다.' },
      { type: 'line', speaker: 'player', text: '우산 없어?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '(하늘을 보며) 안 챙겼어. 너는?' },
      { type: 'line', speaker: 'player', text: '나도.' },
      {
        type: 'choice',
        situation: '처마 밑에서 비가 잦아들길 기다리는 동안',
        options: [
          {
            branch: 'pos', text: '서두르지 않고 비 내리는 풍경을 같이 바라본다', affection: 2, tag: 'L07',
            script: [
              { type: 'narration', text: '조급해하지 않고 나란히 서서 빗줄기를 바라봤다. 처마 끝에서 떨어지는 빗방울이 규칙적으로 웅덩이를 두드렸다.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '비 오는 날, 좋아해.' },
              { type: 'line', speaker: 'player', text: '다들 우울해하지 않아?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '나는 오히려 차분해지더라.' },
              { type: 'line', speaker: 'player', text: '의외네.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '자주 듣는 말이야.' },
              { type: 'line', speaker: 'player', text: '누가 그런 말을 해?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '그냥, 나 자신이.' },
              { type: 'line', speaker: 'player', text: '그럼 나도 비 오는 날 좋아해볼까.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '억지로 하는 건 안 쳐줘.' },
            ],
          },
          {
            branch: 'neg', text: '짜증 내며 빗속으로 먼저 뛰어나간다', affection: -1, tag: 'D07',
            script: [
              { type: 'line', speaker: 'player', text: '아 짜증나, 그냥 맞고 가자.' },
              { type: 'narration', text: '툴툴대다 몇 걸음 못 가 흠뻑 젖고 말았다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(말없이 시선을 돌리며) ...' },
              { type: 'narration', text: '딱히 나무라진 않았지만, 표정이 살짝 굳어 있었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '비가 그칠 기미가 안 보이자, 결국 교문 앞 우산 대여함을 뒤졌다. 마지막 남은 우산 하나뿐이라, 둘이 나눠 쓸 수밖에 없었다.' },
      {
        type: 'choice',
        situation: '결국 우산 하나를 나눠 쓰고 걷게 된 어색한 순간',
        options: [
          {
            branch: 'pos', text: '편안하게 대화를 이어가며 자연스럽게 걷는다', affection: 2, tag: 'L08',
            script: [
              { type: 'line', speaker: 'player', text: '그러고 보니, 우산 없이 나오는 스타일이었어?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '말 걸어줘서 다행이야. 어색해서 혼났어.' },
              { type: 'line', speaker: 'player', text: '나도 뭐라고 해야 할지 몰랐어.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(픽 웃으며) 그럼 잘됐네.' },
              { type: 'line', speaker: 'player', text: '그럼 다음부턴 나오기 전에 하늘 좀 봐.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '너나 잘 봐.' },
              { type: 'line', speaker: 'player', text: '집 방향 같은 데야?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '어느 정도는.' },
              { type: 'line', speaker: 'player', text: '그럼 앞으로도 자주 이렇게 되겠네.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '오늘은 그냥 우연이야.' },
              { type: 'narration', text: '그 뒤로는 시답잖은 이야기가 자연스럽게 이어졌다.' },
            ],
          },
          {
            branch: 'neg', text: '스마트폰만 보며 말없이 걷는다', affection: -1, tag: 'D08',
            script: [
              { type: 'narration', text: '딱히 할 말이 없어 스마트폰만 들여다보며 걸었다. 우산을 든 손에 자꾸 힘이 들어가는 게 느껴졌다.' },
              { type: 'narration', text: '집 앞에 도착할 때까지, 그녀는 한마디도 하지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '집 앞 골목에 다다르자 빗줄기가 조금 가늘어져 있었다. 가로등 불빛 아래로 빗방울이 희미하게 반짝였다. 헤어지기 직전, 그녀가 우산을 도로 접었다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '고마워. ...이걸로 퉁친 거다, 알겠지.' },
      { type: 'line', speaker: 'player', text: '내일도 비 온대.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '그럼 또 처마 밑에서 보겠네.' },
      { type: 'line', speaker: 'player', text: '그건 좀 싫은데.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 농담이야.' },
      { type: 'narration', text: '짧은 인사였지만, 빗소리에 묻히지 않을 만큼 또렷했다.' },
    ],
  },

  {
    id: 'ch05', order: 5, grade: 1, season: 'autumn', title: '체육대회', bg: 'b6',
    script: [
      { type: 'narration', text: '가을 체육대회, 운동장은 응원 함성과 호루라기 소리로 뒤덮여 있었다. 반 대항 이어달리기를 기다리며 다들 목이 터져라 소리를 질렀다.', sheAbsent: true },
      { type: 'narration', text: '저 멀리 그늘진 스탠드 구석, 온이유가 혼자 앉아 스케치북을 펼치고 있었다. 함성이 가장 덜 닿는 자리를 골라 앉은 게 분명해 보였다.' },
      { type: 'line', speaker: 'player', text: '여기 있었네.' },
      { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(스케치북을 슬쩍 덮으며) 어, 왔어?' },
      { type: 'line', speaker: 'player', text: '이 시끄러운 데서 뭐 해.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '그냥, 구경.' },
      { type: 'line', speaker: 'player', text: '계주 안 나가?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '나가야 돼. 조금 있다가.' },
      { type: 'line', speaker: 'player', text: '긴장돼?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '그런 거, 잘 못해서.' },
      {
        type: 'choice',
        situation: '다 같이 소리 지르며 응원하는 분위기 속에서',
        options: [
          {
            branch: 'pos', text: '잠깐 옆에 앉아 그녀 속도에 맞춰 함께 있는다', affection: 2, tag: 'L09',
            script: [
              { type: 'narration', text: '옆에 털썩 앉아 같이 스탠드에 등을 기댔다. 멀리서 응원 함성이 파도처럼 밀려왔다 사라졌다.' },
              { type: 'line', speaker: 'player', text: '나도 잠깐 쉴래.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '응원 안 해도 돼?' },
              { type: 'line', speaker: 'player', text: '목 아까워.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(피식) 그런 이유였어?' },
              { type: 'line', speaker: 'player', text: '진짜 이유는 비밀.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '...뭐, 궁금하지도 않았어.' },
              { type: 'line', speaker: 'player', text: '여기 앉아 있으니까 좀 낫다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '그치. 여기가 제일 조용해.' },
            ],
          },
          {
            branch: 'neg', text: '억지로 끌고 가서 다 같이 응원하자고 등 떠민다', affection: -1, tag: 'D09',
            script: [
              { type: 'line', speaker: 'player', text: '야, 가서 같이 응원하자!' },
              { type: 'narration', text: '손을 잡아끌었다.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(당황하며) 어, 잠깐...' },
              { type: 'narration', text: '결국 마지못해 끌려갔지만, 내내 표정이 편치 않아 보였다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '잠시 후, 스피커에서 다음 계주 명단이 나오기 시작했다. 그녀의 손이 스케치북 모서리를 살짝 움켜쥐는 게 보였다.' },
      {
        type: 'choice',
        situation: '계주 순서가 다가오는데, 그녀가 부담스러워 보이는 순간',
        options: [
          {
            branch: 'pos', text: '크게 티 내지 않고 슬쩍 부담을 덜어줄 방법을 찾는다', affection: 2, tag: 'L10b',
            script: [
              { type: 'line', speaker: 'player', text: '(담임에게 다가가) 저희 조 순서 좀 바꿔도 될까요?' },
              { type: 'narration', text: '별일 아니라는 듯 자연스럽게 처리했다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(안도하며) 고마워.' },
              { type: 'line', speaker: 'player', text: '뭐가.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '알잖아, 뭔지.' },
              { type: 'line', speaker: 'player', text: '모르겠는데.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 모르면 됐어. ...근데 또 이런 거 안 해도 돼.' },
              { type: 'line', speaker: 'player', text: '그럼 다음부턴 말 안 할게.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '그건 또 아니고.' },
            ],
          },
          {
            branch: 'neg', text: '다들 보란 듯이 큰 소리로 그녀 순서를 알린다', affection: -1, tag: 'D10',
            script: [
              { type: 'line', speaker: 'player', text: '(크게 외치며) 다음 온이유 차례래!' },
              { type: 'narration', text: '여기저기서 시선이 몰렸다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(얼굴이 굳으며) ...' },
              { type: 'narration', text: '달리기가 끝난 뒤에도, 한동안 말이 없었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '체육대회가 끝나갈 무렵, 그녀가 다시 스케치북을 펼쳤다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '오늘 그린 건 나중에 보여줄게.' },
      { type: 'line', speaker: 'player', text: '뭐 그렸는데?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 시끄러운 거 피해 다니는 사람.' },
      { type: 'line', speaker: 'player', text: '그거 나야?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(모르는 척) 글쎄.' },
      { type: 'line', speaker: 'player', text: '보여줄 거면 제대로 그려줘.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '주문이 많네.' },
      { type: 'narration', text: '스피커에서 다음 종목을 알리는 소리가 울렸지만, 스탠드 구석만은 여전히 조용했다. 그 조용함이 오늘 하루 중 가장 편안한 순간처럼 느껴졌다.' },
    ],
  },

  {
    id: 'ch06', order: 6, grade: 1, season: 'autumn', title: '가을 소풍', bg: 'b14',
    script: [
      { type: 'narration', text: '단풍이 곱게 물든 교외로 학년 소풍을 떠났다. 도착하자마자 자유시간이 주어졌고, 다들 삼삼오오 흩어지기 시작했다. 버스에서 내리자마자 선선한 가을바람이 불어왔다.', sheAbsent: true },
      { type: 'narration', text: '온이유가 옆에서 두리번거리고 있었다. 어디로 갈지 아직 정하지 못한 눈치였다.' },
      { type: 'line', speaker: 'player', text: '어디로 갈지 정했어?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '아니, 아직.' },
      { type: 'line', speaker: 'player', text: '나도.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '다들 벌써 저쪽으로 몰려가네.' },
      { type: 'line', speaker: 'player', text: '안 가고 싶은 표정인데.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '티 나?' },
      {
        type: 'choice',
        situation: '반 친구들은 소란스러운 놀이 구역으로 몰려가고',
        options: [
          {
            branch: 'pos', text: '조용한 산책로 쪽으로 같이 걷자고 제안한다', affection: 2, tag: 'L11',
            script: [
              { type: 'line', speaker: 'player', text: '저쪽 산책로는 어때, 사람도 별로 없어 보이고.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(살짝 놀라며) 어떻게 알았어, 거기 가고 싶었는데.' },
              { type: 'line', speaker: 'player', text: '딱 네 취향 같아서.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '...그렇게 잘 아는 척은.' },
              { type: 'line', speaker: 'player', text: '틀렸어?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '아니, 맞아서 더 그래.' },
              { type: 'narration', text: '그래도 발걸음은 순순히 산책로 쪽으로 향했다. 낙엽 밟는 소리가 두 사람 사이로 조용히 퍼졌다.' },
            ],
          },
          {
            branch: 'neg', text: '다 같이 시끄러운 쪽으로 가자고 이끈다', affection: -1, tag: 'D11',
            script: [
              { type: 'line', speaker: 'player', text: '야, 저기 놀이 구역 가자!' },
              { type: 'narration', text: '대답도 듣지 않고 앞장서 걸었다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(한숨을 삼키며) ...알겠어.' },
              { type: 'narration', text: '시끌벅적한 무리 속에서, 그녀는 내내 한 발짝 떨어져 걸었다. 말수도 눈에 띄게 줄어 있었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '단풍나무가 늘어선 길에 다다르자, 그녀가 걸음을 멈추고 가방에서 스케치북을 꺼냈다. 붉고 노란 잎들이 머리 위로 지붕처럼 드리워 있었다.' },
      {
        type: 'choice',
        situation: '단풍을 배경으로 스케치를 하고 싶어하는 그녀',
        options: [
          {
            branch: 'pos', text: '시간을 넉넉히 두고 그리게 기다려준다', affection: 2, tag: 'L12',
            script: [
              { type: 'line', speaker: 'player', text: '천천히 그려, 시간 많아.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '진짜? 오래 걸릴 수도 있는데.' },
              { type: 'line', speaker: 'player', text: '어차피 딱히 할 것도 없어.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그런 식으로 말하니까 편하네. 고마워.' },
              { type: 'line', speaker: 'player', text: '그동안 나는 뭐 해?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '옆에서 구경이나 해.' },
            ],
          },
          {
            branch: 'neg', text: '버스 시간 늦는다며 재촉한다', affection: -1, tag: 'D12',
            script: [
              { type: 'line', speaker: 'player', text: '빨리 좀 그려, 버스 시간 늦어.' },
              { type: 'narration', text: '손목시계를 자꾸 들여다봤다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(서둘러 연필을 놀리며) 알았어, 알았어.' },
              { type: 'narration', text: '결국 다 그리지 못한 채 스케치북을 덮었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '돌아가는 버스 안, 창밖으로 노을이 산등성이를 붉게 물들이고 있었다. 그녀가 스치는 단풍을 바라보며 입을 열었다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '오늘 그린 거, 마음에 들어.' },
      { type: 'line', speaker: 'player', text: '다행이네.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '다음에 또 이런 데 오면...' },
      { type: 'line', speaker: 'player', text: '또 같이 가자는 거지?' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(창밖을 보며) 누가 그렇대.' },
      { type: 'line', speaker: 'player', text: '표정은 그렇게 말 안 하는데.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '착각이야.' },
      { type: 'narration', text: '하지만 그 말을 하는 입가엔, 옅은 미소가 걸려 있었다. 버스 유리창 너머로 붉게 물든 산이 천천히 멀어져 갔다.' },
    ],
  },

  {
    id: 'ch07', order: 7, grade: 1, season: 'winter', title: '기말고사', bg: 'b5',
    script: [
      { type: 'narration', text: '기말고사 기간, 도서관은 평소보다 훨씬 붐볐다. 자리마다 빼곡히 앉은 학생들 사이로 사각거리는 연필 소리만 낮게 깔렸다. 빈자리를 찾다 우연히 같은 테이블에 앉게 됐다.', sheAbsent: true },
      { type: 'narration', text: '온이유가 문제집을 펴놓고 미간을 잔뜩 찌푸리고 있었다. 창밖엔 눈이라도 내릴 듯 하늘이 잔뜩 흐렸다.' },
      { type: 'line', speaker: 'player', text: '뭐가 그렇게 어려워?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(고개도 안 들고) 이 문제, 세 번째 풀어도 안 풀려.' },
      {
        type: 'choice',
        situation: '막힌 문제를 붙잡고 혼자 끙끙대는 그녀',
        options: [
          {
            branch: 'pos', text: '아는 부분을 차분히 같이 짚어가며 설명해준다', affection: 2, tag: 'L13',
            script: [
              { type: 'line', speaker: 'player', text: '어디 봐봐.' },
              { type: 'narration', text: '문제집을 슬쩍 끌어와 같이 들여다봤다.' },
              { type: 'line', speaker: 'player', text: '여기서부터 막힌 거지? 이 부분만 다르게 풀면 돼.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 커지며) 아, 이거였어?' },
              { type: 'line', speaker: 'player', text: '어렵게 생각했네.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '고마워. ...근데 매번 이렇게 잘난 척할 필요는 없잖아.' },
              { type: 'line', speaker: 'player', text: '방금 칭찬 아니었어?' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '몰라.' },
              { type: 'narration', text: '그러면서도 문제집을 다시 끌어가는 손길이 한결 가벼워 보였다.' },
            ],
          },
          {
            branch: 'neg', text: '별일 아니라는 듯 "그냥 넘어가" 하고 만다', affection: -1, tag: 'D13',
            script: [
              { type: 'line', speaker: 'player', text: '그냥 넘어가, 어차피 한 문제야.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(연필을 내려놓으며) ...그런가, 그렇겠지.' },
              { type: 'narration', text: '더 이상 그 문제를 붙잡지 않았지만, 표정은 개운치 않아 보였다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '한 시간쯤 지나자, 연필 소리와 책장 넘기는 소리만 반복되고 있었다. 둘 다 지쳐가고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(짜증 섞인 투로) 자꾸 다리 떨지 마, 신경 쓰여.' },
      { type: 'line', speaker: 'player', text: '(놀라며) 어, 미안.' },
      {
        type: 'choice',
        situation: '시험 스트레스로 예민해진 순간, 사소한 말다툼 직전',
        options: [
          {
            branch: 'pos', text: '한 발 물러나 차분한 톤으로 다시 말을 건넨다', affection: 2, tag: 'L14',
            script: [
              { type: 'narration', text: '한 박자 쉬고, 목소리를 낮췄다.' },
              { type: 'line', speaker: 'player', text: '미안, 몰랐어. 많이 피곤하지.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(한숨) ...나도 좀 예민했어. 미안.' },
              { type: 'line', speaker: 'player', text: '잠깐 쉬었다 할래?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '...그럴까.' },
              { type: 'narration', text: '둘이 나란히 자리에서 일어나 휴게 공간으로 향했다. 자판기 앞에서 잠깐의 침묵이 오히려 편안하게 느껴졌다.' },
            ],
          },
          {
            branch: 'neg', text: '똑같이 날 선 말투로 맞받아친다', affection: -1, tag: 'D14',
            script: [
              { type: 'line', speaker: 'player', text: '너나 한숨 좀 그만 쉬어.' },
              { type: 'narration', text: '그녀의 표정이 순간 굳었다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '...' },
              { type: 'narration', text: '그 뒤로 한동안 서로 말을 건네지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '시험이 끝나갈 무렵, 다행히 눈은 내리지 않고 흐린 하늘만 이어졌다. 도서관을 나서며 그녀가 먼저 입을 열었다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '오늘 고마웠어.' },
      { type: 'line', speaker: 'player', text: '뭐가, 문제 풀어준 거?' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '그것도 있고. ...같이 있어준 것도.' },
      { type: 'line', speaker: 'player', text: '다음 시험 때도 여기 있을 거야?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 자리 뺏기지나 마.' },
      { type: 'line', speaker: 'player', text: '그건 내가 할 말인데.' },
      { type: 'narration', text: '도서관 문을 나서자 차가운 바람이 훅 끼쳤다. 시험 기간치고는, 두 사람의 발걸음이 어쩐지 가벼웠다.' },
    ],
  },

  {
    id: 'ch08', order: 8, grade: 1, season: 'winter', title: '첫눈', bg: 'b2',
    script: [
      { type: 'narration', text: '1학년 마지막 하굣길, 운동장을 가로질러 걷고 있었다. 겨울방학이 코앞이라 다들 들뜬 얼굴이었다. 하늘은 아까부터 계속 무겁게 가라앉아 있었다.', sheAbsent: true },
      { type: 'narration', text: '문득 하늘에서 하얀 것이 흩날리기 시작했다. 처음엔 먼지인가 싶었는데, 이내 눈이라는 걸 알아챘다.', sheAbsent: true },
      { type: 'line', speaker: 'player', text: '어, 눈이다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(하늘을 올려다보며) 진짜네. 올해 첫눈이다.' },
      {
        type: 'choice',
        situation: '눈이 내리기 시작하는 걸 먼저 알아챈 순간',
        options: [
          {
            branch: 'pos', text: '잠깐 멈춰 서서 그녀와 함께 첫눈을 맞는다', affection: 2, tag: 'L15',
            script: [
              { type: 'narration', text: '발걸음을 멈추고 나란히 서서 눈을 올려다봤다. 눈송이가 속눈썹 위로 하나둘 내려앉았다.' },
              { type: 'line', speaker: 'player', text: '첫눈 좋아해?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '좋아해. 딱 오늘 같은 날, 이불 속에서 게임하기 좋거든.' },
              { type: 'line', speaker: 'player', text: '낭만이 없네.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '낭만은 무슨. 오늘 밤 몇 판 돌릴지가 더 중요해.' },
              { type: 'line', speaker: 'player', text: '그래도 예쁘긴 하잖아.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '그건 인정.' },
            ],
          },
          {
            branch: 'neg', text: '춥다며 서둘러 안으로 들어가 버린다', affection: -1, tag: 'D15',
            script: [
              { type: 'line', speaker: 'player', text: '춥다, 빨리 들어가자.' },
              { type: 'narration', text: '대답도 안 듣고 성큼성큼 걸었다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(아쉬운 눈으로 하늘을 한 번 더 보고) ...알겠어.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '교문을 나서자 운동장 전체가 하얗게 덮이기 시작했다. 아무도 밟지 않은 눈밭이 가로등 불빛 아래 조용히 빛나고 있었다.' },
      {
        type: 'choice',
        situation: '눈 쌓인 운동장을 가로질러 갈지, 돌아갈지',
        options: [
          {
            branch: 'pos', text: '그녀가 원하는 대로 눈길을 천천히 함께 걷는다', affection: 2, tag: 'L16',
            script: [
              { type: 'line', speaker: 'player', text: '천천히 갈까?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '(눈을 밟으며) 어차피 집 가봤자 할 것도 없어.' },
              { type: 'line', speaker: 'player', text: '뭐 할 건데.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '말했잖아, 게임.' },
              { type: 'line', speaker: 'player', text: '방학 내내 그것만 할 거야?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 계획이 확고하네, 나.' },
              { type: 'line', speaker: 'player', text: '중간에 밖에 나오긴 할 거야?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '불러주면 생각은 해볼게.' },
            ],
          },
          {
            branch: 'neg', text: '빠른 길로만 혼자 앞장서서 걷는다', affection: -1, tag: 'D16',
            script: [
              { type: 'line', speaker: 'player', text: '이쪽이 빠른 길이야, 따라와.' },
              { type: 'narration', text: '눈길을 신경도 안 쓰고 성큼성큼 앞서갔다. 발자국이 어지럽게 눈밭을 헤집어놓았다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(뒤에서 눈을 조심스레 밟으며) ...같이 좀 가.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '교문 앞에서 헤어지기 직전, 그녀가 문득 걸음을 멈췄다. 눈송이가 어깨와 머리 위로 소복이 쌓이고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '1학년, 끝났네.' },
      { type: 'line', speaker: 'player', text: '시원섭섭해?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '시원한 쪽이 더 커. 방학 동안 밀린 랭크 게임 좀 해야지.' },
      { type: 'line', speaker: 'player', text: '2학년 되면 또 같은 반일까?' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(눈을 맞으며) 그럼 좋겠는데. ...뭐, 아니어도 상관없고.' },
      { type: 'line', speaker: 'player', text: '방학 잘 보내.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '너도. ...연락 정도는 해도 되고.' },
      { type: 'narration', text: '눈은 그칠 줄 모르고 계속 내렸다. 그녀가 골목 저편으로 사라질 때까지, 하얀 발자국이 나란히 이어졌다. 1학년이 그렇게, 아주 조용히 저물어가고 있었다.' },
    ],
  },

  {
    id: 'ch09', order: 9, grade: 2, season: 'spring', title: '새로운 반', bg: 'b1',
    script: [
      { type: 'narration', text: '2학년, 새 학기가 시작됐다. 아쉽게도 반은 갈렸지만, 복도에서 마주치는 게 이젠 별로 낯설지 않았다. 새로 붙은 반 배정표 앞에서 한참을 서로 찾아 헤맸던 게 무색하게, 결국 다른 반이었다.', sheAbsent: true },
      { type: 'narration', text: '쉬는 시간, 옆 반 문 앞에서 서성이다 안을 들여다봤다. 낯선 얼굴들 사이에서 그녀만 유독 눈에 띄었다.' },
      { type: 'line', speaker: 'player', text: '좀 적응됐어?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(책상에 엎드린 채) 아직. 다들 너무 시끄러워.' },
      {
        type: 'choice',
        situation: '새 반 친구들과 아직 서먹한 그녀 이야기를 듣는 순간',
        options: [
          {
            branch: 'pos', text: '조급해하지 말라며 진지하게 들어준다', affection: 2, tag: 'L17',
            script: [
              { type: 'line', speaker: 'player', text: '천천히 해도 돼. 급할 거 없잖아.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '(몸을 일으키며) ...그런가.' },
              { type: 'line', speaker: 'player', text: '1년 내내 이 반인데 뭐.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '그렇게 말하니까 좀 편해지네. 고마워. ...근데 이런 걸로 매번 고마워하긴 싫은데.' },
              { type: 'line', speaker: 'player', text: '그럼 다음부턴 그냥 넘어갈게.' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '그것도 서운하고.' },
            ],
          },
          {
            branch: 'neg', text: '"금방 친해질 텐데 뭘" 하고 가볍게 넘긴다', affection: -1, tag: 'D17',
            script: [
              { type: 'line', speaker: 'player', text: '금방 친해질 텐데 뭘 그래.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(다시 엎드리며) ...그렇겠지.' },
              { type: 'narration', text: '대화가 그대로 끊겼다. 종이 울릴 때까지 그녀는 고개를 들지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '점심시간이 되자, 다들 삼삼오오 급식실로 몰려갔다. 새로 짠 반은 유독 목소리 큰 애들이 많은지, 급식실이 평소보다 더 시끌시끌했다.' },
      {
        type: 'choice',
        situation: '점심시간마다 어디서 만날지 정하는 상황',
        options: [
          {
            branch: 'pos', text: '그녀가 편한 조용한 자리로 맞춰준다', affection: 2, tag: 'L18',
            script: [
              { type: 'line', speaker: 'player', text: '창가 구석 자리 어때, 사람도 별로 없던데.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 살짝 커지며) 어떻게 거기를.' },
              { type: 'line', speaker: 'player', text: '매번 네가 앉는 데잖아.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '보고 있었어?' },
              { type: 'line', speaker: 'player', text: '그냥 눈에 띄었어.' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(새침하게) ...그런 거 티 내지 마.' },
            ],
          },
          {
            branch: 'neg', text: '매번 시끌벅적한 급식실 중앙 자리를 고집한다', affection: -1, tag: 'D18',
            script: [
              { type: 'line', speaker: 'player', text: '오늘도 중앙 자리 가자, 애들 다 거기 있어.' },
              { type: 'narration', text: '대답도 안 듣고 자리를 맡으러 뛰어갔다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(한숨을 삼키며) ...알겠어.' },
              { type: 'narration', text: '점심 내내 소음 속에서 말수가 눈에 띄게 줄어 있었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '하굣길, 나란히 걷다가 그녀가 문득 입을 열었다. 노을이 교문 앞 가로수를 붉게 물들이고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '작년 이맘때보다 지금이 낫다.' },
      { type: 'line', speaker: 'player', text: '왜?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '그땐 네 이름도 몰랐잖아.' },
      { type: 'line', speaker: 'player', text: '하긴, 그것도 그러네.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 1년 사이에 많이 컸어, 우리.' },
      { type: 'line', speaker: 'player', text: '갑자기 어른스럽네.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(장난스럽게) 오늘만 그래.' },
      { type: 'line', speaker: 'player', text: '내일부터는 원래대로 돌아가는 거야?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '글쎄, 그건 내일 되어봐야 알지.' },
      { type: 'line', speaker: 'player', text: '애매하게 대답하네.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '원래 이런 거 애매한 게 재밌는 거야.' },
      { type: 'narration', text: '벚꽃은 아직 피지 않았지만, 봄기운은 확실히 완연해지고 있었다. 작년 이맘때와 같은 계절, 조금씩 달라진 두 사람이었다.' },
    ],
  },

  {
    id: 'ch10', order: 10, grade: 2, season: 'spring', title: '동아리 활동', bg: 'b4',
    script: [
      { type: 'narration', text: '같은 미술 관련 동아리에 들어가면서, 그녀와 마주치는 일이 부쩍 늘었다. 딱히 미술에 재능이 있어서라기보다, 어쩌다 보니 자연스럽게 신청하게 된 쪽이었다.' },
      { type: 'narration', text: '첫 모임, 동아리실에 둘러앉아 이번 학기 전시 주제를 정하는 중이었다. 낡은 이젤들과 물감 냄새가 방 안 가득 배어 있었다.' },
      { type: 'line', speaker: 'club', text: '자, 다들 의견 있으면 말해봐요.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(조심스럽게 손을 들며) 저... "일상 속 작은 순간들"은 어때요?' },
      {
        type: 'choice',
        situation: '동아리 전시 주제를 정하는 회의 시간',
        options: [
          {
            branch: 'pos', text: '그녀의 아이디어를 진지하게 듣고 힘을 실어준다', affection: 2, tag: 'L19',
            script: [
              { type: 'line', speaker: 'player', text: '그거 좋다. 부연설명 좀 해줄 수 있어?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(눈이 반짝이며) 진짜? 음, 그러니까...' },
              { type: 'narration', text: '신이 나서 설명을 이어가는 그녀 옆에서, 다른 부원들도 하나둘 고개를 끄덕이기 시작했다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(회의 끝나고) 도와줘서 고마워. ...그렇다고 매번 편들어달란 건 아니야.' },
              { type: 'line', speaker: 'player', text: '그럼 이번만 특별히 해준 거로 할게.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '그래, 그런 걸로 해.' },
            ],
          },
          {
            branch: 'neg', text: '별생각 없이 다수 의견 쪽으로 몰아간다', affection: -1, tag: 'D19',
            script: [
              { type: 'line', speaker: 'player', text: '그냥 다수결로 하죠, 다른 의견 없어요?' },
              { type: 'narration', text: '다른 목소리에 묻혀 그녀의 제안은 흐지부지 넘어갔다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(작게 한숨을 쉬며) ...그래, 뭐.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '몇 주 뒤, 전시 준비로 다들 늦게까지 남는 날이 이어졌다. 어느 날은 결국 동아리실에 둘만 남았다. 창밖은 이미 어두워지고 있었다.' },
      {
        type: 'choice',
        situation: '작업이 늦어져 동아리실에 둘만 남게 된 저녁',
        options: [
          {
            branch: 'pos', text: '조용히 옆에서 같이 마무리 작업을 돕는다', affection: 2, tag: 'L20',
            script: [
              { type: 'line', speaker: 'player', text: '나 뭐 도와줄 거 없어?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '그럼 이거 색칠 좀 해줄래.' },
              { type: 'line', speaker: 'player', text: '망치면 어떡해.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '그럼 다시 하면 되지.' },
              { type: 'narration', text: '그날따라 작업이 유독 순조롭게 끝났다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '덕분에 일찍 끝났다. 고마워.' },
            ],
          },
          {
            branch: 'neg', text: '지루하다며 먼저 가겠다고 한다', affection: -1, tag: 'D20',
            script: [
              { type: 'line', speaker: 'player', text: '나 먼저 갈게, 할 것도 없고.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(붓을 멈추고) ...어, 그래.' },
              { type: 'narration', text: '혼자 남은 그녀는 결국 예정보다 훨씬 늦게 동아리실을 나섰다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '작업을 마치고 나오니 이미 해가 저물어 있었다. 텅 빈 복도에 발소리만 나란히 울렸다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '오늘 고생했어.' },
      { type: 'line', speaker: 'player', text: '이 정도로 고생은 무슨.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '그래도 덕분에 빨리 끝났어. 집 가면 밀린 랭크 게임이나 해야지.' },
      { type: 'line', speaker: 'player', text: '방금까지 그림 그려놓고 벌써 게임 생각이야?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그게 낙이니까 어쩔 수 없어.' },
      { type: 'line', speaker: 'player', text: '오늘은 몇 판이나 할 거야?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '글쎄, 눈 떠지는 데까지?' },
      { type: 'line', speaker: 'player', text: '내일 또 학교 가야 되는데.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '그건 내일의 나한테 맡겨줘.' },
      { type: 'narration', text: '봄바람이 살짝 쌀쌀했지만, 동아리실을 나서는 두 사람의 발걸음은 가벼웠다.' },
    ],
  },

  {
    id: 'ch11', order: 11, grade: 2, season: 'summer', title: '방학 계획', bg: 'b1',
    script: [
      { type: 'narration', text: '기말고사가 끝나고 여름방학을 앞둔 마지막 주, 교실은 후덥지근한 열기로 가득했다. 선풍기 몇 대가 힘없이 돌아가고 있었지만 더위를 이기기엔 역부족이었다. 에어컨 바람이 잘 안 닿는 자리에 앉은 그녀가 연신 부채질을 하고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(부채질하며) 진짜 덥다. 나 여름 진짜 싫어해.' },
      { type: 'line', speaker: 'player', text: '매년 하는 말 아니야?' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '매년 진심이니까 문제지.' },
      {
        type: 'choice',
        situation: '그녀가 조심스럽게 방학 계획을 묻는 순간',
        options: [
          {
            branch: 'pos', text: '그녀와 시간을 맞출 수 있는 계획을 먼저 이야기한다', affection: 2, tag: 'L21',
            script: [
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '저기, 방학 때 뭐 할 거야?' },
              { type: 'line', speaker: 'player', text: '딱히 없는데, 너랑 시간 맞춰볼까.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 커지며) 진짜?' },
              { type: 'line', speaker: 'player', text: '어차피 할 것도 없고.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '그래, 그럼... 나쁘지 않네. 먼저 말해줘서 고맙긴 한데, 너무 티 내진 마.' },
              { type: 'line', speaker: 'player', text: '안 냈는데.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '표정이 이미 냈어.' },
            ],
          },
          {
            branch: 'neg', text: '별생각 없다는 듯 무성의하게 답한다', affection: -1, tag: 'D21',
            script: [
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '저기, 방학 때 뭐 할 거야?' },
              { type: 'line', speaker: 'player', text: '글쎄, 그때 가서 생각해보지 뭐.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(시선을 피하며) ...그래, 그러던가.' },
              { type: 'narration', text: '그 뒤로 그녀는 더 묻지 않았다. 종이 울릴 때까지 부채질만 계속했다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '며칠 뒤, 방학 계획을 구체적으로 정하려고 다시 이야기를 꺼냈다. 창밖 매미 소리가 한층 요란해져 있었다.' },
      {
        type: 'choice',
        situation: '어디서 만날지, 무엇을 할지 정하는 상황',
        options: [
          {
            branch: 'pos', text: '시원한 실내에서 같이 게임하거나 쉴 수 있는 곳을 제안한다', affection: 2, tag: 'L22',
            script: [
              { type: 'line', speaker: 'player', text: 'PC방 가서 같이 게임할래? 에어컨 빵빵한 데로.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(눈이 반짝이며) 진심이야?' },
              { type: 'line', speaker: 'player', text: '어차피 너 게임 좋아하잖아.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 취향 알아가네.' },
              { type: 'line', speaker: 'player', text: '같이 한 판 할까, 아니면 구경만 할래?' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '일단 가서 정하자. 마음 바뀔 수도 있으니까.' },
            ],
          },
          {
            branch: 'neg', text: '정한 것 없이 즉흥적으로 아무 데나 가자고 한다', affection: -1, tag: 'D22',
            script: [
              { type: 'line', speaker: 'player', text: '그냥 아무 데나 가지 뭐, 나가서 정하자.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(한숨) 이 더위에 밖에서 정하자고?' },
              { type: 'narration', text: '결국 정하지 못한 채 이야기가 흐지부지됐다. 그녀는 그 뒤로도 몇 번이나 더위 타령을 늘어놓았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '종업식 날, 교문 앞은 방학을 앞둔 학생들로 북적였다. 다들 들뜬 얼굴로 인사를 나누는 사이, 그녀가 조용히 다가와 말했다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '아무튼 방학 잘 보내.' },
      { type: 'line', speaker: 'player', text: '너도. 더위 조심하고.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '나야 뭐, 방 안에만 있을 거니까 상관없어.' },
      { type: 'line', speaker: 'player', text: '그럼 밖에 나올 일은 없겠네.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(장난스럽게) 불러주면 생각해본다니까.' },
      { type: 'line', speaker: 'player', text: '그 말, 벌써 두 번째야.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '기억력 좋네.' },
      { type: 'narration', text: '매미 소리가 요란하게 울려 퍼지는 여름, 방학이 시작되고 있었다. 뜨거운 햇살 아래 멀어지는 그녀의 뒷모습은, 벌써부터 시원한 방구석과 이온음료를 그리는 사람처럼 가벼워 보였다. 그런데도 눈을 뗄 수 없어서, 문득 이상하다는 생각이 스쳤다.' },
    ],
  },

  {
    id: 'ch12', order: 12, grade: 2, season: 'summer', title: '우연한 만남', bg: 'b10',
    script: [
      { type: 'narration', text: '방학 중, 동네 서점에 볼일이 있어 들렀다. 에어컨 바람이 시원하게 도는 매장 안으로 들어서는 순간, 낯익은 뒷모습이 눈에 들어왔다.', sheAbsent: true },
      { type: 'narration', text: '잡지 코너 앞에 선 온이유였다. 방학인데도 이렇게 밖에 나와 있다는 게 의외였다.' },
      {
        type: 'choice',
        situation: '예상치 못한 만남에 반가움을 어떻게 표현할지',
        options: [
          {
            branch: 'pos', text: '자연스럽게 웃으며 잠깐 같이 걷자고 한다', affection: 2, tag: 'L23',
            script: [
              { type: 'line', speaker: 'player', text: '(다가가며) 어, 여기서 다 만나네.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(돌아보며) 어? 진짜 방학인데도 마주치네.' },
              { type: 'line', speaker: 'player', text: '잠깐 같이 둘러볼래?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(살짝 웃으며) 그러든가.' },
              { type: 'line', speaker: 'player', text: '여긴 왜 왔어?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '너야말로. 방학인데 집에 안 있고.' },
              { type: 'line', speaker: 'player', text: '심심해서.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '그건 나도 마찬가지네.' },
            ],
          },
          {
            branch: 'neg', text: '어색해서 서둘러 인사만 하고 지나친다', affection: -1, tag: 'D23',
            script: [
              { type: 'line', speaker: 'player', text: '(어색하게) 어, 안녕. 그럼 나 이만.' },
              { type: 'narration', text: '인사만 하고 서둘러 다른 코너로 발걸음을 옮겼다.' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(혼잣말처럼) ...뭐야, 저래.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '나란히 매장을 둘러보다, 그녀가 걸음을 멈춘 코너 앞에 다다랐다. 게임 잡지와 캐릭터 굿즈가 진열된 매대였다.' },
      {
        type: 'choice',
        situation: '매대에서 발견한 게임 관련 굿즈나 잡지를 두고',
        options: [
          {
            branch: 'pos', text: '그녀가 좋아할 만한 걸 발견하고 알려준다', affection: 2, tag: 'L24',
            script: [
              { type: 'line', speaker: 'player', text: '이거 롤 관련 잡지 아니야? 신간인데.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 커지며) 어, 진짜네. 나 이거 몰랐어.' },
              { type: 'line', speaker: 'player', text: '살 거야?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '당연하지. ...같이 있어서 발견한 거니까, 이건 우연이 아니라고 해두자.' },
              { type: 'line', speaker: 'player', text: '그게 무슨 논리야.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '내 논리는 원래 이래.' },
              { type: 'narration', text: '계산대로 향하는 그녀의 발걸음이 평소보다 한결 가벼워 보였다.' },
            ],
          },
          {
            branch: 'neg', text: '관심 없다는 듯 그냥 지나친다', affection: -1, tag: 'D24',
            script: [
              { type: 'line', speaker: 'player', text: '이런 거 뭐 하러 사, 그냥 가자.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(매대를 슬쩍 보다 손을 떼며) ...그래, 가자.' },
              { type: 'narration', text: '결국 아무것도 사지 못한 채 서점을 나섰다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '서점을 나서니 매미 소리가 여전히 요란했다. 뜨거운 아스팔트 위로 아지랑이가 피어오르고, 손에 든 작은 종이봉투가 그녀의 걸음마다 가볍게 흔들렸다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '방학 중에 이렇게 마주치는 것도 신기하네.' },
      { type: 'line', speaker: 'player', text: '그러게. 자주 나와?' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '아니, 오늘은 살 게 있어서. 평소엔 방 밖으로 잘 안 나가.' },
      { type: 'line', speaker: 'player', text: '그럼 오늘은 특별한 날이네.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그렇게까지 특별한 건 아니고.' },
      { type: 'line', speaker: 'player', text: '그럼 뭔데.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '그냥, 나쁘지 않은 날 정도로 해두자.' },
      { type: 'narration', text: '뜨거운 햇살 아래, 두 사람은 잠시 같은 방향으로 나란히 걸었다. 매미 울음이 골목을 가득 채웠고, 그늘 하나 없는 길이었지만 걸음은 이상하게 느긋했다. 방학이라고 완전히 끊겼던 일상이, 잠깐이지만 다시 이어진 기분이었다.' },
    ],
  },

  {
    id: 'ch13', order: 13, grade: 2, season: 'summer', title: '첫 데이트', bg: 'b9',
    script: [
      { type: 'narration', text: '방학이 끝나갈 무렵, 처음으로 약속을 잡고 만나기로 했다. 우연이 아니라 진짜 약속이라는 게, 묘하게 어색하면서도 설렜다.', sheAbsent: true },
      { type: 'narration', text: '약속 장소에서 기다리는데, 저 멀리서 걸어오는 모습이 보였다. 평소보다 조금 신경 쓴 듯한 차림에, 걸음도 어딘가 조심스러웠다.', sheAbsent: true },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '(다가오며) 많이 기다렸어?' },
      { type: 'line', speaker: 'player', text: '아니, 방금 왔어.' },
      {
        type: 'choice',
        situation: '어디로 갈지 먼저 물어보는 상황',
        options: [
          {
            branch: 'pos', text: '그녀가 좋아할 만한 곳을 미리 알아봐 제안한다', affection: 2, tag: 'L25',
            script: [
              { type: 'line', speaker: 'player', text: '저번에 롤 신작 캐릭터 팝업스토어 생겼다던데, 가볼래?' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 커지며) 그거 어떻게 알았어?' },
              { type: 'line', speaker: 'player', text: '그냥 찾아봤어.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(웃으며) 준비 좀 했네. ...티 안 내려고 했는데 실패했나 보다.' },
              { type: 'line', speaker: 'player', text: '실패한 거 인정하네.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '정정할게, 실패 안 했어.' },
            ],
          },
          {
            branch: 'neg', text: '정한 거 없이 아무 데나 가자며 즉흥적으로 끈다', affection: -1, tag: 'D25',
            script: [
              { type: 'line', speaker: 'player', text: '몰라, 그냥 걷다가 아무 데나 들어가자.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(당황하며) 그래도 뭔가 정해놓지 그랬어.' },
              { type: 'narration', text: '결국 정처 없이 거리를 헤매다 시간을 꽤 흘려보냈다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '팝업스토어를 한 시간 넘게 둘러보고 나와 근처 카페에 자리를 잡았다. 시원한 에어컨 바람이 반가웠고, 그녀의 손엔 작은 캐릭터 키링이 담긴 봉투가 들려 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '근데 이거... 데이트 같은 거 아니지?' },
      {
        type: 'choice',
        situation: '"이거 데이트 같은 거 아니지?" 하고 얼버무리는 그녀',
        options: [
          {
            branch: 'pos', text: '얼버무리지 않고 담담히 진심을 이야기한다', affection: 2, tag: 'L26',
            script: [
              { type: 'line', speaker: 'player', text: '데이트 맞는 것 같은데.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(당황하며) 어, 그렇게 바로 말하면...' },
              { type: 'line', speaker: 'player', text: '아니야?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(시선을 피하며) ...아니라고 안 했어.' },
              { type: 'narration', text: '그 순간, 그녀가 처음으로 이름을 불렀다. 여느 때와는 다른, 조금 조심스러운 부름이었다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(조용히) ...사실 오늘 좀 긴장했었어.' },
              { type: 'line', speaker: 'player', text: '안 그래 보였는데.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '티 안 나게 하려고 얼마나 애썼는데.' },
            ],
          },
          {
            branch: 'neg', text: '괜히 겉으로만 아니라며 딴청을 부린다', affection: -1, tag: 'D26',
            script: [
              { type: 'line', speaker: 'player', text: '에이, 데이트는 무슨. 그냥 노는 거지.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(표정이 살짝 굳으며) ...그렇지, 그냥 노는 거지.' },
              { type: 'narration', text: '그 뒤로 그녀는 말수가 눈에 띄게 줄었다.' },
            ],
          },
        ],
      },
      { type: 'setAddressStage', value: 1 },
      { type: 'narration', text: '헤어지기 전, 그녀가 문득 걸음을 멈췄다. 노을이 골목 끝을 붉게 물들이고 있었다.' },
      { type: 'narration', text: '한참 말이 없던 그녀가, 손에 든 봉투를 살짝 만지작거리며 다시 입을 열었다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '오늘 재밌었어.' },
      { type: 'line', speaker: 'player', text: '나도.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '다음에 또 이런 데 가자.' },
      { type: 'line', speaker: 'player', text: '또 데이트하자는 거네.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(당황하며) ...그렇게 부르면 이상하잖아. 그냥, 또 놀자는 거야.' },
      { type: 'line', speaker: 'player', text: '알겠어, 그럼 다음 데이트는 내가 정할게.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(눈을 흘기며) 아 진짜, 데이트 아니라니까... 근데 뭐 할 건데?' },
      { type: 'line', speaker: 'player', text: '그건 비밀.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(입술을 살짝 깨물며 웃음을 참으며) ...치사하게 그런 게 어딨어.' },
      { type: 'narration', text: '여름 저녁 바람이 선선하게 불었다. 매미 소리도 어느새 잦아들어 있었다. 처음 이름을 불러준 그 순간이, 오래도록 마음에 남을 것 같았다. 돌아서는 뒷모습을 보며, 다음 약속이 벌써부터 기다려졌다.' },
    ],
  },

  {
    id: 'ch14', order: 14, grade: 2, season: 'autumn', title: '축제 준비', bg: 'b4',
    script: [
      { type: 'narration', text: '가을 축제가 다가오면서, 동아리 전시 부스 준비로 다들 바빠졌다. 복도마다 붙은 홍보 포스터가 축제 분위기를 한층 부풀리고 있었다.', sheAbsent: true },
      { type: 'narration', text: '부스 콘셉트를 정하는 회의, 동아리실 탁자에 둘러앉아 의견이 여러 갈래로 갈렸다.', sheAbsent: true },
      { type: 'line', speaker: 'club', text: '이번엔 뭘로 갈지 정해야 하는데, 다들 의견 내봐요.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(조심스럽게) 제 그림 중심으로 코너 하나 꾸며보는 건 어떨까요.' },
      {
        type: 'choice',
        situation: '부스 콘셉트를 두고 의견이 갈리는 순간',
        options: [
          {
            branch: 'pos', text: '그녀의 그림이 잘 드러나는 방향으로 힘을 실어준다', affection: 2, tag: 'L27',
            script: [
              { type: 'line', speaker: 'player', text: '그거 좋다. 조명이랑 배치도 그림 위주로 잡으면 되겠네.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 커지며) 진짜 그렇게 생각해?' },
              { type: 'line', speaker: 'player', text: '어, 딱 눈에 그려지는데.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(살짝 웃으며) 그렇게 말해주니까 용기 나네. 고마워. ...그렇다고 부담 주는 건 아니지?' },
              { type: 'line', speaker: 'player', text: '이미 늦었어, 부담 가져.' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '진짜 도움 안 되는 말이네.' },
            ],
          },
          {
            branch: 'neg', text: '그녀 의견은 제쳐두고 다른 의견을 밀어붙인다', affection: -1, tag: 'D27',
            script: [
              { type: 'line', speaker: 'player', text: '그것보단 다른 애 의견이 낫지 않아?' },
              { type: 'narration', text: '그녀의 제안은 그대로 묻혔다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(작게) ...그래, 그게 낫겠다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '콘셉트가 정해지고, 며칠간 다들 늦게까지 남아 부스를 꾸몄다. 페인트 냄새와 톱밥 먼지가 뒤섞인 동아리실 공기가 점점 무거워졌다. 마감이 다가올수록 분위기도 함께 날카로워졌다.' },
      {
        type: 'choice',
        situation: '마감이 촉박해 다들 예민해진 저녁',
        options: [
          {
            branch: 'pos', text: '분위기를 살피며 차분하게 역할을 나눈다', affection: 2, tag: 'L28',
            script: [
              { type: 'line', speaker: 'player', text: '자, 소리 지르지 말고. 나눠서 하자 — 나는 배경, 넌 인물.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '(한숨 돌리며) 그래, 그게 낫겠다.' },
              { type: 'line', speaker: 'player', text: '급하다고 대충 하지 말고.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '그건 내가 할 말인데.' },
            ],
          },
          {
            branch: 'neg', text: '급하다고 다그치며 몰아붙인다', affection: -1, tag: 'D28',
            script: [
              { type: 'line', speaker: 'player', text: '빨리 좀 해, 시간 없어.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(붓을 멈추고) ...알아, 나도.' },
              { type: 'narration', text: '그 뒤로 그녀는 말없이 손만 바쁘게 움직였다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '늦은 밤, 겨우 부스가 완성됐다. 창밖은 이미 캄캄했고, 물감 냄새가 방 안 가득 퍼져 있었다. 다른 부원들은 하나둘 먼저 돌아간 뒤였다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '드디어 끝났다.' },
      { type: 'line', speaker: 'player', text: '고생 많았어.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '이제 집 가서 밀린 랭크나 채워야지.' },
      { type: 'line', speaker: 'player', text: '방금까지 그림 그려놓고 벌써?' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 이게 낙이라니까, 몇 번을 말해.' },
      { type: 'line', speaker: 'player', text: '축제날엔 그럴 시간도 없을걸.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '그건 그때 가서 걱정할래.' },
      { type: 'narration', text: '텅 빈 동아리실에 물감 냄새만 남아 있었다. 완성된 부스 한구석엔, 그녀의 그림이 조명 아래 조용히 자리 잡고 있었다. 며칠간의 피로가 무색하게, 완성된 부스는 생각보다 근사했다. 내일이면 이 그림도, 지금까지의 고생도 사람들 앞에 드러날 참이었다.' },
    ],
  },

  {
    id: 'ch15', order: 15, grade: 2, season: 'autumn', title: '축제 당일', bg: 'b15',
    script: [
      { type: 'narration', text: '축제 당일, 어제 완성한 부스가 드디어 문을 열었다. 복도는 이미 다른 반 학생들로 북적였고, 곳곳에서 웃음소리와 음악 소리가 뒤섞여 들려왔다.', sheAbsent: true },
      { type: 'narration', text: '부스 안, 그녀는 긴장한 기색이 역력한 얼굴로 자기 그림 앞을 서성이고 있었다.' },
      { type: 'line', speaker: 'visitor', text: '우와, 이거 누가 그린 거예요?' },
      {
        type: 'choice',
        situation: '부스를 구경하러 온 다른 반 친구들 앞에서',
        options: [
          {
            branch: 'pos', text: '그녀의 작품을 진심으로, 자세히 소개한다', affection: 2, tag: 'L29',
            script: [
              { type: 'line', speaker: 'player', text: '얘가 그린 거예요. 여기 명암 처리 진짜 잘 봐야 돼요.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(당황하며) 그렇게까지 자세히 안 해도...' },
              { type: 'line', speaker: 'player', text: '진짜 잘 그렸잖아.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(얼굴이 살짝 붉어지며) 고마워. ...근데 다음엔 미리 말하고 그래.' },
              { type: 'line', speaker: 'player', text: '왜, 부끄러워?' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '당연하지, 누가 안 그러겠어.' },
            ],
          },
          {
            branch: 'neg', text: '"그냥 그림이야" 하고 대충 넘긴다', affection: -1, tag: 'D29',
            script: [
              { type: 'line', speaker: 'player', text: '아, 그냥 동아리에서 그린 그림이에요.' },
              { type: 'narration', text: '대충 흘려 넘긴 소개에, 학생들도 금세 흥미를 잃고 지나갔다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(작게 한숨) ...그래, 그런 거지 뭐.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '오후가 되자 부스를 찾는 발길이 눈에 띄게 줄었다. 여기저기서 뒷정리하는 소리가 들리기 시작했고, 창밖으로는 벌써 노을이 번지고 있었다. 정리를 마치고 슬슬 하루를 마무리할 시간이었다.' },
      { type: 'line', speaker: 'club', text: '다들 고생했는데 뒤풀이 갈 사람?' },
      {
        type: 'choice',
        situation: '부스 정리 후, 뒤풀이는 어디서',
        options: [
          {
            branch: 'pos', text: '동아리 친구들과 조용히 마무리 시간을 갖는다', affection: 2, tag: 'L30',
            script: [
              { type: 'line', speaker: 'player', text: '근처 카페에서 조용히 마무리하는 건 어때요?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(안도하며) 그게 낫겠다.' },
              { type: 'line', speaker: 'player', text: '시끄러운 데 싫어하잖아.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '잘 아네. ...그렇다고 매번 맞춰줄 필요는 없는데.' },
              { type: 'line', speaker: 'player', text: '그럼 다음엔 시끄러운 데로 갈까?' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '그건 또 아니고.' },
            ],
          },
          {
            branch: 'neg', text: '시끌벅적한 뒤풀이 자리로 끌고 간다', affection: -1, tag: 'D30',
            script: [
              { type: 'line', speaker: 'player', text: '다 같이 노래방 가죠!' },
              { type: 'narration', text: '그녀는 마지못해 따라갔지만, 내내 구석 자리에서 말이 없었다.' },
            ],
          },
        ],
      },
      { type: 'narration', bg: 'b9', text: '카페에 자리를 잡고 앉자, 그녀가 컵을 만지작거리며 입을 열었다. 창밖으로 축제의 여운이 남은 교정이 어스름하게 저물고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '오늘 그림, 봐준 사람 많았어.' },
      { type: 'line', speaker: 'player', text: '잘 그렸으니까.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '그렇게 말하니까 좀 부끄럽네. ...근데 싫진 않아.' },
      { type: 'line', speaker: 'player', text: '이제 집 가서 쉬어야지.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(눈이 반짝이며) 어, 오늘은 진짜 밀린 랭크 갚아야 해.' },
      { type: 'line', speaker: 'player', text: '축제까지 치르고 무슨 힘이 남았대.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '이건 완전히 다른 종류의 힘이야.' },
      { type: 'narration', text: '긴 하루였지만, 카페를 나서는 그녀의 발걸음은 가벼워 보였다. 저녁 공기가 선선하게 스쳐 지나갔다. 오늘의 뿌듯함과 오늘 밤의 기대가, 나란히 그녀 안에 자리 잡은 듯했다.' },
    ],
  },

  {
    id: 'ch16', order: 16, grade: 2, season: 'winter', title: '크리스마스', bg: 'b9',
    script: [
      { type: 'narration', text: '연말 분위기가 완연한 거리, 크리스마스 캐럴이 곳곳에서 흘러나왔다. 상점마다 내걸린 트리 장식이 반짝였다. 이번에도 진짜 약속을 잡고 만나기로 했다 — 사실상 두 번째 데이트였다.', sheAbsent: true },
      { type: 'narration', text: '약속 장소에서 기다리는데, 목도리를 두른 채 종종걸음으로 다가오는 모습이 보였다.', sheAbsent: true },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(숨을 고르며) 늦어서 미안, 많이 기다렸어?' },
      { type: 'line', speaker: 'player', text: '방금 왔어.' },
      {
        type: 'choice',
        situation: '어디서 시간을 보낼지 정하는 순간',
        options: [
          {
            branch: 'pos', text: '사람 적은 조용한 카페나 전시를 제안한다', affection: 2, tag: 'L31',
            script: [
              { type: 'line', speaker: 'player', text: '저 골목에 보드게임 카페 생겼던데, 조용하고 사람도 별로 없대.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 커지며) 오, 거기 게임 종류 많아?' },
              { type: 'line', speaker: 'player', text: '꽤 많다던데.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 오늘 지는 사람이 뭐 사기, 어때?' },
              { type: 'line', speaker: 'player', text: '그거 나 불리한 제안 아니야?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '그럼 시작도 하기 전에 포기하는 거야?' },
              { type: 'line', speaker: 'player', text: '누가 포기한대, 각오해.' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '그 말, 나중에 후회하지나 마.' },
            ],
          },
          {
            branch: 'neg', text: '사람 몰리는 번화가 한복판을 고집한다', affection: -1, tag: 'D31',
            script: [
              { type: 'line', speaker: 'player', text: '크리스마스인데 번화가 가서 분위기 좀 느껴야지.' },
              { type: 'narration', text: '인파에 밀려 제대로 걷기도 힘들 지경이었다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(지친 얼굴로) ...이런 데 딱 질색인데.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '보드게임 카페에 자리를 잡고 앉으니, 창밖으로 눈이 흩날리기 시작했다. 따뜻한 조명 아래 테이블마다 웃음소리가 낮게 깔려 있었다.' },
      { type: 'narration', text: '첫 판은 그녀의 압승이었다. 승리가 확정되는 순간, 그녀가 장난스럽게 내 손을 덥석 잡아 번쩍 들어 올렸다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(신나서) 봐봐, 내가 이겼잖아! 각오하랬지?' },
      { type: 'line', speaker: 'player', text: '야, 손 놔. 사람들 다 봐.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(그제야 손을 놓으며) ...어, 그러네. 나도 모르게.' },
      { type: 'narration', text: '순간 어색해진 그녀가 헛기침을 하며 다시 카드를 섞기 시작했다. 귀끝이 살짝 붉어져 있었다.' },
      {
        type: 'choice',
        situation: '헤어지기 직전, 작은 선물을 건네는 순간',
        options: [
          {
            branch: 'pos', text: '직접 고르거나 만든 정성이 담긴 것을 건넨다', affection: 2, tag: 'L32',
            script: [
              { type: 'line', speaker: 'player', text: '(봉투를 건네며) 이거, 크리스마스 선물.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(놀라며) 뭐야, 준비했어?' },
              { type: 'line', speaker: 'player', text: '열어봐.' },
              { type: 'narration', text: '봉투 안에는 그녀가 좋아하는 캐릭터가 그려진 마우스패드가 들어 있었다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(눈이 커지며) 이거 어떻게 알고... 고마워. ...근데 나도 준비했는데 이렇게 세심할 줄은 몰랐어.' },
              { type: 'line', speaker: 'player', text: '내 선물이 더 좋았나 보네.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(마우스패드를 꼭 안으며) ...누가 그렇대. 근데 뭐, 오늘만 인정해줄게.' },
            ],
          },
          {
            branch: 'neg', text: '급하게 아무거나 사 온 티가 나는 걸 건넨다', affection: -1, tag: 'D32',
            script: [
              { type: 'line', speaker: 'player', text: '(편의점 봉투를 건네며) 자, 크리스마스 선물.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(봉투 안을 보고) ...이거 방금 편의점에서 산 거지?' },
              { type: 'narration', text: '부정할 수 없는 타이밍이었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '헤어지기 전, 그녀가 눈을 맞으며 입을 열었다. 가로등 불빛이 떨어지는 눈송이를 하나하나 비추고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '오늘도 재밌었어.' },
      { type: 'line', speaker: 'player', text: '다음엔 내가 이길 거야, 보드게임.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '그건 두고 봐야 알지.' },
      { type: 'line', speaker: 'player', text: '메리 크리스마스.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(조용히 웃으며) ...너도.' },
      { type: 'narration', text: '눈발이 조금씩 굵어지는 거리 위로, 캐럴 소리가 은은하게 이어지고 있었다. 올해도 얼마 남지 않았다는 게, 새삼스럽게 느껴지는 밤이었다. 마우스패드가 담긴 봉투를 안고 걷는 발걸음이 유난히 가벼워 보였다.' },
    ],
  },

  {
    id: 'ch17', order: 17, grade: 2, season: 'winter', title: '한 해의 끝', bg: 'b8',
    script: [
      { type: 'narration', text: '겨울방학을 앞둔 마지막 하굣길, 올 한 해를 정리하듯 조용한 공기가 감돌았다. 가로등 불빛 아래로 입김이 하얗게 퍼졌고, 발밑에서는 얼어붙은 눈이 뽀득뽀득 소리를 냈다.', sheAbsent: true },
      { type: 'narration', text: '나란히 걷던 그녀가 문득 걸음을 늦추며 입을 열었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '올해도 벌써 다 갔네.' },
      { type: 'narration', text: '그녀는 하얀 입김을 내뱉으며 잠시 하늘을 올려다보았다. 구름 사이로 흐릿한 달이 걸려 있었다.' },
      {
        type: 'choice',
        situation: '올 한 해 기억에 남는 순간을 묻는 그녀',
        options: [
          {
            branch: 'pos', text: '함께 쌓아온 순간들을 하나하나 꺼내며 이야기한다', affection: 2, tag: 'L33',
            script: [
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '너는 올해 뭐가 제일 기억에 남아?' },
              { type: 'line', speaker: 'player', text: '음, 축제 때 부스 꾸미던 거? 아니면 방학 때 우연히 마주친 거.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 커지며) 그런 것까지 기억해?' },
              { type: 'line', speaker: 'player', text: '생각보다 많이 남았더라.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(조용히 웃으며) 나도, 사실. ...이렇게 말하니까 낯간지럽네.' },
            ],
          },
          {
            branch: 'neg', text: '딱히 기억나는 게 없다는 듯 무심하게 답한다', affection: -1, tag: 'D33',
            script: [
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '너는 올해 뭐가 제일 기억에 남아?' },
              { type: 'line', speaker: 'player', text: '글쎄, 딱히 기억나는 거 없는데.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(시선을 내리며) ...그렇구나.' },
              { type: 'narration', text: '그녀는 더 이상 그 이야기를 이어가지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '이야기가 끊긴 자리를 메우듯, 두 사람은 한동안 말없이 걸음만 옮겼다. 골목 끝, 편의점 앞 벤치에 잠깐 앉았다. 캔에 담긴 따뜻한 음료 두 개가 손에 들려 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '내년엔 3학년이네. ...좀 무섭다.' },
      {
        type: 'choice',
        situation: '내년에 3학년이 된다는 부담을 슬쩍 내비치는 순간',
        options: [
          {
            branch: 'pos', text: '진지하게 그녀의 걱정을 들어준다', affection: 2, tag: 'L34',
            script: [
              { type: 'line', speaker: 'player', text: '뭐가 제일 걱정돼?' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '그냥, 다 처음이니까. 잘할 수 있을지 모르겠어.' },
              { type: 'line', speaker: 'player', text: '지금까지도 잘해왔잖아.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게) ...그런 말 들으니까 조금 낫다.' },
            ],
          },
          {
            branch: 'neg', text: '"다 잘될 거야" 하고 가볍게 흘려듣는다', affection: -1, tag: 'D34',
            script: [
              { type: 'line', speaker: 'player', text: '에이, 다 잘될 거야. 걱정을 왜 해.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(표정이 살짝 굳으며) ...그래, 그렇겠지.' },
              { type: 'narration', text: '가벼운 위로였지만, 그녀에겐 닿지 않은 듯했다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '벤치에 앉아 캔을 감싸 쥔 손이 따뜻했다. 지나가는 사람들의 발소리만 이따금 정적을 깼고, 저 멀리 신호등이 깜빡이며 빨갛게 물들었다 사라지길 반복했다.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '그래도, 내년에도 같은 반이면 좋겠다.' },
      { type: 'line', speaker: 'player', text: '그럴 확률이 얼마나 될까.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '낮겠지. 그래도 바라는 건 자유잖아.' },
      { type: 'line', speaker: 'player', text: '반이 갈려도 어차피 또 마주칠 거야.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그건 그러네. ...올해도 고마웠어.' },
      { type: 'narration', text: '캔 온기가 식어갈 때까지, 두 사람은 한동안 말없이 나란히 앉아 있었다. 멀리서 자정을 알리는 종소리 같은 것이 희미하게 들려온 것도 같았다. 다가올 3학년이 어떤 얼굴을 하고 있을지는, 아직 아무도 알 수 없었다.' },
    ],
  },

  {
    id: 'ch18', order: 18, grade: 3, season: 'spring', title: '진로 고민', bg: 'b1',
    script: [
      { type: 'narration', text: '새 학년이 시작된 지 얼마 안 된 3월, 교실 창밖으로 아직 앙상한 벚나무 가지가 흔들렸다. 새 반, 새 담임, 낯선 급훈 앞에서도 두 사람은 다행히 또 같은 반이었고, 자리도 우연히 가까웠다.' },
      { type: 'line', speaker: 'player', text: '담임이 진로 상담 신청서 내라던데, 넌 뭐 적었어?' },
      { type: 'narration', text: '그녀는 책상 서랍에서 반쯤 접힌 종이를 꺼냈다가, 다시 슬그머니 밀어 넣었다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(잠시 머뭇거리다) ...아직 못 냈어.' },
      { type: 'narration', text: '평소라면 뭐든 미루지 않는 그녀였다. 그런 그녀가 며칠째 신청서를 붙잡고만 있다는 게 마음에 걸렸다.' },
      {
        type: 'choice',
        situation: '진로를 두고 조심스럽게 속내를 털어놓는 순간',
        options: [
          {
            branch: 'pos', text: '끝까지 진지하게 듣고 그녀의 꿈을 존중해준다', affection: 2, tag: 'L35',
            script: [
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '사실, 미대 실기 준비를 해볼까 진지하게 생각 중이야.' },
              { type: 'line', speaker: 'player', text: '그래? 어쩌다가.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '그동안 그냥 해오던 건데, 막상 진로로 놓고 보니까 겁도 나고. 근데 해보고 싶어.' },
              { type: 'line', speaker: 'player', text: '겁나는 건 당연한 거 아니야? 하고 싶으면 하는 거지.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 웃으며) 그렇게 쉽게 말해주니까 오히려 마음이 놓이네.' },
            ],
          },
          {
            branch: 'neg', text: '"그냥 편한 길로 가" 하며 가볍게 조언한다', affection: -1, tag: 'D35',
            script: [
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '사실, 미대 실기 준비를 해볼까 진지하게 생각 중이야.' },
              { type: 'line', speaker: 'player', text: '그거 힘들다던데, 그냥 무난한 데로 가는 게 낫지 않아?' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(표정이 굳으며) ...무난한 게 뭔지도 잘 모르겠는데.' },
              { type: 'narration', text: '그녀는 신청서를 도로 가방에 넣으며 화제를 돌렸다. 창밖을 보는 옆얼굴이 평소보다 굳어 있었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '며칠 뒤 하굣길, 그녀의 얼굴에 그늘이 짙어 보였다. 평소보다 가방을 꽉 움켜쥔 손에 힘이 들어가 있었고, 걸음도 평소보다 한 박자씩 느렸다.' },
      { type: 'line', speaker: 'player', text: '오늘따라 기운이 없어 보이네.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '어제 부모님이랑 얘기했는데... 미대는 돈도 많이 들고 취업도 불안정하다고, 걱정을 많이 하시더라.' },
      {
        type: 'choice',
        situation: '부모님 반대 등 현실적인 걱정을 말하는 순간',
        options: [
          {
            branch: 'pos', text: '섣불리 답을 주지 않고 그녀 편에서 같이 고민한다', affection: 2, tag: 'L36',
            script: [
              { type: 'line', speaker: 'player', text: '그 얘기 듣고 넌 어떤 생각이 들었어?' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '...솔직히 나도 확신은 없어. 그냥 겁만 나는 건지, 진짜 안 맞는 건지도 헷갈리고.' },
              { type: 'line', speaker: 'player', text: '지금 당장 정답 낼 필요는 없잖아. 천천히 생각해봐도 되지.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(눈을 마주치며) ...그렇게 말해주는 사람이 있는 것만으로도 다행이다.' },
              { type: 'line', speaker: 'player', text: '다행이면 자주 이용해도 되는데.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(피식 웃으며) ...그런 거 함부로 말하면 진짜 자주 부른다.' },
              { type: 'narration', text: '웃는 얼굴 위로 아직 남은 걱정의 그림자가 살짝 옅어져 있었다.' },
            ],
          },
          {
            branch: 'neg', text: '대수롭지 않다는 듯 서둘러 결론부터 내린다', affection: -1, tag: 'D36',
            script: [
              { type: 'line', speaker: 'player', text: '부모님 말씀도 일리 있네. 그냥 그쪽으로 안 가는 게 낫겠다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(시선을 피하며) ...너까지 그렇게 말하니까 할 말이 없네.' },
              { type: 'narration', text: '그녀는 더 이상 그 얘기를 꺼내지 않았고, 남은 하굣길은 유독 조용했다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '교문을 나서자 봄바람이 불어와 벚꽃 잎 몇 장을 흩날렸다. 그녀는 잠시 걸음을 멈추고 떨어지는 꽃잎을 바라보았다. 손바닥 위에 내려앉은 꽃잎 한 장을 가만히 들여다보다, 이내 훅 불어 날려 보냈다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '정답이 딱 정해져 있으면 편할 텐데. 아무도 정답을 안 알려주네.' },
      { type: 'line', speaker: 'player', text: '정답 없는 거, 원래 그런 거 아니야?' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(피식 웃으며) 위로인지 그냥 하는 말인지 모르겠지만, 그래도 고마워.' },
      { type: 'narration', text: '멀어지는 그녀의 뒷모습 위로 저녁 햇살이 길게 드리웠다. 신청서 마감일은 다음 주였다. 그때까지 그녀가 어떤 답을 적어낼지는, 아직 그녀 자신도 모르는 듯했다.' },
    ],
  },

  {
    id: 'ch19', order: 19, grade: 3, season: 'spring', title: '입시 준비 시작', bg: 'b8',
    script: [
      { type: 'narration', text: '신청서를 낸 지 얼마 지나지 않아, 그녀는 방과 후 곧장 실기 학원으로 향하기 시작했다. 빈 자리가 하루하루 늘어가는 하굣길이 낯설게 느껴졌다.' },
      { type: 'line', speaker: 'player', text: '이번 주 토요일에 다 같이 보기로 한 거, 기억하지?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(휴대폰을 확인하며) 아... 미안한데, 그날 학원에서 갑자기 특강이 잡혔어.' },
      { type: 'narration', text: '며칠 전까지만 해도 없던 일정이었다. 그녀의 표정에서 미안함과 난감함이 동시에 묻어났다.' },
      {
        type: 'choice',
        situation: '갑자기 일정이 바뀌어 약속이 취소되는 순간',
        options: [
          {
            branch: 'pos', text: '괜찮다며 그녀의 사정을 먼저 배려한다', affection: 2, tag: 'L37',
            script: [
              { type: 'line', speaker: 'player', text: '어쩔 수 없지, 그런 거면 당연히 그쪽이 먼저지.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(눈이 살짝 커지며) ...화 안 내?' },
              { type: 'line', speaker: 'player', text: '화낼 일이야, 이게?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 웃으며) 아니, 고마워서. ...너무 당연하게 이해해줘서 오히려 이상하네.' },
            ],
          },
          {
            branch: 'neg', text: '서운함을 대놓고 티 내며 몰아붙인다', affection: -1, tag: 'D37',
            script: [
              { type: 'line', speaker: 'player', text: '또? 요즘 맨날 이런 식이네.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(시선을 내리며) ...나도 이러고 싶어서 이러는 거 아니야.' },
              { type: 'narration', text: '그녀는 더 말을 잇지 않고 휴대폰을 가방에 집어넣었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '그로부터 며칠 뒤, 늦은 오후 학원 건물 앞 벤치에서 우연히 그녀와 마주쳤다. 손에는 물감이 채 마르지 않은 스케치북이 들려 있었다.' },
      { type: 'line', speaker: 'player', text: '여기서 다 보네. 잠깐 쉬는 시간이야?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(눈 밑이 거뭇한 채로) 어... 10분 남았어.' },
      { type: 'narration', text: '평소보다 목소리에 힘이 없었다. 늘 단정하던 머리카락도 오늘따라 살짝 흐트러져 있었다.' },
      {
        type: 'choice',
        situation: '지친 얼굴로 잠깐 쉬러 나온 그녀와 마주친 순간',
        options: [
          {
            branch: 'pos', text: '부담 주지 않고 조용히 곁에 있어준다', affection: 2, tag: 'L38',
            script: [
              { type: 'line', speaker: 'player', text: '그냥 옆에 좀 앉아 있어도 돼? 아무 말 안 할게.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(피식 웃으며) 뭐야 그게. ...근데, 그래 줘.' },
              { type: 'narration', text: '둘은 아무 말 없이 나란히 앉아 잠깐 눈을 붙이듯 벤치에 몸을 기댔다. 그러다 스르르 기울어진 그녀의 머리가 어깨에 살짝 닿았다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게) ...이런 게 은근 힘이 되네.' },
              { type: 'line', speaker: 'player', text: '(가만히) ...기대도 돼, 그 정도는.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(눈을 감으며 작게) ...말 안 해도 이미 기댔거든.' },
            ],
          },
          {
            branch: 'neg', text: '이것저것 캐물으며 계속 말을 건다', affection: -1, tag: 'D38',
            script: [
              { type: 'line', speaker: 'player', text: '학원 어때? 힘들지? 선생님은 어떤 사람이야?' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(지친 목소리로) ...지금 그거 다 대답할 힘이 없어.' },
              { type: 'narration', text: '그녀는 눈을 감고 잠깐이라도 쉬고 싶어 하는 눈치였지만, 질문은 쉽게 끊이지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '멀리서 학원 종소리가 울리자, 그녀는 무거운 몸을 일으켰다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '가야겠다. 오늘도 늦게 끝날 것 같아.' },
      { type: 'line', speaker: 'player', text: '끝나고 연락해, 늦어도 상관없으니까.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(뒤돌아보며 살짝 웃으며) ...응, 그럴게.' },
      { type: 'narration', text: '멀어지는 그녀의 뒷모습이 며칠 전보다 조금 더 작아 보였다. 학원 문이 닫히는 소리가 유난히 크게 울렸다. 창 너머로 불이 하나둘 켜지는 학원 건물을, 나는 한참을 서서 바라보았다.' },
    ],
  },

  {
    id: 'ch20', order: 20, grade: 3, season: 'summer', title: '여름 실기 특강', bg: 'b9',
    script: [
      { type: 'narration', text: '방학이 시작되자 학원 수업은 오전부터 밤까지 이어지는 종일반으로 바뀌었다. 매미 소리가 시끄럽게 울리는 한낮에도 그녀는 에어컨도 잘 안 나오는 실기실에 틀어박혀 있었다. 창밖으로 아지랑이가 일렁이는 게 보일 정도로 뜨거운 날이었다.' },
      { type: 'line', speaker: 'player', text: '이 더위에 하루 종일 그림 그리는 거야? 안 지쳐?' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(휴대폰 너머로) 더위는 진짜 싫은데, 이건 그냥 해야 하는 거니까.' },
      { type: 'narration', text: '일주일 만에 겨우 잡힌 짧은 만남이었다. 근처 카페 창가 자리에 마주 앉아, 그녀는 얼음이 가득한 음료부터 단숨에 들이켰다.' },
      {
        type: 'choice',
        situation: '오랜만에 잠깐 짬이 난 그녀와의 짧은 만남',
        options: [
          {
            branch: 'pos', text: '짧은 시간이라도 온전히 집중해서 함께한다', affection: 2, tag: 'L39',
            script: [
              { type: 'line', speaker: 'player', text: '시간 얼마 없으니까, 딴생각 말고 이 시간에만 집중하자.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그거 좋다. 딱 그렇게만 하자.' },
              { type: 'narration', text: '두 사람은 남은 30분 동안 학원 얘기도, 미래 얘기도 없이 시답잖은 농담만 주고받았다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(자리에서 일어나며) ...30분이 이렇게 짧았나. 다음엔 좀 더 길게 보자.' },
              { type: 'line', speaker: 'player', text: '그럼 다음엔 아예 하루 종일 비워둬.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(뒤돌아보며 살짝 웃으며) ...누가 들으면 진짜 사귀는 줄 알겠다.' },
              { type: 'narration', text: '부정하지도, 긍정하지도 않은 채 돌아서는 걸음이 평소보다 가벼워 보였다.' },
            ],
          },
          {
            branch: 'neg', text: '아쉬움을 티 내며 더 있다 가라고 붙잡는다', affection: -1, tag: 'D39',
            script: [
              { type: 'line', speaker: 'player', text: '벌써 가야 돼? 조금만 더 있다 가.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(시계를 보며) ...나도 그러고 싶은데, 늦으면 안 돼서.' },
              { type: 'narration', text: '그녀는 미안한 기색으로 서둘러 가방을 챙겼고, 짧은 만남의 여운은 아쉬움만 남긴 채 끝났다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '헤어지기 전, 그녀는 가방에서 낡은 스케치북을 꺼내 무릎에 올렸다. 표지 귀퉁이가 반질반질하게 닳아 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '오늘 그린 거 좀 볼래? 선생님한테 되게 혼났거든.' },
      { type: 'line', speaker: 'player', text: '어디 봐봐.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '(스케치북을 펼치며) 손목이 나갈 것 같아. 근데 그린 만큼 느는 게 눈에 보이니까 그건 재밌어.' },
      {
        type: 'choice',
        situation: '학원 숙제로 지친 그녀가 그림 이야기를 꺼내는 순간',
        options: [
          {
            branch: 'pos', text: '힘든 와중에도 이어가는 노력을 진심으로 알아준다', affection: 2, tag: 'L40',
            script: [
              { type: 'line', speaker: 'player', text: '진짜 많이 늘었네. 이 정도면 매일 손목 나갈 만하다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(눈이 반짝이며) 그치? 알아봐 주니까 좋다.' },
              { type: 'line', speaker: 'player', text: '이 힘든 걸 매일 하는 거잖아. 그게 더 대단한 거 같은데.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 웃으며) ...그런 말 들으려고 보여준 거 아닌데, 기분은 좋네.' },
            ],
          },
          {
            branch: 'neg', text: '"그렇게까지 해야 하나" 하고 가볍게 말한다', affection: -1, tag: 'D40',
            script: [
              { type: 'line', speaker: 'player', text: '그렇게까지 힘들게 해야 되는 거야? 적당히 해도 되지 않아?' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(스케치북을 덮으며) ...적당히 해서 될 거였으면 애초에 시작도 안 했어.' },
              { type: 'narration', text: '그녀는 스케치북을 가방에 도로 집어넣었다. 더 보여줄 마음이 사라진 듯했다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '카페를 나서자 후텁지근한 공기가 다시 훅 끼쳤다. 그녀는 손부채질을 하며 학원 쪽으로 걸음을 옮겼다.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '여름만 되면 진짜 왜 이렇게 더운지 모르겠어. 매년 적응이 안 돼.' },
      { type: 'line', speaker: 'player', text: '그래도 이 더위 지나면 방학도 끝이니까, 조금만 더 버텨.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(피식 웃으며) 위로가 되는 건지 협박이 되는 건지.' },
      { type: 'narration', text: '멀어지는 그녀의 뒷모습 위로 매미 울음소리가 다시 크게 번졌다. 여름 특강은 아직 절반도 채 지나지 않았다.' },
    ],
  },

  {
    id: 'ch21', order: 21, grade: 3, season: 'summer', title: '지친 그녀', bg: 'b3',
    script: [
      { type: 'narration', text: '특강이 후반부로 접어들자 그녀의 얼굴에서 웃음이 눈에 띄게 줄었다. 메시지 답장도 하루씩 늦어지기 시작했고, 통화 중에도 목소리에 힘이 빠져 있었다. 늦여름 매미 소리만 변함없이 시끄럽게 울렸다.' },
      { type: 'line', speaker: 'player', text: '오늘도 늦게 끝났어?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(하품을 삼키며) 어... 괜찮아. 별거 아니야.' },
      { type: 'narration', text: '"괜찮다"는 말과 달리, 눈 밑 그늘은 하루하루 짙어지고 있었다. 대화 중간중간 말이 끊기고, 같은 질문에 두 번 답하는 일도 잦아졌다. 늘 단정하던 필체마저 요 며칠은 눈에 띄게 흐트러져 있었다.' },
      {
        type: 'choice',
        situation: '애써 괜찮은 척하는 그녀의 모습을 알아챈 순간',
        options: [
          {
            branch: 'pos', text: '무리하지 말라고 솔직하게 걱정을 전한다', affection: 2, tag: 'L41',
            script: [
              { type: 'line', speaker: 'player', text: '괜찮다는 말, 나한테까지 안 해도 돼. 힘들면 힘들다고 해.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(잠시 침묵하다) ...사실 요즘 진짜 힘들어. 근데 이 정도로 힘들다고 하기도 좀 그래서.' },
              { type: 'line', speaker: 'player', text: '힘든 데 정도가 어디 있어. 힘들면 그냥 힘든 거지.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 웃으며) ...그렇게 말해주니까 조금은 숨통 트이네.' },
            ],
          },
          {
            branch: 'neg', text: '눈치채지 못한 척 평소처럼 대한다', affection: -1, tag: 'D41',
            script: [
              { type: 'line', speaker: 'player', text: '그래? 그럼 다행이고. 아무튼 오늘 뭐 했는데?' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(무미건조하게) ...그냥, 뭐. 매일 똑같지.' },
              { type: 'narration', text: '대화는 겉돌았고, 그녀의 목소리엔 감정이 실리지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '며칠 뒤 저녁, 오랜만에 만난 자리에서 사소한 계획 변경을 이야기하던 중이었다. 노을이 붉게 지는 골목 어귀, 그녀의 표정이 갑자기 굳었다.' },
      { type: 'line', speaker: 'player', text: '어, 그럼 그날 말고 다른 날로 옮길까?' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(날카롭게) 아 진짜, 그냥 좀 한 번에 정하면 안 돼?' },
      { type: 'narration', text: '평소의 그녀답지 않은 말투에 순간 정적이 흘렀다. 그녀 스스로도 놀란 듯 눈이 커졌다.' },
      {
        type: 'choice',
        situation: '갑자기 예민하게 반응하고 후회하는 그녀',
        options: [
          {
            branch: 'pos', text: '서운해하지 않고 이해한다는 태도를 보인다', affection: 2, tag: 'L42',
            script: [
              { type: 'line', speaker: 'player', text: '괜찮아, 요즘 많이 지쳤나 보다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(당황하며) ...미안. 나도 모르게 그런 말이 나왔어. 너한테 할 말은 아니었는데.' },
              { type: 'line', speaker: 'player', text: '그럴 수도 있지, 나도 신경 안 써.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(눈을 마주치며) ...받아줘서 고마워. 요즘 내가 나 같지 않네.' },
              { type: 'line', speaker: 'player', text: '너한테만 특별히 관대한 거야, 알지?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(살짝 웃으며 시선을 피하며) ...그런 말은 왜 꼭 이럴 때 하는 건데.' },
              { type: 'narration', text: '웃음을 감추려는 듯 괜히 딴 곳을 바라보는 그녀의 귀가 발갛게 물들어 있었다.' },
            ],
          },
          {
            branch: 'neg', text: '왜 그렇게까지 화를 내냐며 맞받아친다', affection: -1, tag: 'D42',
            script: [
              { type: 'line', speaker: 'player', text: '뭘 그렇게까지 화를 내? 나도 어이없네.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(시선을 떨구며) ...미안해. 근데 그렇게 받아치면 나도 할 말이 없다.' },
              { type: 'narration', text: '먼저 사과했음에도 분위기는 쉽게 풀리지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '한참 말없이 앉아 있던 그녀가 먼저 입을 열었다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '요즘 계속 이런 식이네. 나도 내가 왜 이러는지 모르겠어.' },
      { type: 'line', speaker: 'player', text: '피곤해서 그런 거지, 별거 아니야.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(작게 한숨을 쉬며) ...그래도 이런 나까지 참아주는 거, 당연한 건 아닌데.' },
      { type: 'narration', text: '밤바람이 선선하게 불어왔다. 낮 동안의 열기가 조금씩 식어가듯, 지친 하루의 끝에서 그녀는 조금씩 다시 평소의 표정을 되찾아가고 있었다.' },
    ],
  },

  {
    id: 'ch22', order: 22, grade: 3, season: 'autumn', title: '작은 오해', bg: 'b1',
    script: [
      { type: 'narration', text: '선선한 가을바람이 불기 시작한 어느 하굣길, 낙엽이 발밑에서 바스락거렸다. 입시가 코앞으로 다가오면서 교실 분위기도 어딘가 팽팽했다.', sheAbsent: true },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '있잖아, 나 요즘 계속 생각하던 게 있는데.' },
      { type: 'line', speaker: 'player', text: '뭔데?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '수시로 넣을 학교 말이야. 사실 1지망을 확 바꿔볼까 고민 중이거든.' },
      { type: 'narration', text: '평소와 달리 말투에 조심스러움이 묻어났다. 오래 고민한 티가 역력했다.' },
      {
        type: 'choice',
        situation: '진로 고민을 조심스럽게 털어놓는 그녀',
        options: [
          {
            branch: 'pos', text: '끝까지 차분히 듣고 나서 진지하게 답한다', affection: 2, tag: 'L43',
            script: [
              { type: 'line', speaker: 'player', text: '왜 바꾸고 싶어졌는데? 끝까지 얘기해봐.' },
              { type: 'line', speaker: 'onyu', expr: 'calm', text: '포트폴리오 방향이 거기랑 더 잘 맞는 것 같아서. 그리고... (한참 이야기를 이어간다)' },
              { type: 'line', speaker: 'player', text: '다 듣고 보니까, 그쪽이 너한테 더 맞는 것 같긴 하다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(옅게 웃으며) 끝까지 들어줘서 고마워. 정리가 좀 되네.' },
            ],
          },
          {
            branch: 'neg', text: '제대로 듣지도 않고 성급하게 조언부터 한다', affection: -1, tag: 'D43',
            script: [
              { type: 'line', speaker: 'player', text: '어차피 다 거기서 거기 아니야? 그냥 원래 생각한 대로 가.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(말을 멈추며) ...아직 다 얘기도 안 했는데.' },
              { type: 'line', speaker: 'player', text: '어, 미안. 계속 해봐.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(작게) ...됐어, 별로 중요한 얘기도 아니었어.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '그날 이후로 며칠간, 그녀와의 대화는 눈에 띄게 짧아졌다. 먼저 말을 걸어도 단답으로 끝나는 일이 많았고, 쉬는 시간에도 괜히 다른 자리에 앉는 날이 늘었다. 이틀째 되던 날엔 인사조차 짧게 고개만 끄덕이고 지나쳤다.' },
      { type: 'line', speaker: 'player', text: '오늘 하교 같이 할까?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(눈을 마주치지 않고) 오늘은 먼저 갈게. 할 거 있어서.' },
      { type: 'narration', text: '사흘째였다. 무슨 말을 걸어도 대화가 자꾸 겉돌았고, 예전 같으면 웃어넘겼을 농담에도 반응이 없었다. 서먹함이 매일 조금씩 두꺼워지는 게 눈에 보였다.' },
      {
        type: 'choice',
        situation: '그 뒤로 며칠간 서먹해진 분위기',
        options: [
          {
            branch: 'pos', text: '손편지에 그때의 진심을 담아 전한다', affection: 2, tag: 'L44',
            script: [
              { type: 'narration', text: '말로는 풀기 어려울 것 같아, 편지지를 사서 그날 못 다 들은 미안함과 진심을 꾹꾹 눌러 적었다. 다음 날, 그녀의 책상 위에 조용히 편지를 올려두었다.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(편지를 발견하고 멈칫하며) ...이게 뭐야.' },
              { type: 'line', speaker: 'player', text: '그냥, 하고 싶은 말이 있어서. 읽어봐.' },
              { type: 'narration', text: '그녀는 편지를 조심스럽게 집어 들고는, 대답 없이 가방 속에 넣었다.' },
            ],
          },
          {
            branch: 'neg', text: '아무 일 없었다는 듯 가볍게 넘어가려 한다', affection: -1, tag: 'D44',
            script: [
              { type: 'line', speaker: 'player', text: '왜 요즘 그렇게 새침해? 그냥 원래대로 지내자.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(시선을 피하며) ...나는 딱히 티 낸 적 없는데.' },
              { type: 'line', speaker: 'player', text: '티 났으니까 하는 말이지.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(작게) ...그렇게 대충 덮으려고 하지 좀 마.' },
              { type: 'narration', text: '가볍게 넘기려 했지만, 그녀의 목소리엔 여전히 서운함이 배어 있었다. 서먹함은 쉽게 가시지 않았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '노을이 낮아진 오후, 텅 빈 복도에 발소리만 울렸다. 창밖으로 마른 낙엽 하나가 유리창에 부딪혔다 떨어졌다. 그녀가 편지에 뭐라고 답할지, 혹은 답하지 않을지는 아직 알 수 없었다.' },
    ],
  },

  {
    id: 'ch23', order: 23, grade: 3, season: 'autumn', title: '화해', bg: 'b7',
    script: [
      { type: 'narration', text: '편지를 건넨 다음 날, 교실 문을 열자마자 그녀의 자리부터 눈이 갔다. 평소와 다르게, 그녀도 이쪽을 슬쩍 돌아보고 있었다. 눈이 마주치자 그녀는 황급히 고개를 돌렸다.' },
      { type: 'narration', text: '쉬는 시간이 되어도 선뜻 다가가지 못하고 망설였다. 어떤 말부터 꺼내야 할지, 며칠 내내 머릿속으로 되뇌었지만 막상 눈앞에 서니 아무 말도 떠오르지 않았다.' },
      {
        type: 'choice',
        situation: '어떻게 먼저 말을 걸지 고민하는 순간',
        options: [
          {
            branch: 'pos', text: '그날의 진심을 담아 솔직하게 사과한다', affection: 2, tag: 'L45',
            script: [
              { type: 'line', speaker: 'player', text: '그때 제대로 안 듣고 성급하게 말해서 미안해. 편지에 못다 한 말도 있는데, 지금 직접 하고 싶어서.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(잠시 눈을 마주치다) ...편지, 다 읽었어. 몇 번을 다시 읽었는지 몰라.' },
              { type: 'line', speaker: 'player', text: '다행이다. 전해지긴 한 거네.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 웃으며) ...그렇게 진지하게 사과할 줄은 몰랐어. 놀랐잖아.' },
            ],
          },
          {
            branch: 'neg', text: '아무 일 없었다는 듯 어물쩍 넘어가려 한다', affection: -1, tag: 'D45',
            script: [
              { type: 'line', speaker: 'player', text: '어제 일은 그냥 잊자. 우리 사이에 뭘 그런 걸로.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(시선을 내리며) ...그렇게 넘어가면, 편지는 왜 준 거야?' },
              { type: 'narration', text: '얼버무리려던 말이 오히려 그녀를 더 서운하게 만든 듯했다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '방과 후, 늘 지나치던 공원 벤치에 나란히 앉았다. 낙엽이 바람에 쓸려 다니는 소리만 두 사람 사이를 채웠다. 그녀는 가방에서 그 편지를 살짝 꺼내 보이더니, 다시 조심스레 집어넣었다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '사실 며칠 동안 계속 편지 생각만 했어. 근데 막상 뭐라고 답해야 할지 모르겠더라.' },
      {
        type: 'choice',
        situation: '조심스럽게 마음을 여는 그녀의 반응',
        options: [
          {
            branch: 'pos', text: '서두르지 않고 그녀의 속도에 맞춰 기다린다', affection: 2, tag: 'L46',
            script: [
              { type: 'line', speaker: 'player', text: '답 안 해도 돼. 그냥 마음 편해지면 그걸로 됐어.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(놀란 듯 바라보며) ...재촉 안 해?' },
              { type: 'line', speaker: 'player', text: '재촉할 일이야, 이게?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(옅게 웃으며) ...그렇게 기다려주는 거, 사실 제일 고마운 거야.' },
              { type: 'line', speaker: 'player', text: '그럼 답 대신 딴 거 하나만 해줘. 나 보고 웃어줘.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(피식 웃으며) ...뭐야 그게. 대신 딱 한 번만이야.' },
              { type: 'narration', text: '잠깐 스친 그 미소가, 생각보다 오래 마음에 남았다.' },
            ],
          },
          {
            branch: 'neg', text: '화해했으니 됐다며 성급하게 넘어가려 한다', affection: -1, tag: 'D46',
            script: [
              { type: 'line', speaker: 'player', text: '이제 화해했으니까 됐네. 다음 얘기 하자.' },
              { type: 'line', speaker: 'onyu', expr: 'surprised', text: '(당황하며) ...나 아직 하고 싶은 말 다 못 했는데.' },
              { type: 'narration', text: '서둘러 넘어가려는 태도에, 그녀는 다시 입을 다물었다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '한동안 말없이 앉아 있던 그녀가 조심스레 손을 들어 앞머리를 정리하며 입을 열었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '편지에 적혀 있던 거, 나도 똑같이 느꼈어. 그때 내가 말을 끝까지 못 해서 답답했던 거.' },
      { type: 'line', speaker: 'player', text: '이제라도 알았으니까 됐지.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 숨을 내쉬며) ...응. 이제 좀 풀린 것 같아.' },
      { type: 'narration', text: '노을빛이 두 사람의 그림자를 길게 늘어뜨렸다. 며칠간 팽팽했던 공기가 그제야 조금씩 풀려가고 있었다. 벤치 옆에 쌓인 낙엽 더미가 바람에 살짝 흩어졌다 다시 모였다.' },
    ],
  },

  {
    id: 'ch24', order: 24, grade: 3, season: 'autumn', title: '둘만의 하루', bg: 'b11',
    script: [
      { type: 'narration', text: '화해 이후 처음 맞는 주말, 오랜만에 부담 없는 하루였다. 입시 준비도, 서먹함도 잠시 내려놓은 채, 그녀는 평소보다 한결 가벼운 얼굴로 약속 장소에 나왔다. 하늘까지 맑아서 오랜만에 여유로운 공기가 느껴졌다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '오랜만에 진짜 자유시간이다. 오늘 뭐 하고 싶어?' },
      {
        type: 'choice',
        situation: '오랜만에 무얼 하고 싶은지 물어보는 순간',
        options: [
          {
            branch: 'pos', text: '그녀가 평소 좋아하던 걸 기억해 제안한다', affection: 2, tag: 'L47',
            script: [
              { type: 'line', speaker: 'player', text: '너 롤 좋아하잖아. 오랜만에 피시방 가서 같이 하는 거 어때?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(눈이 확 밝아지며) 진짜? 완전 좋지!' },
              { type: 'line', speaker: 'player', text: '표정 봐, 완전 신났네.' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(새침하게) ...티 났어? 뭐, 오랜만이니까 그런 거지.' },
            ],
          },
          {
            branch: 'neg', text: '정한 것 없이 즉흥적으로 여기저기 끌고 다닌다', affection: -1, tag: 'D47',
            script: [
              { type: 'line', speaker: 'player', text: '일단 여기부터 가보자. 정하고 말고 할 것도 없지.' },
              { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(끌려가며) ...나한테 물어본 의미가 없잖아.' },
              { type: 'narration', text: '정처 없이 돌아다니는 사이, 그녀의 표정엔 슬쩍 지친 기색이 비쳤다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '피시방 구석 자리에 나란히 앉아 헤드셋을 나눠 썼다. 오랜만에 잡아보는 마우스에 그녀는 손목을 몇 번 풀더니 이내 화면에 완전히 몰입했다. 옆자리 소음도, 밖에서 기다리던 일들도 그 순간만큼은 전혀 신경 쓰이지 않는 듯했다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '(집중한 채로) 잠깐, 거기 조심해. 갱킹 온다.' },
      { type: 'line', speaker: 'player', text: '이럴 때 보면 완전 다른 사람 같아.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '(모니터에서 눈도 안 떼고) 이게 진짜 내 모습이지.' },
      { type: 'line', speaker: 'player', text: '그 모습도 나쁘지 않은데.' },
      { type: 'line', speaker: 'onyu', expr: 'pouty', text: '(그제야 힐끗 쳐다보며) ...지금 그런 말 할 타이밍이야? 갱킹 온다니까.' },
      { type: 'narration', text: '몇 판을 내리 하고 나서야 둘은 자판기 앞에 서서 이온음료 캔을 하나씩 뽑았다. 창밖으로는 어느새 노을이 지고 있었다. 캔을 건네받다 손끝이 살짝 스쳤는데, 그 잠깐이 이상하게 오래 남았다.' },
      { type: 'line', speaker: 'onyu', expr: 'shy', text: '오늘 진짜 오랜만에 숨통 트인다. 고맙다는 말, 괜히 안 하고 싶었는데 결국 하게 되네.' },
      {
        type: 'choice',
        situation: '하루를 마무리하며 서로에게 솔직해지는 순간',
        options: [
          {
            branch: 'pos', text: '가볍지 않게, 진지한 마음을 그대로 전한다', affection: 2, tag: 'L48',
            script: [
              { type: 'line', speaker: 'player', text: '나도 오늘 진짜 좋았어. 요즘 계속 이런 시간이 그리웠거든.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(잠시 눈을 마주치다) ...나도, 사실. 요즘 너무 나만 힘든 척했나 싶기도 하고.' },
              { type: 'line', speaker: 'player', text: '그런 척 안 해도 돼, 이제.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 웃으며) ...오늘 하루, 오래 기억할 것 같아.' },
            ],
          },
          {
            branch: 'neg', text: '분위기가 어색해 농담으로 얼버무린다', affection: -1, tag: 'D48',
            script: [
              { type: 'line', speaker: 'player', text: '고맙긴, 오늘 내가 캐리했지.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(어색하게 웃으며) ...그렇게 넘기는 거야?' },
              { type: 'narration', text: '진지해질 뻔했던 순간은 농담 한마디에 슬쩍 지나가버렸다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '캔을 다 비울 때쯤, 하늘은 완전히 어두워져 있었다. 가로등 불빛이 하나둘 켜지기 시작했다. 별다를 것 없는 하루였지만, 그래서 더 오래 남을 것 같은 저녁이었다. 다가올 겨울과 그 너머의 시험 같은 건, 오늘만큼은 잠시 잊어도 좋았다.' },
    ],
  },

  {
    id: 'ch25', order: 25, grade: 3, season: 'winter', title: '수능', bg: 'b12',
    script: [
      { type: 'narration', text: '이른 새벽, 아직 어둑한 하늘 아래 칼바람이 옷깃 사이를 파고들었다. 시험장 정문 앞은 이미 각종 플래카드와 후배들의 응원 소리로 북적였다.', sheAbsent: true },
      { type: 'line', speaker: 'player', text: '어제 잠은 좀 잤어?' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(눈 밑이 거뭇한 채로) 거의 못 잤어. 평소엔 눈만 감아도 잘 자는데, 오늘따라 왜 이러나 몰라.' },
      { type: 'narration', text: '평소답지 않게 목도리를 몇 번이나 고쳐 매는 손끝이 미세하게 떨리고 있었다.' },
      {
        type: 'choice',
        situation: '시험장 앞에서 무슨 말을 건넬지',
        options: [
          {
            branch: 'pos', text: '부담 주지 않는 담백한 응원의 말을 건넨다', affection: 2, tag: 'L49',
            script: [
              { type: 'line', speaker: 'player', text: '지금까지 해온 대로만 하고 와. 그거면 충분해.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 숨을 내쉬며) ...그 말이 딱 필요했어. 고마워.' },
              { type: 'line', speaker: 'player', text: '끝나고 여기서 기다리고 있을게.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(옅게 웃으며) ...어, 이따 보자.' },
            ],
          },
          {
            branch: 'neg', text: '긴장하게 만드는 거창한 말을 늘어놓는다', affection: -1, tag: 'D49',
            script: [
              { type: 'line', speaker: 'player', text: '오늘 진짜 인생 걸린 날이잖아. 후회 없이 다 쏟아붓고 와!' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(표정이 굳으며) ...안 그래도 떨리는데, 그런 말은 좀.' },
              { type: 'narration', text: '응원이랍시고 건넨 말이 오히려 어깨를 더 무겁게 만든 듯했다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '정문 안으로 사라지는 뒷모습을 한참 지켜보았다. 하루 종일 마음 한구석이 붕 뜬 채로 시간을 흘려보냈다. 휴대폰을 몇 번이고 들여다봤지만, 당연하게도 연락은 오지 않았다.' },
      { type: 'narration', text: '해가 저물 무렵, 시험장 문이 열리고 학생들이 하나둘 쏟아져 나오기 시작했다. 얼마 지나지 않아 지친 얼굴의 그녀가 보였다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(멍한 얼굴로) ...끝났다.' },
      {
        type: 'choice',
        situation: '시험이 끝나고 지쳐 나온 그녀를 맞이하는 순간',
        options: [
          {
            branch: 'pos', text: '결과를 묻지 않고 먼저 고생했다고 다독인다', affection: 2, tag: 'L50',
            script: [
              { type: 'line', speaker: 'player', text: '진짜 고생 많았어. 오늘 하루 종일 힘들었을 텐데.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(눈시울이 붉어지며) ...그 말이 왜 이렇게 눈물 나게 하지.' },
              { type: 'line', speaker: 'player', text: '결과는 나중에 생각하고, 오늘은 그냥 푹 쉬어.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 웃으며) ...응. 오늘만큼은 아무 생각도 안 하고 싶어.' },
            ],
          },
          {
            branch: 'neg', text: '시험이 어땠는지부터 다급하게 캐묻는다', affection: -1, tag: 'D50',
            script: [
              { type: 'line', speaker: 'player', text: '어땠어? 잘 봤어? 시간은 안 모자랐어?' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(지친 목소리로) ...지금 그것부터 묻는 거야?' },
              { type: 'narration', text: '쏟아지는 질문에, 안 그래도 지친 그녀의 표정이 더 어두워졌다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '돌아가는 버스 안, 창에 기댄 그녀의 어깨가 완전히 풀려 있었다. 몇 달간 팽팽했던 긴장이 그제야 조금씩 빠져나가는 듯했다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(작게) ...진짜 끝났다는 게 아직도 실감이 안 나.' },
      { type: 'line', speaker: 'player', text: '실감 안 나도 끝난 건 끝난 거야.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(창밖을 보며) ...그러네. 이제 뭘 해야 할지도 모르겠어.' },
      { type: 'narration', text: '버스가 흔들릴 때마다, 그녀의 어깨가 슬며시 이쪽으로 기울어졌다. 잠든 건지 아닌지 알 수 없었지만, 굳이 깨우지 않았다.' },
      { type: 'narration', text: '창밖으로 저무는 겨울 오후의 풍경이 스쳐 지나갔다. 길고 길었던 하루가, 그렇게 조용히 저물고 있었다.' },
    ],
  },

  {
    id: 'ch26', order: 26, grade: 3, season: 'winter', title: '마지막 겨울', bg: 'b3',
    script: [
      { type: 'narration', text: '수능이 끝나고 나니 학교는 이상하리만치 여유로워졌다. 정해진 일과도, 쫓기던 마음도 사라진 자리에 낯선 한가함이 들어찼다. 교실 안 분위기도 한결 느슨해져 있었다.', sheAbsent: true },
      { type: 'narration', text: '하굣길, 흐린 하늘에서 뭔가 하얀 것이 하나둘 떨어지기 시작했다. 그녀가 먼저 걸음을 멈추고 하늘을 올려다보았다.' },
      { type: 'line', speaker: 'onyu', expr: 'smile', text: '어, 눈이다. 이번 겨울 첫눈이네.' },
      {
        type: 'choice',
        situation: '3학년의 첫눈이 내리는 날',
        options: [
          {
            branch: 'pos', text: '잠깐 멈춰 서서 첫눈을 같이 맞이한다', affection: 2, tag: 'L51',
            script: [
              { type: 'line', speaker: 'player', text: '그러네, 잠깐 서서 좀 보고 가자.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(눈이 반짝이며) 역시, 이런 건 그냥 지나치면 안 되지.' },
              { type: 'narration', text: '둘은 한동안 말없이 서서 눈이 내리는 걸 바라보았다. 그녀의 표정이 아이처럼 환해졌다.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(작게) ...나 첫눈 진짜 좋아하거든. 매년 이 순간만 기다려.' },
              { type: 'line', speaker: 'player', text: '올해는 혼자 안 봐도 되네.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(눈을 마주치며 조용히) ...그러게. 옆에 누가 있으니까 확실히 다르다.' },
            ],
          },
          {
            branch: 'neg', text: '춥다며 갑자기 다른 곳으로 이끈다', affection: -1, tag: 'D51',
            script: [
              { type: 'line', speaker: 'player', text: '춥다, 얼른 들어가자.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(아쉬운 얼굴로 끌려가며) ...조금만 더 보면 안 됐을까.' },
              { type: 'narration', text: '첫눈은 금방 등 뒤로 멀어졌고, 그녀는 못내 아쉬운 표정을 숨기지 못했다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '그날 밤, 자정이 다 돼가는 시간까지 통화가 이어졌다. 창밖엔 여전히 눈발이 흩날리고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '이렇게 3학년도 다 끝나가네. 생각해보면 벚꽃 필 때 처음 같은 반 됐던 거잖아.' },
      { type: 'line', speaker: 'player', text: '그러고 보니 그때부터 벌써 3년이네.' },
      {
        type: 'choice',
        situation: '지난 3년을 돌아보게 되는 밤',
        options: [
          {
            branch: 'pos', text: '함께 쌓아온 순간들을 하나하나 꺼내본다', affection: 2, tag: 'L52',
            script: [
              { type: 'line', speaker: 'player', text: '처음 만났을 때 기억나? 그때 완전 낯가렸잖아.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃음 섞인 목소리로) 야, 그건 너도 마찬가지였거든? 근데 진짜 많은 일이 있었네.' },
              { type: 'line', speaker: 'player', text: '축제도 있었고, 싸웠다 화해도 하고, 수능도 같이 견뎠고.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(조용히) ...이렇게 하나씩 꺼내놓으니까 진짜 벚꽃부터 눈까지, 계절 한 바퀴를 다 돈 기분이다.' },
            ],
          },
          {
            branch: 'neg', text: '"그냥 지나간 거지 뭐" 하고 가볍게 웃어넘긴다', affection: -1, tag: 'D52',
            script: [
              { type: 'line', speaker: 'player', text: '뭐, 3년이야 다 그냥 지나간 거지.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '(살짝 서운한 티를 내며) ...그렇게 간단하게 정리할 일인가.' },
              { type: 'narration', text: '가볍게 넘긴 말에, 통화 너머 그녀의 목소리가 조금 가라앉았다.' },
            ],
          },
        ],
      },
      { type: 'narration', text: '전화를 끊고도 한참, 창밖의 눈은 그치지 않고 소복이 쌓여갔다. 가로등 불빛 아래 눈송이가 천천히 흩날렸다. 벚꽃으로 시작했던 한 해가 이렇게 눈으로 저물어가고 있었다.' },
      { type: 'line', speaker: 'onyu', expr: 'worried', text: '(작게) ...곧 있으면 졸업이네. 그다음엔 우리 어떻게 되는 걸까.' },
      { type: 'narration', text: '답을 정하지 않은 채로, 그 물음은 하얗게 쌓이는 눈처럼 밤새 조용히 남아 있었다. 창밖 세상이 온통 하얗게 뒤덮이는 동안, 두 사람의 3년도 마지막 페이지를 향해 조용히 넘어가고 있었다.' },
    ],
  },

  {
    id: 'ch27', order: 27, grade: 3, season: 'winter', title: '졸업식', bg: 'b13',
    script: [
      // ── 공통 구간 — 졸업식 ──
      { type: 'narration', text: '마지막 조회 날, 담임은 평소보다 말수가 적었다. "다들 고생 많았다"는 짧은 한마디를 끝으로, 교실은 3년 치 흔적을 정리하는 손길로 부산해졌다.', sheAbsent: true },
      { type: 'narration', text: '강당에 모인 학생들 사이로 한 명씩 이름이 불렸다. 졸업장을 받아 든 학생들의 표정은 저마다 달랐지만, 온이유의 차례가 되었을 때만큼은 자연스레 그쪽으로 눈이 갔다. 단상 위에서 살짝 이쪽을 바라보며 웃는 얼굴이 유독 눈에 밟혔다.' },
      { type: 'narration', text: '식이 끝나고 반 전체가 우르르 모여 사진을 찍었다. 누가 뭐라고 소리치는지도 모를 만큼 소란스러운 와중, 카메라 셔터가 눌리는 그 짧은 순간 그녀와 눈이 마주쳤다.' },
      { type: 'narration', bg: 'b2', text: '사람들이 하나둘 흩어지고, 저마다 다른 방향으로 걸음을 옮겼다. 마지막으로 교문을 향해 걷는 발걸음이 이상하게 느리게 느껴졌다.' },

      // ── 분기점 — 교문 밖에서 다시 만난 순간 ──
      { type: 'narration', text: '교문을 나서자, 인파가 다 빠져나간 자리에 그녀가 혼자 서서 기다리고 있었다. 3년을 함께한 두 사람만 남은 조용한 순간이었다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '다 끝났네. 진짜로.' },
      { type: 'line', speaker: 'player', text: '그러게. 실감이 잘 안 난다.' },
      { type: 'line', speaker: 'onyu', expr: 'calm', text: '나도. 근데 이상하게 후련하기도 하고.' },
      { type: 'narration', text: '그녀가 먼저 입을 열었다. 지난 3년간 쌓아온 모든 순간이 이 한마디 뒤에 조용히 무게를 싣고 있었다.' },

      // ── 최종 호감도로 우정/썸/연인 중 하나를 고른다(선택지 없음) ──
      {
        type: 'scoreGate',
        branches: [
          {
            // 우정 엔딩 — 곁에 남은 사람 (호감도 8 이하)
            id: 'friend', max: 8,
            script: [
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(가방에서 스케치북을 꺼내며) 이거, 마지막 페이지 뜯은 거야. 너 주려고.' },
              { type: 'line', speaker: 'player', text: '갑자기 웬 선물이야?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '그냥. 3년간 고마웠다는 표시 정도로 생각해.' },
              { type: 'narration', text: '건네받은 종이엔 두 사람이 함께 웃고 있는 작은 그림이 담겨 있었다. 특별할 것 없는 일상의 한 장면이었지만, 그래서 더 온이유다운 선물이었다.' },
              { type: 'line', speaker: 'player', text: '이런 걸 언제 다 그렸대.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 짬짬이. 이제 다른 학교 가도 종종 연락하고 지내자. 전시회 같은 거 하면 부를게.' },
              { type: 'line', speaker: 'player', text: '당연하지. 새로 뭐 그리면 제일 먼저 보여줘.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(가볍게 웃으며) 그건 약속. 대신 너도 연락 씹지 마.' },
              { type: 'line', speaker: 'player', text: '그건 네가 더 심하지 않았어?' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(웃으며) 그건 그렇네. 아무튼, 잘 지내자.' },
              { type: 'narration', text: '두 사람은 각자의 방향으로 손을 흔들며 돌아섰다. 거창한 인사도, 무거운 말도 없었지만 그걸로 충분했다.' },
              { type: 'narration', text: '그 후로도 계절이 몇 번 바뀌는 동안, 종종 안부를 주고받았다. 대단할 것 없는 사이였지만, 오래도록 편하게 남을 수 있는 사이라는 걸 둘 다 알고 있었다.' },
              { type: 'line', speaker: 'ending', text: '곁에 남은 사람' },
            ],
          },
          {
            // 썸 엔딩 — 여백 (호감도 9~64)
            id: 'crush', min: 9, max: 64,
            script: [
              { type: 'narration', text: '노을이 낮게 깔린 교문 앞, 두 사람은 나란히 서 있었지만 그 사이엔 여전히 채워지지 않은 거리감이 남아 있었다.' },
              { type: 'line', speaker: 'onyu', expr: 'worried', text: '있잖아... 아니야, 됐다.' },
              { type: 'line', speaker: 'player', text: '왜, 말해봐.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(고개를 저으며) 나중에. 지금은 그냥, 이 정도가 딱 좋은 것 같아서.' },
              { type: 'line', speaker: 'player', text: '나중에 언제?' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(살짝 웃으며) ...글쎄, 그건 나도 아직 몰라.' },
              { type: 'narration', text: '나도 그 이상은 묻지 않았다. 확실한 답을 유보한 채, 두 사람 사이엔 말로 하지 않아도 되는 온도가 남아 있었다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '다음에 또 보자. 언제가 될진 모르겠지만.' },
              { type: 'line', speaker: 'player', text: '그래, 또 보자.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게) ...연락은 할 거지?' },
              { type: 'line', speaker: 'player', text: '당연하지, 걱정 마.' },
              { type: 'narration', text: '서로를 향한 눈빛에 담긴 말은 끝내 소리가 되지 않았다. 미래를 확정 짓지 않은 채로, 그 여백만이 두 사람 사이에 오래 남았다.' },
              { type: 'line', speaker: 'ending', text: '여백' },
            ],
          },
          {
            // 연인 엔딩 — 온 이유 (호감도 65 이상)
            id: 'lover', min: 65,
            script: [
              { type: 'narration', text: '그녀는 잠시 망설이다 가방에서 스케치북을 꺼내 마지막 장을 펼쳤다. 거기엔 지난 3년간 몰래 그려온, 내가 담긴 그림들이 페이지마다 빼곡했다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '사실 처음 만났을 때부터 지금까지, 계속 그려왔어. 들키면 어쩌나 매번 조마조마했는데.' },
              { type: 'narration', text: '한 장 한 장 넘길 때마다, 그 계절 그 순간들이 고스란히 되살아났다. 그녀는 마지막 장을 넘기기 직전, 잠시 숨을 골랐다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', slow: 2, text: '(조심스럽게) 있잖아. 네가 여기 온 이유가... 나였으면 좋겠어.' },
              { type: 'narration', text: '그 말이 끝나는 순간, 세상의 소리가 잠시 멀어졌다. 흩날리던 눈송이만 유난히 크고 느리게 떨어지고 있었다.' },
              { type: 'narration', text: '짧은 정적 끝에, 내가 먼저 손을 뻗어 그녀의 손을 잡았다.' },
              { type: 'line', speaker: 'player', text: '나도 같은 마음이야. 진작 말할 걸 그랬어.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(눈을 마주치며) ...정말? 나만 그런 게 아니어서 다행이다.' },
              { type: 'line', speaker: 'onyu', expr: 'shy', text: '(작게 웃으며) 그럼 오늘부터 1일인 거네.' },
              { type: 'line', speaker: 'player', text: '어, 오늘부터 1일.' },
              { type: 'line', speaker: 'onyu', expr: 'smile', text: '(장난스럽게) 기억해둬. 오늘 날짜, 나중에 까먹으면 안 돼.' },
              { type: 'narration', text: '두 사람은 눈이 소복이 쌓여가는 교문 앞에서, 오래도록 손을 맞잡고 서 있었다. 벚꽃으로 시작된 이야기가, 이렇게 눈 속에서 가장 다정한 결말을 맞이하고 있었다.' },
              { type: 'line', speaker: 'ending', text: '온 이유' },
              { type: 'narration', text: '엔딩 화면이 저물고, 화면 위로 지난 3년의 순간들이 조용히 흘러갔다 — 벚꽃 아래 첫 만남, 축제의 소란, 눈싸움 같던 다툼과 화해, 함께 웃던 피시방의 밤. 그 모든 순간이 갤러리에 남아있던 CG들로 하나씩 되살아나는, 짧은 크레딧이었다.' },
            ],
          },
        ],
      },
    ],
  },
];
