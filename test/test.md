# Oracle → PostgreSQL 변환 샘플 케이스

> **변환기**: `oracle_to_pgsql.js` v1.0.3  
> **생성일**: 2026-03-06

---

### Case 01: ROWNUM=1 + LPAD + TO_NUMBER + SUBSTR

**Oracle (Java)**
```java
sbSql.append(" SELECT ?||TO_CHAR(TO_DATE(?), 'YYYYMM') \n");
sbSql.append("        ||NVL(LPAD(TO_NUMBER(SUBSTR(MAX(voucher_no),8,5))+1, 5,'0'),'00001') \n");
sbSql.append(" FROM   voucher_t \n");
sbSql.append(" WHERE  voucher_no LIKE ?||TO_CHAR(TO_DATE(?), 'YYYYMM')||'%' \n");
sbSql.append(" AND    ROWNUM = 1 \n");
```

**Oracle SQL**
```sql
SELECT ?||TO_CHAR(TO_DATE(?), 'YYYYMM') 
        ||NVL(LPAD(TO_NUMBER(SUBSTR(MAX(voucher_no),8,5))+1, 5,'0'),'00001') 
 FROM   voucher_t 
 WHERE  voucher_no LIKE ?||TO_CHAR(TO_DATE(?), 'YYYYMM')||'%' 
 AND    ROWNUM = 1
```

**PostgreSQL**
```sql
SELECT (?)::TEXT ||TO_CHAR(TO_DATE(?, 'YYYYMMDD'), 'YYYYMM') 
        ||COALESCE(LPAD(((SUBSTR(MAX(voucher_no),8,5))::NUMERIC+1)::TEXT, 5, '0'),'00001') 
 FROM   voucher_t 
 WHERE  voucher_no LIKE (?)::TEXT ||TO_CHAR(TO_DATE(?, 'YYYYMMDD'), 'YYYYMM')||'%' 
 LIMIT 1
```

---

### Case 02: DECODE + NVL2

**Oracle (Java)**
```java
sbSql.append(" SELECT A.USER_ID \n");
sbSql.append("      , DECODE(A.STATUS, '1', 'ACTIVE', '2', 'SUSPENDED', 'DELETED') AS status_nm \n");
sbSql.append("      , NVL2(A.LAST_LOGIN, 'LOGGED_IN', 'NEVER') AS login_yn \n");
sbSql.append(" FROM   USER_T A \n");
sbSql.append(" WHERE  A.USER_ID = ? \n");
```

**Oracle SQL**
```sql
SELECT A.USER_ID 
      , DECODE(A.STATUS, '1', 'ACTIVE', '2', 'SUSPENDED', 'DELETED') AS status_nm 
      , NVL2(A.LAST_LOGIN, 'LOGGED_IN', 'NEVER') AS login_yn 
 FROM   USER_T A 
 WHERE  A.USER_ID = ?
```

**PostgreSQL**
```sql
SELECT A.USER_ID 
      , CASE
    WHEN A.STATUS = '1' THEN 'ACTIVE'
    WHEN A.STATUS = '2' THEN 'SUSPENDED'
    ELSE 'DELETED'
 END AS status_nm 
      , CASE
    WHEN A.LAST_LOGIN IS NOT NULL THEN 'LOGGED_IN'
    ELSE 'NEVER'
 END AS login_yn 
 FROM   USER_T A 
 WHERE  A.USER_ID = ?
```

---

### Case 03: (+) LEFT JOIN + ROWNUM

**Oracle (Java)**
```java
sbSql.append(" SELECT A.EMP_NAME, B.DEPT_NAME \n");
sbSql.append(" FROM   EMP_T A, DEPT_T B \n");
sbSql.append(" WHERE  A.DEPT_ID = B.DEPT_ID(+) \n");
sbSql.append(" AND    A.SALARY > TO_NUMBER(?) \n");
sbSql.append(" AND    ROWNUM = 1 \n");
```

**Oracle SQL**
```sql
SELECT A.EMP_NAME, B.DEPT_NAME 
 FROM   EMP_T A, DEPT_T B 
 WHERE  A.DEPT_ID = B.DEPT_ID(+) 
 AND    A.SALARY > TO_NUMBER(?) 
 AND    ROWNUM = 1
```

