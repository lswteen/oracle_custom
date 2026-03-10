# Oracle to PostgreSQL Converter Pro

Oracle 19c SQL 쿼리를 Azure PostgreSQL 18 환경에 맞게 변환해주는 전문가용 도구입니다. Java 소스 코드에서 SQL을 자동으로 추출하고 변환하며, 다시 Java 코드로 래핑하는 전체 워크플로우를 지원합니다.

---

## 🚀 주요 특징

- **오프라인 최적화**: 모든 로직이 로컬 JavaScript (`oracle_to_pgsql.js`)로 처리되어 인터넷 연결 없이 보안 구역에서도 사용 가능합니다.
- **Java 소스 구조 보존 (Smart Replace)**: 변환 시 Java 코드의 **들여쓰기, 변수명, 주석 및 연산 구조를 100% 보존**하면서 문자열 내부의 SQL만 정교하게 치환합니다.
- **가변 날짜 포맷팅**: 프로젝트 표준에 따라 `YYYY-MM-DD`, `YYYYMMDD`, `YYYY/MM/DD` 등 다양한 날짜 포맷을 선택하여 변환할 수 있습니다.
- **정교한 변환 엔진**:
    - `NVL` -> `COALESCE`, `NVL2` -> `CASE WHEN`
    - `DECODE` -> `CASE WHEN` (재귀적/중첩 처리 및 홑따옴표 탈출 완벽 지원)
    - `SYSDATE` / `SYSTIMESTAMP` -> `CURRENT_TIMESTAMP`
    - `(+)` Outer Join -> ANSI Join 변환 가이드 주석 생성
    - `@dblink` -> 주석 처리 및 제거
    - `ROWNUM` -> `LIMIT` 또는 `ROW_NUMBER()` 가이드
    - `TO_CHAR` (포맷 선택 반영) / `TRUNC` / `LAST_DAY` / `ADD_MONTHS` 등 일체 지원

## 🛠 사용 방법

1.  **실행**: `oracle_to_pgsql_converter.html` 파일을 크롬(Chrome)이나 엣지(Edge) 브라우저로 엽니다.
2.  **소스 입력**: 좌상단 "1. Java Source" 패널에 `sb.append("...")` 또는 `sql += "..."` 형태의 Java 코드를 붙여넣습니다.
3.  **자동 추출**: 입력 즉시 "2. Extracted Oracle SQL" 패널에 SQL 본문만 추출됩니다.
3.  **옵션 설정**: 우상단 "DATE FORMAT" 드롭다운에서 원하는 출력 포맷을 선택합니다.
4.  **변환 수행**: "Transform Now" 버튼을 클릭합니다.
5.  **결과 확인**:
    - "3. Transformed PG SQL": 순수 SQL 변환 결과물
    - "4. Final Java (Structure Preserved)": **원본 Java 코드 스타일을 유지**한 최종 결과 (주석 및 들여쓰기 보존)

---

## 🧪 기능별 변환 테스트 샘플 (10대 핵심 기능)

`oracle_to_pgsql_converter.html` 도구에서 직접 테스트해볼 수 있는 기능 단위 샘플 코드입니다.

### 1. NULL 처리 (NVL)
- **기능**: NULL 또는 빈 값을 기본값으로 치환
- **Oracle Source**:
  ```java
  sb.append(" SELECT NVL(USER_ID, 'GUEST') as user_id \n ");
  sb.append(" FROM USERS \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  SELECT COALESCE(USER_ID, 'GUEST') as user_id 
  FROM USERS 
  ```

### 2. 조건부 변환 (DECODE)
- **기능**: 복잡한 조건문을 CASE 문으로 변환 (중첩 처리 가능)
- **Oracle Source**:
  ```java
  sb.append(" SELECT DECODE(STATUS, '1', '정상', '2', '정지', '기타') as status_nm \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  SELECT CASE WHEN STATUS = '1' THEN '정상' WHEN STATUS = '2' THEN '정지' ELSE '기타' END as status_nm 
  ```

### 3. NULL 조건 변환 (NVL2)
- **기능**: 값이 존재할 때와 아닐 때를 나누어 리턴
- **Oracle Source**:
  ```java
  sb.append(" SELECT NVL2(MODIFY_DATE, '수정됨', '신규') as stat \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  SELECT CASE WHEN MODIFY_DATE IS NOT NULL THEN '수정됨' ELSE '신규' END as stat 
  ```

