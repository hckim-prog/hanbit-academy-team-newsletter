# Hanbit Academy Team Newsletter

Vercel에 배포해서 쓰는 디지털콘텐츠전환TF 격주 뉴스레터 생성기입니다.

원본 Google Sheet는 수정하지 않고 읽기 전용으로만 사용합니다. 사용자는 웹앱에서 `이번 호 만들기`를 누른 뒤, 생성된 웹 뉴스레터를 직접 검수하고 `HTML 복사` 또는 `HTML 다운로드`로 발송 준비를 할 수 있습니다.

## 기능

- `김호철` 시트의 최신 `주간업무보고(2주간격)` 행 자동 탐색
- 최신 보고 행 `A:F`를 뉴스레터 섹션으로 변환
- OpenAI 이미지 생성으로 히어로 이미지와 섹션 이미지 생성
- 웹 화면에서 본문 직접 검수/수정
- HTML 복사
- HTML 다운로드
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
NEWSLETTER_IMAGE_COUNT=4
```

OpenAI 이미지 생성이 billing hard limit, quota, model access 문제로 실패하면 앱은 뉴스레터가 깨지지 않도록 SVG 대체 이미지를 표시합니다. 결제 한도 또는 모델 접근 권한이 정상화되면 같은 버튼으로 실제 생성 이미지가 들어갑니다.

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

## 운영 흐름

1. 웹앱 접속
2. `이미지 함께 생성` 켜기
3. `이번 호 만들기` 클릭
4. 본문을 직접 검수/수정
5. `HTML 복사` 또는 `HTML 다운로드`
6. Gmail/사내 메일 도구에서 최종 발송

## 보관 자료

이전 Apps Script와 정적 미리보기 산출물은 `legacy/` 폴더에 보관했습니다.