**PostgreSQL**
```sql
SELECT A.EMP_NAME, B.DEPT_NAME 
 FROM EMP_T A
 LEFT JOIN DEPT_T B
  ON A.DEPT_ID = B.DEPT_ID
 WHERE A.SALARY > (?)::NUMERIC
 LIMIT 1
```

---

### Case 04: DECODE(INSTR) 중첩

**Oracle (Java)**
```java
sbSql.append(" SELECT DECODE(INSTR(holder_name, '아메리카'), 0, 'NONE', 'EXISTS') AS chk \n");
sbSql.append("      , DECODE(INSTR(col1, 'sub', 3), 0, 'NOT_FOUND', 'FOUND') AS chk2 \n");
sbSql.append(" FROM   DEPT_T \n");
```

**Oracle SQL**
```sql
SELECT DECODE(INSTR(holder_name, '아메리카'), 0, 'NONE', 'EXISTS') AS chk 
      , DECODE(INSTR(col1, 'sub', 3), 0, 'NOT_FOUND', 'FOUND') AS chk2 
 FROM   DEPT_T
```

**PostgreSQL**
```sql
SELECT CASE
    WHEN STRPOS(holder_name, '아메리카') = 0 THEN 'NONE'
    ELSE 'EXISTS'
 END AS chk 
      , CASE
    WHEN STRPOS(SUBSTRING(col1 FROM 3), 'sub') = 0 THEN 'NOT_FOUND'
    ELSE 'FOUND'
 END AS chk2 
 FROM   DEPT_T
```

---

### Case 05: BETWEEN + (+) 조인

**Oracle (Java)**
```java
sbSql.append(" SELECT * \n");
sbSql.append(" FROM   table_a a, table_b b \n");
sbSql.append(" WHERE  a.trans_date(+) BETWEEN :FROM AND :TO \n");
sbSql.append(" AND    a.bank_acct_seq(+) = b.bank_acct_seq \n");
sbSql.append(" AND    a.use_flag(+) = '1' \n");
sbSql.append(" AND    b.use_flag    = '1' \n");
```

**Oracle SQL**
```sql
SELECT * 
 FROM   table_a a, table_b b 
 WHERE  a.trans_date(+) BETWEEN :FROM AND :TO 
 AND    a.bank_acct_seq(+) = b.bank_acct_seq 
 AND    a.use_flag(+) = '1' 
 AND    b.use_flag    = '1'
```

**PostgreSQL**
```sql
SELECT * 
 FROM table_a a
 LEFT JOIN table_b b
  ON a.bank_acct_seq = b.bank_acct_seq
 AND b.use_flag    = '1'
 WHERE a.trans_date BETWEEN :FROM AND :TO
   AND a.use_flag = '1'
```

---

### Case 06: ROLLUP + GROUPING + DECODE

**Oracle (Java)**
```java
sbSql.append(" SELECT DECODE(GROUPING(dept_code), 1, '합계', dept_code) AS dept_code \n");
sbSql.append("      , SUM(salary) AS total_salary \n");
sbSql.append(" FROM   emp_t \n");
sbSql.append(" GROUP BY ROLLUP(dept_code) \n");
```

**Oracle SQL**
```sql
SELECT DECODE(GROUPING(dept_code), 1, '합계', dept_code) AS dept_code 
      , SUM(salary) AS total_salary 
 FROM   emp_t 
 GROUP BY ROLLUP(dept_code)
```

**PostgreSQL**
```sql
SELECT CASE
    WHEN GROUPING(dept_code) = 1 THEN '합계'
    ELSE dept_code
 END AS dept_code 
      , SUM(salary) AS total_salary 
 FROM   emp_t 
 GROUP BY ROLLUP(dept_code)
```

---

### Case 07: GROUPING 합산 문자열 비교

**Oracle (Java)**
```java
sbSql.append(" SELECT dept, job, SUM(amt) \n");
sbSql.append(" FROM   emp_t \n");
sbSql.append(" GROUP BY ROLLUP(dept, job) \n");
sbSql.append(" HAVING (GROUPING(dept) + GROUPING(job)) = '0' \n");
sbSql.append("     OR (GROUPING(dept) + GROUPING(job)) = '1' \n");
```

**Oracle SQL**
```sql
SELECT dept, job, SUM(amt) 
 FROM   emp_t 
 GROUP BY ROLLUP(dept, job) 
 HAVING (GROUPING(dept) + GROUPING(job)) = '0' 
     OR (GROUPING(dept) + GROUPING(job)) = '1'
```

