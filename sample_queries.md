# Sample Oracle Queries for Testing

This file contains Oracle SQL queries extracted from project images for verification in the converter.

## 1. 샘플.jpg Query

### Java Source (StringBuffer)
```java
sbSql.append(" SELECT A.CMS_SEQ \n");
sbSql.append(" , DECODE(A.CMS_TYPE, '1', 'INTERNAL', '2', 'EXTERNAL', 'UNKNOWN') AS TYPE_NM \n");
sbSql.append(" , NVL2(A.MODIFY_DATE, 'MODIFIED', 'NEW') AS STATUS \n");
sbSql.append(" FROM CMS_DEMAND_LIST_T A \n");
sbSql.append(" , CMS_COMMON_AREA_T B \n");
sbSql.append(" , CMS_COMMON_AREA_T C \n");
sbSql.append(" WHERE A.AREA_SEQ = B.AREA_SEQ(+) \n");
sbSql.append(" AND A.AREA_SEQ = C.AREA_SEQ \n");
sbSql.append(" AND A.USE_FLAG(+) = '1' \n");
```

### Oracle (Original)
```sql
SELECT A.CMS_SEQ
, DECODE(A.CMS_TYPE, '1', 'INTERNAL', '2', 'EXTERNAL', 'UNKNOWN') AS TYPE_NM
, NVL2(A.MODIFY_DATE, 'MODIFIED', 'NEW') AS STATUS
FROM CMS_DEMAND_LIST_T A
, CMS_COMMON_AREA_T B
, CMS_COMMON_AREA_T C
WHERE A.AREA_SEQ = B.AREA_SEQ(+)
AND A.AREA_SEQ = C.AREA_SEQ
AND A.USE_FLAG(+) = '1'
```

### PostgreSQL (Converted ANSI)
```sql
SELECT A.CMS_SEQ
, CASE WHEN A.CMS_TYPE = '1' THEN 'INTERNAL' WHEN A.CMS_TYPE = '2' THEN 'EXTERNAL' ELSE 'UNKNOWN' END AS TYPE_NM
, CASE WHEN A.MODIFY_DATE IS NOT NULL THEN 'MODIFIED' ELSE 'NEW' END AS STATUS
FROM CMS_DEMAND_LIST_T A
 LEFT JOIN CMS_COMMON_AREA_T B ON A.AREA_SEQ = B.AREA_SEQ
 JOIN CMS_COMMON_AREA_T C ON A.AREA_SEQ = C.AREA_SEQ
WHERE 1 = 1
   AND A.USE_FLAG = '1'
```

## 2. oracle_sample.jpg Query (Complex)

