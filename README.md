# 둘길 · Dulgil

둘이 갈 길을 정하고, 함께한 순간을 남기다.

## 바로 실행하기

Node.js 22 이상이 필요합니다. 외부 패키지 설치나 API 키 없이 실행할 수 있습니다.

```bash
git clone https://github.com/DoHeeLee-0924/dulgil.git
cd dulgil
npm start
```

브라우저에서 http://localhost:3000 을 엽니다.

```bash
npm run dev   # 파일 변경 시 서버 재시작
npm test      # 추천 제약·계산·서버 테스트
```

포트 변경은 macOS/Linux에서 `PORT=4000 npm start`, PowerShell에서 `$env:PORT=4000; npm start`로 설정합니다. 서버는 기본적으로 로컬 컴퓨터에서만 접근할 수 있도록 실행됩니다.

## 구현된 기능

- 모바일 반응형 홈, 데이트 조건 입력
- 성수/연남 가상 장소 기반 코스 추천: 선택 활동·두 명 총예산·이용 시간을 반영
- 코스 저장, 장소 추가·삭제·순서 변경, 이름·날짜 수정과 시간·예산 재계산
- 가상 장소 순서도 (실제 지도/교통 경로 아님)
- 데이트 완료 후 사진 한 장·소감·만족도 기록, 타임라인 검색·삭제
- 기념일 등록·삭제
- 브라우저 localStorage 저장과 저장 실패 안내

사용 흐름: 데이트 계획 → 추천 코스 저장 → 우리의 코스에서 편집 → 데이트 완료 → 추억 남기기.

## 현재 범위와 다음 단계

현재는 **한 브라우저에서 동작하는 로컬 데모**입니다. 로그인·커플 초대·두 기기 간 공유·DB·실제 지도/장소 API·자동 경로 기록·알림·관리자 기능은 구현하지 않았습니다. 기록 범위 선택은 메타데이터이며 실제 사용자별 접근 제어가 아닙니다. 실제 개인정보를 저장하는 서비스로 배포하기 전에는 인증과 서버/DB 권한 검증을 먼저 추가해야 합니다.

모든 장소 이름·좌표·가격은 가상 데이터이며, 이동은 구간당 15분 가정입니다. 브라우저 저장소 삭제 또는 다른 브라우저 사용 시 기록은 유지되지 않습니다. 사진은 JPEG/PNG/WebP 한 장, 최대 500KB이며 브라우저 저장 한도를 넘으면 저장이 취소됩니다.

설계 문서의 Next.js/TypeScript/Supabase는 후속 구현 제안입니다. 이번 실행 버전은 빠른 설치 없는 검증을 위해 Node.js 정적 서버 + ES Modules로 작성했습니다. 추천 도메인 로직과 UI를 분리하여 이후 프레임워크·실제 제공자로 전환할 수 있습니다.

## 파일 구성

- `server.mjs`: Node.js 정적 HTTP 서버
- `public/index.html`, `public/style.css`, `public/app.js`: 화면과 사용자 동작
- `public/domain.js`: 장소 데모 데이터, 추천·합계·저장소 복구 로직
- `tests/domain.test.mjs`: 추천·계산·텍스트 안전 처리·HTTP 테스트

## 기획 문서

- [PRD](docs/prd.md)
- [기능명세서](docs/feature-spec.md)
- [유저플로우](docs/user-flow.md)
- [구현 계획](docs/implementation-plan.md)
