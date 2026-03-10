# Oracle to PostgreSQL Conversion Test Samples (Diverse Cases)

This file contains diverse test cases in Java `StringBuffer` (`sbSql.append`) style, covering all enhanced conversion rules: nested functions, strict typing, pagination, and outer joins.

## Case 1: Voucher Sequence Generation (Nested & ROWNUM)
```java
sbSql.append(" SELECT ?||TO_CHAR(TO_DATE(?),'YYYYMM') \n");
sbSql.append("        ||NVL(LPAD(TO_NUMBER(SUBSTR(MAX(voucher_no),8,5))+1, 5,'0'),'00001') \n");
sbSql.append(" FROM   voucher_t \n");
sbSql.append(" WHERE  voucher_no LIKE ?||TO_CHAR(TO_DATE(?),'YYYYMM')||'%' \n");
sbSql.append(" AND    rownum = 1 \n");
```

## Case 2: Multi-Argument LPAD & Strict Concatenation
```java
sbSql.append(" SELECT A.DEPT_CODE || '-' || LPAD(B.SEQ_NO + 1, 10, '0') AS FULL_CODE \n");
sbSql.append("      , TO_CHAR(A.CREATE_DATE) AS STR_DATE \n");
sbSql.append(" FROM   DEPT_T A, SEQ_T B \n");
sbSql.append(" WHERE  A.DEPT_ID = B.DEPT_ID \n");
sbSql.append(" AND    A.USE_FLAG = '1' \n");
```

## Case 3: Nested TO_DATE & TO_CHAR with Default Formats
```java
sbSql.append(" SELECT TO_CHAR(TO_DATE(?, 'YYYYMMDD'), 'YYYY/MM/DD') \n");
sbSql.append("      , TO_CHAR(SYSDATE) \n");
sbSql.append("      , NVL(TO_NUMBER(?), 0) + 100 \n");
sbSql.append(" FROM   DUAL \n");
```

## Case 4: Complex DECODE & NVL2 (Vertical Layout)
```java
sbSql.append(" SELECT A.USER_ID \n");
sbSql.append("      , DECODE(A.STATUS, '1', 'ACTIVE', '2', 'SUSPENDED', 'DELETED') \n");
sbSql.append("      , NVL2(A.LAST_LOGIN, 'LOGGED_IN', 'NEVER') \n");
sbSql.append(" FROM   USER_T A \n");
sbSql.append(" WHERE  A.USER_ID = ? \n");
```

## Case 5: Oracle Outer Join (+) & ROWNUM Combined
```java
sbSql.append(" SELECT A.EMP_NAME, B.DEPT_NAME \n");
sbSql.append(" FROM   EMP_T A, DEPT_T B \n");
sbSql.append(" WHERE  A.DEPT_ID = B.DEPT_ID(+) \n");
sbSql.append(" AND    A.SALARY > TO_NUMBER(?) \n");
sbSql.append(" AND    ROWNUM = 1 \n");
```

## Case 6: Parameter Concatenation in LIKE Clause
```java
sbSql.append(" SELECT * \n");
sbSql.append(" FROM   PRODUCT_T \n");
sbSql.append(" WHERE  PROD_NAME LIKE '%' || ? || '%' \n");
sbSql.append(" AND    CATEGORY_CODE = LPAD(?, 5, '0') \n");
```

## Case 7: Subquery with ROWNUM and Nested Functions
```java
sbSql.append(" SELECT * FROM ( \n");
sbSql.append("   SELECT A.MSG_ID, TO_CHAR(A.SEND_TIME) as SEND_TIME \n");
sbSql.append("   FROM   MSG_LOG_T A \n");
sbSql.append("   WHERE  A.SEND_DATE = TO_DATE(?) \n");
sbSql.append("   ORDER BY A.SEND_TIME DESC \n");
sbSql.append(" ) WHERE ROWNUM = 1 \n");
```

## Case 8: Multi-column Outer Join with Constants
```java
sbSql.append(" SELECT A.ID, B.VAL \n");
sbSql.append(" FROM   TAB_A A, TAB_B B \n");
sbSql.append(" WHERE  A.ID = B.ID(+) \n");
sbSql.append(" AND    B.TYPE(+) = 'X' \n");
sbSql.append(" AND    A.CODE = ? \n");
```

## Case 9: Deeply Nested TO_NUMBER and SUBSTR
```java
sbSql.append(" SELECT LPAD(TO_NUMBER(SUBSTR(?, 1, 4)) + 1, 4, '0') \n");
sbSql.append("        || TO_CHAR(TO_DATE(?), 'MMDD') AS NEW_ID \n");
sbSql.append(" FROM   DUAL \n");
```

## Case 10: UNION ALL with Mixed Function Styles
```java
sbSql.append(" SELECT 'TYPE1' as TYPE, NVL(A.AMT, 0) as AMT \n");
sbSql.append(" FROM   SALES_T A WHERE A.DATE = TO_DATE(?) \n");
sbSql.append(" UNION ALL \n");
sbSql.append(" SELECT 'TYPE2', TO_NUMBER(?) \n");
sbSql.append(" FROM   DUAL \n");
```

