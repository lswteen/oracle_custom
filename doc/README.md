# Oracle to PostgreSQL Converter (v1.2.1)

Oracle SQL을 PostgreSQL용 쿼리로 변환하고, Java 소스 코드 내의 SQL을 추출 및 관리하기 위한 도구입니다. Java 21의 Text Block(`"""`) 형식을 지원하며, 복잡한 Oracle 특유 문법을 PostgreSQL 표준 및 최적화된 문법으로 자동 변환합니다.

## 주요 기능 (Features)

### 1. SQL 추출 및 복원 (Extraction & Restoration)
- **Java 소스 추출:** Java 코드 내의 `.append()` 체인이나 문자열 결합 형태로 작성된 SQL을 순수 SQL 문법으로 자동 추출합니다.
- **Java 21 Text Block 지원:** 변환된 SQL을 Java 21의 Text Block(`"""`) 형식으로 복원하며, 원본 코드의 주석을 SQL 내부에 `--` 주석으로 유지하여 가독성을 높입니다.

### 2. 주요 문법 변환 (Syntax Conversion)
- **시퀀스(Sequence):** Oracle의 `SEQ_NAME.NEXTVAL`을 PostgreSQL의 `nextval('SEQ_NAME')` 형식으로 변환합니다.
- **DELETE 문법 강화:** PostgreSQL에서 필수인 `DELETE FROM [TABLE]` 형식을 보장하도록 자동 수정합니다.
- **GROUPING_ID 변환:** Oracle의 `GROUPING_ID(a, b, c)`를 PostgreSQL 호환을 위해 `GROUPING(a)*4 + GROUPING(b)*2 + GROUPING(c)*1` 형태의 비트마스크 연산으로 변환합니다.
- **내장 함수 지원:**
    - `NVL` ➜ `COALESCE`
    - `SYSDATE` ➜ `CURRENT_TIMESTAMP`
    - `DECODE` ➜ `CASE WHEN ... END`
    - `INSTR`, `SUBSTR`, `SUBSTRB`, `TRUNC`, `ADD_MONTHS`, `LAST_DAY` 등 대응 변환
    - `TO_CHAR`, `TO_DATE`, `TO_NUMBER` (데이터 타입 캐스팅 포함)
- **계층형 쿼리:** `CONNECT BY LEVEL` 구문을 PostgreSQL의 `generate_series()`를 사용한 구문으로 변환합니다.
- **Rownum 처리:** `ROWNUM` 조건을 PostgreSQL의 `LIMIT` 구문으로 변환합니다.

### 3. 조인 문법 변환 (Join Conversion)
- **Join (+) 변환:** Oracle 특유의 임시 조인 표기법인 `(+)`를 ANSI 표준인 `LEFT JOIN`, `RIGHT JOIN` 등으로 자동 변환하고 `ON` 절로 필터 조건을 이동시킵니다.
- **명시적 조인:** 암묵적 조인(Comma Join)을 명시적 `JOIN` 문법으로 재구성합니다.

### 4. SQL 포매터 (SQL Beautifier)
- **Slot 3 자동 적용:** 변환된 PostgreSQL 쿼리를 시각적으로 이해하기 쉽게 자동으로 정렬합니다.
- **주요 특징:**
    - 주요 키워드(SELECT, FROM, WHERE 등) 기준 줄바꿈
    - 계층 구조에 따른 들여쓰기(Indentation) 적용
    - 유지보수가 용이한 Leading Comma(줄 시작 콤마) 스타일 적용

## 프로젝트 구조

- `oracle_to_pgsql.js`: 핵심 변환 로직 엔진
- `oracle_to_pgsql_converter.html`: 웹 기반 통합 변환 인터페이스
- `doc/test_case.md`: 대규모 쿼리 및 기능별 변환 샘플 모음

## 사용 방법

1. `oracle_to_pgsql_converter.html` 파일을 브라우저에서 엽니다.
2. **Slot 1:** Java 소스 코드를 붙여넣으면 자동으로 SQL이 추출되어 Slot 2에 표시됩니다.
3. **Slot 3:** "Transform Now" 버튼을 클릭하면 PostgreSQL로 변환 및 포맷팅된 쿼리가 표시됩니다.
4. **Slot 4:** 최종적으로 변환된 Java Text Block 소스를 복사하여 프로젝트에 적용합니다.