### 4. 아우터 조인 (Outer Join +)
- **기능**: 오라클 특유의 `(+)` 구문을 감지하여 ANSI Join 가이드 주석 생성
- **Oracle Source**:
  ```java
  sb.append(" SELECT A.NAME, B.DEPT_NAME \n ");
  sb.append(" FROM EMP A, DEPT B \n ");
  sb.append(" WHERE A.DEPT_ID = B.DEPT_ID(+) \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  SELECT A.NAME, B.DEPT_NAME 
  FROM EMP A, DEPT B 
  WHERE /* ANSI: JOIN DEPT ON A.DEPT_ID = B.DEPT_ID */ A.DEPT_ID = B.DEPT_ID 
  ```

### 5. 현재 일시 (SYSDATE / SYSTIMESTAMP)
- **기능**: 시스템 기준 현재 시간 함수 변환
- **Oracle Source**:
  ```java
  sb.append(" INSERT INTO LOGS (LOG_TIME) VALUES (SYSDATE) \n ");
  sb.append(" SELECT SYSTIMESTAMP FROM DUAL \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  INSERT INTO LOGS (LOG_TIME) VALUES (CURRENT_TIMESTAMP) 
  SELECT CURRENT_TIMESTAMP /* FROM DUAL */ 
  ```

### 6. 날짜 가감 및 계산 (Advanced Date)
- **기능**: `ADD_MONTHS`, `LAST_DAY`, `MONTHS_BETWEEN` 처리
- **Oracle Source**:
  ```java
  sb.append(" SELECT ADD_MONTHS(SYSDATE, 1) as next_month \n ");
  sb.append("      , LAST_DAY(SYSDATE) as end_of_month \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  SELECT (CURRENT_TIMESTAMP + INTERVAL '1 month') as next_month 
       , (DATE_TRUNC('MONTH', CURRENT_TIMESTAMP) + INTERVAL '1 MONTH - 1 day')::DATE as end_of_month 
  ```

### 7. 시퀀스 (NEXTVAL / CURRVAL)
- **기능**: 오라클 시퀀스 구문을 PostgreSQL 함수 형태로 변환
- **Oracle Source**:
  ```java
  sb.append(" INSERT INTO USERS (ID) VALUES (USER_SEQ.NEXTVAL) \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  INSERT INTO USERS (ID) VALUES (NEXTVAL('USER_SEQ')) 
  ```

### 8. 결과 건수 제한 (ROWNUM)
- **기능**: `WHERE ROWNUM` 구문을 `LIMIT`로 변환
- **Oracle Source**:
  ```java
  sb.append(" SELECT * FROM EMP WHERE ROWNUM <= 10 \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  SELECT * FROM EMP LIMIT 10 
  ```

### 9. 집합 연산자 (MINUS)
- **기능**: 두 결과 셋의 차집합 연산자 변환
- **Oracle Source**:
  ```java
  sb.append(" SELECT ID FROM TABLE_A MINUS SELECT ID FROM TABLE_B \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  SELECT ID FROM TABLE_A EXCEPT SELECT ID FROM TABLE_B 
  ```

### 10. 바이트 및 LOB 처리
- **기능**: `LENGTHB`, `SUBSTRB`, `DBMS_LOB` 처리
- **Oracle Source**:
  ```java
  sb.append(" SELECT LENGTHB(CONTENT) as bytes \n ");
  sb.append("      , DBMS_LOB.SUBSTR(CLOB_COL, 4000, 1) as txt \n ");
  ```
- **PostgreSQL Result**:
  ```sql
  SELECT OCTET_LENGTH(CONTENT) as bytes 
       , SUBSTRING(CLOB_COL, 1, 4000) as txt 
  ```

---

## 📂 파일 구조
- `oracle_to_pgsql_converter.html`: UI 인터페이스 (반응형 다크 모드)
- `oracle_to_pgsql.js`: 변환 핵심 라이브러리 (Smart Replace 로직 포함)
- `sample_queries.md`: 실제 프로젝트 이미지(`샘플.jpg`, `oracle_sample.jpg`)에서 추출한 복합 테스트 쿼리 모음
- `README.md`: 본 통합 가이드 문서
