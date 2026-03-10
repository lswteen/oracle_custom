const OracleToPG = require('../oracle_to_pgsql_v1.js');

const javaSource = `
sbSql.append(" SELECT '1' AS seq, b.nickname AS detail --주석00 \\n"); /*주석11*/
sbSql.append("      , SUM(DECODE(INSTR(a.opp_name, '150000414190'), 0, /*주석00*/ \\n"); /*주석11*/
sbSql.append("            DECODE(a.code, '30', a.amt, '52', a.amt * -1, 0), 0)) AS amount \\n"); /*주석22*/
sbSql.append(" FROM   cms_trans_t a, bank_acct_t b -- 주석 \\n");
sbSql.append(" WHERE  a.trans_date(+) BETWEEN :FROM AND :TO /*주석*/ \\n");
sbSql.append(" AND    a.bank_acct_seq(+) = b.bank_acct_seq \\n");
sbSql.append(" AND    b.use_flag = '1' \\n");
sbSql.append(" GROUP BY b.nickname \\n");
sbSql.append(" UNION ALL \\n");
sbSql.append(" SELECT '2' AS seq, NULL AS detail \\n");
sbSql.append("      , NVL(SUM(amount), 0) AS amount \\n");
sbSql.append(" FROM   DUAL \\n");
`;

console.log("=== Slot 2: Clean Oracle SQL (current) ===");
const cleanOracle = OracleToPG.extract(javaSource);
console.log(cleanOracle);

console.log("\n=== Slot 3: PostgreSQL (current) ===");
const pgSql = OracleToPG.transform(cleanOracle);
console.log(pgSql);

console.log("\n=== Slot 4: Java 21 Text Block (current) ===");
console.log(OracleToPG.restoreAsTextBlock(javaSource, pgSql));