**PostgreSQL**
```sql
SELECT dept, job, SUM(amt) 
 FROM   emp_t 
 GROUP BY ROLLUP(dept, job) 
 HAVING (GROUPING(dept) + GROUPING(job))::TEXT = '0' 
     OR (GROUPING(dept) + GROUPING(job))::TEXT = '1'
```

---

### Case 08: ROWNUM <= N

**Oracle (Java)**
```java
sbSql.append(" SELECT * \n");
sbSql.append(" FROM   USER_T \n");
sbSql.append(" WHERE  STATUS = '1' \n");
sbSql.append(" AND    ROWNUM <= 10 \n");
```

**Oracle SQL**
```sql
SELECT * 
 FROM   USER_T 
 WHERE  STATUS = '1' 
 AND    ROWNUM <= 10
```

**PostgreSQL**
```sql
SELECT * 
 FROM   USER_T 
 WHERE  STATUS = '1' 
 LIMIT 10
```

---

### Case 09: CONNECT BY ROWNUM (가상 시퀀스)

**Oracle (Java)**
```java
sbSql.append(" SELECT TO_NUMBER('000001') + (ROWNUM - 1) AS virtual_trace_no \n");
sbSql.append(" FROM   DUAL \n");
sbSql.append(" CONNECT BY ROWNUM <= (SELECT MAX(TO_NUMBER(trace_no)) FROM trace_t) \n");
```

**Oracle SQL**
```sql
SELECT TO_NUMBER('000001') + (ROWNUM - 1) AS virtual_trace_no 
 FROM   DUAL 
 CONNECT BY ROWNUM <= (SELECT MAX(TO_NUMBER(trace_no)) FROM trace_t)
```

**PostgreSQL**
```sql
SELECT ('000001')::NUMERIC + (gs - 1) AS virtual_trace_no FROM generate_series(1, (SELECT MAX((trace_no)::NUMERIC) FROM trace_t)) gs
```

---

### Case 10: CONNECT BY LEVEL (서브쿼리 범위)

**Oracle (Java)**
```java
sbSql.append(" SELECT * \n");
sbSql.append(" FROM ( \n");
sbSql.append("     SELECT LEVEL AS lv \n");
sbSql.append("     FROM   DUAL \n");
sbSql.append("     CONNECT BY LEVEL <= ( \n");
sbSql.append("         SELECT MAX(TO_NUMBER(trace_no)) - TO_NUMBER('000001') \n");
sbSql.append("         FROM   trace_t \n");
sbSql.append("         WHERE  send_date = :SEND_DATE \n");
sbSql.append("     ) \n");
sbSql.append(" ) a \n");
```

**Oracle SQL**
```sql
SELECT * 
 FROM ( 
     SELECT LEVEL AS lv 
     FROM   DUAL 
     CONNECT BY LEVEL <= ( 
         SELECT MAX(TO_NUMBER(trace_no)) - TO_NUMBER('000001') 
         FROM   trace_t 
         WHERE  send_date = :SEND_DATE 
     ) 
 ) a
```

**PostgreSQL**
```sql
SELECT * 
 FROM (  
     SELECT gs AS lv FROM generate_series(1, ( 
         SELECT MAX((trace_no)::NUMERIC) - ('000001')::NUMERIC 
         FROM   trace_t 
         WHERE  send_date = :SEND_DATE 
     )) gs ) AS a
```

---

### Case 11: SUBSTRB (한글/혼합 컬럼)

**Oracle (Java)**
```java
sbSql.append(" SELECT SUBSTRB(korean_name, 1, 6)  AS short_name \n");
sbSql.append("      , SUBSTRB(mixed_col,  1, 10) AS short_code \n");
sbSql.append("      , SUBSTR(eng_col,     1, 5)  AS eng_short \n");
sbSql.append(" FROM   member_t \n");
```

**Oracle SQL**
```sql
SELECT SUBSTRB(korean_name, 1, 6)  AS short_name 
      , SUBSTRB(mixed_col,  1, 10) AS short_code 
      , SUBSTR(eng_col,     1, 5)  AS eng_short 
 FROM   member_t
```

