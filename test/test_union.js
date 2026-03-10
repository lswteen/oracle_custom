const OracleToPG = require('./oracle_to_pgsql.js');

const sql = `
SELECT * FROM (
    SELECT a.id, b.id as b_id FROM table_a a, table_b b WHERE a.id = b.id(+)
    UNION ALL
    SELECT a.id, b.id as b_id FROM table_c a, table_d b WHERE a.id = b.id(+)
) x
`;

const result = OracleToPG.transform(sql);
console.log("Converted SQL:");
console.log(result);
