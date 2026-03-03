/**
 * OracleToPG Converter Utility
 * Version: 1.0.0
 * Description: Utility to convert Oracle SQL to PostgreSQL and extract SQL from Java source.
 */

const OracleToPG = (function () {
    'use strict';

    // --- Core SQL Conversion ---
    const transform = function (sql) {
        if (!sql) return "";
        let res = sql;

        // 1. Basic Functions
        res = res.replace(/NVL\(/gi, 'COALESCE(');
        res = res.replace(/SYSDATE/gi, 'CURRENT_TIMESTAMP');
        res = res.replace(/SYSTIMESTAMP/gi, 'CURRENT_TIMESTAMP');

        // 2. NVL2 Support: NVL2(a, b, c) -> CASE WHEN a IS NOT NULL THEN b ELSE c END
        res = res.replace(/NVL2\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, (match, p1, p2, p3) => {
            return `CASE WHEN ${p1.trim()} IS NOT NULL THEN ${p2.trim()} ELSE ${p3.trim()} END`;
        });

        // 3. Dual Removal
        res = res.replace(/FROM\s+DUAL/gi, '/* FROM DUAL */');
        res = res.replace(/SELECT\s+(.*?)\s+FROM\s+DUAL/gi, 'SELECT $1');

        // 4. Decode (Dynamic)
        const decodeRegex = /DECODE\(([^,]+),\s*([^)]+)\)/gi;
        while (res.match(decodeRegex)) {
            res = res.replace(decodeRegex, (match, val, args) => {
                const parts = splitCsv(args);
                let caseStmt = `CASE WHEN ${val.trim()}`;
                for (let i = 0; i < parts.length - 1; i += 2) {
                    if (i + 1 < parts.length) {
                        caseStmt += ` = ${parts[i].trim()} THEN ${parts[i + 1].trim()}`;
                    }
                }
                if (parts.length % 2 === 1) {
                    caseStmt += ` ELSE ${parts[parts.length - 1].trim()}`;
                }
                caseStmt += ` END`;
                return caseStmt;
            });
        }

        // 5. DB Link Removal (@dblink)
        res = res.replace(/([a-zA-Z0-9_$]+)@([a-zA-Z0-9_$]+)/gi, '$1 /* @$2 */');

        // 6. Join Logic (Enhanced)
        // Oracle Outer Join (+) to ANSI Join hint/reconstruction
        res = res.replace(/([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)\s*\(\+\)/g, (match, p1, p2) => {
            return `/* ANSI: JOIN ${p2.split('.')[0]} ON ${p1} = ${p2} */ ${p1} = ${p2}`;
        });
        res = res.replace(/([a-zA-Z0-9_.]+)\s*\(\+\)\s*=\s*([a-zA-Z0-9_.]+)/g, (match, p1, p2) => {
            return `/* ANSI: JOIN ${p1.split('.')[0]} ON ${p1} = ${p2} */ ${p1} = ${p2}`;
        });
        res = res.replace(/\(\+\)/g, '/* (+) OUTER JOIN */');

        // 7. TO_CHAR / Date Formatting
        res = res.replace(/TO_CHAR\(([^,]+),\s*'YYYYMMDD'\)/gi, "TO_CHAR($1, 'YYYYMMDD')");
        res = res.replace(/TO_CHAR\(([^,]+),\s*'YYYY-MM-DD HH24:MI:SS'\)/gi, "TO_CHAR($1, 'YYYY-MM-DD HH24:MI:SS')");
        res = res.replace(/TO_DATE\(([^,]+),\s*'YYYYMMDD'\)/gi, "CAST($1 AS DATE)");

        // 8. Advanced Date Functions
        res = res.replace(/ADD_MONTHS\(([^,]+),\s*([^)]+)\)/gi, '($1 + INTERVAL \'$2 month\')');
        res = res.replace(/LAST_DAY\(([^)]+)\)/gi, '(DATE_TRUNC(\'MONTH\', $1) + INTERVAL \'1 MONTH - 1 day\')::DATE');
        res = res.replace(/MONTHS_BETWEEN\(([^,]+),\s*([^)]+)\)/gi, '(EXTRACT(YEAR FROM AGE($1, $2)) * 12 + EXTRACT(MONTH FROM AGE($1, $2)))');

        // 9. Trunc (Date & Number)
        res = res.replace(/TRUNC\(CURRENT_TIMESTAMP\)/gi, 'CURRENT_DATE');
        res = res.replace(/TRUNC\(([^,)]+)\)/gi, 'DATE_TRUNC(\'day\', $1)');
        res = res.replace(/TRUNC\(([^,]+),\s*(\d+)\)/gi, 'TRUNC($1, $2)'); // Number version

        // 10. Instr / Substr / Length (Byte & Char)
        res = res.replace(/INSTR\(/gi, 'STRPOS(');
        res = res.replace(/SUBSTR\(/gi, 'SUBSTRING(');
        res = res.replace(/LENGTHB\(([^)]+)\)/gi, 'OCTET_LENGTH($1)');
        res = res.replace(/SUBSTRB\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, 'SUBSTRING($1::BYTEA, $2, $3)::TEXT');

        // 11. Sequences (NEXTVAL, CURRVAL)
        res = res.replace(/([a-zA-Z0-9_$]+)\.NEXTVAL/gi, "NEXTVAL('$1')");
        res = res.replace(/([a-zA-Z0-9_$]+)\.CURRVAL/gi, "CURRVAL('$1')");

        // 12. Set Operators
        res = res.replace(/MINUS/gi, 'EXCEPT');

        // 13. Rownum to Limit (Improved)
        res = res.replace(/WHERE\s+ROWNUM\s*<=\s*(\d+)/gi, 'LIMIT $1');
        res = res.replace(/AND\s+ROWNUM\s*<=\s*(\d+)/gi, 'LIMIT $1');
        res = res.replace(/ROWNUM/gi, '/* ROWNUM -> ROW_NUMBER() OVER() or LIMIT recommended */');

        // 14. Others (USER, UID, LOB)
        res = res.replace(/\bUSER\b/gi, 'CURRENT_USER');
        res = res.replace(/\bUID\b/gi, 'SESSION_USER');
        res = res.replace(/DBMS_LOB\.SUBSTR\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, 'SUBSTRING($1, $3, $2)'); // Arity swap info

        return res;
    };

    // Helper to split CSV but respect nested parens
    function splitCsv(str) {
        const results = [];
        let current = "";
        let depth = 0;
        for (let char of str) {
            if (char === ',' && depth === 0) {
                results.push(current);
                current = "";
            } else {
                if (char === '(') depth++;
                if (char === ')') depth--;
                current += char;
            }
        }
        results.push(current);
        return results;
    }

    // --- Java Source Parser ---
    const Parser = {
        extract: (src) => {
            if (!src) return "";
            const lines = src.split('\n');
            let result = [];
            lines.forEach(line => {
                const match = /"(.*?)"/.exec(line);
                if (match) {
                    result.push(match[1].replace(/\\n/g, '').replace(/\\r/g, '').replace(/\\"/g, '"').trimEnd());
                }
            });
            return result.join('\n');
        },

        detectStyle: (src) => {
            const lines = src.split('\n');
            let vName = "sbSql";
            let type = "append"; // default

            for (let line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const appendMatch = /([a-zA-Z0-9_$]+)\.append\s*\(/i.exec(trimmed);
                if (appendMatch) return { vName: appendMatch[1], type: "append" };

                const plusAssignMatch = /([a-zA-Z0-9_$]+)\s*\+=\s*"/i.exec(trimmed);
                if (plusAssignMatch) return { vName: plusAssignMatch[1], type: "plusAssign" };

                const assignMatch = /([a-zA-Z0-9_$]+)\s*=\s*"/i.exec(trimmed);
                if (assignMatch) return { vName: assignMatch[1], type: "assign" };
            }
            return { vName, type };
        },

        wrap: (pg, style) => {
            if (!pg) return "";
            const lines = pg.split('\n');
            return lines.map((l, i) => {
                const sql = l.trimEnd();
                if (style.type === 'append') {
                    return `${style.vName}.append("${sql} \\n ");`;
                } else if (style.type === 'plusAssign') {
                    return `${style.vName} += "${sql} \\n ";`;
                } else {
                    return (i === 0 ? `${style.vName} = "` : `    + "`) + `${sql} \\n "` + (i === lines.length - 1 ? ";" : "");
                }
            }).join('\n');
        }
    };

    // Public API
    return {
        transform: transform,
        extract: Parser.extract,
        detectStyle: Parser.detectStyle,
        wrap: Parser.wrap
    };
})();
