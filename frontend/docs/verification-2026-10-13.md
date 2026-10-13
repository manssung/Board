# 리팩토링 및 로컬 검증 기록

검증일: 2026-10-13 (한국 시간)

## 변경 내용

- 서버의 AI 프롬프트와 응답 스키마를 공통 모듈로 분리하고 로컬 개발 경로에서도 사용합니다. 운영 서버의 기존 프롬프트는 유지합니다.
- 공용 캐시 요청을 별도 모듈로 분리합니다. HTTP 상태뿐 아니라 재시도 시간과 하루 제한 여부를 호출자에 전달합니다.
- 일시적인 429 요청 제한을 하루 할당량 소진으로 안내하던 문제를 수정합니다.

## 테스트

- 화면 전체 테스트: 기존 69개와 새 테스트 6개, 총 75개 통과.
- 이후 추가한 자동 분석 회귀 테스트를 포함한 useInboxPreanalysis 테스트 13개 통과. 화면 테스트 총수는 76개입니다.
- 서버 테스트: 14개 통과. 총 90개 테스트를 검증했습니다.
- 운영용 빌드 성공. 사용자 임시 폴더 접근의 샌드박스 EPERM 오류는 권한을 받아 재실행하여 검증했습니다.
- Browserslist 데이터가 오래됐다는 경고가 남아 있습니다. 이번 작업에서는 의존성이나 잠금 파일을 변경하지 않았습니다.
- 40건 순차 처리, 작업자 간 잠금 공유, 한 건 실패 후 다음 건 처리, 저장만 재시도, 잠금 만료, 일시정지와 재개, 수동 재시도를 확인합니다.
- 캐시에서 안내한 60초 후 자동 재개, 비 JSON 오류의 상태 보존, 20초 요청 제한과 타이머 정리, 단기 제한/하루 제한 안내를 검증합니다.
- 외부 API를 모의한 로컬 검증입니다. 실제 Gemini 품질·운영 Upstash 저장·GitHub 예약 실행은 이 기록의 검증 범위에 포함하지 않습니다.

```powershell
$env:CI='true'
npm test -- --watchAll=false --runInBand
npm run test:server
npm run build
```

## 보완 전 조건 데이터 점검

7개 증권사의 조건 6,120개를 읽었습니다. 현재 파서 결과에서 상세값이 빈 항목은 45개입니다. 원본 누락인지 태그/파일 매칭 문제인지 추가 확인해야 하며, 이번 리팩토링에서는 값을 임의로 보충하지 않았습니다.

| 증권사 | 전체 조건 | 상세값이 빈 조건 |
| --- | ---: | ---: |
| 신한증권 | 927 | 2 |
| KB증권 | 973 | 14 |
| 교보증권 | 655 | 0 |
| LS증권 | 1074 | 7 |
| 미래에셋증권(해외) | 724 | 2 |
| 미래에셋증권 | 964 | 12 |
| NH증권 | 803 | 8 |

### 확인할 항목

- 신한증권: 증거금률, 추세>Price Osc>Price Osc 순위
- KB증권: 액면가, 증거금율, 추세지표>Price Oscillator>Price Oscillator 추세, 추세지표>Price Oscillator>Price Oscillator 반전, 추세지표>Price Oscillator>Price Oscillator 비교, 추세지표>Price Oscillator>Price Oscillator Signal 비교, 추세지표>Price Oscillator>Price Oscillator Signal 돌파, 변동성지표>Standard Error>Standard Error 범위, 변동성지표>Standard Error>Standard Error 추세, 변동성지표>Standard Error>Standard Error 반전, 변동성지표>Standard Error>Standard Error 비교, 변동성지표>Standard Error>Standard Error 돌파, 변동성지표>Standard Error>Standard Error 선돌파, 변동성지표>Standard Error>Standard Error 선비교
- LS증권: 모멘텀지표>Price Oscillator>Price Oscillator 돌파, 모멘텀지표>Price Oscillator>Price Oscillator Signal 돌파, 모멘텀지표>Price Oscillator>Price Oscillator 추세, 모멘텀지표>Price Oscillator>Price Oscillator 반전, 모멘텀지표>Price Oscillator>Price Oscillator 비교, 모멘텀지표>Price Oscillator>Price Oscillator Signal 비교, 모멘텀지표>Price Oscillator>Price Oscillator 기준값 범위
- 미래에셋증권(해외): 기술적지표>추세지표>Price Oscillator>Price Oscillator 비교, 기술적지표>추세지표>Price Oscillator>Price Oscillator Signal 비교
- 미래에셋증권: 대상지정>증거금율, 기본적인 캔들>양봉(롱바디), 기본적인 캔들>음봉(롱바디), 기본적인 캔들>양봉(숏바디), 기본적인 캔들>음봉(숏바디), 기본적인 캔들>도지(십자), 기본적인 캔들>포 프라이스 도지, 상승반전>묘비석도지, 상승반전>상승용오름도지, 하락지속>트러스팅 라인, Price Oscillator>Price Oscillator 비교, Price Oscillator>Price Oscillator Signal 비교
- NH증권: 증거금률, 갭>갭 상승/하락 후 상한가/하한가, 모멘텀지표>Price Oscillator>Price Oscillator 추세, 모멘텀지표>Price Oscillator>Price Oscillator 반전, 모멘텀지표>Price Oscillator>Price Oscillator 비교, 모멘텀지표>Price Oscillator>Price Oscillator Signal 비교, 모멘텀지표>Price Oscillator>Price Oscillator Signal 돌파, 모멘텀지표>Price Oscillator>Price Oscillator 순위

