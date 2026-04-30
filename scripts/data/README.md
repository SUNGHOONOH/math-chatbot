# Concept Node Seed Data

이 폴더는 `concept_nodes_reference` 시드용 JSON 데이터를 보관합니다.

## 고등수학 I (m1_json)

- 파일: `m1_json/concept_nodes_m1.json`
- 파일: `m1_json/concept_nodes_m1_PC.json`
- 단원 코드: M1_EXPLOG, M1_FUNC, M1_SEQ, M1_SEQSUM, M1_TRIG, M1_TRIGLAW

## 고등수학 II (m2_json)

- 파일: `m2_json/concept_nodes_m2.json`
- 단원 코드: M2_CONT, M2_DIFF, M2_DIFFAPP, M2_INTEG, M2_INTEGAPP, M2_LIMIT

## 중등 1 (md_json/md1)

- md1_01_수와_연산
- md1_02_문자와_식
- md1_03_좌표평면과_그래프
- md1_04_기본도형
- md1_05_평면도형과_입체도형
- md1_06_통계

## 중등 2 (md_json/md2)

- md2_01_수와_식의_계산
- md2_02_부등식과_연립방정식
- md2_03_일차함수
- md2_04_도형의_성질
- md2_05_도형의_닮음
- md2_06_확률

## 중등 3 (md_json/md3)

- md3_01_실수와_그_연산
- md3_02_인수분해와_이차방정식
- md3_03_이차함수
- md3_04_삼각비
- md3_05_원의_성질
- md3_06_통계

## Seed 사용 예

```bash
node scripts/data/seed.ts m2_json md_json
```