**PostgreSQL**
```sql
SELECT substrb(korean_name, 1, 6)  AS short_name 
      , substrb(mixed_col,  1, 10) AS short_code 
      , SUBSTR(eng_col,     1, 5)  AS eng_short 
 FROM   member_t
```

---

### Case 12: INSTR 인자 2/3/4개

**Oracle (Java)**
```java
sbSql.append(" SELECT INSTR(A.COL1, 'sub')       AS pos1 \n");
sbSql.append("      , INSTR(A.COL1, 'sub', 1)    AS pos2 \n");
sbSql.append("      , INSTR(A.COL1, 'sub', 3)    AS pos3 \n");
sbSql.append("      , INSTR(A.COL1, 'sub', 1, 2) AS pos4 \n");
sbSql.append(" FROM   TABLE_A A \n");
```

**Oracle SQL**
```sql
SELECT INSTR(A.COL1, 'sub')       AS pos1 
      , INSTR(A.COL1, 'sub', 1)    AS pos2 
      , INSTR(A.COL1, 'sub', 3)    AS pos3 
      , INSTR(A.COL1, 'sub', 1, 2) AS pos4 
 FROM   TABLE_A A
```

**PostgreSQL**
```sql
SELECT STRPOS(A.COL1, 'sub')       AS pos1 
      , STRPOS(A.COL1, 'sub')    AS pos2 
      , STRPOS(SUBSTRING(A.COL1 FROM 3), 'sub')    AS pos3 
      , /*⚠️ instr() 커스텀 함수 필요 */ instr(A.COL1, 'sub', 1, 2) AS pos4 
 FROM   TABLE_A A
```

---

### Case 13: TRUNC + ADD_MONTHS + LAST_DAY

**Oracle (Java)**
```java
sbSql.append(" SELECT TRUNC(SYSDATE, 'MM')   AS month_start \n");
sbSql.append("      , TRUNC(SYSDATE, 'YYYY') AS year_start \n");
sbSql.append("      , ADD_MONTHS(SYSDATE, 3)  AS three_months_later \n");
sbSql.append("      , ADD_MONTHS(SYSDATE, -1) AS last_month \n");
sbSql.append("      , LAST_DAY(SYSDATE)       AS month_end \n");
sbSql.append(" FROM   DUAL \n");
```

**Oracle SQL**
```sql
SELECT TRUNC(SYSDATE, 'MM')   AS month_start 
      , TRUNC(SYSDATE, 'YYYY') AS year_start 
      , ADD_MONTHS(SYSDATE, 3)  AS three_months_later 
      , ADD_MONTHS(SYSDATE, -1) AS last_month 
      , LAST_DAY(SYSDATE)       AS month_end 
 FROM   DUAL
```

**PostgreSQL**
```sql
SELECT DATE_TRUNC('month', CURRENT_TIMESTAMP)   AS month_start 
      , DATE_TRUNC('year', CURRENT_TIMESTAMP) AS year_start 
      , (CURRENT_TIMESTAMP + INTERVAL '3 months')  AS three_months_later 
      , (CURRENT_TIMESTAMP - INTERVAL '1 months') AS last_month 
      , (DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month' - INTERVAL '1 day')       AS month_end
```

---

### Case 14: UNION ALL + DECODE(INSTR) + (+) 조인

**Oracle (Java)**
```java
sbSql.append(" SELECT '1' AS seq, b.nickname AS detail --주석00 \n"); /*주석11*/
sbSql.append("      , SUM(DECODE(INSTR(a.opp_name, '150000414190'), 0, /*주석00*/ \n"); /*주석11*/
sbSql.append("            DECODE(a.code, '30', a.amt, '52', a.amt * -1, 0), 0)) AS amount \n"); /*주석22*/
sbSql.append(" FROM   cms_trans_t a, bank_acct_t b -- 주석 \n");
sbSql.append(" WHERE  a.trans_date(+) BETWEEN :FROM AND :TO /*주석*/ \n");
sbSql.append(" AND    a.bank_acct_seq(+) = b.bank_acct_seq \n");
sbSql.append(" AND    b.use_flag = '1' \n");
sbSql.append(" GROUP BY b.nickname \n");
sbSql.append(" UNION ALL \n");
sbSql.append(" SELECT '2' AS seq, NULL AS detail \n");
sbSql.append("      , NVL(SUM(amount), 0) AS amount \n");
sbSql.append(" FROM   DUAL \n");
```

