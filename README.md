# Hanbit Academy Team Newsletter

Vercel에 배포해서 쓰는 디지털콘텐츠전환TF 격주 뉴스레터 생성기입니다.

원본 Google Sheet는 수정하지 않고 읽기 전용으로만 사용합니다. 사용자는 웹앱에서 `이번 호 만들기`를 누른 뒤, 생성된 웹 뉴스레터를 직접 검수하고 `HTML 복사` 또는 `HTML 다운로드`로 발송 준비를 할 수 있습니다.
현재 UI는 Awwwards의 큐레이션/어워드형 레이아웃에서 영감을 받아 큰 편집형 타이포, 강한 대비, 메타 라벨, 매거진형 섹션 구조로 구성했습니다.

## 기능

- `김호철` 시트의 최신 `주간업무보고(2주간격)` 행 자동 탐색
- 최신 보고 행 `A:F`를 뉴스레터 섹션으로 변환
- OpenAI 이미지 생성으로 히어로 이미지와 섹션 이미지 생성
- 웹 화면에서 본문 직접 검수/수정
- HTML 복사
- HTML 다운로드
- Gmail 임시보관함 생성
- Gmail 직접 발송
- Awwwards 스타일을 참고한 매거진형 웹 뉴스레터 프리뷰
- GitHub 인기 교정 도구의 방향을 참고해 명사형 보고 문장을 짧은 요체 문장으로 다듬기
- 같은 내용에서도 매번 다른 이미지 조합을 고르는 이미지 새로고침
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
OPENAI_TEXT_MODEL=gpt-4.1-mini
NEWSLETTER_IMAGE_COUNT=4

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

OpenAI 이미지 생성이 billing hard limit, quota, model access 문제로 실패하면 앱은 뉴스레터가 깨지지 않도록 본문 키워드 기반의 실사진을 자동으로 표시합니다. 결제 한도 또는 모델 접근 권한이 정상화되면 같은 버튼으로 AI 생성 실사진 스타일 이미지가 들어갑니다.

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
- 수신자는 `Bcc`에 넣고, 발송 계정은 Gmail OAuth 프로필에서 자동으로 확인합니다.

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
