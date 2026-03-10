const OracleToPG = require('./oracle_to_pgsql.js');

console.log("--- Test 3: UNION inside subquery ---");
const sql3 = `
SELECT * FROM (
    SELECT a.id, b.id as b_id FROM table_a a, table_b b WHERE a.id = b.id(+)
    UNION ALL
    SELECT a.id, b.id as b_id FROM table_c a, table_d b WHERE a.id = b.id(+)
) x
`;
const result3 = OracleToPG.transform(sql3);
console.log(result3);
