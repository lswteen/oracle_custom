document.addEventListener('DOMContentLoaded', () => {
    const inputCode = document.getElementById('inputCode');
    const outputCode = document.getElementById('outputCode').querySelector('code');
    const copyBtn = document.getElementById('copyBtn');
    const loadSampleBtn = document.getElementById('loadSampleBtn');

    // Extraction Logic
    const extractSQL = (javaCode) => {
        if (!javaCode) return '-- 추출된 SQL이 여기에 표시됩니다.';

        // 1. Remove Java Multi-line comments /* ... */
        let liveCode = javaCode.replace(/\/\*[\s\S]*?\*\//g, "");

        // 2. Remove Java Single-line comments // ...
        // We carefully skip comments inside strings
        const lines = liveCode.split('\n');
        liveCode = lines.map(line => {
            let inQuote = false;
            let strippedLine = "";
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"' && (i === 0 || line[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                }
                if (!inQuote && line[i] === '/' && line[i + 1] === '/') {
                    break;
                }
                strippedLine += line[i];
            }
            return strippedLine;
        }).join('\n');

        // 3. Extract .append("...") patterns
        const appendRegex = /\.append\s*\(\s*"(.*?)"\s*\)/gs;
        let match;
        let result = [];
        let foundAppend = false;

        while ((match = appendRegex.exec(liveCode)) !== null) {
            foundAppend = true;
            let content = match[1];

            // Unescape Java characters
            content = content
                .replace(/\\"/g, '"')
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\r/g, '\r');

            result.push(content);
        }

        // 4. Fallback for general String literals (if no .append() found)
        if (!foundAppend) {
            const stringRegex = /"(.*?)"/g;
            while ((match = stringRegex.exec(liveCode)) !== null) {
                let content = match[1];
                if (content.trim().length > 3) {
                    result.push(content.replace(/\\"/g, '"'));
                }
            }
        }

        return result.map(line => line.trimEnd()).join('\n').trim();
    };

    // Live update
    inputCode.addEventListener('input', () => {
        const extracted = extractSQL(inputCode.value);
        outputCode.textContent = extracted;
    });

    // Copy to clipboard
    copyBtn.addEventListener('click', () => {
        const text = outputCode.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '복사 완료!';
            copyBtn.classList.add('success');
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.classList.remove('success');
            }, 2000);
        });
    });

    // Sample Data
    const samples = [
        `@case1
StringBuilder query = new StringBuilder();
/*
query.append("SELECT EMP_ID, EMP_NAME "); /**/ //
*/
//query.append("SELECT EMP_ID, EMP_NAME ");
/* SELECT EMP_ID, EMP_NAME */
query.append( " SELECT EMP_ID, EMP_NAME "); /**/ //`,

        `@case2
StringBuilder query = new StringBuilder().
append("SELECT EMP_ID, EMP_NAME -- "). /**/
append("AND SALARY > 5000 /**/ "); //

query.append("FROM EMPLOYEES -- 직원 테이블 조회 ")
     .append("WHERE DEPT_ID = '10' /* 기획부서 */ ")
     .append("AND SALARY > 5000;");`,

        `// Case 3: Merge Into (Oracle Specific)
sb.append("MERGE INTO MEMBER_T T ")
  .append("USING (SELECT 'M001' AS ID FROM DUAL) S ")
  .append("ON (T.MEM_ID = S.ID) ")
  .append("WHEN MATCHED THEN ")
  .append("    UPDATE SET T.LAST_LOGIN = SYSDATE ")
  .append("WHEN NOT MATCHED THEN ")
  .append("    INSERT (MEM_ID, REG_DT) VALUES (S.ID, SYSDATE); -- MERGE 문 검증");`,

        `// Case 4: Complex Oracle Paging Query
query.append("SELECT * ")
     .append("FROM ( ")
     .append("    SELECT ")
     .append("        ROW_NUMBER() OVER(ORDER BY REG_DT DESC) AS RNUM, ")
     .append("        TITLE, ")
     .append("        WRITER ")
     .append("    FROM BOARD_DATA /* Oracle ROW_NUMBER 활용 */ ")
     .append(") ")
     .append("WHERE RNUM BETWEEN 1 AND 10;");`,

        `// Case 5: Simple String append (sql += "...")
String sql = "";
sql += "INSERT INTO USER_LOG (USER_ID, LOG_DATE, ACTION_MSG) ";
sql += "VALUES ('ADMIN', SYSDATE, '로그인 성공'); -- 한글 메시지 처리";`
    ];

    let currentSampleIdx = 0;
    loadSampleBtn.addEventListener('click', () => {
        inputCode.value = samples[currentSampleIdx];
        inputCode.dispatchEvent(new Event('input'));
        currentSampleIdx = (currentSampleIdx + 1) % samples.length;
    });
});
