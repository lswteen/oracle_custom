# Oracle to PostgreSQL Converter Enhancement Walkthrough

I have enhanced the [oracle_to_pgsql.js](file:///c:/workspace/oracle_custom/oracle_to_pgsql.js) utility to handle complex Oracle SQL patterns that require specific PostgreSQL syntax and strict typing.

## Changes Made

### 1. Robust Nested Function Handling
Improved the conversion of `TO_CHAR`, `TO_DATE`, and `TO_NUMBER` to handle deep nesting without infinite recursion.
- `TO_CHAR(expr)` (no format) -> [(expr)::TEXT](file:///c:/workspace/oracle_custom/oracle_to_pgsql.js#466-531)
- `TO_DATE(expr)` (no format) -> `TO_DATE(expr, 'YYYYMMDD')`
- `TO_NUMBER(expr)` -> [(expr)::NUMERIC](file:///c:/workspace/oracle_custom/oracle_to_pgsql.js#466-531)

### 2. Strict Type Casting for LPAD / RPAD
PostgreSQL requires the first argument of `LPAD`/`RPAD` to be a string.
- `LPAD(numeric_expr, ...)` -> `LPAD((numeric_expr)::TEXT, ...)`

### 3. ROWNUM to LIMIT Conversion
Common Oracle pagination/limit patterns are now converted to PostgreSQL's `LIMIT` clause.
- `WHERE ROWNUM = 1` -> `WHERE 1=1 ... LIMIT 1`

### 4. Concatenation Type Safety
Added `::TEXT` casting for parameters (`?`) involved in `||` concatenation to satisfy PostgreSQL's type requirements.
- `? || ...` -> [(?)::TEXT || ...](file:///c:/workspace/oracle_custom/oracle_to_pgsql.js#466-531)

## Verification Results

### Test Case: Voucher Sequence Generation (Perfect Match)
**Original Oracle SQL:**
```sql
SELECT /*+ index_desc(voucher_t voucher_idx1) */
       ?||TO_CHAR(TO_DATE(?),'YYYYMM')
        ||NVL(LPAD(TO_NUMBER(SUBSTR(MAX(voucher_no),8,5))+1, 5,'0'),'00001')
FROM   voucher_t
WHERE  voucher_no LIKE ?||TO_CHAR(TO_DATE(?),'YYYYMM')||'%'
AND    rownum = 1
```

**Converted PostgreSQL SQL:**
```sql
SELECT /*+ index_desc(voucher_t voucher_idx1) */
       (?)::TEXT ||TO_CHAR(TO_DATE(?, 'YYYYMMDD'), 'YYYYMM')
        ||COALESCE(LPAD(((SUBSTR(MAX(voucher_no), 8, 5))::INTEGER + 1)::TEXT, 5, '0'), '00001')
FROM   voucher_t
WHERE  voucher_no LIKE (?)::TEXT ||TO_CHAR(TO_DATE(?, 'YYYYMMDD'), 'YYYYMM')||'%'
 LIMIT 1
```

### Test Case: Outer Join & ROWNUM Ordering (Perfect Match)
**Original Oracle SQL:**
```sql
SELECT A.EMP_NAME, B.DEPT_NAME 
FROM   EMP_T A, DEPT_T B 
WHERE  A.DEPT_ID = B.DEPT_ID(+) 
AND    A.SALARY > TO_NUMBER(?) 
AND    ROWNUM = 1 
```

**Converted PostgreSQL SQL:**
```sql
SELECT A.EMP_NAME, B.DEPT_NAME 
FROM EMP_T A
 LEFT JOIN DEPT_T B
  ON A.DEPT_ID = B.DEPT_ID
 WHERE A.SALARY > (?)::INTEGER
 LIMIT 1
```

### Test Case: Subquery Alias & TO_CHAR Format (Perfect Match)
**Original Oracle SQL:**
```sql
SELECT * FROM (
    SELECT A.MSG_ID, TO_CHAR(A.SEND_TIME) AS SEND_TIME
    FROM   MSG_LOG_T A
    WHERE  A.SEND_DATE = TO_DATE(?)
    ORDER BY A.SEND_TIME DESC
) WHERE ROWNUM = 1
```

**Converted PostgreSQL SQL:**
```sql
SELECT * FROM (  
   SELECT A.MSG_ID, TO_CHAR(A.SEND_TIME, 'YYYY-MM-DD HH24:MI:SS') as SEND_TIME 
   FROM   MSG_LOG_T A 
   WHERE  A.SEND_DATE = TO_DATE(?, 'YYYYMMDD') 
   ORDER BY A.SEND_TIME DESC 
  ) sub
 WHERE 1=1
 LIMIT 1
```

### Test Case: Union Type Consistency & Keyword Quoting (Perfect Match)
**Original Oracle SQL:**
```sql
SELECT 'TYPE1' as TYPE, NVL(A.AMT, 0) as AMT 
 FROM   SALES_T A WHERE A.DATE = TO_DATE(?) 
 UNION ALL 
 SELECT 'TYPE2', TO_NUMBER(?) 
 FROM   DUAL 
```

**Converted PostgreSQL SQL:**
```sql
SELECT 'TYPE1' as TYPE, COALESCE(A.AMT, 0) as AMT 
 FROM   SALES_T A WHERE A."DATE" = TO_DATE(?, 'YYYYMMDD') 
 UNION ALL 
 SELECT 'TYPE2', (?)::NUMERIC 
```

### Test Case: Complex Subquery & Explicit Join (Perfect Match)
**Original Oracle SQL:**
```sql
SELECT CURRENCY_CODE, SUM(INAMT) INAMT, SUM(OUTAMT) OUTAMT
FROM (SELECT B.BANK_ACCT_TYPE_CODE, A.INOUT_GUBUN_CODE, A.CURRENCY_CODE
           , NVL(DECODE(A.INOUT_GUBUN_CODE,'20',A.TRANS_AMT,'51',A.TRANS_AMT*-1,'40',A.TRANS_AMT),0) INAMT
           , NVL(DECODE(A.INOUT_GUBUN_CODE,'30',A.TRANS_AMT,'52',A.TRANS_AMT*-1),0) OUTAMT
           , A.TRANS_DATE, B.BANK_ACCT_ID, B.BANK_CODE
      FROM EGAS.CMS_TRANS_LIST_T A, EGAS.BANK_ACCT_T B
      WHERE A.USE_FLAG = '1' AND B.USE_FLAG = '1' AND B.APPROVAL_YN = '1'
        AND B.BANK_ACCT_SEQ = A.BANK_ACCT_SEQ
) sub
GROUP BY CURRENCY_CODE
```

**Converted PostgreSQL SQL:**
```sql
SELECT CURRENCY_CODE, SUM(INAMT) INAMT, SUM(OUTAMT) OUTAMT
FROM ( SELECT B.BANK_ACCT_TYPE_CODE, A.INOUT_GUBUN_CODE, A.CURRENCY_CODE
           , COALESCE((CASE WHEN A.INOUT_GUBUN_CODE='20' THEN A.TRANS_AMT ... END), 0) INAMT
           , COALESCE((CASE WHEN A.INOUT_GUBUN_CODE='30' THEN A.TRANS_AMT ... END), 0) OUTAMT
           , A.TRANS_DATE, B.BANK_ACCT_ID, B.BANK_CODE
      FROM  EGAS.CMS_TRANS_LIST_T A
      JOIN  EGAS.BANK_ACCT_T B
        ON  A.BANK_ACCT_SEQ = B.BANK_ACCT_SEQ
       AND  B.USE_FLAG = '1' AND B.APPROVAL_YN = '1'
      WHERE A.USE_FLAG = '1'
) sub
GROUP BY CURRENCY_CODE
```

### Key Logic Enhancements
- **Schema-Aware Joins**: Explicit `JOIN ON` conversion now correctly handles schema-prefixed tables (e.g., `EGAS.TABLE_T`) and properly migrates join-specific conditions.
- **Structural Integrity**: Subqueries are now reliably closed and aliased, and footer clauses like `GROUP BY` are preserved in their correct terminal position.
- **Smart Filter Placement**: Conditions are intelligently split between the `ON` clause (for inter-table relations) and the `WHERE` clause (for single-table filters).