**Oracle SQL**
```sql
SELECT '1' AS seq, b.nickname AS detail 
      , SUM(DECODE(INSTR(a.opp_name, '150000414190'), 0, 
            DECODE(a.code, '30', a.amt, '52', a.amt * -1, 0), 0)) AS amount 
 FROM   cms_trans_t a, bank_acct_t b 
 WHERE  a.trans_date(+) BETWEEN :FROM AND :TO 
 AND    a.bank_acct_seq(+) = b.bank_acct_seq 
 AND    b.use_flag = '1' 
 GROUP BY b.nickname 
 UNION ALL 
 SELECT '2' AS seq, NULL AS detail 
      , NVL(SUM(amount), 0) AS amount 
 FROM   DUAL
```

**PostgreSQL**
```sql
SELECT '1' AS seq, b.nickname AS detail 
      , SUM(CASE
    WHEN STRPOS(a.opp_name, '150000414190') = 0 THEN CASE
    WHEN a.code = '30' THEN a.amt
    WHEN a.code = '52' THEN a.amt * -1
    ELSE 0
 END
    ELSE 0
 END) AS amount 
 FROM cms_trans_t a
 LEFT JOIN bank_acct_t b
  ON a.bank_acct_seq = b.bank_acct_seq
 AND b.use_flag = '1'
 WHERE a.trans_date BETWEEN :FROM AND :TO
 GROUP BY b.nickname 
 UNION ALL 
 SELECT '2' AS seq, NULL AS detail 
      , COALESCE(SUM(amount), 0) AS amount
```

---

### Case 15: Subquery with UNION ALL + (+) 조인

**Oracle SQL**
```sql
SELECT * FROM (
    SELECT a.id, b.id as b_id FROM table_a a, table_b b WHERE a.id = b.id(+)
    UNION ALL
    SELECT a.id, b.id as b_id FROM table_c a, table_d b WHERE a.id = b.id(+)
) x
```

**PostgreSQL**
```sql
SELECT * FROM ( SELECT a.id, b.id as b_id FROM table_a a
 LEFT JOIN table_b b
  ON a.id = b.id
UNION ALL
    SELECT a.id, b.id as b_id FROM table_c a
 LEFT JOIN table_d b
  ON a.id = b.id ) AS x
```

---

### Case 16: 문제의 쿼리 (Screenshot Query)

**Oracle SQL**
```sql
SELECT * FROM (
    SELECT a.cms_seq, b.cms_demand_list_seq
    FROM gas.cms_demand_mngt_t a
       , gas.cms_demand_list_mngt_t b
       , gas.cms_demand_detail_t c
       , gas.cms_common_area_t d
       , gas.common_detail_code_t e
    WHERE a.cms_seq = :CMS_SEQ
    AND a.data_create_date = :DATA_CREATE_DATE
    AND a.cms_demand_list_seq = b.cms_demand_list_seq
    AND b.cms_demand_list_mngt_seq = c.cms_demand_list_mngt_seq
    AND c.cms_common_area_seq = d.cms_common_area_seq(+)
    AND c.payment_account_bank_code = e.common_detail_code(+)
    AND e.common_code(+) = '0021'
    AND a.use_flag = '1'
    AND b.use_flag = '1'
    AND e.use_flag(+) = '1'
) x
GROUP BY x.cms_demand_list_seq
```

**PostgreSQL**
```sql
SELECT * FROM ( SELECT a.cms_seq, b.cms_demand_list_seq
    FROM gas.cms_demand_mngt_t a
 JOIN gas.cms_demand_list_mngt_t b
  ON a.cms_demand_list_seq = b.cms_demand_list_seq
 AND b.use_flag = '1'
 JOIN gas.cms_demand_detail_t c
  ON b.cms_demand_list_mngt_seq = c.cms_demand_list_mngt_seq
 LEFT JOIN gas.cms_common_area_t d
  ON c.cms_common_area_seq = d.cms_common_area_seq
 LEFT JOIN gas.common_detail_code_t e
  ON c.payment_account_bank_code = e.common_detail_code
 AND e.common_code = '0021'
 AND e.use_flag = '1'
 WHERE a.cms_seq = :CMS_SEQ
   AND a.data_create_date = :DATA_CREATE_DATE
   AND a.use_flag = '1' ) AS x
GROUP BY x.cms_demand_list_seq
```