### Java Source (StringBuffer)
```java
sbSql.append(" SELECT C.COMMON_DETAIL_CODE_NAME AS BANK_ACCT_TYPE_NAME \n");
sbSql.append("     ,NVL(B.SA_GUBUN_CODE,?) AS SA_GUBUN_CODE \n");
sbSql.append("     ,H.FUNCTION_NAME AS SA_GUBUN_NAME \n");
sbSql.append("     ,B.BANK_ACCT_NICKNAME \n");
sbSql.append("     ,B.BANK_ACCT_ID \n");
sbSql.append("     ,D.KOR_NAME AS BELONG_DEPT_NAME \n");
sbSql.append("     ,A.TRANS_DATE \n");
sbSql.append("     ,A.TRANS_TIME \n");
sbSql.append("     ,E.FUNCTION_NAME AS CURRENCY_NAME \n");
sbSql.append("     ,A.INOUT_GUBUN_CODE \n");
sbSql.append("     ,NVL(DECODE(A.INOUT_GUBUN_CODE,'20',A.TRANS_AMT,'51',A.TRANS_AMT * -1,'40',A.TRANS_AMT),0) AS IN_AMT \n");
sbSql.append("     ,NVL(DECODE(A.INOUT_GUBUN_CODE,'30',A.TRANS_AMT,'30',A.TRANS_AMT,'52',A.TRANS_AMT * -1),0) AS OUT_AMT \n");
sbSql.append("     ,NVL((DECODE(A.BALANCE_SIGNAL,'-',A.BALANCE_SIGNAL)||A.BALANCE_AMT),0) AS BALANCE \n");
sbSql.append("     ,F.COMMON_DETAIL_CODE_NAME AS BANK_NAME \n");
sbSql.append("     ,B.FC_CURRENCY_CODE \n");
sbSql.append("     ,G.INDICATOR_NAME AS FC_CURRENCY_NAME \n");
sbSql.append("     ,B.OLAS_ACCOUNT_CODE \n");
sbSql.append("     ,A.OPP_DEPOSIT_HOLDER_NAME AS REMARKS \n");
sbSql.append("     ,K.COMMON_DETAIL_CODE_NAME AS INOUT_GUBUN_NAME \n");
sbSql.append(" FROM EGAS.COMMON_DETAIL_CODE_T F \n");
sbSql.append("     ,EGAS.ES_INDICATOR_CODE_T G \n");
sbSql.append("     ,EGAS.FUNCTION_CODE_T H \n");
sbSql.append("     ,EGAS.BANK_ACCT_T B \n");
sbSql.append("     ,EGAS.COMMON_DETAIL_CODE_T C \n");
sbSql.append("     ,EGAS.AUTHORIZATION_CODE_T D \n");
sbSql.append("     ,EGAS.FUNCTION_CODE_T E --E테스트 \n");
sbSql.append("     ,EGAS.CMS_TRANS_LIST_T A /* A테스트 */ \n");
sbSql.append("     ,EGAS.COMMON_DETAIL_CODE_T K \n");
sbSql.append(" WHERE 1 = 1 \n");
sbSql.append(" AND A.USE_FLAG = '1' \n");
sbSql.append(" AND B.USE_FLAG = '1' \n");
sbSql.append(" AND B.APPROVAL_YN = '1' \n");
sbSql.append(" AND B.BANK_ACCT_SEQ = A.BANK_ACCT_SEQ \n");
sbSql.append(" AND C.COMMON_DETAIL_CODE = B.BANK_ACCT_TYPE_CODE \n");
sbSql.append(" AND C.COMMON_CODE = '0022' \n");
sbSql.append(" AND D.TYPE = '400' \n");
sbSql.append(" AND D.CODE = B.MNGT_DEPT_CODE \n");
sbSql.append(" AND E.FUNCTION_CODE = B.CURRENCY_CODE  \n");
sbSql.append(" AND E.CATEGORY_CODE = '0004' \n");
sbSql.append(" AND F.COMMON_DETAIL_CODE = B.BANK_CODE \n");
sbSql.append(" AND F.COMMON_CODE = '0021' \n");
sbSql.append(" AND G.FINANCIAL_CODE(+) = '03' \n");
sbSql.append(" AND G.INDICATOR_CODE(+) = B.FC_CURRENCY_CODE \n");
sbSql.append(" AND NVL(B.SA_GUBUN_CODE,?) = H.FUNCTION_CODE(+) \n");
sbSql.append(" AND H.CATEGORY_CODE(+) = '0013' \n");
sbSql.append(" AND K.COMMON_DETAIL_CODE = A.INOUT_GUBUN_CODE \n");
sbSql.append(" AND K.COMMON_CODE = '0103' \n");
```

