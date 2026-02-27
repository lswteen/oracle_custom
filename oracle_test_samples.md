# Oracle to PostgreSQL Conversion Test Samples

This document provides representative test samples based on the provided Oracle 19c code images. Use these to verify the `oracle_to_pgsql_converter.html` tool.

---

## Sample 1: Update with Bind Variables & Comments
**Purpose**: Verify `StringBuffer.append()` extraction, preserved bind variables, and comment handling.

### [Source Java Code]
```java
StringBuffer sbSql = new StringBuffer();
sbSql.append(" UPDATE cms_demand_list_t \n ");
sbSql.append(" SET cms_state_code     = :CMS_STATE_CODE      \n "); // CMS처리상태코드
sbSql.append("   , approval_demand_time = :APPROVAL_DEMAND_TIME \n "); // 결재요청시간
sbSql.append("   , modify_usr_id        = :MODIFY_USR_ID        \n "); // 수정자
sbSql.append(" WHERE cms_demand_list_seq = :CMS_DEMAND_LIST_SEQ \n "); // 요청목록SEQ
sbSql.append("   AND use_flag           = '1'                   \n "); // 사용여부
```

---

## Sample 2: Complex Select with DB Links & Date Functions
**Purpose**: Verify DB Link removal (`@`), `SYSDATE` conversion, and `TO_CHAR` handling.

### [Source Java Code]
```java
sbSql.append(" SELECT x.cli_system_trx_id \n ");
sbSql.append("      , x.trx_send_time \n ");
sbSql.append("      , TO_CHAR(x.trx_send_date, 'YYYYMMDD') as send_date \n ");
sbSql.append(" FROM eecs.afbs_cms_header_t@xpecs01 x \n ");
sbSql.append("    , eecs.afbs_cms_body_0100_700_t@xpecs01 y \n ");
sbSql.append(" WHERE x.trx_send_date = TRUNC(SYSDATE) \n ");
sbSql.append("   AND x.cli_system_trx_id LIKE 'V%' \n ");
```

---

## Sample 3: Decode & Outer Join (+)
**Purpose**: Verify recursive `DECODE` to `CASE` conversion and `(+)` join flagging.

### [Source Java Code]
```java
sbSql.append(" SELECT a.cms_seq \n ");
sbSql.append("      , DECODE(a.cms_type, '1', 'Internal', '2', 'External', 'Unknown') as type_nm \n ");
sbSql.append("      , NVL2(a.modify_date, 'Modified', 'New') as status \n ");
sbSql.append(" FROM cms_demand_list_t a \n ");
sbSql.append("    , cms_common_area_t b \n ");
sbSql.append(" WHERE a.area_seq = b.area_seq(+) \n ");
sbSql.append("   AND a.use_flag = '1' \n ");
```

---

## Sample 4: Complex Megasample (60+ lines)
**Purpose**: Verify robustness with a large, complex query containing multiple joins, nested DECODE, DB Links, Outer Joins, Date functions, and ROWNUM.

### [Source Java Code]
```java
StringBuffer sbSql = new StringBuffer();
sbSql.append(" SELECT a.cms_seq \n ");
sbSql.append("      , a.cms_demand_list_seq \n ");
sbSql.append("      , b.common_area_seq \n ");
sbSql.append("      , DECODE(a.cms_state_code, '01', 'Ready', '02', 'Progress', '03', 'Done', 'Unknown') as state_nm \n ");
sbSql.append("      , NVL2(a.approval_demand_time, TO_CHAR(a.approval_demand_time, 'YYYY-MM-DD HH24:MI:SS'), 'NOT YET') as approved_time \n ");
sbSql.append("      , (SELECT count(*) FROM cms_demand_detail_t@xpecs01 d WHERE d.cms_demand_list_seq = a.cms_demand_list_seq) as detail_cnt \n ");
sbSql.append("      , x.user_name as req_user_name \n ");
sbSql.append("      , y.dept_name as req_dept_name \n ");
sbSql.append(" FROM cms_demand_list_t a \n ");
sbSql.append("    , cms_common_area_t b \n ");
sbSql.append("    , eecs.user_info_t@xpecs01 x \n ");
sbSql.append("    , eecs.dept_info_t@xpecs01 y \n ");
sbSql.append(" WHERE a.area_seq = b.common_area_seq(+) \n ");
sbSql.append("   AND a.req_user_id = x.user_id(+) \n ");
sbSql.append("   AND x.dept_id = y.dept_id(+) \n ");
sbSql.append("   AND a.use_flag = '1' \n ");
sbSql.append("   AND a.create_date >= TRUNC(SYSDATE) - 7 \n ");
sbSql.append("   AND a.cms_type IN ( \n ");
sbSql.append("       SELECT code_id FROM common_code_t \n ");
sbSql.append("       WHERE group_id = 'CMS_TYPE' \n ");
sbSql.append("         AND attr1 = 'Y' \n ");
sbSql.append("   ) \n ");
sbSql.append("   AND ( \n ");
sbSql.append("       a.cms_state_code != 'DELETED' \n ");
sbSql.append("       OR a.approval_usr_id IS NOT NULL \n ");
sbSql.append("   ) \n ");
sbSql.append("   AND ROWNUM <= 100 \n ");
sbSql.append(" ORDER BY a.create_date DESC, a.cms_seq ASC \n ");
// 추가 비즈니스 로직 조건
if (bean.getSearchType().equals("1")) {
    sbSql.append("   AND a.cms_title LIKE '%' || :SEARCH_VAL || '%' \n ");
} else {
    sbSql.append("   AND a.cms_content LIKE '%' || :SEARCH_VAL || '%' \n ");
}
sbSql.append(" UNION ALL \n ");
sbSql.append(" SELECT c.cms_seq \n ");
sbSql.append("      , c.cms_demand_list_seq \n ");
sbSql.append("      , 0 as common_area_seq \n ");
sbSql.append("      , 'HISTORY' as state_nm \n ");
sbSql.append("      , TO_CHAR(SYSTIMESTAMP, 'YYYY-MM-DD') as approved_time \n ");
sbSql.append("      , 0 as detail_cnt \n ");
sbSql.append("      , 'SYSTEM' as req_user_name \n ");
sbSql.append("      , 'N/A' as req_dept_name \n ");
sbSql.append(" FROM cms_history_t a \n ");
sbSql.append(" WHERE a.history_date > TRUNC(SYSDATE) \n ");
sbSql.append("   AND a.action_type = 'AUTO' \n ");
sbSql.append("   AND ROWNUM <= 10 \n ");
```

---

## Guide: How to Test

1.  **Copy** the code from the `[Source Java Code]` section of a sample.
2.  **Paste** it into the **"1. Java Source"** panel of the [oracle_to_pgsql_converter.html](oracle_to_pgsql_converter.html).
3.  Click **"Transform Now"**.
4.  Verify the results in:
    - **"2. Extracted Oracle SQL"**: Should show the raw SQL without Java quotes.
    - **"3. Transformed PG SQL"**: Should show the converted PostgreSQL 18 compatible SQL.
    - **"4. Final Java Wrapped"**: Should show the code ready to be pasted back into Java.
