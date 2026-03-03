# OracleToPG Utility 기술 가이드 (`oracle_to_pgsql.js`)

본 문서는 `oracle_to_pgsql.js` 라이브러리의 내부 구조, 설계 철학 및 핵심 변환 로직에 대해 설명합니다.

---

## 1. 개요 및 설계 철학

`oracle_to_pgsql.js`는 Oracle 19c 문법을 PostgreSQL 18 환경으로 변환하기 위한 경량 JavaScript 유틸리티입니다. 

- **오프라인 우선**: 외부 라이브러리(jQuery, Lodash 등)에 의존하지 않는 순수 자바스크립트(Vanilla JS)로 작성되었습니다.
- **모듈화 (IIFE)**: `jquery.min.js`와 유사하게 **즉시 실행 함수 표현식(IIFE)**을 사용하여 전역 변수 오염을 방지하고 독립적인 네임스페이스(`OracleToPG`)를 제공합니다.
- **정규표현식 기반 엔진**: 복잡한 구문 분석 대신 고도로 최적화된 정규표현식(Regex)을 사용하여 변환 속도를 극대화했습니다.

---

## 2. 내부 구조 및 컴포넌트

라이브러리는 크게 세 가지 내부 컴포넌트로 구성됩니다.

### 2.1 네임스페이스 패턴
```javascript
const OracleToPG = (function() {
    'use strict';
    // 내부 로직...
    return {
        transform: transform,
        extract: Parser.extract,
        detectStyle: Parser.detectStyle,
        wrap: Parser.wrap
    };
})();
```
공개 메서드만을 외부로 노출하여 내부 헬퍼 함수(`splitCsv` 등)에 대한 접근을 제한합니다.

### 2.2 SQL 변환 엔진 (`transform`)
`transform` 함수는 문자열 파이프라인 방식을 사용합니다. 입력된 SQL 문자열에 대해 약 15단계 이상의 정규표현식 치환 작업을 순차적으로 수행합니다.

- **핵심 로직**:
    - 대소문자 구분 없는 글로벌 매칭(`gi`)을 통한 키워드 치환.
    - 캡처 그룹(Parentheses)을 활용한 함수 인자 보존 및 재배치.
    - **중첩된 문법 처리**: `DECODE`와 같은 중첩 가능한 문법은 `while` 루프와 전용 파서(`splitCsv`)를 결합하여 해결합니다.

### 2.3 Java 소스 파서 (`Parser`)
Java 코드 내의 SQL을 추출하고 다시 래핑하는 역할을 담당합니다.

- **`extract`**: 정규표현식을 통해 쌍따옴표(`"..."`) 내부의 SQL 내용만 필터링하여 불필요한 이스케이프 문자를 제거합니다.
- **`detectStyle`**: 소스 코드를 분석하여 사용자가 `StringBuilder.append()`를 사용하는지, 혹은 변수 할당(`+=`)을 사용하고 있는지 자동으로 스타일을 감지합니다.
- **`wrap`**: 감지된 스타일에 맞춰 변환된 SQL을 다시 Java 코드로 재조립합니다.

---

## 3. 주요 알고리즘 설명

### 3.1 DECODE 재귀적 처리
`DECODE` 함수는 가변 인자를 가지며 중첩될 수 있습니다. 
1. `decodeRegex`로 가장 바깥쪽 `DECODE`를 찾습니다.
2. 내부 인자들을 `splitCsv` 함수(괄호 깊이를 추적하는 커스텀 로직)로 분리합니다.
3. 이를 `CASE WHEN ... THEN` 구조로 재구성합니다.
4. 더 이상 `DECODE`가 발견되지 않을 때까지 반복합니다.

### 3.2 Join (+) 구문 감지
오라클의 `(+)` 조인은 복잡한 파싱이 필요하지만, 이 라이브러리는 **"개발자 보조"**에 초점을 맞춥니다.
- `A.ID = B.ID(+)` 패턴 발견 시, 해당 테이블명을 추출하여 `/* ANSI: JOIN B ON ... */` 주석을 자동으로 삽입하여 ANSI 조인으로의 변경을 가이드합니다.

---

## 4. 확장 방법

새로운 변환 규칙을 추가하려면 `transform` 내부의 `res = res.replace(...)` 체인에 새로운 정규표현식 규칙을 추가하면 됩니다. 

```javascript
// 예: 새로운 함수 변환 추가
res = res.replace(/NEW_FUNC\(([^)]+)\)/gi, 'PG_FUNC($1)');
```

---

이 라이브러리는 가볍고 빠르며, 오프라인 환경에서 개발자가 수동으로 수행해야 했던 반복적인 변환 작업을 지능적으로 자동화하는 데 목적이 있습니다.
