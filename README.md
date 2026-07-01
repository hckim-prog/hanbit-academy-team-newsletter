# Hanbit Academy Team Newsletter

Vercel에 배포해서 쓰는 디지털콘텐츠전환TF 격주 뉴스레터 생성기입니다.

원본 Google Sheet는 수정하지 않고 읽기 전용으로만 사용합니다. 사용자는 웹앱에서 `이번 호 만들기`를 누른 뒤, 생성된 웹 뉴스레터를 직접 검수하고 `HTML 복사` 또는 `HTML 다운로드`로 발송 준비를 할 수 있습니다.
현재 UI는 Awwwards의 큐레이션/어워드형 레이아웃에서 영감을 받아 큰 편집형 타이포, 강한 대비, 메타 라벨, 매거진형 섹션 구조로 구성했습니다.

## 기능

- 김호철·김태진·손혜진 중 한 명 이상을 선택해 최신 `주간업무보고(2주간격)` 자동 탐색
- 선택한 여러 보고서를 선택 순서대로 사람별 섹션 묶음으로 변환
- OpenAI 이미지 생성으로 히어로 이미지와 섹션 이미지 생성
- 웹 화면에서 본문 직접 검수/수정
- HTML 복사
- HTML 다운로드
- Gmail 임시보관함 생성
- Gmail 직접 발송
- Awwwards 스타일을 참고한 매거진형 웹 뉴스레터 프리뷰
- 한국어 문장 경계와 맞춤법 원칙을 반영해 번호·명사형 보고 문장을 자연스러운 요체로 다듬기
- 같은 내용에서도 매번 다른 이미지 조합을 고르는 이미지 새로고침
- 이미지 생성 실패 시에도 여러 주제 풀을 섞은 실사진 fallback 사용
- 동일·유사 문장을 뉴스레터 전체에서 정리하고 섹션 성격에 맞는 한 곳에만 배치
- 일부 이미지 생성이 실패해도 성공한 AI 이미지는 유지하고 실패한 자리만 기본 사진으로 대체
- Vercel 배포 가능

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경 변수

`.env.local` 또는 Vercel Project Settings > Environment Variables에 설정합니다.

```bash
OPENAI_API_KEY=...
OPENAI_IMAGE_MODE=image_api
OPENAI_IMAGE_MODEL=gpt-image-2

# 기본값이 이미 들어 있지만, 다른 문서를 쓰려면 설정합니다.
GOOGLE_SHEETS_SPREADSHEET_ID=1M1U0-RTNhlkS9bWvOaALYHW7Mup8sxXboS2wZJPwpN8
GOOGLE_SHEETS_SOURCE_SHEET=김호철

# 방법 1: 공개/도메인 허용 API 키
GOOGLE_SHEETS_API_KEY=...

# 방법 2: 서비스 계정 권장
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# 선택 설정
GEMINI_API_KEY=...
GEMINI_TEXT_MODEL=gemini-2.5-flash
OPENAI_TEXT_MODEL=gpt-5.5
OPENAI_AUTO_POLISH=false
NEWSLETTER_IMAGE_COUNT=7

# Gmail 발송 기능
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_SESSION_SECRET=...

# 선택: 앱 연결 버튼 대신 서버 전체 공용 발송 계정을 고정할 때만 사용합니다.
GMAIL_REFRESH_TOKEN=...
GMAIL_SENDER_EMAIL=sender@example.com

# 선택: 기본 수신자 목록. 화면에서 직접 입력해도 됩니다.
ACADEMY_NEWSLETTER_RECIPIENTS=member1@example.com,member2@example.com
```

`NEWSLETTER_IMAGE_COUNT`를 비워두면 히어로와 모든 섹션에 이미지를 붙입니다. 값을 지정하면 최대 이미지 수를 제한합니다.

`OPENAI_AUTO_POLISH=true`로 설정하면 생성 단계에서 Gemini를 우선 사용하고 OpenAI, 로컬 교정 순서로 한국어 본문을 다듬습니다. 각 결과는 섹션·항목 순서와 날짜·숫자 보존 검사를 통과해야 적용됩니다. 기본값은 `false`이며, 이때도 로컬 한국어 문장 보정은 적용됩니다.

이미지는 각 이미지마다 Gemini, OpenAI 순서로 생성합니다. billing hard limit, quota, model access 문제로 특정 이미지가 실패하면 성공한 AI 이미지는 유지하고 실패한 자리만 본문 키워드 기반의 기본 사진으로 대체합니다. 화면의 `AI 사용 상태`에는 엔진별 이미지 장수와 안전하게 요약한 오류 코드가 표시됩니다.