### Oracle (Original)
```sql
SELECT C.COMMON_DETAIL_CODE_NAME AS BANK_ACCT_TYPE_NAME -- 입금종류
    ,NVL(B.SA_GUBUN_CODE,?) AS SA_GUBUN_CODE -- SA구분코드
    ,H.FUNCTION_NAME AS SA_GUBUN_NAME -- SA구분코드명
    ,B.BANK_ACCT_NICKNAME -- 계좌닉네임
    ,B.BANK_ACCT_ID -- 계좌번호
    ,D.KOR_NAME AS BELONG_DEPT_NAME -- 귀속부서
    ,A.TRANS_DATE -- 입출금일자
    ,A.TRANS_TIME -- 입출금시간
    ,E.FUNCTION_NAME AS CURRENCY_NAME -- 통화코드명
    ,A.INOUT_GUBUN_CODE -- 입출금구분 (20:입금, 30:출금)
    ,NVL(DECODE(A.INOUT_GUBUN_CODE,'20',A.TRANS_AMT,'51',A.TRANS_AMT * -1,'40',A.TRANS_AMT),0) AS IN_AMT -- 입금액
    ,NVL(DECODE(A.INOUT_GUBUN_CODE,'30',A.TRANS_AMT,'30',A.TRANS_AMT,'52',A.TRANS_AMT * -1),0) AS OUT_AMT -- 출금액
    ,NVL((DECODE(A.BALANCE_SIGNAL,'-',A.BALANCE_SIGNAL)||A.BALANCE_AMT),0) AS BALANCE -- 잔액
    ,F.COMMON_DETAIL_CODE_NAME AS BANK_NAME -- 은행명
    ,B.FC_CURRENCY_CODE -- FC통화코드
    ,G.INDICATOR_NAME AS FC_CURRENCY_NAME -- FC통화코드명
    ,B.OLAS_ACCOUNT_CODE
    ,A.OPP_DEPOSIT_HOLDER_NAME AS REMARKS -- 적요
    ,K.COMMON_DETAIL_CODE_NAME AS INOUT_GUBUN_NAME -- 입급지급구분명
FROM EGAS.COMMON_DETAIL_CODE_T F
    ,EGAS.ES_INDICATOR_CODE_T G -- FC통화코드(03)
    ,EGAS.FUNCTION_CODE_T H -- SA구분(0013)
    ,EGAS.BANK_ACCT_T B
    ,EGAS.COMMON_DETAIL_CODE_T C
    ,EGAS.AUTHORIZATION_CODE_T D
    ,EGAS.FUNCTION_CODE_T E
    ,EGAS.CMS_TRANS_LIST_T A
    ,EGAS.COMMON_DETAIL_CODE_T K
WHERE 1 = 1
AND A.USE_FLAG = '1'
AND B.USE_FLAG = '1'
AND B.APPROVAL_YN = '1'
AND B.BANK_ACCT_SEQ = A.BANK_ACCT_SEQ
AND C.COMMON_DETAIL_CODE = B.BANK_ACCT_TYPE_CODE
AND C.COMMON_CODE = '0022'
AND D.TYPE = '400'
AND D.CODE = B.MNGT_DEPT_CODE
AND E.FUNCTION_CODE = B.CURRENCY_CODE
AND E.CATEGORY_CODE = '0004'
AND F.COMMON_DETAIL_CODE = B.BANK_CODE
AND F.COMMON_CODE = '0021'
AND G.FINANCIAL_CODE(+) = '03'
AND G.INDICATOR_CODE(+) = B.FC_CURRENCY_CODE
AND NVL(B.SA_GUBUN_CODE,?) = H.FUNCTION_CODE(+)
AND H.CATEGORY_CODE(+) = '0013'
AND K.COMMON_DETAIL_CODE = A.INOUT_GUBUN_CODE
AND K.COMMON_CODE = '0103' -- CMS 입금지급구분
```

