# Oracle to PostgreSQL Conversion Test Samples (Diverse Cases)

This file contains 10 diverse test cases in Java `StringBuffer` (`sbSql.append`) style, covering all enhanced conversion rules: nested functions, strict typing, pagination, and outer joins.

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

### Case 11: UNION ALL with Mixed Function Styles
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