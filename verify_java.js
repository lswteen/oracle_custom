
const fs = require('fs');
const content = fs.readFileSync('c:\\workspace\\oracle_custom\\oracle_to_pgsql.js', 'utf8');

// The file is an IIFE that returns OracleToPG. We can mock the environment.
const mockWindow = {};
const logic = new Function('window', content + '\nreturn OracleToPG;')(mockWindow);

const javaSrc = `
sbSql.append(" SELECT y.gubun_code \\n");
sbSql.append("      , x.cli_system_trx_id \\n");
sbSql.append("      , x.trx_send_time \\n");
sbSql.append(" FROM   eecs.afbs_cms_header_t@xpecs01 x \\n");
sbSql.append("      , eecs.afbs_cms_body_0100_700_t@xpecs01 y \\n");
sbSql.append(" WHERE  x.trx_send_date          = :DATA_CREATE_DATE \\n");
sbSql.append("    AND x.cli_system_trx_id LIKE 'V%' \\n");
sbSql.append("    AND x.trx_send_date     = y.trx_send_date \\n");
sbSql.append("    AND x.sender_id        = y.sender_id \\n");
sbSql.append("    AND x.gate_trx_id      = y.gate_trx_id \\n");
sbSql.append(" UNION ALL \\n");
sbSql.append(" SELECT y.gubun_code \\n");
sbSql.append("      , x.cli_system_trx_id \\n");
sbSql.append("      , x.trx_send_time \\n");
sbSql.append(" FROM   eecs.afbs_cms_header_t@xpecs01 x \\n");
sbSql.append("      , eecs.afbs_cms_body_0107_100_t@xpecs01 y \\n");
sbSql.append(" WHERE  x.trx_send_date         = :DATA_CREATE_DATE \\n");
sbSql.append("    AND x.cli_system_trx_id LIKE 'V%' \\n");
sbSql.append("    AND x.trx_send_date     = y.trx_send_date \\n");
sbSql.append("    AND x.sender_id        = y.sender_id \\n");
sbSql.append("    AND x.gate_trx_id      = y.gate_trx_id \\n");
`;

const extracted = logic.extract(javaSrc);
console.log("--- Extracted SQL ---");
console.log(extracted);
console.log("\n--- Transformed PG SQL ---");
console.log(logic.transform(extracted));
