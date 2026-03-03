/**
 * OracleToPG Converter Utility
 * Version: 1.0.0
 * Description: Utility to convert Oracle SQL to PostgreSQL and extract SQL from Java source.
 */

const OracleToPG = (function () {
    'use strict';

    // --- Core SQL Conversion ---
    const transform = function (sql, dateFormat = 'YYYY-MM-DD') {
        if (!sql) return "";
        let res = sql;

        // 1. Basic Functions
        res = res.replace(/NVL\(/gi, 'COALESCE(');
        res = res.replace(/SYSDATE/gi, 'CURRENT_TIMESTAMP');
        res = res.replace(/SYSTIMESTAMP/gi, 'CURRENT_TIMESTAMP');

        // 2. NVL2 Support
        res = res.replace(/NVL2\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, (match, p1, p2, p3) => {
            return `CASE WHEN ${p1.trim()} IS NOT NULL THEN ${p2.trim()} ELSE ${p3.trim()} END`;
        });

        // 3. Dual Removal
        res = res.replace(/SELECT\s+(.*?)FROM\s+DUAL/gi, 'SELECT $1 /* Dual Removed */ ');
        res = res.replace(/FROM\s+DUAL/gi, '/* FROM DUAL removed */');

        // 4. Decode (Dynamic & Recursive)
        const decodeRegex = /DECODE\(([^,]+),\s*((?:[^()]|\([^)]*\))*)\)/gi;
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

        // 5. DB Link Removal
        res = res.replace(/([a-zA-Z0-9_$]+)@([a-zA-Z0-9_$]+)/gi, '$1 /* @$2 */');

        // 6. Join Logic (Convert Oracle comma joins with (+) to ANSI JOIN)
        res = convertToAnsiJoin(res);

        // 7. TO_CHAR / Date Formatting
        const datePattern = /TO_CHAR\(([^,]+),\s*'([^']+)'\)/gi;
        res = res.replace(datePattern, (match, p1, p2) => {
            return `TO_CHAR(${p1}, '${dateFormat}')`;
        });
        res = res.replace(/TO_DATE\(([^,]+),\s*'[^']+'\)/gi, "CAST($1 AS DATE)");

        // 8. Advanced Date Functions
        res = res.replace(/ADD_MONTHS\(([^,]+),\s*([^)]+)\)/gi, '($1 + INTERVAL \'$2 month\')');
        res = res.replace(/LAST_DAY\(([^)]+)\)/gi, '(DATE_TRUNC(\'MONTH\', $1) + INTERVAL \'1 MONTH - 1 day\')::DATE');
        res = res.replace(/MONTHS_BETWEEN\(([^,]+),\s*([^)]+)\)/gi, '(EXTRACT(YEAR FROM AGE($1, $2)) * 12 + EXTRACT(MONTH FROM AGE($1, $2)))');

        // 9. Trunc
        res = res.replace(/TRUNC\(CURRENT_TIMESTAMP\)/gi, 'CURRENT_DATE');
        res = res.replace(/TRUNC\(([^,)]+)\)/gi, 'DATE_TRUNC(\'day\', $1)');
        res = res.replace(/TRUNC\(([^,]+),\s*(\d+)\)/gi, 'TRUNC($1, $2)');

        // 10. Instr / Substr / Length
        res = res.replace(/INSTR\(/gi, 'STRPOS(');
        res = res.replace(/SUBSTR\(/gi, 'SUBSTRING(');
        res = res.replace(/LENGTHB\(([^)]+)\)/gi, 'OCTET_LENGTH($1)');
        res = res.replace(/SUBSTRB\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, 'SUBSTRING($1::BYTEA, $2, $3)::TEXT');

        // 11. Sequences
        res = res.replace(/([a-zA-Z0-9_$]+)\.NEXTVAL/gi, "NEXTVAL('$1')");
        res = res.replace(/([a-zA-Z0-9_$]+)\.CURRVAL/gi, "CURRVAL('$1')");

        // 12. Set Operators
        res = res.replace(/MINUS/gi, 'EXCEPT');

        // 13. Rownum to Limit
        res = res.replace(/WHERE\s+ROWNUM\s*<=\s*(\d+)/gi, 'LIMIT $1');
        res = res.replace(/AND\s+ROWNUM\s*<=\s*(\d+)/gi, 'LIMIT $1');
        res = res.replace(/\bROWNUM\b/gi, '/* ROWNUM -> ROW_NUMBER() or LIMIT */');

        // 14. Others
        res = res.replace(/\bUSER\b/gi, 'CURRENT_USER');
        res = res.replace(/\bUID\b/gi, 'SESSION_USER');
        res = res.replace(/DBMS_LOB\.SUBSTR\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, 'SUBSTRING($1, $3, $2)');

        return res;
    };

    /**
     * Converts Oracle comma-separated joins with (+) to ANSI JOIN syntax.
     */
    function convertToAnsiJoin(sql) {
        // Handle UNION/UNION ALL by processing each segment separately
        if (/\bUNION\b/i.test(sql)) {
            const segments = sql.split(/(\bUNION\b(?:\s+ALL)?)/i);
            return segments.map(seg => {
                if (/(\bUNION\b(?:\s+ALL)?)/i.test(seg)) return seg;
                return processSingleQueryJoin(seg);
            }).join('');
        }
        return processSingleQueryJoin(sql);
    }

    /**
     * Internal processor for a single SELECT/UPDATE/DELETE block.
     */
    function processSingleQueryJoin(sql) {
        // Basic check for join markers or multiple tables
        const hasPlus = /\(\+\)/i.test(sql);
        const hasComma = sql.split(/FROM\s+/i)[1]?.split(/WHERE\s+/i)[0]?.includes(',');
        if (!hasPlus && !hasComma) return sql;

        // Extract FROM and WHERE clauses carefully
        const fromRegex = /FROM\s+([\s\S]+?)(?=\s+WHERE|\s+GROUP BY|\s+ORDER BY|\s+HAVING|$|;)/i;
        const whereRegex = /WHERE\s+([\s\S]+?)(?=\s+GROUP BY|\s+ORDER BY|\s+HAVING|$|;)/i;

        const fromMatch = fromRegex.exec(sql);
        if (!fromMatch) return sql;

        const fromClause = fromMatch[1];
        const whereMatch = whereRegex.exec(sql);
        const whereClause = whereMatch ? whereMatch[1] : "";

        // Parse tables
        const tables = fromClause.split(',').map(t => t.trim()).filter(Boolean);
        if (tables.length < 2) return sql;

        // Parse conditions
        const conditions = whereClause ? whereClause.split(/\s+AND\s+/i).map(c => c.trim()).filter(Boolean) : [];

        const joinStates = tables.map(t => {
            const alias = getTableAlias(t);
            return { raw: t, alias: alias, joined: false, type: 'JOIN', on: [] };
        });

        // First table is base
        joinStates[0].joined = true;
        const processed = new Set([joinStates[0].alias]);
        const otherWhere = [];

        // Distribute conditions
        conditions.forEach(cond => {
            const clean = cond.replace(/\(\+\)/gi, '');
            const condHasPlus = /\(\+\)/i.test(cond);

            // Find aliases
            const aliases = [];
            const aliasMatches = cond.matchAll(/\b([a-zA-Z0-9_$]+)\.[a-zA-Z0-9_$]+\b/g);
            for (const am of aliasMatches) {
                if (!aliases.includes(am[1])) aliases.push(am[1]);
            }

            if (condHasPlus) {
                const plusAliasMatch = /\b([a-zA-Z0-9_$]+)\.[a-zA-Z0-9_$]+\s*\(\+\)/i.exec(cond);
                if (plusAliasMatch) {
                    const plusAlias = plusAliasMatch[1];
                    const target = joinStates.find((s, idx) => s.alias === plusAlias && idx > 0);
                    if (target) {
                        target.type = 'LEFT JOIN';
                        target.on.push(clean);
                        return;
                    }
                }
            } else if (aliases.length >= 2) {
                otherWhere.push({ cond: clean, aliases: aliases, isJoin: true });
                return;
            }

            otherWhere.push({ cond: clean, aliases: aliases, isJoin: false });
        });

        let newFrom = joinStates[0].raw;
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 1; i < joinStates.length; i++) {
                const s = joinStates[i];
                if (s.joined) continue;

                if (s.on.length > 0) {
                    const canJoin = s.on.some(oc => {
                        const ams = oc.matchAll(/\b([a-zA-Z0-9_$]+)\.\b/g);
                        for (const am of ams) {
                            if (am[1] !== s.alias && processed.has(am[1])) return true;
                        }
                        return false;
                    });
                    if (canJoin) {
                        s.joined = true;
                        processed.add(s.alias);
                        // Pull in any static filters for any already processed tables (including driving table)
                        for (let j = 0; j < otherWhere.length; j++) {
                            const ow = otherWhere[j];
                            if (!ow.isJoin && ow.aliases.every(a => processed.has(a))) {
                                const cond = otherWhere[j].cond;
                                if (cond.trim() === '1 = 1' || cond.trim() === '1=1') continue;
                                s.on.push(otherWhere.splice(j, 1)[0].cond);
                                j--;
                            }
                        }
                        const sortedOn = s.on.sort((a, b) => {
                            const aIsJoin = (a.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || []).length >= 2;
                            const bIsJoin = (b.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || []).length >= 2;
                            if (aIsJoin && !bIsJoin) return -1;
                            if (!aIsJoin && bIsJoin) return 1;
                            return 0;
                        });
                        newFrom += `\n ${s.type} ${s.raw} ON ${sortedOn.join(' AND ')}`;
                        changed = true;
                        break;
                    }
                }

                const innerIdx = otherWhere.findIndex(ow => {
                    if (!ow.isJoin) return false;
                    const hasS = ow.aliases.includes(s.alias);
                    const hasOthers = ow.aliases.some(a => a !== s.alias && processed.has(a));
                    return hasS && hasOthers;
                });

                if (innerIdx !== -1) {
                    const ow = otherWhere.splice(innerIdx, 1)[0];
                    s.joined = true;
                    s.on.push(ow.cond);
                    processed.add(s.alias);

                    // Pull in any static filters for any already processed tables (including driving table)
                    for (let j = 0; j < otherWhere.length; j++) {
                        const condObj = otherWhere[j];
                        if (!condObj.isJoin && condObj.aliases.every(a => processed.has(a))) {
                            if (condObj.cond.trim() === '1 = 1' || condObj.cond.trim() === '1=1') continue;
                            s.on.push(otherWhere.splice(j, 1)[0].cond);
                            j--;
                        }
                    }

                    // Also pull in any multi-alias joins that are now fully satisfied
                    for (let j = 0; j < otherWhere.length; j++) {
                        if (otherWhere[j].isJoin && otherWhere[j].aliases.every(a => processed.has(a))) {
                            s.on.push(otherWhere.splice(j, 1)[0].cond);
                            j--;
                        }
                    }

                    const sortedOn = s.on.sort((a, b) => {
                        const aIsJoin = (a.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || []).length >= 2;
                        const bIsJoin = (b.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || []).length >= 2;
                        if (aIsJoin && !bIsJoin) return -1;
                        if (!aIsJoin && bIsJoin) return 1;
                        return 0;
                    });
                    newFrom += `\n ${s.type} ${s.raw} ON ${sortedOn.join(' AND ')}`;
                    changed = true;
                    break;
                }
            }
        }

        joinStates.forEach(s => {
            if (!s.joined) newFrom += ` , ${s.raw}`;
        });

        const finalConditions = otherWhere.map(ow => ow.cond);

        let res = sql.replace(fromMatch[0], "FROM " + newFrom);
        if (whereMatch) {
            if (finalConditions.length > 0) {
                res = res.replace(whereMatch[0], "WHERE " + finalConditions.join("\n   AND "));
            } else {
                res = res.replace(whereMatch[0], "WHERE 1 = 1");
            }
        }
        return res;
    }

    function getTableAlias(t) {
        const parts = t.trim().split(/\s+/);
        return parts[parts.length - 1];
    }

    // Robust CSV splitter for DECODE etc. (handles single quotes and nested parens)
    function splitCsv(str) {
        const results = [];
        let current = "";
        let depth = 0;
        let inQuote = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === "'") {
                // Peek for escaped single quote (doubled: '')
                if (inQuote && str[i + 1] === "'") {
                    current += "''";
                    i++; // skip next quote
                } else {
                    inQuote = !inQuote;
                    current += char;
                }
            } else if (char === ',' && depth === 0 && !inQuote) {
                results.push(current);
                current = "";
            } else {
                if (!inQuote) {
                    if (char === '(') depth++;
                    if (char === ')') depth--;
                }
                current += char;
            }
        }
        results.push(current);
        return results;
    }

    // --- Java Source Parser ---
    const Parser = {
        // Robust string extraction regex (handles escaped quotes \")
        stringRegex: /"((?:[^"\\]|\\.)*)"/,

        extract: function (src) {
            if (!src) return "";
            const lines = src.split('\n');
            let result = [];
            let inBlock = false;

            lines.forEach(line => {
                const trimmed = line.trim();

                // 1. Block Comments
                if (trimmed.startsWith('/*')) {
                    inBlock = true;
                    result.push("/*<@");
                    if (trimmed.includes('*/')) {
                        const content = line.substring(line.indexOf('/*') + 2, line.lastIndexOf('*/')).trim();
                        if (content) result.push(content);
                        result.push("@>*/");
                        inBlock = false;
                    } else {
                        const content = line.substring(line.indexOf('/*') + 2).trim();
                        if (content) result.push(content);
                    }
                    return;
                }
                if (inBlock) {
                    if (trimmed.includes('*/')) {
                        const content = line.substring(0, line.lastIndexOf('*/')).trim();
                        if (content) result.push(content);
                        result.push("@>*/");
                        inBlock = false;
                    } else {
                        result.push(line);
                    }
                    return;
                }

                // 2. Standalone line comments
                if (trimmed.startsWith('//')) {
                    result.push(`/*@ ${trimmed} */`);
                    return;
                }

                // 3. String extraction
                const match = this.stringRegex.exec(line);
                if (match) {
                    // Extract SQL content. Do NOT trimEnd to preserve internal spaces.
                    let sql = match[1].replace(/\\n/g, '').replace(/\\r/g, '').replace(/\\"/g, '"');

                    // Detect trailing comment
                    const trailer = line.substring(line.indexOf(match[0]) + match[0].length);
                    const cMatch = /(\/\/.*|\/\*.*?\*\/)/.exec(trailer);
                    let marker = "";
                    if (cMatch) {
                        const c = cMatch[1];
                        if (c.startsWith('//')) marker = `/*@ ${c.trim()} */`;
                        else marker = `/*@@ ${c.substring(2, c.length - 2).trim()} */`;
                    }
                    result.push(sql + (marker ? " " + marker : ""));
                } else if (trimmed) {
                    // Lines without strings but might have comments
                    const cMatch = /(\/\/.*|\/\*.*?\*\/)/.exec(line);
                    if (cMatch) {
                        const c = cMatch[1];
                        if (c.startsWith('//')) result.push(`/*@ ${c.trim()} */`);
                        else result.push(`/*@@ ${c.substring(2, c.length - 2).trim()} */`);
                    }
                }
            });

            // Fallback: If no strings were extracted but the input has content, 
            // check if it looks like raw SQL (not Java code)
            if (result.length === 0 && src.trim()) {
                const trimmed = src.trim().toUpperCase();
                if (trimmed.startsWith('SELECT') || trimmed.startsWith('INSERT') ||
                    trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE') ||
                    trimmed.startsWith('WITH') || trimmed.startsWith('CREATE')) {
                    return src;
                }
            }

            return result.join('\n');
        },

        detectStyle: function (src) {
            const lines = src.split('\n');
            let vName = "sbSql";
            let type = "append";

            for (let line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('*')) continue;

                const appM = /([a-zA-Z0-9_$]+)\.append/i.exec(line);
                if (appM) return { vName: appM[1], type: "append" };

                const assignM = /([a-zA-Z0-9_$]+)\s*(\+?=)\s*"/i.exec(line);
                if (assignM) return { vName: assignM[1], type: assignM[2] === "+=" ? "plusAssign" : "assign" };
            }
            return { vName, type };
        },

        smartReplace: function (src, pgSqlLines) {
            if (!src) return "";
            const srcLines = src.split('\n');
            const pgLines = pgSqlLines.split('\n');
            let pgIdx = 0;
            let inBlock = false;

            return srcLines.map(line => {
                const trimmed = line.trim();
                const pgLine = pgLines[pgIdx] || "";
                const pgTrimmed = pgLine.trim();

                // 1. Handle Block Restoration
                if (trimmed.startsWith('/*')) {
                    inBlock = true;
                    if (pgTrimmed === "/*<@") pgIdx++;
                    return line;
                }
                if (inBlock) {
                    if (trimmed.includes('*/')) {
                        inBlock = false;
                        if (pgLines[pgIdx] && pgLines[pgIdx].trim() === "@>*/") pgIdx++;
                    } else if (pgIdx < pgLines.length && pgLines[pgIdx].trim() !== "@>*/") {
                        // If it's block content, we just keep the original line as is, but advance pgIdx
                        pgIdx++;
                    }
                    return line;
                }

                // 2. Handle Standalone Comments
                if (trimmed.startsWith('//') && pgTrimmed.startsWith('/*@')) {
                    pgIdx++;
                    return line;
                }

                // 3. Handle Code and Trailing Comments
                const match = this.stringRegex.exec(line);

                if (match && pgIdx < pgLines.length) {
                    const startQuote = line.indexOf(match[0]);
                    const endQuote = startQuote + match[0].length;

                    const prefix = line.substring(0, startQuote + 1);
                    const suffix = line.substring(endQuote - 1);

                    let targetPg = pgLines[pgIdx++];

                    // Detect markers in converted SQL (Markers are appended with ONE space in extract)
                    const m1 = / \/\*@ (.*?) \*\/$/.exec(targetPg); // // style
                    const m2 = / \/\*@@ (.*?) \*\/$/.exec(targetPg); // /* */ style

                    let comment = "";
                    if (m1) {
                        comment = m1[1];
                        targetPg = targetPg.replace(m1[0], '');
                    } else if (m2) {
                        comment = "/* " + m2[1] + " */";
                        targetPg = targetPg.replace(m2[0], '');
                    }

                    const needsNewLine = line.includes('\\n');
                    const content = targetPg + (needsNewLine ? " \\n " : "");

                    // Reconstruct suffix to include/update comment
                    let baseSuffix = suffix;
                    if (comment) {
                        // Remove existing comment from baseSuffix logic
                        baseSuffix = suffix.replace(/(\/\/.*|\/\*.*?\*\/)/, '').trimEnd();

                        // Carefully reconstruct with semicolon preservation
                        if (baseSuffix.endsWith(';')) {
                            return prefix + content + baseSuffix.slice(0, -1) + ' ' + comment + ';';
                        }
                        return prefix + content + baseSuffix + ' ' + comment;
                    }

                    return prefix + content + suffix;
                }

                // 4. Fallback: marker lines without content match
                if (pgTrimmed.startsWith('/*@') || pgTrimmed.startsWith('/*@@')) {
                    pgIdx++;
                }

                return line;
            }).join('\n');
        }
    };

    // Public API
    return {
        transform: transform,
        extract: Parser.extract.bind(Parser),
        detectStyle: Parser.detectStyle.bind(Parser),
        smartReplace: Parser.smartReplace.bind(Parser)
    };
})();
