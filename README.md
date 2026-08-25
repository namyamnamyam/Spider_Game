# Spider_Game

개인용 브라우저 3D 액션 게임 프로토타입.

## v0.1

- Babylon.js 기반 3D 도시
- 3인칭 카메라
- WASD 이동 / 점프
- 건물 충돌 및 옥상 착지
- 조준점 기반 웹 부착
- 기본 웹 스윙 물리
- Web Zip
- 웹 스윙 부스트
- 속도 / 고도 / 웹 상태 HUD
- iPad/모바일용 터치 조이스틱 + WEB / ZIP / JUMP 버튼
- 외부 3D 에셋 없이 바로 실행 가능

## PC 조작

- `WASD`: 이동
- `Space`: 점프
- 마우스 드래그: 카메라 회전
- 마우스 우클릭 유지: 웹 부착 / 놓으면 해제
- `E`: 웹 부착 토글
- `F`: 조준 지점으로 Web Zip
- `Shift`: 웹 스윙 중 가속

웹은 화면 중앙 조준점이 가리키는 건물에 붙는다.

## GitHub Pages

저장소의 **Settings → Pages → Build and deployment → Deploy from a branch**에서

- Branch: `main`
- Folder: `/(root)`

를 선택한 뒤 Save 하면 된다.

## 다음 개발 후보

벽타기 → 벽점프 → 다이브 → 스윙 애니메이션 → 기계식 Spider Arms → 근접 전투 → 적 AI → 미션 순서로 확장 예정.