---

### Case 17: full_join_sql.jpg (Complex Nested Query)

**Oracle SQL**
```sql
SELECT x.cms_demand_list_seq
     , x.cms_currency_gubun_code, x.cms_transfer_gubun_code
     , x.data_create_date, x.transfer_from_date, x.transfer_to_date
FROM (
    SELECT a.cms_seq, b.cms_demand_list_seq
         , b.cms_currency_gubun_code, b.cms_transfer_gubun_code
         , b.data_create_date, b.transfer_from_date, b.transfer_to_date
    FROM gas.cms_demand_mngt_t a
       , gas.cms_demand_list_mngt_t b
       , gas.cms_demand_detail_t c
       , gas.cms_common_area_t d
       , gas.common_detail_code_t e
    WHERE a.cms_seq = :CMS_SEQ
    AND a.data_create_date = :DATA_CREATE_DATE
    AND a.cms_demand_list_seq = b.cms_demand_list_seq
    AND b.cms_demand_list_mngt_seq = c.cms_demand_list_mngt_seq
    AND c.cms_common_area_seq = d.cms_common_area_seq(+)
    AND c.payment_account_bank_code = e.common_detail_code(+)
    AND e.common_code(+) = '0021'
    AND a.use_flag = '1'
    AND b.use_flag = '1'
    AND e.use_flag(+) = '1'
) x
GROUP BY x.cms_demand_list_seq, x.cms_currency_gubun_code, x.cms_transfer_gubun_code, x.data_create_date
```

**PostgreSQL**
```sql
SELECT x.cms_demand_list_seq
     , x.cms_currency_gubun_code, x.cms_transfer_gubun_code
     , x.data_create_date, x.transfer_from_date, x.transfer_to_date
FROM ( SELECT a.cms_seq, b.cms_demand_list_seq
         , b.cms_currency_gubun_code, b.cms_transfer_gubun_code
         , b.data_create_date, b.transfer_from_date, b.transfer_to_date
    FROM gas.cms_demand_mngt_t a
 JOIN gas.cms_demand_list_mngt_t b
  ON a.cms_demand_list_seq = b.cms_demand_list_seq
 AND b.use_flag = '1'
 JOIN gas.cms_demand_detail_t c
  ON b.cms_demand_list_mngt_seq = c.cms_demand_list_mngt_seq
 LEFT JOIN gas.cms_common_area_t d
  ON c.cms_common_area_seq = d.cms_common_area_seq
 LEFT JOIN gas.common_detail_code_t e
  ON c.payment_account_bank_code = e.common_detail_code
 AND e.common_code = '0021'
 AND e.use_flag = '1'
 WHERE a.cms_seq = :CMS_SEQ
   AND a.data_create_date = :DATA_CREATE_DATE
   AND a.use_flag = '1' ) AS x
GROUP BY x.cms_demand_list_seq, x.cms_currency_gubun_code, x.cms_transfer_gubun_code, x.data_create_date
```

---
### Case 18: User Requested Query (Subquery with multiple (+) joins and non-space FROM)

