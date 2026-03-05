const OracleToPG = require('./oracle_to_pgsql.js');

const tests = [
    {
        name: "BETWEEN ... AND in Join",
        input: `SELECT * FROM table_a a, table_b b WHERE a.trans_date(+) BETWEEN :FROM AND :TO AND a.use_flag = '1'`,
        expected: ["BETWEEN :FROM AND :TO"]
    },
    {
        name: "INSTR 3 args (start=1)",
        input: "INSTR(str, sub, 1)",
        expected: ["STRPOS(str, sub)"]
    },
    {
        name: "INSTR 3 args (start=3)",
        input: "INSTR(str, sub, 3)",
        expected: ["STRPOS(SUBSTRING(str FROM 3), sub)"]
    },
    {
        name: "ROWNUM <= N",
        input: "SELECT * FROM dual WHERE ROWNUM <= 10",
        expected: ["LIMIT 10"]
    },
    {
        name: "ROWNUM < N",
        input: "SELECT * FROM dual WHERE ROWNUM < 5",
        expected: ["LIMIT 4"]
    },
    {
        name: "Date Functions: TRUNC",
        input: "TRUNC(sysdate, 'MM')",
        expected: ["DATE_TRUNC('month', CURRENT_TIMESTAMP)"]
    },
    {
        name: "Date Functions: ADD_MONTHS",
        input: "ADD_MONTHS(sysdate, 3)",
        expected: ["(CURRENT_TIMESTAMP + INTERVAL '3 months')"]
    },
    {
        name: "Date Functions: LAST_DAY",
        input: "LAST_DAY(sysdate)",
        expected: ["(DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month' - INTERVAL '1 day')"]
    },
    {
        name: "ROLLUP Protection",
        input: "SELECT dept_code, SUM(salary) FROM emp_t GROUP BY ROLLUP(dept_code)",
        expected: ["ROLLUP(dept_code)"]
    }
];

console.log("Starting comprehensive verification...");
let allPassed = true;

tests.forEach(test => {
    const result = OracleToPG.transform(test.input);
    const passed = test.expected.every(exp => result.includes(exp));
    console.log(`Test: ${test.name}`);
    console.log(`Input: ${test.input.trim()}`);
    console.log(`Result: ${result.trim()}`);
    if (passed) {
        console.log("Status: OK");
    } else {
        console.log("Status: FAILED");
        allPassed = false;
    }
    console.log("-".repeat(40));
});

if (allPassed) {
    console.log("OVERALL STATUS: ALL TESTS PASSED");
} else {
    console.log("OVERALL STATUS: SOME TESTS FAILED");
    process.exit(1);
}
