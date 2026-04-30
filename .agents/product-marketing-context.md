# Product Marketing Context

*Last updated: 2026-04-26*

## Product Overview
**One-liner:** AHA is a Socratic AI math tutor for Korean high school students that guides students with questions, detects learning bottlenecks, and turns each tutoring session into a diagnostic report.

**What it does:** Students upload or type a math problem, then work through it with an AI tutor that avoids giving the answer directly. AHA reconstructs the problem from text, image, or PDF input, supports math notation, stores tutoring dialogue, detects where the student gets stuck, and generates post-session reports showing required concepts, bottlenecks, mastered concepts, and AHA moments.

**Product category:** AI math tutor, Socratic tutoring platform, math learning diagnosis platform, AI study assistant.

**Product type:** Web SaaS / education technology platform.

**Business model:** Current repo shows login, onboarding, student dashboard, admin operations, and a planned revenue area for paid tiers and tutor commission tracking. Pricing is not yet defined in the codebase.

## Target Audience
**Target companies:** Not enough information in the repo to confirm a B2B target. The implemented product currently reads as direct-to-student or parent/student education SaaS, with future potential for tutoring centers, private academies, or schools.

**Decision-makers:** Students can directly use the product. Likely buyers or influencers may include parents, private tutors, tutoring center operators, and education program owners, but this needs confirmation.

**Primary use case:** A student is stuck on a Korean high school math problem and needs guided help that builds understanding instead of receiving the final answer immediately.

**Jobs to be done:**
- Help me start a difficult math problem without spoiling the solution.
- Show me exactly where my understanding broke down.
- Keep a record of my strong and weak concepts across problem-solving sessions.

**Use cases:**
- Upload a math problem photo or PDF and begin a tutoring session.
- Ask follow-up questions while solving, with short Socratic prompts in Korean.
- End a session and review required concepts, bottlenecks, solved bottlenecks, and AI tutor summary.
- Use a student dashboard to identify mastered and weak concepts.
- Admins review AI-detected bottlenecks, correct concept mappings, manage concept nodes, and inspect sessions.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Student user | Getting unstuck, understanding the next step, avoiding embarrassment | They do not know where to begin or which concept applies | A patient Korean Socratic tutor that asks one answerable question at a time |
| Parent buyer | Real learning progress, not answer-copying | They cannot see whether a child actually understands the concept | Session reports and concept-level diagnosis reveal progress and weak spots |
| Tutor/teacher champion | Efficient diagnosis and targeted practice | It is hard to know each student's misconception from a short answer | Bottleneck records, concept mappings, and learning reports make diagnosis inspectable |
| Admin/operator | Quality control, data management, model performance | AI diagnosis can mis-map concepts or miss edge cases | Admin tools for labeling, concept-node management, sessions, analytics, and model operations |

## Problems & Pain Points
**Core problem:** Students often get stuck because they do not know the first logical step, misread conditions, apply the wrong concept, or make calculation mistakes, but typical AI tools and answer keys reveal too much too quickly.

**Why alternatives fall short:**
- Answer-first AI tools can solve the problem but may weaken learning by skipping student reasoning.
- Static answer keys explain after the fact but do not diagnose the student's exact stuck point.
- Human tutoring is high-touch and effective but expensive, hard to scale, and not always available when the student is studying.
- Generic math apps may not align with Korean high school / CSAT-style reasoning and Korean polite tutoring norms.

**What it costs them:** Lost study time, repeated mistakes, shallow answer copying, weaker concept retention, and poor visibility into recurring weak concepts.

**Emotional tension:** Frustration, confusion, fear of being behind, and uncertainty about whether they truly understand the problem.

## Competitive Landscape
**Direct:** AI math tutoring apps and math-solving assistants — often fall short when they prioritize complete solutions over Socratic guidance and diagnostic tracking.

**Secondary:** ChatGPT or general AI chatbots — can help solve math, but need careful prompting and may not enforce "never give the answer directly" or maintain concept-level learning records.

**Secondary:** Traditional answer keys and lecture explanations — useful after solving, but not interactive and do not capture the student's misconception.

**Indirect:** Human private tutors — provide high-quality guidance but are limited by cost, scheduling, and inconsistent data capture.

## Differentiation
**Key differentiators:**
- Socratic tutoring rule: the tutor should not give direct answers during active sessions.
- Korean-first tutor behavior with 존댓말 and Korean high school math context.
- Problem initialization is separated from live chat, supporting image/PDF/text input before tutoring starts.
- Bottleneck detection is separated from student-facing responses, reducing interference with streaming UX.
- Post-session reports combine dialogue logs, bottlenecks, required concepts, mastered concepts, AHA moments, and strategy graph context.
- Admin QA tools let operators inspect sessions, correct AI labels, manage concept nodes, and improve mappings.