여러 업무보고를 합칠 때는 완전히 같거나 사실상 같은 문장을 한 번만 남깁니다. 성과·기회는 `반짝 소식`, 진행 업무는 `집중 모드`, 약한 신호·리스크는 `체크 포인트`, 향후 계획은 `다음 2주`에 우선 배치합니다. 한입 요약은 성과·핵심 업무·다음 2주의 실제 항목 가운데 구체성이 높은 내용을 골라 분류 제목 없이 점 목록으로 표시하며, AI 문장 교정에서도 일반 안내문으로 바꾸지 않습니다. 요약할 업무가 없으면 해당 섹션을 표시하지 않습니다.

히어로 제목 `디콘전TF 소식이 도착했어요`는 뉴스레터의 고정 브랜드 문구로 유지하며 AI 문장 교정 대상에서 제외합니다.

Vercel에서 민감 변수로 등록한 API 키는 보안상 `vercel env pull`로 값을 다시 내려받을 수 없습니다. 로컬 개발에서도 Gemini를 사용하려면 별도의 로컬 키를 `.env.development.local`에 설정해야 합니다. Production 배포에서는 Vercel에 등록된 민감 변수가 정상적으로 주입됩니다.

Google Sheet가 비공개라면 서비스 계정을 만들고 원본 스프레드시트에 해당 서비스 계정 이메일을 보기 권한으로 공유하세요.

## Vercel 배포

```bash
npx vercel
```

프로덕션 배포:

```bash
npx vercel --prod
```

배포 후 Vercel 환경 변수에 위 값을 추가해야 실제 시트 읽기와 이미지 생성이 동작합니다.

## Gmail 발송 설정

Vercel 앱에서 Gmail 임시보관함 생성 또는 실제 발송을 하려면 Gmail API OAuth Client가 필요합니다. Refresh token은 앱의 `Gmail 연결` 버튼으로 자동 저장하므로 Vercel에 직접 넣지 않아도 됩니다.

1. Google Cloud Console에서 `Gmail API`를 사용 설정합니다.
2. `API 및 서비스 > OAuth 동의 화면`을 설정합니다.
3. `API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > OAuth 클라이언트 ID`를 만듭니다.
4. 앱 유형은 `웹 애플리케이션`으로 만들고, 승인된 리디렉션 URI에 아래 값을 추가합니다.

```text
https://hanbit-academy-team-newsletter.vercel.app/api/gmail/callback
```

5. OAuth client의 `client_id`, `client_secret`을 확보합니다.
6. Vercel Environment Variables에 `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_SESSION_SECRET`를 Production으로 추가한 뒤 재배포합니다.
7. 앱 왼쪽 패널에서 `Gmail 연결`을 누르고 발송에 사용할 Gmail 계정으로 승인합니다.
8. Gmail scope는 아래 범위를 사용합니다.

```text
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.compose
openid
email
```

앱은 다음 방식으로 동작합니다.

- `Gmail 임시보관함`: Gmail Draft를 만듭니다.
- `Gmail 발송`: 발송 확인 체크가 켜져 있을 때만 실제 발송합니다.
- 한 명 또는 여러 명의 수신자는 모두 `Bcc`에 넣고, `To`에는 `undisclosed-recipients:;`만 표시해 수신자 주소가 서로 노출되지 않도록 합니다. 발송 계정은 Gmail OAuth 프로필에서 자동으로 확인합니다.

Vercel에 필요한 값:

```bash
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_SESSION_SECRET
```

`GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL`은 선택입니다. `GMAIL_SENDER_EMAIL`을 설정하면 해당 주소를 From으로 우선 사용합니다. 단, Gmail/Google Workspace에서 연결 계정의 보내는 주소 또는 별칭으로 등록되어 있어야 합니다.

## 운영 흐름

1. 웹앱 접속
2. `이미지 함께 생성` 켜기
3. `이번 호 만들기` 클릭
4. 본문을 직접 검수/수정
5. 받는 사람 입력
6. `Gmail 임시보관함` 또는 `Gmail 발송`
7. 필요하면 `HTML 복사` 또는 `HTML 다운로드`로 별도 보관

## 보관 자료

이전 Apps Script와 정적 미리보기 산출물은 `legacy/` 폴더에 보관했습니다.
