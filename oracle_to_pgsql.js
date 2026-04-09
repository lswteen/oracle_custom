/**
 * OracleToPG Converter Utility
 * Version: 1.2.1
 * Description: Utility to convert Oracle SQL to PostgreSQL and extract SQL from Java source.
 *
 * [v1.2.1 변경사항]
 * - Parser.extract: SQL 주석 제거 기능 강화 (Pure Syntax 추출)
 * - Parser.restoreAsTextBlock: 유연한 매핑 로직 도입 및 원본 주석(Java/SQL)만 추출
 */

const OracleToPG = (function () {
    'use strict';

    function normalize(sql) {
        if (!sql) return sql;
        const literals = [];
        sql = sql.replace(/'([^']*)'/g, (m) => { literals.push(m); return `__LIT_${literals.length - 1}__`; });
        const lineComments = [];
        sql = sql.replace(/--[^\n]*/g, (m) => { lineComments.push(m); return `__CMT_${lineComments.length - 1}__`; });
        sql = sql.replace(/\b(FROM|WHERE|ON|HAVING|AND|OR|SET|INTO|VALUES|JOIN)\s*\(/gi, (m, kw) => kw.toUpperCase() + ' (');
        sql = sql.replace(/\)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+(FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|LIMIT)\b/gi, (m, alias, kw) => `) ${alias} ${kw.toUpperCase()}`);
        sql = sql.replace(/\)(AS)\s+/gi, ') AS ');
        sql = sql.replace(/\)\s*(FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING)\b/gi, (m, kw) => ') ' + kw.toUpperCase());
        sql = sql.replace(/\(\s*SELECT\b/gi, '( SELECT');
        sql = sql.replace(/\s*(<=|>=|<>|!=)\s*/g, ' $1 ');
        sql = sql.replace(/([^<>!= ])(=)([^> ])/g, '$1 = $3');
        sql = sql.replace(/,(?!\s)/g, ', ');
        sql = sql.replace(/\t/g, ' ');
        sql = sql.replace(/[ ]{2,}/g, ' ');
        sql = sql.replace(/[ ]+$/gm, '');
        sql = sql.replace(/;\s*$/, '');
        lineComments.forEach((v, i) => { sql = sql.replace(`__CMT_${i}__`, v); });
        literals.forEach((v, i) => { sql = sql.replace(`__LIT_${i}__`, v); });
        return sql;
    }

    function transform(sql, dateFormat = 'YYYY-MM-DD') {
        if (!sql) return "";
        let result = normalize(sql);
        const rollupPlaceholders = [];
        result = result.replace(/\b(ROLLUP|CUBE|GROUPING\s+SETS)\s*\([\s\S]+?\)/gi, (match) => {
            const key = `__ROLLUP_${rollupPlaceholders.length}__`;
            rollupPlaceholders.push(match);
            return key;
        });
        result = result.replace(/(\bEND|\))AS\b/gi, '$1 AS');
        result = result.replace(/\bNVL\b/gi, 'COALESCE');
        result = result.replace(/\bSYSDATE\b/gi, 'CURRENT_TIMESTAMP');
        result = result.replace(/([a-zA-Z0-9_$#.]+)\.NEXTVAL\b/gi, "nextval('$1')");
        result = result.replace(/\bDELETE\s+(?!FROM\b)([a-zA-Z0-9_$#.]+)/gi, 'DELETE FROM $1');
        result = result.replace(/COALESCE\s*\(\s*(CASE[\s\S]+?END)\s*,\s*(.*?)\s*\)/gi, (match, caseBody, fallback) => `COALESCE((\n${caseBody}\n), ${fallback})`);

        function transformFunctions(text) {
            const funcs = ['TO_CHAR', 'TO_DATE', 'TO_NUMBER', 'LPAD', 'RPAD', 'NVL', 'SUBSTR', 'SUBSTRB', 'MAX', 'SUBSTRING', 'COALESCE', 'DECODE', 'NVL2', 'INSTR', 'TRUNC', 'ADD_MONTHS', 'LAST_DAY', 'GROUPING_ID'];
            function getNextMatch(str) {
                let earliest = null;
                for (const f of funcs) {
                    const regex = new RegExp(`\\b${f}\\s*\\(`, 'gi');
                    const m = regex.exec(str);
                    if (m && (!earliest || m.index < earliest.index)) earliest = { name: f.toUpperCase(), index: m.index, matchLen: m[0].length };
                }
                return earliest;
            }
            function recurse(str) {
                let res = "", curr = str, next;
                while ((next = getNextMatch(curr)) !== null) {
                    res += curr.substring(0, next.index);
                    const openParen = next.index + next.matchLen - 1;
                    const content = getBalancedContent(curr, openParen);
                    if (content === null) { res += curr.substring(next.index); return res; }
                    const transformedContent = recurse(content);
                    const args = splitCsv(transformedContent);
                    let replacement = null;
                    if (next.name === 'TO_CHAR' && args.length === 1) replacement = `TO_CHAR(${args[0].trim()}, 'YYYY-MM-DD HH24:MI:SS')`;
                    else if (next.name === 'TO_DATE' && args.length === 1) replacement = `TO_DATE(${args[0].trim()}, 'YYYYMMDD')`;
                    else if (next.name === 'TO_NUMBER') replacement = `(${transformedContent.trim()})::NUMERIC`;
                    else if (next.name === 'LPAD' || next.name === 'RPAD') {
                        if (args.length > 0) {
                            const arg1 = args[0].trim();
                            const castedArg1 = (!arg1.endsWith('::TEXT') && !arg1.startsWith("'") && !/^\d+$/.test(arg1)) ? `(${arg1})::TEXT` : (/^\d+$/.test(arg1) ? `${arg1}::TEXT` : arg1);
                            replacement = `${next.name}(${[castedArg1, ...args.slice(1).map(a => a.trim())].join(', ')})`;
                        }
                    } else if (next.name === 'NVL') replacement = `COALESCE(${transformedContent})`;
                    else if (next.name === 'DECODE') {
                        if (args.length >= 3) {
                            const col = args[0].trim();
                            let caseStr = "CASE\n";
                            for (let i = 1; i < args.length - 1; i += 2) caseStr += `    WHEN ${col} = ${args[i].trim()} THEN ${args[i + 1].trim()}\n`;
                            if (args.length % 2 === 0) caseStr += `    ELSE ${args[args.length - 1].trim()}\n`;
                            caseStr += " END"; replacement = caseStr;
                        }
                    } else if (next.name === 'NVL2') {
                        if (args.length === 3) replacement = `CASE\n    WHEN ${args[0].trim()} IS NOT NULL THEN ${args[1].trim()}\n    ELSE ${args[2].trim()}\n END`;
                    } else if (next.name === 'SUBSTRB') replacement = `substrb(${transformedContent})`;
                    else if (next.name === 'INSTR') {
                        const iArgs = splitCsv(transformedContent);
                        if (iArgs.length === 2 || (iArgs.length === 3 && iArgs[2].trim() === '1')) replacement = `STRPOS(${iArgs[0].trim()}, ${iArgs[1].trim()})`;
                        else if (iArgs.length === 3) replacement = `STRPOS(SUBSTRING(${iArgs[0].trim()} FROM ${iArgs[2].trim()}), ${iArgs[1].trim()})`;
                        else replacement = `instr(${transformedContent})`;
                    } else if (next.name === 'TRUNC') {
                        if (args.length === 1) replacement = `DATE_TRUNC('day', ${args[0].trim()})`;
                        else {
                            const fmtMap = { "'MM'": 'month', "'YYYY'": 'year', "'DD'": 'day', "'HH'": 'hour' };
                            replacement = `DATE_TRUNC('${fmtMap[args[1].trim().toUpperCase()] || 'day'}', ${args[0].trim()})`;
                        }
                    } else if (next.name === 'ADD_MONTHS' && args.length === 2) {
                        const n = args[1].trim();
                        replacement = `(${args[0].trim()} ${n.startsWith('-') ? '-' : '+'} INTERVAL '${n.replace('-', '')} months')`;
                    } else if (next.name === 'LAST_DAY' && args.length === 1) replacement = `(DATE_TRUNC('month', ${args[0].trim()}) + INTERVAL '1 month' - INTERVAL '1 day')`;
                    else if (next.name === 'GROUPING_ID') {
                        if (args.length > 0) {
                            replacement = args.map((arg, idx) => `GROUPING(${arg.trim()}) * ${Math.pow(2, args.length - 1 - idx)}`).join(' + ');
                        }
                    }
                    if (replacement === null) replacement = `${next.name}(${transformedContent})`;
                    res += replacement;
                    curr = curr.substring(openParen + content.length + 2);
                }
                res += curr; return res;
            }
            return recurse(text);
        }

        result = transformFunctions(result);
        const hasConnectByRownum = /FROM\s+DUAL\s+CONNECT\s+BY\s+(?:LEVEL|ROWNUM)\s*<=/i.test(result);
        let hasRownumLimit = false, rownumLimitVal = 1;
        if (!hasConnectByRownum) {
            if (/\bROWNUM\s*=\s*1\b/i.test(result)) {
                result = result.replace(/\s+AND\s+ROWNUM\s*=\s*1\b/gi, '').replace(/\bWHERE\s+ROWNUM\s*=\s*1\b/gi, 'WHERE 1=1');
                hasRownumLimit = true; rownumLimitVal = 1;
            }
            const rownumLteMatch = result.match(/\bROWNUM\s*(<=?)\s*(\d+)\b/i);
            if (rownumLteMatch) {
                const n = parseInt(rownumLteMatch[2]);
                rownumLimitVal = (rownumLteMatch[1] === '<') ? n - 1 : n;
                result = result.replace(/\s+AND\s+ROWNUM\s*<=?\s*\d+\b/gi, '').replace(/\bWHERE\s+ROWNUM\s*<=?\s*\d+\b/gi, 'WHERE 1=1');
                hasRownumLimit = true;
            }
        }
        result = result.replace(/(\?)\s*\|\|/g, '($1)::TEXT ||').replace(/\|\|\s*(\?)/g, '|| ($1)::TEXT');
        result = result.replace(/\.DATE\b/gi, '."DATE"').replace(/\bDATE\s*=/gi, '"DATE" =');
        result = result.replace(/(\(\s*grouping\s*\([^)]+\)\))\s*(=|!=|<>)\s*'(\d+)'/gi, '$1::TEXT $2 \'$3\'');
        result = result.replace(/\bGROUPING\s*\([^)]+\)\s*(=|!=|<>)\s*'(\d+)'/gi, (match, op, num) => match.replace(`'${num}'`, num));
        const connectByRegex = /SELECT\s+([\s\S]+?)\s+FROM\s+DUAL\s+CONNECT\s+BY\s+(?:LEVEL|ROWNUM)\s*<=\s*([\s\S]+)/gi;
        result = result.replace(connectByRegex, (match, selectList, rest) => {
            let limit = "", depth = 0, foundEnd = false, remainder = "";
            for (let i = 0; i < rest.length; i++) {
                if (rest[i] === '(') depth++;
                else if (rest[i] === ')') { if (depth === 0) { limit = rest.substring(0, i); remainder = rest.substring(i); foundEnd = true; break; } depth--; }
            }
            if (!foundEnd) limit = rest;
            let transformedSelect = selectList.replace(/(^|[^a-zA-Z0-9_$])(LEVEL|ROWNUM)\b/gi, (m, prefix, ident) => (selectList.substring(0, selectList.indexOf(m)).trim().toLowerCase().endsWith(' as')) ? m : prefix + 'gs');
            if (['level', 'rownum'].includes(selectList.trim().toLowerCase())) transformedSelect = `gs AS ${selectList.trim().toLowerCase()}`;
            return `SELECT ${transformedSelect.trim()} FROM generate_series(1, ${limit.trim()}) gs${remainder}`;
        });
        result = result.replace(/\s+FROM\s+DUAL\b/gi, '');
        result = convertToAnsiJoin(result);
        let newResult = "", lastIdx = 0;
        for (let i = 0; i < result.length; i++) {
            if (result[i] === '(') {
                const content = getBalancedContent(result, i);
                if (content && /^\s*SELECT\b/i.test(content.trim())) {
                    newResult += result.substring(lastIdx, i) + `( ${transform(content.trim())} )`;
                    i += content.length + 1; lastIdx = i + 1;
                }
            }
        }
        result = newResult + result.substring(lastIdx);
        if (hasRownumLimit && !/\bLIMIT\b/i.test(result)) result += `\n LIMIT ${rownumLimitVal}`;
        rollupPlaceholders.forEach((val, idx) => { result = result.replace(`__ROLLUP_${idx}__`, val); });
        if (/UPDATE\s+(\w+)\s+(\w+)\s+SET/i.test(result)) {
            result = result.replace(/UPDATE\s+(\w+)\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE/i, (match, table, alias, sets) => `UPDATE ${table} ${alias} SET ${sets.replace(new RegExp(`${alias}\\.`, 'g'), '')} WHERE`);
        }
        return result;
    }

    function getBalancedContent(str, startIdx) {
        let depth = 0;
        for (let i = startIdx + 1; i < str.length; i++) {
            if (str[i] === '(') depth++;
            else if (str[i] === ')') { if (depth === 0) return str.substring(startIdx + 1, i); depth--; }
        }
        return null;
    }

    function convertToAnsiJoin(sql) {
        const segments = []; let lastIdx = 0, depth = 0, inQuote = false;
        for (let i = 0; i < sql.length; i++) {
            const char = sql[i];
            if (char === "'" && sql[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) {
                if (char === "(") depth++; else if (char === ")") depth--;
                else if (depth === 0) {
                    const m = sql.substring(i).match(/^(\bUNION\b(?:\s+ALL)?)/i);
                    if (m) { segments.push(sql.substring(lastIdx, i), m[0]); i += m[0].length; lastIdx = i; }
                }
            }
        }
        segments.push(sql.substring(lastIdx));
        return segments.length > 1 ? segments.map(seg => /^UNION\b/i.test(seg.trim()) ? seg : processSingleQueryJoin(seg)).join('') : processSingleQueryJoin(sql);
    }

    function processSingleQueryJoin(sql) {
        if (!sql) return "";
        const fromIdx = findTopLevelKeyword(sql, "FROM"); if (fromIdx === -1) return sql;
        const footers = ["GROUP BY", "ORDER BY", "HAVING", "LIMIT"];
        let footerIdx = -1;
        for (const f of footers) { const idx = findTopLevelKeyword(sql, f); if (idx !== -1 && (footerIdx === -1 || idx < footerIdx)) footerIdx = idx; }
        let footer = footerIdx !== -1 ? sql.substring(footerIdx) : "";
        let workingSql = footerIdx !== -1 ? sql.substring(0, footerIdx) : sql;
        let whereIdx = findTopLevelKeyword(workingSql, "WHERE");
        let fromClause = whereIdx !== -1 ? workingSql.substring(fromIdx + 4, whereIdx).trim() : workingSql.substring(fromIdx + 4).trim();
        let whereClause = whereIdx !== -1 ? workingSql.substring(whereIdx + 5).trim() : "";
        const tables = splitFromClause(fromClause);
        if (tables.length < 2 && !/\(\+\)/i.test(whereClause) && !tables.some(t => t.trim().startsWith('('))) return sql;
        const conditions = whereClause ? splitConditions(whereClause) : [];
        const joinStates = tables.map(t => {
            let cleanT = t.replace(/(--.*|\/\*[\s\S]*?\*\/)/g, '').trim();
            let alias = getTableAlias(cleanT);
            if (cleanT.startsWith('(')) {
                const sub = getBalancedContent(cleanT, 0);
                if (sub) {
                    const transformedSub = transform(sub.trim());
                    // extract alias correctly
                    const lastParenIdx = cleanT.lastIndexOf(')');
                    let extractedAlias = cleanT.substring(lastParenIdx + 1).trim().split(/\s+/).shift(); // Use shift to get the first part after )
                    if (!extractedAlias || /^(FROM|JOIN|WHERE|GROUP|ORDER|HAVING|LIMIT|ON|AND|OR|AS)$/i.test(extractedAlias)) {
                        extractedAlias = alias || "sub";
                    }
                    cleanT = `( ${transformedSub} ) AS ${extractedAlias}`;
                    alias = extractedAlias;
                }
            }
            return { raw: cleanT, alias: alias, joined: false, on: [], type: 'JOIN' };
        });
        joinStates[0].joined = true; const processed = new Set([joinStates[0].alias]), otherWhere = [];
        conditions.forEach(c => {
            let clean = c.replace(/\(\+\)/g, ''), aliases = (clean.match(/\b[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\b/g) || []).map(a => a.split('.')[0]).filter((v, i, a) => a.indexOf(v) === i);
            otherWhere.push({ cond: clean, isJoin: /\(\+\)/.test(c), aliases: aliases });
        });
        let changed = true, newFrom = joinStates[0].raw;
        while (changed) {
            changed = false;
            for (let i = 1; i < joinStates.length; i++) {
                const s = joinStates[i]; if (s.joined) continue;
                let idx = otherWhere.findIndex(ow => ow.isJoin && ow.aliases.includes(s.alias) && ow.aliases.some(a => a !== s.alias && processed.has(a)));
                let jType = 'LEFT JOIN';
                if (idx === -1) { idx = otherWhere.findIndex(ow => !ow.isJoin && ow.aliases.includes(s.alias) && ow.aliases.some(a => a !== s.alias && processed.has(a))); jType = 'JOIN'; }
                if (idx !== -1) {
                    const m = otherWhere.splice(idx, 1)[0]; s.joined = true; s.type = jType; s.on.push(m.cond); processed.add(s.alias);
                    for (let j = 0; j < otherWhere.length; j++) { if (otherWhere[j].aliases.includes(s.alias) && otherWhere[j].aliases.every(a => processed.has(a))) { const owm = otherWhere.splice(j, 1)[0]; if (!['1 = 1', '1=1'].includes(owm.cond.trim())) s.on.push(owm.cond); j--; } }
                    newFrom += `\n ${s.type} ${s.raw}\n  ON ${s.on.sort((a, b) => (b.includes('.') ? 1 : 0) - (a.includes('.') ? 1 : 0)).join('\n AND ')}`;
                    changed = true; break;
                }
            }
        }
        joinStates.forEach(s => { if (!s.joined) newFrom += ` , ${s.raw}`; });
        let result = sql.substring(0, fromIdx + 4) + ' ' + newFrom;
        if (otherWhere.length > 0) result += '\n WHERE ' + otherWhere.map(ow => ow.cond).join('\n   AND ');
        if (footer) result += '\n' + footer;
        return result;
    }

    function splitConditions(where) {
        const result = []; let current = "", depth = 0, inQuote = false, i = 0;
        while (i < where.length) {
            const char = where[i];
            if (char === "'" && where[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) {
                if (char === "(") depth++; else if (char === ")") depth--;
                else if (depth === 0) {
                    const bm = where.substring(i).match(/^BETWEEN\s+[\s\S]+?\s+AND\s+[\s\S]+?(?=\s+AND|\s*$)/i);
                    if (bm) { current += bm[0]; i += bm[0].length; continue; }
                    if (/^AND\s/i.test(where.substring(i)) && i > 0 && /\s/.test(where[i - 1])) { result.push(current.trim()); current = ""; i += 4; continue; }
                }
            }
            current += char; i++;
        }
        if (current.trim()) result.push(current.trim());
        return result.filter(Boolean);
    }

    function findTopLevelKeyword(sql, kw) {
        let depth = 0, inQuote = false; const kwLen = kw.length;
        for (let i = 0; i <= sql.length - kwLen; i++) {
            const char = sql[i];
            if (char === "'" && sql[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) {
                if (char === "(") depth++; else if (char === ")") depth--;
                else if (depth === 0 && sql.substring(i, i + kwLen).toUpperCase() === kw.toUpperCase()) {
                    const prev = i > 0 ? sql[i - 1] : " ", next = i + kwLen < sql.length ? sql[i + kwLen] : " ";
                    if (/[^a-zA-Z0-9_$#]/.test(prev) && [undefined, " ", "(", "\n", "\t", "\r"].includes(next) || /[^a-zA-Z0-9_$#]/.test(next)) return i;
                }
            }
        }
        return -1;
    }

    function getTableAlias(t) {
        const clean = t.replace(/(--.*|\/\*[\s\S]*?\*\/)/g, '').trim();
        if (clean.startsWith('(')) {
            const last = clean.lastIndexOf(')');
            const trailer = clean.substring(last + 1).trim();
            return trailer ? trailer.split(/\s+/).pop() : "";
        }
        const parts = clean.split(/\s+/).filter(Boolean);
        const last = parts.pop();
        if (!last) return "";
        if (last.includes('.') || last.includes('(') || last.includes(')') || last.includes('=') || /^(FROM|JOIN|WHERE|GROUP|ORDER|HAVING|LIMIT|ON|AND|OR|AS|SELECT|DELETE|UPDATE|INSERT|SET|INTO|VALUES)$/i.test(last)) return "";
        if (/^\d+$/.test(last)) return ""; // Ignore numeric "aliases" which are likely part of conditions
        return last;
    }

    function splitCsv(str) {
        const result = []; let current = "", depth = 0, inQuote = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === "'" && str[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) { if (char === "(") depth++; else if (char === ")") depth--; else if (char === "," && depth === 0) { result.push(current); current = ""; continue; } }
            current += char;
        }
        result.push(current); return result;
    }

    function splitFromClause(fromStr) {
        const result = []; let current = "", depth = 0, inQuote = false;
        for (let i = 0; i < fromStr.length; i++) {
            const char = fromStr[i];
            if (char === "'" && fromStr[i - 1] !== "\\") inQuote = !inQuote;
            if (!inQuote) { if (char === "(") depth++; else if (char === ")") depth--; else if (char === "," && depth === 0) { result.push(current.trim()); current = ""; continue; } }
            current += char;
        }
        if (current.trim()) result.push(current.trim()); return result.filter(Boolean);
    }

    const Parser = {
        extract: function (src) {
            if (!src) return "";
            const lines = src.split('\n'), result = [];
            let inBlock = false;

            lines.forEach(line => {
                let current = line;
                if (inBlock) {
                    if (current.includes('*/')) {
                        inBlock = false;
                        current = current.substring(current.indexOf('*/') + 2);
                    } else return;
                }
                if (current.includes('/*')) {
                    if (current.includes('*/')) {
                        current = current.replace(/\/\*[\s\S]*?\*\//g, '');
                    } else {
                        inBlock = true;
                        current = current.substring(0, current.indexOf('/*'));
                    }
                }

                const m = [], regex = /"((?:[^"\\]|\\.)*)"/g;
                let match;
                while ((match = regex.exec(current)) !== null) {
                    let s = match[1].replace(/\\n/g, '').replace(/\\r/g, '').replace(/\\"/g, '"');
                    // SQL 주석 제거 (Pure Syntax 추출)
                    s = s.replace(/\/\*[\s\S]*?\*\//g, '');
                    s = s.replace(/--[^\n]*/g, '');
                    if (s.trim()) m.push(s);
                }

                if (m.length > 0) {
                    result.push(m.join(' '));
                } else {
                    const cleanLine = current.replace(/\/\/.*/, '').trim();
                    if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|GRANT|ALTER|DROP|TRUNCATE)\b/i.test(cleanLine)) {
                        result.push(cleanLine.replace(/--.*/, '').trim());
                    }
                }
            });
            return result.join('\n');
        },
        restoreAsTextBlock: function (javaIn, pgSql) {
            if (!javaIn || !pgSql) return "";
            const srcLines = javaIn.split('\n'), pgLines = pgSql.split('\n'), sourceMap = [];

            srcLines.forEach(l => {
                const tr = l.trim();
                if (tr.includes('"') || tr.includes("'") ||
                    /^\.(append|plus|appendLine)/i.test(tr) ||
                    /^[a-zA-Z0-9_$]+\.(append|plus)/i.test(tr) ||
                    /^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|GRANT|ALTER|DROP|TRUNCATE)\b/i.test(tr)) {

                    let comments = [];
                    const blocks = tr.match(/\/\*[\s\S]*?\*\//g) || [];
                    let temp = tr.replace(/\/\*[\s\S]*?\*\//g, ' ');
                    const lines = temp.match(/(\/\/.*|--.*)/g) || [];

                    const cleanLines = lines.map(c => {
                        return c.replace(/(\\n|\\r|[\r\n]|"\);?).*$/, '').trim();
                    }).filter(Boolean);

                    // 주석 기호 제거 및 텍스트만 추출
                    const allRaw = [...blocks, ...cleanLines].map(c => {
                        return c.replace(/^(\/\/|--|\/\*)/, '').replace(/\*\/$/, '').trim();
                    }).filter(Boolean);

                    sourceMap.push({
                        line: tr,
                        comments: allRaw.join(' ')
                    });
                }
            });

            let res = 'String sql = """\n';
            let srcIdx = 0;
            pgLines.forEach((l, i) => {
                let currentMapping = sourceMap[srcIdx] || { line: "", comments: "" };
                if (currentMapping.comments) {
                    res += `${l.padEnd(80)} -- ${currentMapping.comments}\n`;
                } else {
                    res += `${l}\n`;
                }

                if (i < pgLines.length - 1) {
                    const nextPg = pgLines[i + 1].trim();
                    // Expansion list: CASE keywords AND Join keywords
                    const isExpansion = /^(WHEN|THEN|ELSE|END|JOIN|ON|LEFT|RIGHT|INNER|OUTER|OFFSET|LIMIT)\b/i.test(nextPg);
                    if (!isExpansion) {
                        srcIdx++;
                    }
                }
            });
            return res + '""";';
        }
    };

    function format(sql) {
        if (!sql) return "";
        let res = sql.replace(/\s+/g, ' ').trim();
        const keywords = [
            "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT",
            "INSERT INTO", "UPDATE", "DELETE", "SET", "VALUES", "UNION ALL", "UNION",
            "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN", "CROSS JOIN", "JOIN",
            "ON", "AND", "OR", "WHEN", "THEN", "ELSE", "END", "WITH"
        ];

        // Replace keywords with newline version using a single pass to avoid splitting
        const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
        res = res.replace(kwRegex, (m) => '\n' + m.toUpperCase());

        // Add newline before leading commas in SELECT list (simplified pattern)
        res = res.replace(/,\s*(?=[a-zA-Z0-9_$#.]+)/g, '\n, ');

        const lines = res.split('\n');
        let indent = 0;
        return lines.map(line => {
            let tr = line.trim();
            if (!tr) return null;
            if (tr.match(/^\)/) || tr.match(/^END\b/i)) indent = Math.max(0, indent - 1);
            let spaces = "    ".repeat(indent);
            if (tr.match(/\($/) || tr.match(/^SELECT\b/i) || tr.match(/^CASE\b/i)) indent++;
            if (tr.match(/^(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|UNION|INSERT|UPDATE|DELETE)\b/i)) {
                // Main keywords are slightly less indented or reset indent? 
                // Let's keep them at current level but reset sub-indent
            }
            return spaces + tr;
        }).filter(l => l !== null).join('\n');
    }

    return { normalize, transform, extract: Parser.extract, restoreAsTextBlock: Parser.restoreAsTextBlock, format };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = OracleToPG;
