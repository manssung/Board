# AI 기반 전략 Q&A 조건식 작성 도구

고객의 자연어 문의를 증권사별 조건검색식으로 전환하고, 담당자가 검토·수정한 뒤 답변 멘트까지 완성하는 업무 지원 웹 도구입니다. 미답변 문의를 자동 분석하여 공통 저장소에 보관하므로, 담당자는 문의를 열어 추천 결과를 확인하고 답변 작성에 활용할 수 있습니다.

[웹 서비스 바로가기](https://board-navy.vercel.app/)

## 만들게 된 이유와 실무 활용

증권사 Q&A 업무에서는 고객의 요구를 해석하고, 해당 증권사의 조건 목록에서 적절한 조건을 찾고, 상세 설정값과 AND/OR 순서를 구성한 뒤 답변을 작성하는 과정이 반복됩니다. 이 과정의 초안을 AI가 작성하고 담당자가 검토하도록 만들었습니다.

현재 실무에서 사용 중이며, 사용자가 공유한 문의 1건의 처리 시간은 **도입 전 약 10분 → 도입 후 약 5분**입니다. 약 50%의 시간 단축에 해당하며, 활용 건수와 전체 평균 처리 시간은 별도 측정이 필요합니다.

## 주요 기능

- **미답변 문의 기본 화면**: 모든 증권사의 미답변 문의와 자동 분석 현황을 한 화면에서 확인합니다.
- **자동 분석 현황판**: 완료 / 분석 중 / 대기 / 작업불가로 작업 상태를 표시합니다.
- **문의별 AI 추천**: 증권사 조건 목록을 기반으로 조건 후보, 상세 설정값, 추천 근거를 제공합니다.
- **조건 검토와 편집**: 추천 조건을 적용·제외하고, 조건 검색·추가·수정·순서 변경과 AND/OR 및 괄호 그룹을 구성합니다.
- **답변 작성**: 구성한 조건을 바탕으로 답변 멘트를 생성하고 복사합니다.
- **직접 질문**: ‘AI에게 물어보기’ 버튼으로 입력 화면에 이동하여 원하는 문의를 작성합니다.
- **분석 결과 공유**: Upstash Redis에 결과를 저장하여 화면과 예약 작업에서 함께 활용합니다.

## 사용 흐름

1. 첫 화면에서 미답변 문의와 전체 증권사의 분석 현황을 확인합니다.
2. 문의를 선택하여 원문과 저장된 AI 추천 결과를 확인합니다.
3. 추천 근거와 조건의 상세값을 검토하고 필요한 조건을 적용하거나 수정합니다.
4. AND/OR와 괄호 그룹을 확인한 뒤 답변 멘트를 생성·복사합니다.
5. 직접 질문할 때는 ‘AI에게 물어보기’로 이동합니다.

AI 결과는 담당자가 검토하는 초안입니다. 고객 요구와 실제 증권사 조건 설정이 일치하는지 확인한 뒤 최종 답변에 사용합니다.

## 자동 분석 방식

| 실행 방식 | 동작 |
| --- | --- |
| 웹이 열려 있을 때 | 화면에서 미답변 문의 자동 분석을 진행합니다. |
| 웹 접속 여부와 관계없이 | GitHub Actions가 매일 한국 시간 밤 8시를 기준으로 예약 실행합니다. |
| 수동 점검 | GitHub Actions의 `Run workflow`로 예약 작업을 직접 실행할 수 있습니다. |

예약 설정은 `.github/workflows/background-analysis.yml`의 `0 11 * * *`입니다. GitHub의 예약 시간대는 UTC이므로 한국 시간 20:00에 해당합니다. 예약 실행은 GitHub 상황에 따라 늦어질 수 있으며, workflow가 기본 브랜치에 있어야 합니다.

밤 8시 이후에 올라온 글은 **웹을 열면 화면 자동 분석에서 처리하고, 웹을 열지 않으면 다음 날 예약 작업에서 처리**합니다. 웹을 닫은 동안 계속 감시하는 구조는 아닙니다.

### 현황판 상태

| 상태 | 의미 |
| --- | --- |
| 완료 | 분석 결과가 저장된 문의 |
| 분석 중 | 현재 분석을 진행하는 문의 |
| 대기 | 아직 처리하지 않았거나 재시도 시점을 기다리는 문의 |
| 작업불가 | 추천 조건 없음 또는 자동 분석 제외 대상 등 처리할 수 없는 문의 |

### 작업량과 오류 처리

- 예약 실행 1회에 최대 40건을 오래된 순서로 처리합니다. 요청당 한 글을 처리하며 이미 저장된 동일 내용은 건너뜁니다.
- 화면과 서버가 같은 저장소와 잠금을 사용하여 중복 분석을 방지합니다. AI 요청은 전체에서 한 번에 하나씩 진행하며 기본 간격은 3초입니다.
- AI 요청은 35초, 게시판 조회는 10초로 제한합니다. Vercel 함수 최대 실행 시간은 60초입니다.
- 일시 오류는 재시도 간격을 늘려 처리합니다. 설정·인증 오류 등은 반복 호출을 멈추고 설정 수정 후 재시도합니다.
- 결과를 임시 저장한 뒤 최종 저장합니다. 최종 저장만 실패했다면 다음 실행에서는 AI를 다시 호출하지 않고 저장을 재시도합니다. 저장소 전체 장애 시에는 임시 결과도 보존되지 않을 수 있습니다.
- 파일 첨부, 미지원 증권사, 빈 문의는 서버 자동 분석에서 제외합니다. 재문의 구분에는 게시판 API의 `isFollowUp` 정보가 필요합니다.
- 화면 일시정지는 화면 작업에 적용됩니다. 예약 작업을 중단하려면 GitHub Actions workflow를 비활성화합니다.

재시도와 사용량 제한의 자세한 규칙은 [자동 분석 운영 안내](frontend/docs/background-analysis.md)를 참고하세요.

## 기술 구성

| 구성 | 역할 |
| --- | --- |
| React | 미답변 문의 현황판, 조건 편집, 답변 작성 화면 |
| Google Gemini API | 고객 문의 해석 및 증권사 조건 추천 |
| 증권사 XML 조건 목록 | 화면 조건 검색과 서버 분석에 사용하는 조건 데이터 |
| Vercel Serverless Functions | 게시판 조회, AI 추천, 분석 결과 저장 및 예약 요청 처리 |
| Upstash Redis | 분석 결과 공유, 작업 잠금 및 처리 상태 보관 |
| GitHub Actions | 매일 밤 8시 예약 실행 및 수동 실행 |
| Vercel | 웹 서비스와 API 호스팅 |

서버 분석용 조건 목록은 `prebuild`에서 XML을 읽어 생성합니다. 화면과 서버가 같은 원본 조건 데이터를 사용합니다.

## 로컬 실행

예약 workflow는 Node.js 22를 사용합니다. 프로젝트 폴더에서 의존성을 설치하고 환경변수를 설정합니다.

```powershell
cd frontend
npm ci
```

`frontend/.env.local`에 아래 값을 설정합니다. 실제 키를 소스 코드나 README에 넣지 않습니다.

```dotenv
GEMINI_API_KEY=your-gemini-api-key
QNA_API_URL=https://your-inquiry-api.example.com/
KV_REST_API_URL=https://your-upstash-rest-endpoint.example.com
KV_REST_API_TOKEN=your-upstash-rest-token
CRON_SECRET=replace-with-a-long-random-value
```

| 환경변수 | 용도 |
| --- | --- |
| `GEMINI_API_KEY` | 서버에서 Gemini 호출 |
| `QNA_API_URL` | 미답변 문의를 제공하는 게시판 API 주소 |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash REST 연결 주소와 쓰기 권한 토큰 |
| `CRON_SECRET` | 예약 분석 API 인증. 예약 작업을 사용할 때 설정 |
| `GEMINI_MODEL` | 선택 사항. 기본값은 `gemini-2.5-flash` |

Upstash 연결에는 `UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN` 이름도 지원합니다. 서버 키에 `REACT_APP_` 접두사를 붙여 브라우저에 전달하지 않습니다.

```powershell
npm start
```

`npm start` 또는 `npm run dev:full`은 Vercel CLI를 통해 화면과 `/api`를 함께 실행합니다. 최초 실행 시 Vercel 로그인과 프로젝트 연결이 필요할 수 있습니다. 화면만 확인하려면 `npm run start:ui`를 사용합니다. 화면만 실행하면 로컬 서버 API는 함께 제공되지 않습니다.

## 밤 8시 예약 작업 설정

1. Vercel 프로젝트의 Root Directory를 `frontend`, Build Command를 `npm run build`로 설정합니다.
2. Vercel의 Production 환경변수에 게시판·Gemini·Upstash 설정과 `CRON_SECRET`을 등록합니다. 환경변수를 추가하거나 변경하면 다시 배포하여 적용합니다.
3. GitHub 저장소의 **Settings → Secrets and variables → Actions → New repository secret**에 다음 두 값을 등록합니다.

   | Repository secret | 값 |
   | --- | --- |
   | `SITE_URL` | 실제 배포 주소: `https://board-navy.vercel.app/` |
   | `CRON_SECRET` | Vercel의 `CRON_SECRET`과 정확히 같은 값 |

4. GitHub **Actions → Background inquiry analysis → Run workflow**로 수동 실행합니다.
5. 실행 로그의 저장 건수와 웹 현황판을 확인하고, 이후 예약 실행 기록을 확인합니다.

`SITE_URL`은 GitHub 실행 스크립트에서 사용합니다. Gemini·Upstash 키는 Vercel 서버 환경변수로 관리하며 GitHub 예약 실행용으로 복사할 필요가 없습니다.

**Actions의 Success는 작업이 오류 없이 종료됐다는 뜻입니다.** 새 문의가 없거나 이미 분석된 문의만 있으면 저장 건수가 0일 수 있습니다. 실제 처리 여부는 로그의 `Saved` 건수와 현황판을 함께 확인합니다.

## 검증 명령

`frontend` 폴더에서 실행합니다.

```powershell
npm test -- --watchAll=false
npm run test:server
npm run build
```

서버 테스트는 외부 서비스를 모의하여 예약 처리와 오류 대응을 검증합니다. 운영 Gemini·게시판·Upstash 연결은 배포 환경에서 수동 workflow와 저장 결과를 확인해야 합니다. `test:server`와 `build` 실행 전에는 서버 분석용 조건 목록이 자동 생성됩니다.

## 프로젝트 구조

```text
.github/workflows/background-analysis.yml  # 예약 실행 설정
frontend/
  src/                                    # React 화면과 조건 편집 로직
  public/                                 # 증권사 조건 데이터 등 정적 파일
  api/                                    # Vercel 서버 API
  lib/                                    # 분석·저장·잠금 공통 로직
  scripts/                                # 조건 목록 생성, 예약 실행, 테스트
  docs/background-analysis.md             # 자동 분석 운영 안내
  vercel.json                             # 빌드 및 함수 실행 설정
```

## 수상

- 2025 사내 혁신상 대상 수상
