# SQL Extractor Test Cases

본 문서는 Java 코드 내에서 SQL을 추출할 때 발생할 수 있는 복잡한 주석 상황들을 테스트하기 위한 샘플 모음입니다.

---

## 🧪 Test Case 1: 복잡한 Java 주석 (Nested Comments)

Java의 멀티라인 주석(`/* */`)과 싱글라인 주석(`//`)이 섞여 있는 경우입니다. 주석 처리된 `append`는 무시되고 실제 실행되는 코드만 추출되어야 합니다.

### Input (Java Source)
```java

StringBuilder query = new StringBuilder();
/*
query.append("SELECT EMP_ID, EMP_NAME "); /**/ //
*/
//query.append("SELECT EMP_ID, EMP_NAME ");
/* SELECT EMP_ID, EMP_NAME */
query.append( " SELECT EMP_ID, EMP_NAME "); /**/ //
```

### Expected Output (Oracle SQL)
```sql
SELECT EMP_ID, EMP_NAME
```

---

## 🧪 Test Case 2: 체이닝 및 SQL 주석 포함

`.append()`가 줄바꿈으로 연결되어 있고, 문자열 내부에 Oracle SQL 주석(`--`, `/* */`)이 포함된 경우입니다.

### Input (Java Source)
```java
@case2
StringBuilder query = new StringBuilder().
append("SELECT EMP_ID, EMP_NAME -- "). /**/
append("AND SALARY > 5000 /**/ "); //

query.append("FROM EMPLOYEES -- 직원 테이블 조회 ")
     .append("WHERE DEPT_ID = '10' /* 기획부서 */ ")
     .append("AND SALARY > 5000;");
```

### Expected Output (Oracle SQL)
```sql
SELECT EMP_ID, EMP_NAME -- 
AND SALARY > 5000 /**/ 
FROM EMPLOYEES -- 직원 테이블 조회 
WHERE DEPT_ID = '10' /* 기획부서 */ 
AND SALARY > 5000;
```

---

## 🧪 Test Case 3: MERGE INTO (Oracle Specific)

Oracle 전용 구문인 `MERGE INTO`와 한글 주석이 섞인 케이스입니다.

### Input (Java Source)
```java
sb.append("MERGE INTO MEMBER_T T ")
  .append("USING (SELECT 'M001' AS ID FROM DUAL) S ")
  .append("ON (T.MEM_ID = S.ID) ")
  .append("WHEN MATCHED THEN ")
  .append("    UPDATE SET T.LAST_LOGIN = SYSDATE ")
  .append("WHEN NOT MATCHED THEN ")
  .append("    INSERT (MEM_ID, REG_DT) VALUES (S.ID, SYSDATE); -- MERGE 문 검증");
```

### Expected Output (Oracle SQL)
```sql
MERGE INTO MEMBER_T T 
USING (SELECT 'M001' AS ID FROM DUAL) S 
ON (T.MEM_ID = S.ID) 
WHEN MATCHED THEN 
    UPDATE SET T.LAST_LOGIN = SYSDATE 
WHEN NOT MATCHED THEN 
    INSERT (MEM_ID, REG_DT) VALUES (S.ID, SYSDATE); -- MERGE 문 검증
```

---

## ✅ 확인 방법
1. 위의 **Input** 코드를 복사합니다.
2. 실행 중인 대시보드의 **Java Source Code** (오른쪽 패널) 영역에 붙여넣습니다.
3. 왼쪽 패널의 결과가 **Expected Output**과 일치하는지 확인합니다.