### PostgreSQL (Converted ANSI)
```sql
SELECT C.COMMON_DETAIL_CODE_NAME AS BANK_ACCT_TYPE_NAME -- 입금종류 
    ,COALESCE(B.SA_GUBUN_CODE,?) AS SA_GUBUN_CODE -- SA구분코드 
    ,H.FUNCTION_NAME AS SA_GUBUN_NAME -- SA구분코드명 
    ,B.BANK_ACCT_NICKNAME -- 계좌닉네임 
    ,B.BANK_ACCT_ID -- 계좌번호 
    ,D.KOR_NAME AS BELONG_DEPT_NAME -- 귀속부서 
    ,A.TRANS_DATE -- 입출금일자 
    ,A.TRANS_TIME -- 입출금시간 
    ,E.FUNCTION_NAME AS CURRENCY_NAME -- 통화코드명 
    ,A.INOUT_GUBUN_CODE -- 입출금구분 (20:입금, 30:출금) 
    ,COALESCE(CASE WHEN A.INOUT_GUBUN_CODE = '20' THEN A.TRANS_AMT WHEN A.INOUT_GUBUN_CODE = '51' THEN A.TRANS_AMT * -1 WHEN A.INOUT_GUBUN_CODE = '40' THEN A.TRANS_AMT END,0) AS IN_AMT -- 입금액 
    ,COALESCE(CASE WHEN A.INOUT_GUBUN_CODE = '30' THEN A.TRANS_AMT WHEN A.INOUT_GUBUN_CODE = '30' THEN A.TRANS_AMT WHEN A.INOUT_GUBUN_CODE = '52' THEN A.TRANS_AMT * -1 END,0) AS OUT_AMT -- 출금액 
    ,COALESCE((CASE WHEN A.BALANCE_SIGNAL = '-' THEN A.BALANCE_SIGNAL END||A.BALANCE_AMT),0) AS BALANCE -- 잔액 
    ,F.COMMON_DETAIL_CODE_NAME AS BANK_NAME -- 은행명 
    ,B.FC_CURRENCY_CODE -- FC통화코드 
    ,G.INDICATOR_NAME AS FC_CURRENCY_NAME -- FC통화코드명 
    ,B.OLAS_ACCOUNT_CODE
    ,A.OPP_DEPOSIT_HOLDER_NAME AS REMARKS -- 적요 
    ,K.COMMON_DETAIL_CODE_NAME AS INOUT_GUBUN_NAME -- 입급지급구분명
FROM EGAS.COMMON_DETAIL_CODE_T F
  JOIN EGAS.BANK_ACCT_T B ON F.COMMON_DETAIL_CODE = B.BANK_CODE AND B.USE_FLAG = '1' AND B.APPROVAL_YN = '1' AND F.COMMON_CODE = '0021'
  JOIN EGAS.CMS_TRANS_LIST_T A ON B.BANK_ACCT_SEQ = A.BANK_ACCT_SEQ AND A.USE_FLAG = '1'
  JOIN EGAS.COMMON_DETAIL_CODE_T C ON C.COMMON_DETAIL_CODE = B.BANK_ACCT_TYPE_CODE AND C.COMMON_CODE = '0022'
  JOIN EGAS.AUTHORIZATION_CODE_T D ON D.CODE = B.MNGT_DEPT_CODE AND D.TYPE = '400'
  JOIN EGAS.FUNCTION_CODE_T E ON E.FUNCTION_CODE = B.CURRENCY_CODE AND E.CATEGORY_CODE = '0004'
  JOIN EGAS.COMMON_DETAIL_CODE_T K ON K.COMMON_DETAIL_CODE = A.INOUT_GUBUN_CODE AND K.COMMON_CODE = '0103'
  LEFT JOIN EGAS.ES_INDICATOR_CODE_T G ON G.INDICATOR_CODE = B.FC_CURRENCY_CODE AND G.FINANCIAL_CODE = '03'
  LEFT JOIN EGAS.FUNCTION_CODE_T H ON COALESCE(B.SA_GUBUN_CODE,?) = H.FUNCTION_CODE AND H.CATEGORY_CODE = '0013'
WHERE 1 = 1
```

## 3. KakaoTalk_20260227_155552295_01.jpg (UNION ALL Query)

