const OracleToPG = require('../oracle_to_pgsql_v1.js');

const query = `
SELECT 
    mngt.cms_mngt_seq,
    mngt.corp_code,
    mngt.settle_date,
    corp.corp_name,
    SUM(detail.settle_amt) as total_amt,
    COUNT(detail.detail_seq) as total_cnt,
    MAX(detail.last_update_date) as last_update,
    -- Complex nested expressions
    MAX(DECODE(mngt.status, '01', 'Initial', '02', 'Processing', '03', 'Completed', 'Error')) as status_text,
    SUM(CASE WHEN detail.type = 'A' THEN detail.settle_amt ELSE 0 END) as type_a_amt,
    SUM(CASE WHEN detail.type = 'B' THEN detail.settle_amt ELSE 0 END) as type_b_amt,
    NVL(MAX(bank.bank_name), 'N/A') as primary_bank,
    -- More columns to reach length
    mngt.reg_usr_id,
    mngt.reg_date,
    mngt.mod_usr_id,
    mngt.mod_date,
    mngt.appr_usr_id,
    mngt.appr_date,
    mngt.send_date,
    mngt.rcv_date,
    mngt.error_code,
    mngt.error_msg
FROM (
    SELECT 
        a.cms_mngt_seq,
        a.corp_code,
        a.settle_date,
        a.status,
        a.reg_usr_id,
        a.reg_date,
        a.mod_usr_id,
        a.mod_date,
        a.appr_usr_id,
        a.appr_date,
        a.send_date,
        a.rcv_date,
        a.error_code,
        a.error_msg,
        b.bank_code,
        b.account_no,
        -- Nested subquery in SELECT
        (SELECT COUNT(*) FROM cms_history_t h WHERE h.cms_mngt_seq = a.cms_mngt_seq) as hist_cnt
    FROM cms_mngt_t a,
         cms_bank_info_t b
    WHERE a.bank_info_seq = b.bank_info_seq(+)
      AND a.use_yn = 'Y'
      AND b.del_yn(+) = 'N'
) mngt,
(
    SELECT 
        c.corp_code,
        c.corp_name,
        c.biz_no,
        c.rep_name,
        c.addr,
        c.tel_no,
        c.fax_no,
        c.email,
        c.homepage,
        c.category,
        c.industry,
        c.zip_code,
        c.base_addr,
        c.dtl_addr,
        l.loc_name,
        l.loc_code
    FROM corp_mngt_t c,
         location_t l
    WHERE c.loc_id = l.loc_id(+)
      AND c.active_yn = 'Y'
) corp,
(
    SELECT 
        d.cms_mngt_seq,
        d.detail_seq,
        d.settle_amt,
        d.type,
        d.last_update_date,
        d.remark,
        d.attr1,
        d.attr2,
        d.attr3,
        d.attr4,
        d.attr5,
        d.attr6,
        d.attr7,
        d.attr8,
        d.attr9,
        d.attr10,
        sub_inner.val_name as attr_val_name
    FROM cms_detail_t d,
         (
            SELECT 
                v.val_code,
                v.val_name,
                v.val_desc,
                v.ref_code,
                v.sort_order,
                v.use_flag,
                v.attr_set_id,
                v.created_by,
                v.created_at,
                v.updated_by,
                v.updated_at
            FROM attr_value_t v,
                 attr_master_t m
            WHERE v.attr_set_id = m.attr_set_id(+)
              AND m.attr_type(+) = 'SETTLE'
         ) sub_inner
    WHERE d.attr_code = sub_inner.val_code(+)
) detail,
bank_master_t bank,
(
    SELECT 
        u.usr_id,
        u.usr_name,
        u.dept_code,
        g.group_name
    FROM user_t u,
         user_group_t g
    WHERE u.group_id = g.group_id(+)
) reg_user
WHERE mngt.cms_mngt_seq = detail.cms_mngt_seq
  AND mngt.corp_code = corp.corp_code(+)
  AND mngt.bank_code = bank.bank_code(+)
  AND mngt.reg_usr_id = reg_user.usr_id(+)
  -- Additional complex filters to reach 200 lines
  AND (mngt.settle_date BETWEEN '20230101' AND '20231231' OR mngt.status = '99')
  AND corp.loc_code(+) IN ('SEOUL', 'BUSAN', 'INCHEON')
  AND detail.settle_amt > 0
  AND length(detail.remark(+)) < 100
  AND mngt.error_code(+) IS NULL
  AND reg_user.group_name(+) != 'ADMIN'
  AND (
    SELECT count(*) 
    FROM audit_log_t al 
    WHERE al.target_id = mngt.cms_mngt_seq 
      AND al.action_type(+) = 'APPROVE'
  ) >= 0
GROUP BY 
    mngt.cms_mngt_seq,
    mngt.corp_code,
    mngt.settle_date,
    corp.corp_name,
    mngt.reg_usr_id,
    mngt.reg_date,
    mngt.mod_usr_id,
    mngt.mod_date,
    mngt.appr_usr_id,
    mngt.appr_date,
    mngt.send_date,
    mngt.rcv_date,
    mngt.error_code,
    mngt.error_msg,
    corp.biz_no,
    corp.rep_name,
    corp.addr,
    corp.tel_no,
    corp.fax_no,
    corp.email,
    corp.homepage,
    corp.category,
    corp.industry,
    corp.zip_code,
    corp.base_addr,
    corp.dtl_addr,
    corp.loc_name,
    corp.loc_code
ORDER BY 
    mngt.settle_date DESC,
    mngt.cms_mngt_seq ASC,
    total_amt DESC,
    corp.corp_name NULLS LAST
`;

console.log("=== ORACLE SQL (Approximately 180-200 lines if formatted widely) ===");
console.log(query);

const start = Date.now();
const result = OracleToPG.transform(query);
const end = Date.now();

console.log("\n=== POSTGRESQL SQL ===");
console.log(result);

console.log(`\nConversion took ${end - start}ms`);

if (result.includes('(+)')) {
    console.error("\nFAILURE: (+) syntax found in output!");
} else {
    console.log("\nSUCCESS: No (+) found in output");
}

// Basic structural check
const joinCount = (result.match(/JOIN/gi) || []).length;
console.log(`Found ${joinCount} JOIN keywords in result.`);
