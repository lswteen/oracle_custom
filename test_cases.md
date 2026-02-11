# SQL Tool Test Cases (Case 1 - 4)

This file contains standardized test cases for the SQL Converter Tool. Use these to verify extraction and re-wrapping logic.

---

## Case 1: Standalone `a.append` with Mixed Comments

### [INPUT AREA]
```java
/*
a.append(" select * \n ");
a.append(" from tab1 \n "); //처리
a.append(" where 1=1 --주석 \n "); //처리
a.append(" and tab1.a = 'text' --주석 \n "); //사용안함
*/
//상수처리
a.append(" select * \n "); /* 처리 */
a.append(" from tab1, tab2 \n"); //처리
a.append(" where 1=1 --주석 \n"); //처리
a.append(" and tab1.a = tab2.a --주석 \n "); //사용
```

### [FIRST AREA] (1차 결과값)
```sql
/*<@
a.append(" select * \n ");
a.append(" from tab1 \n "); //처리
a.append(" where 1=1 --주석 \n "); //처리
a.append(" and tab1.a = 'text' --주석 \n "); //사용안함
@>*/
/*@ //상수처리 */
 select * /*@@ 처리 */
 from tab1, tab2 /*@ //처리 */
 where 1=1 --주석 /*@ //처리 */
 and tab1.a = tab2.a --주석  /*@ //사용 */
```

### [RESULT AREA] (1차 최종값)
```java
/*
a.append(" select * \n ");
a.append(" from tab1, tab2 \n "); //처리
a.append(" where 1=1 --주석 \n "); //처리
a.append(" and tab1.a = tab2.a --주석 \n "); //
*/
//상수처리 
a.append(" select *                                \n "); /* 처리 */
a.append(" from tab2, tab2                   \n "); //처리
a.append(" where 1=1 --주석                 \n "); //처리 
a.append(" and tab1.a = tab2.a --주석  \n "); //사용
```

---

## Case 2: Standalone `a.append` with Line Comments

### [INPUT AREA]
```java
//상수처리
a.append(" select * \n ");
a.append(" from dual \n "); //처리
//조건입력
a.append(" where 1=1 --주석 \n "); //처리
a.append(" and 1=1 --주석 \n "); //
```

### [FIRST AREA] (1차 결과값)
```sql
/*@ //상수처리 */
 select * 
 from dual /*@ //처리 */
/*@ //조건입력 */
 where 1=1 --주석 /*@ //처리 */
 and 1=1 --주석 /*@ // */
```

### [RESULT AREA] (1차 최종값)
```java
//상수처리
a.append(" select *  \n "); 
a.append(" from tab1  \n "); //처리
//조건입력 
a.append(" where 1=1 --주석  \n ");  //처리 
a.append("and tab1.a = 'text' --주석 \n "); // 
a.append("and tab1.b = 'text2' --주석2 \n "); // 
```

---

## Case 3: Chained `append().` with Block Comments

### [INPUT AREA]
```java
/*
append(" select * \n ").
append(" from tab1 \n ").
append(" where 1=1 --주석 \n ").
append(" and tab1.a= 'text' --주석 \n "); // 2025년 폐기
*/
// 상수처리
append(" select *  \n ").
append(" from tab1 \n ").
// 조건입력
append(" where 1=1 --주석 \n ").
append(" and tab1.a = 'text' --주석 \n "); // 2025후 반영
```

### [FIRST AREA] (1차 결과값)
```sql
/*<@
append(" select * \n ").
append(" from tab1 \n ").
append(" where 1=1 --주석 \n ").
append(" and tab1.a= 'text' --주석 \n "); // 2025년 폐기
@>*/
/*@ //상수처리 */
 select *  
 from tab1 
/*@ //조건입력 */
 where 1=1 --주석 
 and tab1.a = 'text' --주석 /*@ // 2025후 반영 */
```

### [RESULT AREA] (1차 최종값)
```java
/*
append(" select * \n ").
append(" from tab1 \n ").
append(" where 1=1 --주석 \n ").
append(" and tab1.a= 'text' --주석 \n "); // 2025년 폐기
*/
// 상수처리
append(" select *                                                                   \n ").
append(" from tab1 inner join tab2 on tab1.a = tab2.b \n ").
// 조건입력
append(" where 1=1 --주석                                                   \n ").
append(" and tab1.a = 'text' --주석                                      \n "); // 2025후 반영
```

---

## Case 4: Chained `append().` with Semicolon Transition

### [INPUT AREA]
```java
// 상수처리
append(" select * \n ").
append(" from tab1 \n ").
// 조건입력
append(" where 1=1 --주석 \n ").
append(" and tab1.a =  'text2' --주석2 \n "); //2026년 폐기
```

### [FIRST AREA] (1차 결과값)
```sql
/*@ //상수처리 */
 select * 
 from tab1 
/*@ //조건입력 */
 where 1=1 --주석 
 and tab1.a =  'text2' --주석2 /*@ //2026년 폐기 */
```

### [RESULT AREA] (1차 최종값)
```java
// 상수처리
append(" select * \n ").
append(" from tab1 outer join tab2 on tab1.a  = tab2.a \n ").
// 조건입력
append(" where 1=1 --주석 \n ").
append(" and tab1.a =  'text2' --주석2 \n "); //2026년 폐기
```