**How we do it differently:** AHA treats each problem as a session, guides through one question at a time, logs the learning process, and converts the session into structured diagnostic data.

**Why that's better:** Students get help without losing the thinking work, while parents/tutors/operators get concrete evidence of where learning is breaking down.

**Why customers choose us:** They want an AI tutor that teaches through guided discovery, not an answer machine, and they want learning diagnosis that persists beyond a single chat.

## Objections
| Objection | Response |
|-----------|----------|
| "Why not just use ChatGPT?" | AHA is designed around Korean math tutoring workflows: no direct answers during active sessions, one guiding question per turn, problem-session records, bottleneck diagnosis, and reports. |
| "Will students still learn if AI is involved?" | The product's core rule is to preserve student reasoning by asking guiding questions rather than giving the answer directly. |
| "Can we trust the diagnosis?" | The repo includes admin labeling, concept-node management, candidate matches, and correction workflows, so AI output can be reviewed and improved. |

**Anti-persona:** Students or buyers who only want instant final answers with no learning process; users outside Korean high school math unless the product scope expands; institutions requiring fully validated assessment metrics not yet proven in the repo.

## Switching Dynamics
**Push:** Current tools give answers too fast, do not show why the student is stuck, or leave parents/tutors without reliable learning records.

**Pull:** Guided Socratic help, Korean math-specific behavior, image/PDF problem intake, bottleneck detection, and session reports.

**Habit:** Students are used to searching for solutions, asking ChatGPT, watching lectures, or waiting for a tutor.

**Anxiety:** Concern that AI may be wrong, may not understand Korean math problems from images, may frustrate students by withholding answers, or may not produce reliable diagnosis.

## Customer Language
**How they describe the problem:**
- "어디서부터 시작해야 할지 모르겠어요."
- "풀이를 봐도 내가 어디서 막힌 건지 모르겠어요."
- "정답만 알려주는 건 도움이 안 돼요."
- "계속 같은 유형에서 틀리는데 이유를 모르겠어요."

**How they describe us:**
- "나만의 소크라틱 AI 수학 선생님"
- "정답을 주지 않는 AI 튜터"
- "막힌 지점을 찾아주는 수학 튜터"

**Words to use:** 소크라틱, AI 수학 튜터, 막힌 지점, 병목, 세션 리포트, 학습 진단, 스스로 해결, 개념, 풀이 경로, AHA Moment.

**Words to avoid:** 정답 바로 제공, 만능 풀이기, 자동 숙제 해결, 완벽한 진단, 검증된 성적 향상률 unless proof exists.

**Glossary:**
| Term | Meaning |
|------|---------|
| Bottleneck / 병목 | A detected point where the student is stuck or misunderstanding a concept |
| Strategy graph / 전략 그래프 | Compact representation of possible solution phases and concept routes |
| AHA Moment | A student's visible moment of understanding in the transcript |
| Required concepts | Concepts needed to solve the specific problem |
| Mastered concepts | Concepts the student appears to have applied or explained independently |

## Brand Voice
**Tone:** Calm, patient, precise, supportive.

**Style:** Korean-first, conversational, concise, educational, diagnostic.

**Personality:** Socratic, thoughtful, trustworthy, focused, student-centered.

## Proof Points
**Metrics:** No public conversion, retention, learning outcome, or customer result metrics found in the repo.

**Customers:** No named customers or logos found in the repo.

**Testimonials:**
> No testimonials found yet.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Guided learning over answer-giving | System prompt requires Socratic tutoring, one guiding question, and no direct answer during active sessions |
| Diagnostic memory | Session reports store bottlenecks, mastered concepts, AHA moments, performance metrics, and snapshots |
| Korean math fit | OCR, tutoring, diagnosis, and report prompts are built around Korean high school math |
| Operational quality control | Admin views support labeling, concept-node management, sessions, analytics, and model operations |

## Goals
**Business goal:** Not explicitly defined. Inferred near-term goal: validate and improve an AI Socratic math tutoring product with reliable session reports and diagnosis workflows.

**Conversion action:** Start a new question/session by entering text or uploading a math problem image/PDF; complete onboarding/login for persistent learning records.

**Current metrics:** Not available in the repo. Admin pages track total sessions, detected bottlenecks, diagnostic reports, concept node counts, and related operational data.