### Case 11: Mixed Ansi Join and Inner Queries
```sql
SELECT CURRENCY_CODE
     , SUM(INAMT)  INAMT
     , SUM(OUTAMT) OUTAMT
FROM (SELECT B.BANK_ACCT_TYPE_CODE
           , A.INOUT_GUBUN_CODE
           , A.CURRENCY_CODE
           , NVL(DECODE(A.INOUT_GUBUN_CODE,'20',A.TRANS_AMT,'51',A.TRANS_AMT * -1,'40',A.TRANS_AMT),0) INAMT
           , NVL(DECODE(A.INOUT_GUBUN_CODE,'30',A.TRANS_AMT,'52',A.TRANS_AMT * -1),0) OUTAMT
           , A.TRANS_DATE
           , B.BANK_ACCT_ID
           , B.BANK_CODE
      FROM  EGAS.CMS_TRANS_LIST_T A
          , EGAS.BANK_ACCT_T      B
      WHERE A.USE_FLAG          = '1'
        AND B.USE_FLAG          = '1'
        AND B.APPROVAL_YN       = '1'
        AND B.BANK_ACCT_SEQ     = A.BANK_ACCT_SEQ
) sub
GROUP BY CURRENCY_CODE
```

### Case 12: AS Spacing Verification (ENDAS & Attached Alias)
```java
sbSql.append(" SELECT CASE WHEN A.AMT > 0 THEN 'POS' ELSE 'NEG' ENDAS AMT_STATUS \n");
sbSql.append("      , (SELECT MAX(VAL) FROM SUB_T)as MAX_VAL \n");
sbSql.append("      , B.COL1edas ALIAS1 \n");
sbSql.append(" FROM   TABLE_A A \n");
sbSql.append("    , (SELECT * FROM TABLE_B)as B \n");
sbSql.append(" WHERE  A.ID = B.ID \n");
```

### Case 13: Indentation Verification (DECODE & NVL2)
```java
sbSql.append(" SELECT A.USER_ID \n");
sbSql.append("      , DECODE(A.STATUS, '1', 'ACTIVE', '2', 'SUSPENDED', 'DELETED') AS STATUS_DESC \n");
sbSql.append("      , NVL2(A.LAST_LOGIN, 'LOGGED_IN', 'NEVER') AS LOGIN_STATUS \n");
sbSql.append(" FROM   USER_T A \n");
```

### Case 15: ROLLUP and GROUPING Support
```java
sbSql.append(" SELECT DECODE(GROUPING(dept_code), 1, '합계', dept_code) AS dept_code \n");
sbSql.append("      , SUM(salary) \n");
sbSql.append(" FROM   emp_t \n");
sbSql.append(" GROUP BY ROLLUP(dept_code) \n");
```

### Case 14: Complex CONNECT BY LEVEL to generate_series
```java
sbSql.append(" SELECT * \n");
sbSql.append(" FROM ( \n");
sbSql.append("     SELECT LEVEL \n");
sbSql.append("     FROM DUAL \n");
sbSql.append("     CONNECT BY LEVEL <= ( \n");
sbSql.append("         SELECT MAX(TO_NUMBER(notice_trace_no)) \n");
sbSql.append("         FROM afbs_cms_body_0200_700_t \n");
sbSql.append("         WHERE notice_send_date = :NOTICE_SEND_DATE \n");
sbSql.append("         AND DECODE(header_bank_code, '026', '088', header_bank_code) = :BANK_CODE \n");
sbSql.append("     ) - TO_NUMBER('000001') \n");
sbSql.append(" ) a \n");
```

### Case 16: GROUPING Sum Comparison (Numeric Sum vs String Literal)
```java
sbSql.append(" HAVING (grouping(b.common_detail_code_name) \n");
sbSql.append("      + grouping(a.chk_id) \n");
sbSql.append("      + grouping(a.chk_reg_date)) = '0' \n");
sbSql.append(" OR   (grouping(b.common_detail_code_name) \n");
sbSql.append("      + grouping(a.chk_id) \n");
sbSql.append("      + grouping(a.chk_reg_date)) = '2' \n");
```

### Case 17: INSTR to STRPOS Conversion
```java
sbSql.append(" SELECT DECODE(INSTR(opp_deposit_holder_name, '아메리카인터내'), 0, 'NONE', 'EXISTS') AS DEPOSIT_STATUS \n");
sbSql.append(" FROM   DEPT_T \n");
```

### Case 18: BETWEEN ... AND in Join Condition
```java
sbSql.append(" SELECT * FROM table_a a, table_b b \n");
sbSql.append(" WHERE a.trans_date(+) BETWEEN :FROM AND :TO \n");
sbSql.append(" AND a.use_flag = '1' \n");
```

### Case 19: Complex INSTR (3+ Arguments)
```java
sbSql.append(" SELECT INSTR(A.COL1, 'sub', 1) as POS1 \n");
sbSql.append("      , INSTR(A.COL1, 'sub', 3) as POS2 \n");
sbSql.append(" FROM   TABLE_A A \n");
```

### Case 20: ROWNUM <= N Range
```java
sbSql.append(" SELECT * FROM USER_T \n");
sbSql.append(" WHERE  STATUS = '1' \n");
sbSql.append(" AND    ROWNUM <= 10 \n");
```

### Case 21: Date Functions (TRUNC, ADD_MONTHS, LAST_DAY)
```java
sbSql.append(" SELECT TRUNC(SYSDATE, 'MM') as MONTH_START \n");
sbSql.append("      , ADD_MONTHS(SYSDATE, 3) as THREE_MONTHS_LATER \n");
sbSql.append("      , LAST_DAY(SYSDATE) as MONTH_END \n");
sbSql.append(" FROM   DUAL \n");
```