**Oracle SQL**
`sql
SELECT x.cms_demand_list_seq                                          -- 요청목록시퀀스
     , x.cms_currency_gubun_code                                      -- 통화구분코드
     , x.cms_transfer_gubun_code                                      -- 이체구분코드
     , x.data_create_data                                             -- 등록일자
     , max(pre_approval_yn)                                           -- 1차결재여부
     , max(pre_approval_usr_id)                                       -- 1차결재자
     , max(pre_approval2_yn)                                          -- 2차결재여부
     , max(pre_approval2_usr_id)                                      -- 2차결재자
     , max(pre_approval3_yn)                                          -- 3차결재여부
     , max(pre_approval3_usr_id)                                      -- 3차결재자
     , x.transfer_from_date                                           -- 이체출금일자
     , x.transfer_to_date                                             -- 이체송금일자
     , x.cms_demand_gubun_code                                        -- CMS구분
     , x.cms_seq                                                      -- 상태코드
     , x.cms_state_code                                               -- 요청목록관리시퀀스
     , x.cms_demand_list_mngt_seq                                     -- 전표전환여부
     , x.voucher_conv_yn                                              -- 지급계좌은행
     , x.payment_account_bank_code                                    -- 지급계좌은행명
     , x.common_detail_code_name                                      -- 지급계좌코드
     , x.payment_account_no                                           -- 지급계좌번호
     , x.payment_currency_code                                        -- 지급계좌통화코드
     , max(x.payment_account_balance)                                 -- 지급계좌잔액
     , max(decode(x.cms_state_code, '05', x.response_date || x.response_time, ' '))  -- 이체완료 일시
     , sum(x.cnt)                                                     -- 건수
     , sum(x.transfer_amt)                                            -- 이체금액 합
     , sum(x.fee_amt)
     , 0                                                              -- 수수료(hidden)
     , sum(decode(trim(x.cms_result_code), '', 0, '0000', 0, 1))     -- 불능건수
     , sum(decode(trim(x.cms_result_code), '', 0, '0000', 0, x.transfer_amt))  -- 불능금액 합
     , max(x.cms_result_code)                                         -- 처리결과
FROM(
SELECT a.cms_demand_list_seq
     , a.cms_currency_gubun_code
     , a.cms_transfer_gubun_code
     , a.data_create_data
     , a.pre_approval_yn
     , a.pre_approval_usr_id
     , a.pre_approval2_yn
     , a.pre_approval2_usr_id
     , a.pre_approval3_yn
     , a.pre_approval3_usr_id
     , a.transfer_from_date
     , a.transfer_to_date
     , a.cms_demand_gubun_code
     , a.cms_seq
     , a.cms_state_code
     , b.cms_demand_list_mngt_seq
     , b.voucher_conv_yn                                              -- 전표전환여부 (대광이체이므로 그룹랑전환)
     , c.payment_account_bank_code
     , c.receive_account_bank_code
     , e.common_detail_code_name
     , c.payment_account_no
     , c.payment_currency_code
     , c.payment_account_balance
     , d.response_date
     , d.response_time
     , 1     as cnt
     , c.transfer_amt
     , c.fee_amt
     , c.cms_result_code
FROM   cms_demand_list_t     a
     , cms_demand_list_mngt_t  b
     , cms_demand_detail_t     c
     , cms_common_area_t       d
     , common_detail_code_t    e
WHERE 1=1
AND a.cms_seq          = :CMS_SEQ                                     -- 요청순번
AND a.data_create_date  = :DATA_CREATE_DATE                       -- 생성일자
AND a.cms_demand_gubun_code  = :CMS_DEMAND_GUBUN_CODE             -- 요청구분
AND a.cms_currency_gubun_code  = :CMS_CURRENCY_GUBUN_CODE         -- 통화구분(해외변)
AND a.cms_transfer_gubun_code  = :CMS_TRANSFER_GUBUN_CODE         -- 이체구분(속시이상)
AND a.mass_trans_yn     = '1'                                        -- 대량이체구분: 1-대상
AND a.cms_daesang_yn    = '1'                                        -- cms대상여부 : 1-cms
AND a.cms_demand_list_seq  = b.cms_demand_list_seq
AND b.cms_demand_list_mngt_seq  = c.cms_demand_list_mngt_seq
AND c.cms_common_area_seq = d.cms_common_area_seq(+)
AND c.payment_account_bank_code  = e.common_detail_code(+)
AND e.common_code(+)   = '0021'
AND a.use_flag    = '1'
AND b.use_flag    = '1'
AND e.use_flag(+)  = '1' ) x
GROUP BY x.cms_demand_list_seq
     , x.cms_currency_gubun_code
     , x.cms_transfer_gubun_code
     , x.data_create_data
     , x.transfer_from_date
     , x.transfer_to_date
     , x.cms_demand_gubun_code
     , x.cms_seq
     , x.cms_state_code
     , x.cms_demand_list_mngt_seq
     , x.voucher_conv_yn
     , x.payment_account_bank_code
     , x.common_detail_code_name
     , x.payment_account_no
     , x.payment_currency_code
```