## 운영 확인

사용자가 배포한 뒤 문의 선택 → 추천 결과 확인 → 조건 편집 → 답변 복사를 점검합니다. GitHub 수동 workflow의 저장 건수와 현황판을 비교하고, 다음 밤 8시 예약 실행 기록을 확인합니다. 이 작업에서 커밋·푸시·배포는 실행하지 않았습니다.

## XML 상세값 보완 결과

- MAP_NAME 없이 상세 템플릿만 있는 정의를 읽도록 수정하여 31개를 복구했습니다.
- 단독 라디오 템플릿의 CHECKED=1 문구를 읽도록 수정하여 증거금률·액면가 5개를 복구했습니다. 복합 템플릿의 기존 숫자 치환은 유지합니다.
- KB Price Oscillator 순위에 다른 지표인 Band %B 설명이 붙던 잘못된 매칭을 수정했습니다.
- 전체 6,120개의 개수·분류·경로·순서를 비교했습니다. 빈 값 36개와 위 잘못된 연결 1개 외에 기존 상세값은 동일합니다.
- 빈 값은 45개에서 9개로 줄었습니다. 남은 항목은 미래에셋 국내 캔들 조건이며 현재 보유한 XML에서 상세 정의를 찾지 못했습니다.
- 화면 전체 테스트 88개 통과 후 추가한 매칭 회귀 테스트를 포함한 XML 테스트 21개 통과. 화면 테스트 총수는 89개입니다. 서버 14개를 포함해 총 103개를 검증했습니다.
- 운영용 빌드 성공. Browserslist 데이터가 오래됐다는 기존 경고는 남아 있습니다.
- 빌드 시 서버 조건 목록도 함께 생성됩니다. 이미 저장된 AI 결과는 코드 변경만으로 재분석되지 않습니다.
- 커밋·푸시·배포는 진행하지 않았습니다.

## 미래에셋 원본 파일 추가 후 확인

- 사용자가 제공한 mapc1-c3.xml을 미래에셋 국내 map 로딩 목록에 연결했습니다.
- 서버 조건 목록을 다시 생성한 결과, 7개 증권사 6,120개 조건의 빈 상세값은 0개입니다. 기존에 남아 있던 캔들 조건 9개가 채워졌습니다.
- 이 결과는 프로젝트 XML에 등재된 조건을 기준으로 합니다. 증권사 HTS 최신 전체 조건과의 일치 여부나 AI 추천 정확도를 보장하는 검증은 아닙니다.
- 배포 전 로컬 상태이며, 기존 저장 AI 결과는 자동 재분석되지 않습니다.

## 전일 대비 등락률 실무 기준 반영

- 전일 대비 또는 별도 비교 기준이 없는 가격 등락률 문의에 1봉전 가격 대비 0봉전 가격의 등락률 범위 조건을 우선 추천하도록 프롬프트에 반영했습니다.
- 이 형태의 조건이 후보 압축에서 빠지지 않도록 우선 보존합니다. 상세 문구에 등락률이 없는 KB 조건은 조건명과 가격 기준으로 인식합니다.
- 다른 시점·이동평균 기준·거래량·순위 요청에는 기본 규칙을 강제하지 않는 회귀 사례를 포함합니다. 가격 기준 미지정은 기본값을 유지하고 확인 필요로 안내하도록 지시합니다.
- 관련 화면 테스트 37개와 서버 테스트 14개 통과. 실제 Gemini 응답은 호출하지 않았으므로 모델이 실무 기준을 따르는지는 실제 사례로 추가 확인해야 합니다.
- 기존 저장 결과는 그대로 유지되며 이번 규칙은 이후 분석에 적용됩니다. 커밋·푸시·배포는 진행하지 않았습니다.

## 지표 인자 및 숫자 쉼표 보완

- XML 상세 템플릿에서 모든 쉼표를 삭제하던 처리를 제거했습니다. 지표 인자 구분과 숫자의 자리 구분을 보존합니다.
- 공통 숫자 표시 함수를 XML 데이터, AI 결과, 추천·적용 목록, 수동 편집 완료와 답변 생성에 적용했습니다. 지표 대괄호 인자, 소수점 이하 자리, 부호, 종목코드·날짜·시간을 보호합니다.
- 1000과 1000000은 1,000과 1,000,000으로 표시하며, 검색과 후보 점수 계산도 쉼표 표기와 호환되게 보완했습니다.
- 실제 KB XML의 기본 RSI 인자는 14와 9이며 RSI[14,9]로 복원됩니다. 사용자 예시 RSI[14,6]도 별도 포맷 테스트에서 유지됩니다.
- 화면 전체 테스트 118개와 서버 테스트 14개 통과, 총 132개입니다. 조건은 6,120개이고 빈 상세값은 0개입니다.
- 이미 이어 붙여 저장된 RSI[146] 같은 문자열은 원래 인자를 확정할 수 없어 임의로 분할하지 않습니다. 이런 기존 결과는 재분석이 필요합니다.
- 커밋·푸시·배포는 진행하지 않았습니다.