### Java Source (StringBuffer)
```java
sbSql.append(" SELECT y.gubun_code \n");
sbSql.append("      , x.cli_system_trx_id \n");
sbSql.append("      , x.trx_send_time \n");
sbSql.append(" FROM   eecs.afbs_cms_header_t@xpecs01 x \n");
sbSql.append("      , eecs.afbs_cms_body_0100_700_t@xpecs01 y \n");
sbSql.append(" WHERE  x.trx_send_date          = :DATA_CREATE_DATE \n");
sbSql.append("    AND x.cli_system_trx_id LIKE 'V%' \n");
sbSql.append("    AND x.trx_send_date     = y.trx_send_date \n");
sbSql.append("    AND x.sender_id        = y.sender_id \n");
sbSql.append("    AND x.gate_trx_id      = y.gate_trx_id \n");
sbSql.append(" UNION ALL \n");
sbSql.append(" SELECT y.gubun_code \n");
sbSql.append("      , x.cli_system_trx_id \n");
sbSql.append("      , x.trx_send_time \n");
sbSql.append(" FROM   eecs.afbs_cms_header_t@xpecs01 x \n");
sbSql.append("      , eecs.afbs_cms_body_0107_100_t@xpecs01 y \n");
sbSql.append(" WHERE  x.trx_send_date         = :DATA_CREATE_DATE \n");
sbSql.append("    AND x.cli_system_trx_id LIKE 'V%' \n");
sbSql.append("    AND x.trx_send_date     = y.trx_send_date \n");
sbSql.append("    AND x.sender_id        = y.sender_id \n");
sbSql.append("    AND x.gate_trx_id      = y.gate_trx_id \n");
```

### Oracle (Original)
```sql
SELECT y.gubun_code
     , x.cli_system_trx_id
     , x.trx_send_time
FROM   eecs.afbs_cms_header_t@xpecs01 x
     , eecs.afbs_cms_body_0100_700_t@xpecs01 y
WHERE  x.trx_send_date          = :DATA_CREATE_DATE
   AND x.cli_system_trx_id LIKE 'V%'
   AND x.trx_send_date     = y.trx_send_date
   AND x.sender_id        = y.sender_id
   AND x.gate_trx_id      = y.gate_trx_id
UNION ALL
SELECT y.gubun_code
     , x.cli_system_trx_id
     , x.trx_send_time
FROM   eecs.afbs_cms_header_t@xpecs01 x
     , eecs.afbs_cms_body_0107_100_t@xpecs01 y
WHERE  x.trx_send_date         = :DATA_CREATE_DATE
   AND x.cli_system_trx_id LIKE 'V%'
   AND x.trx_send_date     = y.trx_send_date
   AND x.sender_id        = y.sender_id
   AND x.gate_trx_id      = y.gate_trx_id
```

### PostgreSQL (Converted ANSI)
```sql
SELECT y.gubun_code
     , x.cli_system_trx_id
     , x.trx_send_time
FROM eecs.afbs_cms_header_t /* @xpecs01 */ x
 JOIN eecs.afbs_cms_body_0100_700_t /* @xpecs01 */ y ON x.trx_send_date = y.trx_send_date
WHERE x.trx_send_date = :DATA_CREATE_DATE
   AND x.cli_system_trx_id LIKE 'V%'
   AND x.sender_id = y.sender_id
   AND x.gate_trx_id = y.gate_trx_id
UNION ALL
SELECT y.gubun_code
     , x.cli_system_trx_id
     , x.trx_send_time
FROM eecs.afbs_cms_header_t /* @xpecs01 */ x
 JOIN eecs.afbs_cms_body_0107_100_t /* @xpecs01 */ y ON x.trx_send_date = y.trx_send_date
WHERE x.trx_send_date = :DATA_CREATE_DATE
   AND x.cli_system_trx_id LIKE 'V%'
   AND x.sender_id = y.sender_id
   AND x.gate_trx_id = y.gate_trx_id
```
