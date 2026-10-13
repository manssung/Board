# 웹을 닫아도 미답변 문의 분석하기

Vercel Hobby 자체 예약 실행 대신 저장소의 GitHub Actions가 매일 한국 시간 오전 6시(UTC 21:00)에 서버 API를 한 번 호출합니다. 예약은 GitHub 상황에 따라 늦어질 수 있습니다. 기본 브랜치에 workflow가 올라가야 예약이 시작됩니다.

## 활성화 순서

1. 이 변경을 배포합니다. Vercel 프로젝트 Root Directory는 frontend이며 Build Command는 npm run build여야 합니다. prebuild가 XML에서 서버 조건 목록을 생성합니다.
2. Vercel 환경변수 CRON_SECRET에 충분히 긴 임의 문자열을 설정한 뒤 다시 배포합니다. QNA_API_URL, GEMINI_API_KEY와 Upstash REST URL/TOKEN은 기존 서버 환경변수를 사용합니다.
3. GitHub 저장소 Settings → Secrets and variables → Actions에 SITE_URL(실제 배포 주소, https:// 포함)과 CRON_SECRET(위와 같은 값)을 등록합니다. Gemini/Upstash 키는 GitHub에 복사하지 않습니다.
4. Actions → Background inquiry analysis → Run workflow로 수동 실행합니다. 로그 Saved 수와 웹 현황판의 완료 건수가 늘어나는지 확인합니다.
5. 웹을 닫은 상태에서 다음 예약 실행을 확인합니다. GitHub Actions가 비활성화되거나 비공개 저장소의 실행 시간 한도가 소진되면 예약 분석이 실행되지 않습니다.

## 처리 규칙

웹이 열려 있을 때는 기존 화면 자동 분석을 계속 사용합니다. 오전 6시 예약은 웹 접속 여부와 관계없이 실행하되, 저장이 끝난 글은 건너뛰고 진행 중인 글은 같은 잠금으로 중복 분석을 막습니다.

- 요청당 한 글, 실행당 최대 40글을 오래된 순서로 처리합니다. 이미 저장된 동일 내용은 건너뜁니다.
- 화면과 서버가 같은 Upstash 잠금/분석 결과를 사용합니다. AI는 전체에서 한 번에 하나만 호출하고 요청 간격은 기본 3초입니다.
- AI 요청은 35초, 게시판 조회는 10초에 제한됩니다. Vercel 함수 최대 시간은 60초입니다.
- 일시 오류는 30초부터 최대 15분까지 재시도 간격을 늘립니다. 429는 제공된 재시도 시간 또는 1시간 대기합니다. 웹이 열려 있으면 화면에서 재시도하고, 웹이 닫혀 있으면 다음 날 오전 6시 예약 실행에서 이어갑니다.
- 400/401/403/404/422 오류는 반복 호출을 멈춥니다. 서버 설정을 수정한 후 화면의 실패 건 재시도를 누르면 다시 시도합니다.
- 결과를 Upstash에 임시 저장한 뒤 최종 저장합니다. 최종 저장 실패 시 다음 실행에서 저장만 재시도합니다. 저장소 전체가 불통이면 임시 결과도 보존할 수 없습니다.
- 파일 첨부, 미지원 증권사, 빈 문의는 서버 자동 분석에서 제외됩니다. 재문의 여부는 API에 isFollowUp이 제공되어야 구분 가능합니다.
- 화면 일시정지는 화면 작업에만 적용됩니다. 예약 실행을 멈추려면 GitHub Actions workflow를 비활성화합니다.
- APP_MONTHLY_CACHE_REQUEST_LIMIT(기본 10000)은 화면과 서버의 애플리케이션 캐시 요청 수 제한입니다. Upstash에서 청구하는 실제 Redis 명령 수가 아닙니다. 기존 REDIS_MONTHLY_OPERATION_LIMIT 설정도 호환됩니다. 실제 사용량은 Upstash 콘솔에서 확인합니다.

## 검증

로컬 검증은 실제 Gemini 호출이나 운영 게시글 변경 없이 테스트합니다. 배포 후 위 수동 workflow 검증까지 마쳐야 웹 접속 없는 예약 분석이 실제로 활성화됐다고 볼 수 있습니다.
