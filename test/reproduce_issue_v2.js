const OracleToPG = require('./oracle_to_pgsql.js');

const sql = `
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
`;

const result = OracleToPG.transform(sql);
console.log(result);
if (result.includes('(+)')) {
    console.error('FAILED: Output still contains (+)');
} else {
    console.log('SUCCESS: No (+) found in output');
}
