# Oracle to PostgreSQL 변환 테스트 케이스 (Test Cases)

이 문서는 Oracle SQL을 PostgreSQL로 변환할 때의 주요 사례별 입력(Oracle)과 출력(PostgreSQL) 결과를 정리한 문서입니다.

## 1. 기초 문법 변환 (Basic Syntax)

### 1.1 시퀀스 (NEXTVAL)
- **Input:** `SELECT MY_SEQ.NEXTVAL FROM DUAL;`
- **Output:** `SELECT nextval('MY_SEQ')`

### 1.2 DELETE 문법 (DELETE FROM)
- **Input:** `DELETE MY_TABLE WHERE ID = 1;`
- **Output:** `DELETE FROM MY_TABLE WHERE ID = 1`

---

## 2. 내장 함수 변환 (Function Mappings)

### 2.1 NVL 및 DECODE
- **Input:** `SELECT NVL(COL1, 'N/A'), DECODE(STATUS, '1', 'OK', 'NO') FROM DUAL;`
- **Output:**
```sql
SELECT COALESCE(COL1, 'N/A')
    , CASE
    WHEN STATUS = '1' THEN 'OK'
    ELSE 'NO'
END
```

### 2.2 LPAD, SUBSTR, TO_NUMBER
- **Input:** `SELECT LPAD(TO_NUMBER(SUBSTR('12345', 1, 3)) + 1, 5, '0') FROM DUAL;`
- **Output:** `SELECT LPAD(((SUBSTR('12345', 1, 3))::NUMERIC + 1)::TEXT, 5, '0')`

### 2.3 날짜 관련 함수 (TRUNC, LAST_DAY, ADD_MONTHS)
- **Input:**
```sql
SELECT TRUNC(SYSDATE, 'MM') AS M_START
     , LAST_DAY(SYSDATE) AS M_END
     , ADD_MONTHS(SYSDATE, 1) AS NEXT_M
FROM DUAL;
```
- **Output:**
```sql
SELECT DATE_TRUNC('month', CURRENT_TIMESTAMP) AS M_START
    , (DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month' - INTERVAL '1 day') AS M_END
    , (CURRENT_TIMESTAMP + INTERVAL '1 months') AS NEXT_M
```

---

## 3. 고급 쿼리 변환 (Advanced Queries)

### 3.1 ROWNUM 처리 (LIMIT)
- **Input:** `SELECT * FROM MY_TABLE WHERE ROWNUM <= 10;`
- **Output:** `SELECT * FROM MY_TABLE LIMIT 10`

### 3.2 계층형 쿼리 (CONNECT BY ➜ generate_series)
- **Input:** `SELECT LEVEL FROM DUAL CONNECT BY LEVEL <= 5;`
- **Output:** `SELECT gs AS LEVEL FROM generate_series(1, 5) gs`

### 3.3 ROLLUP 및 GROUPING_ID
- **Input:**
```sql
SELECT COL1, COL2, GROUPING_ID(COL1, COL2) AS G_ID
FROM MY_TABLE
GROUP BY ROLLUP(COL1, COL2);
```
- **Output:**
```sql
SELECT COL1
    , COL2
    , GROUPING(COL1) * 2 + GROUPING(COL2) * 1 AS G_ID
FROM MY_TABLE
GROUP BY ROLLUP(COL1, COL2)
```

---

## 4. 조인 및 서브쿼리 (Joins & Subqueries)

### 4.1 Oracle Outer Join (+) ➜ ANSI Join
- **Input:**
```sql
SELECT A.NAME, B.DEPT
FROM EMP_T A, DEPT_T B
WHERE A.DEPT_ID = B.DEPT_ID(+)
  AND B.USE_FLAG(+) = '1';
```
- **Output:**
```sql
SELECT A.NAME
    , B.DEPT
FROM EMP_T A
LEFT JOIN DEPT_T B
    ON A.DEPT_ID = B.DEPT_ID
    AND B.USE_FLAG = '1'
```

---

## 5. 복합 사례 (Complex Case Study)

가장 복잡한 형태의 서브쿼리, 조인, 집계 함수가 혼합된 사례입니다.

### Input (Oracle SQL - Complex)
```sql
SELECT A.CURRENCY_CODE
      ,CASE WHEN A.GROUP_ID = 0 THEN A.STEPPURPOSE END AS STEPPURPOSE
      ,A.BANK_ACCT_ID
      ,SUM(THE_DAY_BEFORE) AS THE_DAY_BEFORE
      ,GROUPING_ID(CURRENCY_CODE, STEPPURPOSE, BANK_CODE) AS GROUP_ID
  FROM (
        SELECT A.CURRENCY_CODE, A.STEPPURPOSE, B.BANK_CODE, B.BANK_ACCT_ID
          FROM TABLE_A A, TABLE_B B
         WHERE A.ID = B.ID(+)
           AND B.USE_FLAG(+) = '1'
       ) A
 GROUP BY ROLLUP(CURRENCY_CODE, STEPPURPOSE, BANK_CODE);
```

### Output (PostgreSQL SQL - Formatted)
```sql
SELECT A.CURRENCY_CODE
    , CASE
    WHEN A.GROUP_ID = 0
    THEN A.STEPPURPOSE
END AS STEPPURPOSE
, A.BANK_ACCT_ID
, SUM(THE_DAY_BEFORE) AS THE_DAY_BEFORE
, GROUPING(CURRENCY_CODE) * 4 + GROUPING(STEPPURPOSE) * 2 + GROUPING(BANK_CODE) * 1 AS GROUP_ID
FROM (
    SELECT A.CURRENCY_CODE
        , A.STEPPURPOSE
        , B.BANK_CODE
        , B.BANK_ACCT_ID
    FROM TABLE_A A
    LEFT JOIN TABLE_B B
        ON A.ID = B.ID
        AND B.USE_FLAG = '1' ) AS A
GROUP BY ROLLUP(CURRENCY_CODE, STEPPURPOSE, BANK_CODE)
```
