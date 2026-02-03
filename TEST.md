# SQL Extractor 4-Area Workflow Test

이 문서는 새롭게 구현된 4단계 워크플로우(Input -> Extraction -> ANSI -> Final)를 검증하기 위한 가이드입니다.

---

## 🛠 워크플로우 단계
1. **Area 1 (Input)**: 원본 Java 코드를 붙여넣습니다. (주석 포함 가능)
2. **Area 2 (Extraction)**: Java 주석이 `/*@ ... */` 마커로 자동 변환되어 SQL과 함께 표시됩니다.
3. **Area 3 (ANSI)**: Area 2의 내용을 복사하여 붙여넣습니다. (실제 환경에서는 여기서 ANSI 쿼리로 변환을 수행합니다.)
4. **Area 4 (Final)**: 상단의 **"최종 결과 생성"** 버튼을 누르면 원래의 Java 스타일로 다시 래핑됩니다.

---

## 🧪 테스트 케이스 1-4 (User Cases)

### Input (Area 1)
```java
// Case 1 & 2 혼합
StringBuilder query = new StringBuilder();
/*
query.append("SELECT EMP_ID, EMP_NAME "); /**/ //
*/
//상수처리
query.append(" select * \n "); /* 처리 */
query.append(" from tab1, tab2 \n"); //처리

// Case 3 & 4 (Dot Chaining)
append(" select * \n ").
append(" from tab1 \n ").
// 조건입력
append(" where 1=1 --주석 \n ").
append(" and tab1.a = 'text' --주석 \n "); // 2025후 반영
```

### Expected Flow Verification
- **Area 2**에서 `/*<@ ... @>*/`로 감싸진 블록 주석과 `/*@ //... */`로 변환된 한 줄 주석이 보이는지 확인하세요.
- **Area 3**에 내용을 그대로 넣고 **"최종 결과 생성"**을 눌렀을 때, 원래의 `query.append` 또는 `.append()` 스타일이 유지되는지 확인하세요.
- 마지막 라인에 `;`가 올바르게 붙는지 확인하세요.
