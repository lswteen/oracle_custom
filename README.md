# Java to Oracle SQL Extractor

Java 소스 코드 내의 `.append()` 패턴에서 SQL 쿼리만을 완벽하게 추출해주는 대시보드 도구입니다.

## 🚀 주요 기능
- **자동 추출**: `.append("...")` 부분을 찾아 내부 문자열만 추출합니다.
- **Oracle 최적화**: Oracle 주석(`--`, `/* */`), 한글 데이터, `MERGE INTO`, `ROW_NUMBER()` 등을 완벽 보존합니다.
- **클린 출력**: Java의 이스케이프 문자(`\"`, `\n` 등)를 실제 문자로 변환하여 온전한 SQL을 만듭니다.

## 🧪 검증 샘플 및 결과 예시 (Oracle)

### 1. 입력 (Java Source)
```java
StringBuilder query = new StringBuilder();
query.append("SELECT EMP_ID, EMP_NAME ")
     .append("FROM EMPLOYEES -- 직원 테이블 조회 ")
     .append("WHERE DEPT_ID = '10' /* 기획부서 */ ")
     .append("AND SALARY > 5000;");
```

### 2. 출력 (Extracted Oracle SQL)
```sql
SELECT EMP_ID, EMP_NAME 
FROM EMPLOYEES -- 직원 테이블 조회 
WHERE DEPT_ID = '10' /* 기획부서 */ 
AND SALARY > 5000;
```

## 🛠 사용 방법
1. `index.html` 파일을 브라우저로 엽니다.
2. 오른쪽 **Java Source Code** 섹션에 코드를 붙여넣습니다.
3. 왼쪽 **Extracted Query** 섹션에서 `append`가 제거된 온전한 SQL을 확인합니다.
4. **Copy to Clipboard** 버튼으로 결과를 복사합니다.

## 📂 프로젝트 구조
- `index.html`: 대시보드 구조 및 레이아웃
- `style.css`: 프리미엄 다크 모드 및 Glassmorphism 디자인
- `script.js`: 정규식 기반 SQL 추출 로직 및 샘플 데이터
