# SOOP 온이유 게임 홍보글 HTML 양식

SOOP 방송국 게시글에 사용한 온이유 게임 소개글의 구조와 편집기 동작을 기록한다. 이 문서는 게시글 본문을 재현하거나 다른 방송국에 맞게 수정할 때 참고하는 템플릿이다.

## 게시글 구성

1. 타이틀 이미지
2. 게임명과 짧은 소개 문구
3. 작품 소개 카드
4. 챕터 수·엔딩 수·예상 플레이 시간 요약
5. 게임으로 이동하는 버튼

구매/이용권 안내는 넣지 않는다. 타이틀 이미지 주소는 SOOP에 업로드된 이미지 주소로 교체하고, 게임 링크는 실제 공개 페이지 주소를 사용한다.

## 재사용 HTML

아래 코드는 SOOP HTML 편집기에 넣는 본문 양식이다. `TITLE_IMAGE_URL`은 해당 게시글에서 사용할 이미지로, 게임 링크와 소개 문구·플레이 정보를 필요에 따라 바꾼다.

```html
<div style="max-width:820px;width:95%;margin:24px auto;padding:12px;background:#fffaf5;border:1px solid #eadbcf;border-radius:24px;overflow:hidden;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#40363a;line-height:1.75;box-sizing:border-box" data-soop-custom-block="true">
  <div style="position:relative;overflow:hidden;border-radius:18px;margin:0 0 12px">
    <img src="TITLE_IMAGE_URL" alt="당신이 여기에 온 이유 타이틀 배경" style="display:block;width:100%;height:auto;margin:0" data-soop-primary-image="true">
  </div>
  <div style="padding:34px 26px 30px;text-align:center;background:linear-gradient(135deg,#f9e8ee,#fff5e6 58%,#f1e8f6);border-radius:18px">
    <div style="font-size:12px;letter-spacing:3px;font-weight:800;color:#bc6b86">VISUAL NOVEL · 27 CHAPTERS</div>
    <div style="margin:10px 0 8px;font-size:30px;font-weight:900;line-height:1.3;color:#45323b">당신이 여기에 온 이유</div>
    <div style="font-size:15px;color:#77636b">벚꽃으로 시작해, 각자의 선택으로 이어지는 3년</div>
    <div style="margin:22px auto 0;padding:13px 18px;max-width:530px;background:rgba(255,255,255,.72);border:1px solid #f0dce2;border-radius:16px;font-size:14px">
      고등학교 1학년, 같은 반이지만 초면인 두 사람.<br>
      작은 대화와 선택이 쌓여 졸업식의 순간으로 향합니다.
    </div>
  </div>
  <div style="padding:24px 10px">
    <div style="padding:20px;background:#fff;border:1px solid #eee2dc;border-radius:18px">
      <div style="font-size:18px;font-weight:900;color:#a65775">🌸 여러분의 선택으로 만드는 이야기</div>
      <div style="margin-top:10px;font-size:14px">
        어떤 말을 건넬지, 어떤 마음을 전할지 직접 선택해 보세요.<br>
        선택이 쌓이며 두 사람의 관계와 마지막 결말이 달라집니다.
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">
      <div style="flex:1;min-width:145px;padding:15px;background:#f8f1e8;border-radius:14px;text-align:center">
        <div style="font-size:11px;color:#927b70">플레이 구성</div>
        <div style="font-size:16px;font-weight:900">27개 챕터</div>
      </div>
      <div style="flex:1;min-width:145px;padding:15px;background:#f8f1e8;border-radius:14px;text-align:center">
        <div style="font-size:11px;color:#927b70">결말</div>
        <div style="font-size:16px;font-weight:900">3종 엔딩</div>
      </div>
      <div style="flex:1;min-width:145px;padding:15px;background:#f8f1e8;border-radius:14px;text-align:center">
        <div style="font-size:11px;color:#927b70">예상 플레이</div>
        <div style="font-size:16px;font-weight:900">약 45–60분</div>
      </div>
    </div>
    <div style="margin-top:20px;text-align:center">
      <a href="https://neezu-crypto.github.io/onyu-vn/" target="_blank" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#bd6685;color:#fff;text-decoration:none;font-size:15px;font-weight:900">온이유 게임 플레이하기 →</a>
      <div style="margin-top:9px;font-size:11px;color:#907b80">당신이 이곳에 온 이유는, 무엇인가요?</div>
    </div>
  </div>
</div>
```

## SOOP 편집기에서 확인된 점

- 본문은 HTML 모드에서 편집하고, 게시 전에 반드시 미리보기로 레이아웃과 링크를 확인한다.
- 인라인 `style`을 이용한 카드·간격·색상·타이포그래피와 일반 이미지·링크는 양식에 사용한다.
- `<style>` 블록의 CSS 애니메이션은 게시글 미리보기에서 제거되거나 적용되지 않았다.
- `onmouseover`/`onmouseout` 마우스 이벤트를 넣은 시험 내용은 미리보기에서 포인터 반응이 확인되지 않았다. JavaScript 이벤트에 의존하는 인터랙션은 지원된다고 가정하지 않는다.
- 본문 HTML에 직접 넣은 SVG 및 추가 이미지 레이어는 지원되지 않거나 제거될 수 있다. 이미지 첨부는 JPG, PNG, GIF를 기준으로 하고 SOOP 이미지 업로드를 사용한다.
- 따라서 이 게시글 양식은 정적 HTML 카드와 링크 중심으로 유지한다. 벚꽃잎 등 움직임 효과는 SOOP 본문 CSS/이벤트가 아닌 이미지 자체의 애니메이션으로 별도 시험해야 하며, 미리보기에서 실제 표시를 확인하기 전에는 게시하지 않는다.

## 게시글 참고

- 테스트한 게시글: [온이유 게임 홍보글](https://www.sooplive.com/station/skftodwocks2/post/208298345)
- 게임 페이지: [당신이 여기에 온 이유](https://neezu-crypto.github.io/onyu-vn/)
