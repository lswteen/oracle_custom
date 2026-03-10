const OracleToPG = require('../oracle_to_pgsql_v1.js');

const javaSource = `
    public void test() {
        StringBuilder sbSql = new StringBuilder();
        sbSql.append("SELECT x.cms_demand_list_seq /* Primary Key */ ");
        sbSql.append("     , x.cms_currency_gubun_code // Currency ");
        sbSql.append("  FROM CMS_DEMAND_LIST x ");
        sbSql.append(" WHERE x.transfer_from_date = :fromDate (+) ");
    }
`;

console.log("=== Slot 1: Java Source ===");
console.log(javaSource);

console.log("\n=== Slot 2: Clean Oracle SQL Extraction ===");
const cleanOracle = OracleToPG.extract(javaSource);
console.log(cleanOracle);

console.log("\n=== Slot 3: PostgreSQL Conversion ===");
const pgSql = OracleToPG.transform(cleanOracle);
console.log(pgSql);

console.log("\n=== Slot 4: Java 21 Text Block Restoration ===");
const finalRes = OracleToPG.restoreAsTextBlock(javaSource, pgSql);
console.log(finalRes);

if (!cleanOracle.includes("/*") && !cleanOracle.includes("//") && cleanOracle.includes("SELECT")) {
    console.log("\n✅ Extraction Success (No comments, cleaned Java)");
} else {
    console.log("\n❌ Extraction Failure");
}

if (finalRes.includes('String sql = """') && finalRes.includes('--')) {
    console.log("✅ Restoration Success (Java 21 format with comments)");
} else {
    console.log("❌ Restoration Failure");
}
