/**
 * OracleToPG Converter Utility
 * Version: 1.0.2
 * Description: Utility to convert Oracle SQL to PostgreSQL and extract SQL from Java source.
 */

const OracleToPG = (function () {
    'use strict';

    // --- Core SQL Conversion ---
    function transform(sql, dateFormat = 'YYYY-MM-DD') {
        if (!sql) return "";

        let result = sql;

        // --- ROLLUP Protection ---
        const rollupPlaceholders = [];
        result = result.replace(/\b(ROLLUP|CUBE|GROUPING\s+SETS)\s*\([\s\S]+?\)/gi, (match) => {
            const key = `__ROLLUP_${rollupPlaceholders.length}__`;
            rollupPlaceholders.push(match);
            return key;
        });

        // 0. AS spacing cleanup
        result = result.replace(/(\bEND|\))AS\b/gi, '$1 AS');

        // 1. Basic Keyword Cleanup
        result = result.replace(/\bNVL\b/gi, 'COALESCE');
        result = result.replace(/\bSYSDATE\b/gi, 'CURRENT_TIMESTAMP');
        result = result.replace(/\bsubstrb\b/gi, 'SUBSTRING');

        // 2. COALESCE vertical formatting
        result = result.replace(/COALESCE\s*\(\s*(CASE[\s\S]+?END)\s*,\s*(.*?)\s*\)/gi, (match, caseBody, fallback) => {
            return `COALESCE((\n${caseBody}\n), ${fallback})`;
        });

        // 3. Robust Recursive Function Transformer
        function transformFunctions(text) {
            const funcs = ['TO_CHAR', 'TO_DATE', 'TO_NUMBER', 'LPAD', 'RPAD', 'NVL', 'SUBSTR', 'MAX', 'SUBSTRING', 'COALESCE', 'DECODE', 'NVL2', 'INSTR', 'TRUNC', 'ADD_MONTHS', 'LAST_DAY'];

            function getNextMatch(str) {
                let earliest = null;
                for (const f of funcs) {
                    const regex = new RegExp(`\\b${f}\\s*\\(`, 'gi');
                    const m = regex.exec(str);
                    if (m && (!earliest || m.index < earliest.index)) {
                        earliest = { name: f.toUpperCase(), index: m.index, matchLen: m[0].length };
                    }
                }
                return earliest;
            }

            function recurse(str) {
                let res = "";
                let curr = str;
                let next;

                while ((next = getNextMatch(curr)) !== null) {
                    res += curr.substring(0, next.index);
                    const openParen = next.index + next.matchLen - 1;
                    const content = getBalancedContent(curr, openParen);
                    if (content === null) {
                        res += curr.substring(next.index);
                        return res;
                    }

                    const transformedContent = recurse(content);
                    const args = splitCsv(transformedContent);
                    let replacement = null;

                    if (next.name === 'TO_CHAR' && args.length === 1) {
                        replacement = `TO_CHAR(${args[0].trim()}, 'YYYY-MM-DD HH24:MI:SS')`;
                    } else if (next.name === 'TO_DATE' && args.length === 1) {
                        replacement = `TO_DATE(${args[0].trim()}, 'YYYYMMDD')`;
                    } else if (next.name === 'TO_NUMBER') {
                        replacement = `(${transformedContent.trim()})::NUMERIC`;
                    } else if (next.name === 'LPAD' || next.name === 'RPAD') {
                        if (args.length > 0) {
                            const arg1 = args[0].trim();
                            const castedArg1 = (!arg1.endsWith('::TEXT') && !arg1.startsWith("'") && !/^\d+$/.test(arg1))
                                ? `(${arg1})::TEXT`
                                : (/^\d+$/.test(arg1) ? `${arg1}::TEXT` : arg1);
                            const otherArgs = args.slice(1).map(a => a.trim());
                            replacement = `${next.name}(${[castedArg1, ...otherArgs].join(', ')})`;
                        }
                    } else if (next.name === 'NVL') {
                        replacement = `COALESCE(${transformedContent})`;
                    } else if (next.name === 'DECODE') {
                        if (args.length < 3) {
                            replacement = `DECODE(${transformedContent})`;
                        } else {
                            const col = args[0].trim();
                            let caseStr = "CASE\n";
                            for (let i = 1; i < args.length - 1; i += 2) {
                                const val = args[i].trim();
                                const res = args[i + 1].trim();
                                caseStr += `    WHEN ${col} = ${val} THEN ${res}\n`;
                            }
                            if (args.length % 2 === 0) {
                                caseStr += `    ELSE ${args[args.length - 1].trim()}\n`;
                            }
                            caseStr += " END";
                            replacement = caseStr;
                        }
                    } else if (next.name === 'NVL2') {
                        if (args.length !== 3) {
                            replacement = `NVL2(${transformedContent})`;
                        } else {
                            replacement = `CASE\n    WHEN ${args[0].trim()} IS NOT NULL THEN ${args[1].trim()}\n    ELSE ${args[2].trim()}\n END`;
                        }
                    } else if (next.name === 'INSTR') {
                        const iArgs = splitCsv(transformedContent);
                        if (iArgs.length === 2) {
                            replacement = `STRPOS(${iArgs[0].trim()}, ${iArgs[1].trim()})`;
                        } else if (iArgs.length === 3 && iArgs[2].trim() === '1') {
                            replacement = `STRPOS(${iArgs[0].trim()}, ${iArgs[1].trim()})`;
                        } else if (iArgs.length === 3) {
                            replacement = `STRPOS(SUBSTRING(${iArgs[0].trim()} FROM ${iArgs[2].trim()}), ${iArgs[1].trim()})`;
                        } else {
                            replacement = `/*⚠️ instr() 커스텀 함수 필요 */ instr(${transformedContent})`;
                        }
                    } else if (next.name === 'TRUNC') {
                        if (args.length === 1) {
                            replacement = `DATE_TRUNC('day', ${args[0].trim()})`;
                        } else {
                            const fmtMap = { "'MM'": 'month', "'YYYY'": 'year', "'DD'": 'day', "'HH'": 'hour' };
                            const pgFmt = fmtMap[args[1].trim().toUpperCase()] || 'day';
                            replacement = `DATE_TRUNC('${pgFmt}', ${args[0].trim()})`;
                        }
                    } else if (next.name === 'ADD_MONTHS') {
                        if (args.length === 2) {
                            const n = args[1].trim();
                            const sign = n.startsWith('-') ? '-' : '+';
                            const abs = n.replace('-', '');
                            replacement = `(${args[0].trim()} ${sign} INTERVAL '${abs} months')`;
                        }
                    } else if (next.name === 'LAST_DAY') {
                        if (args.length === 1) {
                            replacement = `(DATE_TRUNC('month', ${args[0].trim()}) + INTERVAL '1 month' - INTERVAL '1 day')`;
                        }
                    }

                    if (replacement === null) {
                        replacement = `${next.name}(${transformedContent})`;
                    }

                    res += replacement;
                    curr = curr.substring(openParen + content.length + 2);
                }
                res += curr;
                return res;
            }
            return recurse(text);
        }

        result = transformFunctions(result);

        // 4. ROWNUM range handling (ROWNUM=1, <=N, <N → LIMIT)
        // ⚠️ CONNECT BY ROWNUM 패턴과 충돌하지 않도록
        //    generate_series 로 변환될 CONNECT BY 패턴이 없을 때만 처리
        const hasConnectByRownum = /FROM\s+DUAL\s+CONNECT\s+BY\s+(?:LEVEL|ROWNUM)\s*<=/i.test(result);

        let hasRownumLimit = false;
        let rownumLimitVal = 1;

        if (!hasConnectByRownum) {
            if (/\bROWNUM\s*=\s*1\b/i.test(result)) {
                result = result.replace(/\s+AND\s+ROWNUM\s*=\s*1\b/gi, '');
                result = result.replace(/\bWHERE\s+ROWNUM\s*=\s*1\b/gi, 'WHERE 1=1');
                hasRownumLimit = true;
                rownumLimitVal = 1;
            }

            const rownumLteMatch = result.match(/\bROWNUM\s*(<=?)\s*(\d+)\b/i);
            if (rownumLteMatch) {
                const op = rownumLteMatch[1];
                const n = parseInt(rownumLteMatch[2]);
                rownumLimitVal = (op === '<') ? n - 1 : n;
                result = result.replace(/\s+AND\s+ROWNUM\s*<=?\s*\d+\b/gi, '');
                result = result.replace(/\bWHERE\s+ROWNUM\s*<=?\s*\d+\b/gi, 'WHERE 1=1');
                hasRownumLimit = true;
            }
        }

        // 5. Concatenation Type Safety
        result = result.replace(/(\?)\s*\|\|/g, '($1)::TEXT ||');
        result = result.replace(/\|\|\s*(\?)/g, '|| ($1)::TEXT');

        // 6. Reserved Keyword Quoting (e.g., DATE)
        result = result.replace(/\.DATE\b/gi, '."DATE"');
        result = result.replace(/\bDATE\s*=/gi, '"DATE" =');

        // 7. GROUPING comparison
        // Pattern 1: Parenthesized sum of grouping functions
        result = result.replace(/(\([\s\S]+?grouping\s*\([\s\S]+?\))\s*(=|!=|<>)\s*'(\d+)'/gi, '$1::TEXT $2 \'$3\'');
        // Pattern 2: Single grouping function compared to string digit
        result = result.replace(/\bGROUPING\s*\([^)]+\)\s*(=|!=|<>)\s*'(\d+)'/gi, (match, op, num) => {
            return match.replace(`'${num}'`, num);
        });

        // 8. CONNECT BY LEVEL / ROWNUM → generate_series
        // ⚠️ ROWNUM 처리보다 반드시 뒤에 위치 (충돌 방지를 위해 hasConnectByRownum 플래그로 제어)
        const connectByRegex = /SELECT\s+([\s\S]+?)\s+FROM\s+DUAL\s+CONNECT\s+BY\s+(?:LEVEL|ROWNUM)\s*<=\s*([\s\S]+)/gi;
        result = result.replace(connectByRegex, (match, selectList, rest) => {
            let limit = "";
            let depth = 0;
            let foundEnd = false;
            let remainder = "";

            for (let i = 0; i < rest.length; i++) {
                if (rest[i] === '(') depth++;
                else if (rest[i] === ')') {
                    if (depth === 0) {
                        limit = rest.substring(0, i);
                        remainder = rest.substring(i);
                        foundEnd = true;
                        break;
                    }
                    depth--;
                }
            }
            if (!foundEnd) limit = rest;

            // LEVEL/ROWNUM → gs 치환 (AS 뒤 alias 는 제외)
            let transformedSelect = selectList.replace(/(^|[^a-zA-Z0-9_$])(LEVEL|ROWNUM)\b/gi, (m, prefix, ident) => {
                const before = selectList.substring(0, selectList.indexOf(m)).trim().toLowerCase();
                if (before.endsWith(' as')) return m;
                return prefix + 'gs';
            });

            // SELECT LEVEL / SELECT ROWNUM 단독인 경우
            const trimmedOriginal = selectList.trim().toLowerCase();
            if (trimmedOriginal === 'level' || trimmedOriginal === 'rownum') {
                transformedSelect = `gs AS ${trimmedOriginal}`;
            }

            return `SELECT ${transformedSelect.trim()} FROM generate_series(1, ${limit.trim()}) gs${remainder}`;
        });

        // 9. FROM DUAL 제거
        result = result.replace(/\s+FROM\s+DUAL\b/gi, '');

        // 10. OUTER JOIN (+) → ANSI JOIN
        result = convertToAnsiJoin(result);

        // 11. LIMIT 추가 (CONNECT BY 패턴이 없을 때만)
        if (hasRownumLimit && !/\bLIMIT\b/i.test(result)) {
            result += `\n LIMIT ${rownumLimitVal}`;
        }

        // 12. ROLLUP 복원
        rollupPlaceholders.forEach((val, idx) => {
            result = result.replace(`__ROLLUP_${idx}__`, val);
        });

        // 13. UPDATE alias 정리
        if (/UPDATE\s+(\w+)\s+(\w+)\s+SET/i.test(result)) {
            result = result.replace(/UPDATE\s+(\w+)\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE/i, (match, table, alias, sets) => {
                const cleanSets = sets.replace(new RegExp(`${alias}\\.`, 'g'), '');
                return `UPDATE ${table} ${alias} SET ${cleanSets} WHERE`;
            });
        }

        return result;
    }

    function getBalancedContent(str, startIdx) {
        let depth = 0;
        for (let i = startIdx + 1; i < str.length; i++) {
            if (str[i] === '(') depth++;
            else if (str[i] === ')') {
                if (depth === 0) return str.substring(startIdx + 1, i);
                depth--;
            }
        }
        return null;
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
        if (!sql) return "";

        const fromIdx = findTopLevelKeyword(sql, "FROM");
        if (fromIdx === -1) return sql;

        const footers = ["GROUP BY", "ORDER BY", "HAVING", "LIMIT"];
        let footerIdx = -1;
        for (const f of footers) {
            const idx = findTopLevelKeyword(sql, f);
            if (idx !== -1 && (footerIdx === -1 || idx < footerIdx)) footerIdx = idx;
        }

        let footer = "", workingSql = sql;
        if (footerIdx !== -1) { footer = sql.substring(footerIdx); workingSql = sql.substring(0, footerIdx); }

        let whereIdx = findTopLevelKeyword(workingSql, "WHERE");
        let whereClause = "", fromClause = "";
        const selectSegment = workingSql.substring(0, fromIdx + 4);

        if (whereIdx !== -1) {
            fromClause = workingSql.substring(fromIdx + 4, whereIdx).trim();
            whereClause = workingSql.substring(whereIdx + 5).trim();
        } else {
            fromClause = workingSql.substring(fromIdx + 4).trim();
        }

        const tables = splitFromClause(fromClause);
        const hasPlus = /\(\+\)/i.test(whereClause);
        const hasSubquery = tables.some(t => t.trim().startsWith('('));
        if (tables.length < 2 && !hasPlus && !hasSubquery) return sql;

        const conditions = whereClause ? splitConditions(whereClause) : [];

        const joinStates = tables.map((t, idx) => {
            const commentMatch = /(--.*|\/\*[\s\S]*?\*\/)/.exec(t);
            const comment = commentMatch ? commentMatch[1] : "";
            let cleanT = t.replace(/(--.*|\/\*[\s\S]*?\*\/)/g, '').trim();
            let alias = getTableAlias(cleanT);

            if (cleanT.startsWith('(')) {
                const subContent = getBalancedContent(cleanT, 0);
                if (subContent !== null) {
                    const transformedSub = transform(subContent);
                    const finalAlias = alias || "sub";
                    cleanT = `( ${transformedSub} ) AS ${finalAlias}`;
                    alias = finalAlias;
                }
            }

            return { raw: cleanT, alias: alias, joined: false, type: 'JOIN', on: [], comment: comment };
        });

        joinStates[0].joined = true;
        const processed = new Set([joinStates[0].alias]);
        const otherWhere = [];

        conditions.forEach(condStr => {
            const condMatch = /([\s\S]+?)(--.*|\/\*[\s\S]*?\*\/)?$/.exec(condStr);
            const cond = condMatch ? condMatch[1].trim() : condStr.trim();
            const comment = condMatch ? (condMatch[2] || "") : "";
            const isJoin = /\(\+\)/.test(cond);
            let cleanCond = cond.replace(/\(\+\)/g, '');
            const aliases = (cleanCond.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || [])
                .map(a => a.split('.')[0])
                .filter((v, i, a) => a.indexOf(v) === i);
            otherWhere.push({ cond: cleanCond, isJoin: isJoin, aliases: aliases, comment: comment });
        });

        let changed = true;
        let newFrom = joinStates[0].raw + (joinStates[0].comment ? ' ' + joinStates[0].comment : '');

        while (changed) {
            changed = false;
            for (let i = 1; i < joinStates.length; i++) {
                const s = joinStates[i];
                if (s.joined) continue;

                let idx = otherWhere.findIndex(ow => {
                    if (!ow.isJoin) return false;
                    return ow.aliases.includes(s.alias) && ow.aliases.some(a => a !== s.alias && processed.has(a));
                });
                let jType = 'LEFT JOIN';

                if (idx === -1) {
                    idx = otherWhere.findIndex(ow => {
                        if (ow.isJoin) return false;
                        return ow.aliases.includes(s.alias) && ow.aliases.some(a => a !== s.alias && processed.has(a));
                    });
                    jType = 'JOIN';
                }

                if (idx !== -1) {
                    const matched = otherWhere.splice(idx, 1)[0];
                    let finalCond = matched.cond + (matched.comment ? ' ' + matched.comment : '');

                    if (finalCond.includes('=') && matched.aliases.length === 2 && !finalCond.includes('CASE')) {
                        const parts = finalCond.split('=');
                        if (parts.length === 2) {
                            const lhs = parts[0].trim();
                            const rhs = parts[1].trim();
                            const lhsAliasMatch = /^([a-zA-Z0-9_$]+)\./.exec(lhs);
                            if (lhsAliasMatch && lhsAliasMatch[1] === s.alias) finalCond = `${rhs} = ${lhs}`;
                        }
                    }

                    s.joined = true;
                    s.type = jType;
                    s.on.push(finalCond);
                    processed.add(s.alias);

                    for (let j = 0; j < otherWhere.length; j++) {
                        const ow = otherWhere[j];
                        if (ow.aliases.includes(s.alias) && ow.aliases.every(a => processed.has(a))) {
                            if (ow.cond.trim() === '1 = 1' || ow.cond.trim() === '1=1') continue;
                            const owm = otherWhere.splice(j, 1)[0];
                            let extraCond = owm.cond + (owm.comment ? ' ' + owm.comment : '');
                            if (extraCond.includes('=') && ow.aliases.length === 2 && !extraCond.includes('CASE')) {
                                const parts = extraCond.split('=');
                                if (parts.length === 2) {
                                    const lhs = parts[0].trim();
                                    const rhs = parts[1].trim();
                                    const lhsAliasMatch = /^([a-zA-Z0-9_$]+)\./.exec(lhs);
                                    if (lhsAliasMatch && lhsAliasMatch[1] === s.alias) extraCond = `${rhs} = ${lhs}`;
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
                        for (let k = 1; k < sortedOn.length; k++) newFrom += `\n AND ${sortedOn[k]}`;
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

        const finalConditions = otherWhere.map(ow => ow.cond + (ow.comment ? ' ' + ow.comment : ''));
        let result = selectSegment + ' ' + newFrom;
        if (finalConditions.length > 0) result += '\n WHERE ' + finalConditions.join('\n   AND ');
        if (footer) result += '\n' + footer;
        return result;
    }

    function splitConditions(where) {
        const result = [];
        let current = "", depth = 0, inQuote = false, i = 0;
        while (i < where.length) {
            const char = where[i];
            if (char === "'" && where[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) {
                if (char === "(") depth++;
                else if (char === ")") depth--;
                else if (depth === 0) {
                    const betweenMatch = where.substring(i).match(/^BETWEEN\s+[\s\S]+?\s+AND\s+[\s\S]+?(?=\s+AND|\s*$)/i);
                    if (betweenMatch) {
                        if (current && !current.endsWith(' ')) current += ' ';
                        current += betweenMatch[0];
                        i += betweenMatch[0].length;
                        const nextAndMatch = where.substring(i).match(/^\s+AND\s+/i);
                        if (nextAndMatch) { result.push(current.trim()); current = ""; i += nextAndMatch[0].length; continue; }
                        else break;
                    }
                    const andMatch = /^AND\s/i.exec(where.substring(i));
                    if (andMatch && i > 0 && /\s/.test(where[i - 1])) {
                        result.push(current.trim()); current = ""; i += 4; continue;
                    }
                }
            }
            current += char;
            i++;
        }
        if (current.trim()) result.push(current.trim());
        return result.filter(Boolean);
    }

    function findTopLevelKeyword(sql, kw) {
        let depth = 0, inQuote = false;
        const kwLen = kw.length;
        for (let i = 0; i < sql.length - kwLen; i++) {
            const char = sql[i];
            if (char === "'" && sql[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) {
                if (char === "(") depth++;
                else if (char === ")") depth--;
                else if (depth === 0) {
                    const sub = sql.substring(i, i + kwLen).toUpperCase();
                    if (sub === kw.toUpperCase()) {
                        const prev = i > 0 ? sql[i - 1] : " ";
                        const next = i + kwLen < sql.length ? sql[i + kwLen] : " ";
                        if (/\s/.test(prev) && /\s/.test(next)) return i;
                    }
                }
            }
        }
        return -1;
    }

    function getTableAlias(t) {
        const clean = t.replace(/(--.*|\/\*[\s\S]*?\*\/)/g, '').trim();
        if (clean.startsWith('(')) {
            const lastParenIdx = clean.lastIndexOf(')');
            let trailer = clean.substring(lastParenIdx + 1).trim();
            if (!trailer) return "";
            const asMatch = /^AS\s+(.*)/i.exec(trailer);
            if (asMatch) return asMatch[1].trim().split(/\s+/)[0];
            return trailer.split(/\s+/)[0];
        }
        const parts = clean.split(/\s+/);
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.') || /^(FROM|JOIN|LEFT|RIGHT|INNER|OUTER|WHERE)$/i.test(lastPart)) return "";
        return lastPart;
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
                else if (char === "," && depth === 0) { result.push(current); current = ""; continue; }
            }
            current += char;
        }
        result.push(current);
        return result;
    }

    function splitFromClause(fromStr) {
        const result = [];
        let current = "", depth = 0, inQuote = false;
        for (let i = 0; i < fromStr.length; i++) {
            const char = fromStr[i];
            if (char === "'" && fromStr[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) {
                if (char === "(") depth++;
                else if (char === ")") depth--;
                else if (char === "," && depth === 0) { result.push(current.trim()); current = ""; continue; }
            }
            current += char;
        }
        if (current.trim()) result.push(current.trim());
        return result.filter(Boolean);
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
                if (trimmed.startsWith('/*') && !trimmed.includes('*/')) { inBlock = true; result.push(line); return; }
                if (inBlock) { result.push(line); if (trimmed.includes('*/')) inBlock = false; return; }
                if (trimmed.startsWith('/*') && trimmed.includes('*/')) { result.push(line); return; }
                if (trimmed.startsWith('//')) { result.push(`/*@ ${trimmed} */`); return; }

                let lineMatch;
                const matches = [];
                const globalStringRegex = /"((?:[^"\\]|\\.)*)"/g;
                while ((lineMatch = globalStringRegex.exec(line)) !== null) matches.push(lineMatch);

                if (matches.length > 0) {
                    let combinedSql = "";
                    matches.forEach(m => { combinedSql += m[1].replace(/\\n/g, '').replace(/\\r/g, '').replace(/\\"/g, '"'); });
                    const lastMatch = matches[matches.length - 1];
                    const trailer = line.substring(line.indexOf(lastMatch[0]) + lastMatch[0].length);
                    const cMatch = /(\/\/.*|\/\*.*?\*\/|--.*)/.exec(trailer);
                    let marker = "";
                    if (cMatch) { const c = cMatch[1]; marker = `/*#TRAIL# ${c.replace(/\*\//g, '* /')} */`; }
                    result.push(combinedSql + (marker ? " " + marker : ""));
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
            let vName = "sbSql", type = "append", isFluent = false, hasVName = false;
            for (let line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('*')) continue;
                const appM = /([a-zA-Z0-9_$]+)\.append/i.exec(line);
                if (appM) { vName = appM[1]; type = "append"; hasVName = true; if (line.split('.append').length > 2) isFluent = true; }
                else if (/\.?append\s*\(/i.test(line)) { type = "append"; isFluent = true; }
                const assignM = /([a-zA-Z0-9_$]+)\s*(\+?=)\s*"/i.exec(line);
                if (assignM) { vName = assignM[1]; type = assignM[2] === "+=" ? "plusAssign" : "assign"; hasVName = true; }
            }
            return { vName, type, isFluent, hasVName };
        },

        smartReplace: function (src, pgSqlLines) {
            if (!src) return "";
            const srcLines = src.split('\n');
            const pgLines = pgSqlLines.split('\n');
            const style = this.detectStyle(src);

            let firstSqlIdx = -1, lastSqlIdx = -1;
            srcLines.forEach((line, idx) => {
                if (this.stringRegex.test(line)) { if (firstSqlIdx === -1) firstSqlIdx = idx; lastSqlIdx = idx; }
            });
            if (firstSqlIdx === -1) return src;

            const result = [];
            for (let i = 0; i < firstSqlIdx; i++) result.push(srcLines[i]);

            const baseIndentMatch = srcLines[firstSqlIdx].match(/^\s*/);
            const indent = baseIndentMatch ? baseIndentMatch[0] : "    ";

            pgLines.forEach((pgLine, idx) => {
                let trail = "";
                const trailMatch = /\s*\/\*#TRAIL#\s+([\s\S]+?)\s+\*\/$/.exec(pgLine);
                if (trailMatch) { trail = " " + trailMatch[1].replace(/\*\//g, '* /'); pgLine = pgLine.substring(0, trailMatch.index); }
                const escapedLine = pgLine.replace(/"/g, '\\"');
                const isLast = idx === pgLines.length - 1;

                if (style.type === "append") {
                    if (style.isFluent) {
                        const prefix = (idx === 0 && style.hasVName) ? `${style.vName}.append` : `append`;
                        const suffix = isLast ? ';' : '.';
                        result.push(`${indent}${prefix}("${escapedLine} \\n")${suffix}${trail}`);
                    } else {
                        result.push(`${indent}${style.vName}.append("${escapedLine} \\n");${trail}`);
                    }
                } else if (style.type === "plusAssign") {
                    result.push(`${indent}${style.vName} += "${escapedLine} ";${trail}`);
                } else {
                    result.push(`${indent}${style.vName} = "${escapedLine} ";${trail}`);
                }
            });

            for (let i = lastSqlIdx + 1; i < srcLines.length; i++) result.push(srcLines[i]);
            return result.join('\n');
        }
    };

    return {
        transform: transform,
        extract: Parser.extract.bind(Parser),
        detectStyle: Parser.detectStyle.bind(Parser),
        smartReplace: Parser.smartReplace.bind(Parser),
        splitConditions: splitConditions
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OracleToPG;
}