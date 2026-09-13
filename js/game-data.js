/*
 * 챕터 스크립트 데이터.
 * 대본 원본: onyu-vn-script.html (Artifact). 지금은 수직 슬라이스 검증 단계라
 * CH01~CH02만 옮겨져 있다. 이후 챕터는 같은 스키마로 이어서 추가한다.
 *
 * 줄 타입: 'narration' | 'line' | 'choice' | 'nameInput'
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
 * chapter.cg: (선택) 이 챕터의 이벤트 CG 파일명(예: 'cg-02.png', assets/cg/ 기준).
 *   engine.js가 챕터 시작 시 "다음 챕터"의 cg를 미리 프리페치하는 데 쓴다 — 실제
 *   CG 32장이 생성되고 각 챕터에 배정되면(Phase 2) 채워 넣을 것, 지금은 비워둠.
 */

window.SPEAKER_LABELS = {
  player: null, // null이면 엔진이 state.playerName으로 치환
  onyu: '온이유',
  teacher: '담임',
};

window.ONYU_CHAPTERS = [
  {
    id: 'ch01', order: 1, grade: 1, season: 'spring', title: '새 학기',
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
    id: 'ch02', order: 2, grade: 1, season: 'spring', title: '벚꽃 스케치',
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
];