**PostgreSQL**
`sql
SELECT x.cms_demand_list_seq                                          -- 요청목록시퀀스
     , x.cms_currency_gubun_code                                      -- 통화구분코드
     , x.cms_transfer_gubun_code                                      -- 이체구분코드
     , x.data_create_data                                             -- 등록일자
     , MAX(pre_approval_yn)                                           -- 1차결재여부
     , MAX(pre_approval_usr_id)                                       -- 1차결재자
     , MAX(pre_approval2_yn)                                          -- 2차결재여부
     , MAX(pre_approval2_usr_id)                                      -- 2차결재자
     , MAX(pre_approval3_yn)                                          -- 3차결재여부
     , MAX(pre_approval3_usr_id)                                      -- 3차결재자
     , x.transfer_from_date                                           -- 이체출금일자
     , x.transfer_to_date                                             -- 이체송금일자
     , x.cms_demand_gubun_code                                        -- CMS구분
     , x.cms_seq                                                      -- 상태코드
     , x.cms_state_code                                               -- 요청목록관리시퀀스
     , x.cms_demand_list_mngt_seq                                     -- 전표전환여부
     , x.voucher_conv_yn                                              -- 지급계좌은행
     , x.payment_account_bank_code                                    -- 지급계좌은행명
     , x.common_detail_code_name                                      -- 지급계좌코드
     , x.payment_account_no                                           -- 지급계좌번호
     , x.payment_currency_code                                        -- 지급계좌통화코드
     , MAX(x.payment_account_balance)                                 -- 지급계좌잔액
     , MAX(CASE
    WHEN x.cms_state_code = '05' THEN x.response_date || x.response_time
    ELSE ' '
 END)  -- 이체완료 일시
     , sum(x.cnt)                                                     -- 건수
     , sum(x.transfer_amt)                                            -- 이체금액 합
     , sum(x.fee_amt)
     , 0                                                              -- 수수료(hidden)
     , sum(CASE
    WHEN trim(x.cms_result_code) = '' THEN 0
    WHEN trim(x.cms_result_code) = '0000' THEN 0
    ELSE 1
 END)     -- 불능건수
     , sum(CASE
    WHEN trim(x.cms_result_code) = '' THEN 0
    WHEN trim(x.cms_result_code) = '0000' THEN 0
    ELSE x.transfer_amt
 END)  -- 불능금액 합
     , MAX(x.cms_result_code)                                         -- 처리결과
FROM ( SELECT a.cms_demand_list_seq
     , a.cms_currency_gubun_code
     , a.cms_transfer_gubun_code
     , a.data_create_data
     , a.pre_approval_yn
     , a.pre_approval_usr_id
     , a.pre_approval2_yn
     , a.pre_approval2_usr_id
     , a.pre_approval3_yn
     , a.pre_approval3_usr_id
     , a.transfer_from_date
     , a.transfer_to_date
     , a.cms_demand_gubun_code
     , a.cms_seq
     , a.cms_state_code
     , b.cms_demand_list_mngt_seq
     , b.voucher_conv_yn                                              
     , c.payment_account_bank_code
     , c.receive_account_bank_code
     , e.common_detail_code_name
     , c.payment_account_no
     , c.payment_currency_code
     , c.payment_account_balance
     , d.response_date
     , d.response_time
     , 1     as cnt
     , c.transfer_amt
     , c.fee_amt
     , c.cms_result_code
FROM cms_demand_list_t     a
 JOIN cms_demand_list_mngt_t  b
  ON a.cms_demand_list_seq  = b.cms_demand_list_seq
 AND b.use_flag    = '1'
 JOIN cms_demand_detail_t     c
  ON b.cms_demand_list_mngt_seq  = c.cms_demand_list_mngt_seq
 LEFT JOIN cms_common_area_t       d
  ON c.cms_common_area_seq = d.cms_common_area_seq
 LEFT JOIN common_detail_code_t    e
  ON c.payment_account_bank_code  = e.common_detail_code
 AND e.common_code   = '0021'
 AND e.use_flag  = '1'
 WHERE 1=1
   AND a.cms_seq          = :CMS_SEQ
   AND a.data_create_date  = :DATA_CREATE_DATE
   AND a.use_flag    = '1' ) AS x -- 전표전환여부 (대광이체이므로 그룹랑전환)
GROUP BY x.cms_demand_list_seq
     , x.cms_currency_gubun_code
     , x.cms_transfer_gubun_code
     , x.data_create_data
     , x.transfer_from_date
     , x.transfer_to_date
     , x.cms_demand_gubun_code
     , x.cms_seq
     , x.cms_state_code
     , x.cms_demand_list_mngt_seq
     , x.voucher_conv_yn
     , x.payment_account_bank_code
     , x.common_detail_code_name
     , x.payment_account_no
     , x.payment_currency_code

---
