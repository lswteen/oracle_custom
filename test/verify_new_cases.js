const OracleToPG = require('./oracle_to_pgsql.js');

const sql16 = `
SELECT * FROM (
    SELECT a.cms_seq, b.cms_demand_list_seq
    FROM gas.cms_demand_mngt_t a
       , gas.cms_demand_list_mngt_t b
       , gas.cms_demand_detail_t c
       , gas.cms_common_area_t d
       , gas.common_detail_code_t e
    WHERE a.cms_seq = :CMS_SEQ
    AND a.data_create_date = :DATA_CREATE_DATE
    AND a.cms_demand_gubun_code = :CMS_DEMAND_GUBUN_CODE
    AND a.cms_currency_gubun_code = :CMS_CURRENCY_GUBUN_CODE
    AND a.cms_transfer_gubun_code = :CMS_TRANSFER_GUBUN_CODE
    AND a.mass_trans_yn = '1'
    AND a.cms_daesang_yn = '1'
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
`;

const sql17 = `
SELECT x.cms_demand_list_seq
     , x.cms_currency_gubun_code, x.cms_transfer_gubun_code
     , x.data_create_date, x.transfer_from_date, x.transfer_to_date
     , x.cms_demand_gubun_code, x.cms_seq, x.cms_state_code
     , x.cms_demand_list_mngt_seq, x.voucher_conv_yn
     , x.payment_account_bank_code, x.common_detail_code_name
     , x.payment_account_no, x.payment_currency_code
FROM (
    SELECT a.cms_seq, b.cms_demand_list_seq
         , b.cms_currency_gubun_code, b.cms_transfer_gubun_code
         , b.data_create_date, b.transfer_from_date, b.transfer_to_date
         , a.cms_demand_gubun_code, b.cms_state_code
         , b.cms_demand_list_mngt_seq, b.voucher_conv_yn
         , c.payment_account_bank_code, d.common_detail_code_name
         , c.payment_account_no, c.payment_currency_code
    FROM gas.cms_demand_mngt_t a
       , gas.cms_demand_list_mngt_t b
       , gas.cms_demand_detail_t c
       , gas.cms_common_area_t d
       , gas.common_detail_code_t e
    WHERE a.cms_seq = :CMS_SEQ
    AND a.data_create_date = :DATA_CREATE_DATE
    AND a.cms_demand_gubun_code = :CMS_DEMAND_GUBUN_CODE
    AND a.cms_currency_gubun_code = :CMS_CURRENCY_GUBUN_CODE
    AND a.cms_transfer_gubun_code = :CMS_TRANSFER_GUBUN_CODE
    AND a.mass_trans_yn = '1'
    AND a.cms_daesang_yn = '1'
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
       , x.transfer_from_date, x.transfer_to_date, x.cms_demand_gubun_code, x.cms_seq, x.cms_state_code
       , x.cms_demand_list_mngt_seq, x.voucher_conv_yn, x.payment_account_bank_code, x.common_detail_code_name
       , x.payment_account_no, x.payment_currency_code
`;

console.log("--- CASE 16 ---");
console.log(OracleToPG.transform(sql16));
console.log("\n--- CASE 17 ---");
console.log(OracleToPG.transform(sql17));
