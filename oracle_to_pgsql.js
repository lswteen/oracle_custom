/**
 * OracleToPG Converter Utility
 * Version: 1.0.1
 * Description: Utility to convert Oracle SQL to PostgreSQL and extract SQL from Java source.
 */

const OracleToPG = (function () {
    'use strict';

    // --- Core SQL Conversion ---
    function transform(sql, dateFormat = 'YYYY-MM-DD') {
        if (!sql) return "";

        let result = sql;

        // 1. Basic Keyword Cleanup
        result = result.replace(/\bNVL\b/gi, 'COALESCE');
        result = result.replace(/\bSYSDATE\b/gi, 'CURRENT_TIMESTAMP');

        // 2. DECODE to CASE (Vertical Formatting)
        const decodeRegex = /DECODE\s*\(([\s\S]+?)\)/gi;
        result = result.replace(decodeRegex, (match, p1) => {
            const args = splitCsv(p1);
            if (args.length < 3) return match;

            const col = args[0].trim();
            let caseStr = "CASE\n";
            for (let i = 1; i < args.length - 1; i += 2) {
                const val = args[i].trim();
                const res = args[i + 1].trim();
                caseStr += `     WHEN ${col} = ${val} THEN ${res}\n`;
            }

            if (args.length % 2 === 0) {
                caseStr += `     ELSE ${args[args.length - 1].trim()}\n`;
            }
            caseStr += " END";
            return caseStr;
        });

        // 3. NVL2 (Vertical Formatting)
        result = result.replace(/NVL2\s*\(([\s\S]+?)\)/gi, (match, p1) => {
            const args = splitCsv(p1);
            if (args.length !== 3) return match;
            return `CASE\n     WHEN ${args[0].trim()} IS NOT NULL THEN ${args[1].trim()}\n     ELSE ${args[2].trim()}\n END`;
        });

        // 4. COALESCE (Vertical Formatting for complex nested cases)
        // Match COALESCE followed by a CASE to trigger vertical split and wrap CASE in parentheses with specific layout
        result = result.replace(/COALESCE\s*\(\s*(CASE[\s\S]+?END)\s*,\s*(.*?)\s*\)/gi, (match, caseBody, fallback) => {
            return `COALESCE((\n${caseBody}\n), ${fallback})`;
        });

        // 4. TO_DATE
        result = result.replace(/TO_DATE\s*\(\s*('.*?')\s*,\s*('.*?')\s*\)/gi, (match, val, fmt) => {
            return `TO_TIMESTAMP(${val}, ${fmt})`;
        });

        // 5. Dual removal
        result = result.replace(/\s+FROM\s+DUAL/gi, '');

        // 6. OUTER JOIN (+) -> ANSI JOIN
        result = convertToAnsiJoin(result);

        // EXTRA: Remove table aliases from UPDATE SET
        if (/UPDATE\s+(\w+)\s+(\w+)\s+SET/i.test(result)) {
            result = result.replace(/UPDATE\s+(\w+)\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE/i, (match, table, alias, sets) => {
                const cleanSets = sets.replace(new RegExp(`${alias}\\.`, 'g'), '');
                return `UPDATE ${table} ${alias} SET ${cleanSets} WHERE`;
            });
        }

        return result;
    }

    function convertToAnsiJoin(sql) {
        if (/\bUNION\b/i.test(sql)) {
            const segments = sql.split(/(\bUNION\b(?:\s+ALL)?)/i);
            return segments.map(seg => {
                if (/(\bUNION\b(?:\s+ALL)?)/i.test(seg)) return seg;
                return processSingleQueryJoin(seg);
            }).join('');
        }
        return processSingleQueryJoin(sql);
    }

    function processSingleQueryJoin(sql) {
        const hasPlus = /\(\+\)/i.test(sql);
        const fromPart = sql.split(/FROM\s+/i)[1]?.split(/WHERE\s+|GROUP BY|ORDER BY|HAVING|$|;/i)[0];
        const hasComma = fromPart?.includes(',');

        if (!hasPlus && !hasComma) return sql;

        const fromRegex = /FROM\s+([\s\S]+?)(?=\s+WHERE|\s+GROUP BY|\s+ORDER BY|\s+HAVING|$|;)/i;
        const whereRegex = /WHERE\s+([\s\S]+?)(?=\s+GROUP BY|\s+ORDER BY|\s+HAVING|$|;)/i;

        const fromMatch = fromRegex.exec(sql);
        if (!fromMatch) return sql;

        const fromClause = fromMatch[1];
        const whereMatch = whereRegex.exec(sql);
        const whereClause = whereMatch ? whereMatch[1] : "";

        const tables = fromClause.split(',').map(t => t.trim()).filter(Boolean);
        if (tables.length < 2) return sql;

        const conditions = whereClause ? whereClause.split(/\s+AND\s+/i).map(c => c.trim()).filter(Boolean) : [];

        const joinStates = tables.map(t => {
            const commentMatch = /(--.*|\/\*[\s\S]*?\*\/)/.exec(t);
            const comment = commentMatch ? commentMatch[1] : "";
            const cleanT = t.replace(/(--.*|\/\*[\s\S]*?\*\/)/g, '').trim();
            const alias = getTableAlias(cleanT);
            return { raw: cleanT, alias: alias, joined: false, type: 'JOIN', on: [], comment: comment };
        });

        joinStates[0].joined = true;
        const processed = new Set([joinStates[0].alias]);
        const otherWhere = [];

        conditions.forEach(cond => {
            const isJoin = /\(\+\)/.test(cond);
            let cleanCond = cond.replace(/\s*\(\+\)\s*/g, '');
            const aliases = (cond.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || [])
                .map(a => a.split('.')[0])
                .filter((v, i, a) => a.indexOf(v) === i);


            otherWhere.push({ cond: cleanCond, isJoin: isJoin, aliases: aliases });
        });

        let changed = true;
        let newFrom = joinStates[0].raw + (joinStates[0].comment ? ' ' + joinStates[0].comment : '');

        while (changed) {
            changed = false;
            for (let i = 1; i < joinStates.length; i++) {
                const s = joinStates[i];
                if (s.joined) continue;

                // Path 1: LEFT JOIN (+)
                let idx = otherWhere.findIndex(ow => {
                    if (!ow.isJoin) return false;
                    const hasS = ow.aliases.includes(s.alias);
                    const hasOthers = ow.aliases.some(a => a !== s.alias && processed.has(a));
                    return hasS && hasOthers;
                });
                let jType = 'LEFT JOIN';

                // Path 2: INNER JOIN
                if (idx === -1) {
                    idx = otherWhere.findIndex(ow => {
                        if (ow.isJoin) return false;
                        const hasS = ow.aliases.includes(s.alias);
                        const hasOthers = ow.aliases.some(a => a !== s.alias && processed.has(a));
                        return hasS && hasOthers;
                    });
                    jType = 'JOIN';
                }

                if (idx !== -1) {
                    const matched = otherWhere.splice(idx, 1)[0];
                    let finalCond = matched.cond;

                    // Swap if needed: BaseTable = NewTable
                    if (finalCond.includes('=') && matched.aliases.length === 2 && !finalCond.includes('CASE')) {
                        const parts = finalCond.split('=');
                        if (parts.length === 2) {
                            const lhs = parts[0].trim();
                            const rhs = parts[1].trim();
                            const lhsAliasMatch = /^([a-zA-Z0-9_$]+)\./.exec(lhs);
                            if (lhsAliasMatch && lhsAliasMatch[1] === s.alias) {
                                finalCond = `${rhs} = ${lhs}`;
                            }
                        }
                    }

                    s.joined = true;
                    s.type = jType;
                    s.on.push(finalCond);
                    processed.add(s.alias);

                    for (let j = 0; j < otherWhere.length; j++) {
                        const ow = otherWhere[j];
                        if (ow.aliases.every(a => processed.has(a))) {
                            if (ow.cond.trim() === '1 = 1' || ow.cond.trim() === '1=1') continue;

                            let extraCond = otherWhere.splice(j, 1)[0].cond;
                            // Also swap for extra conditions if they are joins to 's'
                            if (extraCond.includes('=') && ow.aliases.length === 2 && !extraCond.includes('CASE')) {
                                const parts = extraCond.split('=');
                                if (parts.length === 2) {
                                    const lhs = parts[0].trim();
                                    const rhs = parts[1].trim();
                                    const lhsAliasMatch = /^([a-zA-Z0-9_$]+)\./.exec(lhs);
                                    if (lhsAliasMatch && lhsAliasMatch[1] === s.alias) {
                                        extraCond = `${rhs} = ${lhs}`;
                                    }
                                }
                            }
                            s.on.push(extraCond);
                            j--;
                        }
                    }

                    const sortedOn = s.on.sort((a, b) => {
                        const aIsJ = (a.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || []).length >= 2;
                        const bIsJ = (b.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || []).length >= 2;
                        return (bIsJ ? 1 : 0) - (aIsJ ? 1 : 0);
                    });

                    newFrom += `\n ${s.type} ${s.raw}`;
                    if (sortedOn.length > 0) {
                        newFrom += `\n  ON ${sortedOn[0]}`;
                        for (let k = 1; k < sortedOn.length; k++) {
                            newFrom += `\n AND ${sortedOn[k]}`;
                        }
                    }
                    if (s.comment) newFrom += ' ' + s.comment;
                    changed = true;
                    break;
                }
            }
        }

        joinStates.forEach(s => {
            if (!s.joined) newFrom += ` , ${s.raw}${s.comment ? ' ' + s.comment : ''}`;
        });

        const finalConditions = otherWhere.map(ow => ow.cond);
        let newSql = sql.replace(fromClause, ' ' + newFrom + ' ');
        if (finalConditions.length > 0) {
            newSql = newSql.replace(whereClause, ' ' + finalConditions.join('\n   AND ') + ' ');
        } else {
            newSql = newSql.replace(whereClause, ' 1 = 1 ');
        }
        return newSql;
    }

    function getTableAlias(t) {
        const clean = t.replace(/(--.*|\/\*[\s\S]*?\*\/)/g, '').trim();
        const parts = clean.split(/\s+/);
        return parts[parts.length - 1];
    }

    function splitCsv(str) {
        const result = [];
        let current = "", depth = 0, inQuote = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === "'" && str[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) {
                if (char === "(") depth++;
                else if (char === ")") depth--;
                else if (char === "," && depth === 0) {
                    result.push(current);
                    current = "";
                    continue;
                }
            }
            current += char;
        }
        result.push(current);
        return result;
    }

    const Parser = {
        stringRegex: /"((?:[^"\\]|\\.)*)"/,

        extract: function (src) {
            if (!src) return "";
            const lines = src.split('\n');
            const result = [];
            let inBlock = false;

            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
                    inBlock = true;
                    result.push(line);
                    return;
                }
                if (inBlock) {
                    result.push(line);
                    if (trimmed.includes('*/')) inBlock = false;
                    return;
                }
                if (trimmed.startsWith('/*') && trimmed.includes('*/')) {
                    result.push(line);
                    return;
                }
                if (trimmed.startsWith('//')) {
                    result.push(`/*@ ${trimmed} */`);
                    return;
                }

                const match = this.stringRegex.exec(line);
                if (match) {
                    let sql = match[1].replace(/\\n/g, '').replace(/\\r/g, '').replace(/\\"/g, '"');
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
                    const cMatch = /(\/\/.*|\/\*.*?\*\/)/.exec(line);
                    if (cMatch) {
                        const c = cMatch[1];
                        if (c.startsWith('//')) result.push(`/*@ ${c.trim()} */`);
                        else result.push(`/*@@ ${c.substring(2, c.length - 2).trim()} */`);
                    }
                }
            });

            if (result.length === 0 && src.trim()) {
                const t = src.trim().toUpperCase();
                if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE)/.test(t)) return src;
            }
            return result.join('\n');
        },

        detectStyle: function (src) {
            const lines = src.split('\n');
            let vName = "sbSql", type = "append";
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
            const style = this.detectStyle(src);

            // Find the SQL region in src
            let firstSqlIdx = -1, lastSqlIdx = -1;
            srcLines.forEach((line, idx) => {
                if (this.stringRegex.test(line)) {
                    if (firstSqlIdx === -1) firstSqlIdx = idx;
                    lastSqlIdx = idx;
                }
            });

            if (firstSqlIdx === -1) return src;

            const result = [];
            // Preserve lines before SQL region
            for (let i = 0; i < firstSqlIdx; i++) result.push(srcLines[i]);

            // Replace SQL region with PG lines
            const baseIndentMatch = srcLines[firstSqlIdx].match(/^\s*/);
            const indent = baseIndentMatch ? baseIndentMatch[0] : "    ";

            pgLines.forEach(pgLine => {
                if (style.type === "append") {
                    result.push(`${indent}${style.vName}.append("${pgLine.replace(/"/g, '\\"')} \\n");`);
                } else if (style.type === "plusAssign") {
                    result.push(`${indent}${style.vName} += "${pgLine.replace(/"/g, '\\"')} ";`);
                } else {
                    result.push(`${indent}${style.vName} = "${pgLine.replace(/"/g, '\\"')} ";`);
                }
            });

            // Preserve lines after SQL region
            for (let i = lastSqlIdx + 1; i < srcLines.length; i++) result.push(srcLines[i]);

            return result.join('\n');
        }
    };

    return {
        transform: transform,
        extract: Parser.extract.bind(Parser),
        detectStyle: Parser.detectStyle.bind(Parser),
        smartReplace: Parser.smartReplace.bind(Parser)
    };
})();
