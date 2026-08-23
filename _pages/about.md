---
permalink: /
title: ""
excerpt: ""
author_profile: true
redirect_from:
  - /about/
  - /about.html
---

<span class="anchor" id="about-me"></span>

I am **Wangjie Su**, an undergraduate at [Peking University](https://www.pku.edu.cn/) pursuing a B.S. in **Theoretical and Applied Mechanics** and a double degree in **Intelligent Science and Technology**. My current work centers on reliable AI agents that can use domain tools, preserve state, recover from failures, and complete long-horizon scientific and industrial workflows.

I am currently studying long-horizon research autonomy: how agents can preserve executable state across interruptions, advance only through independent evidence, recover from failures, and accumulate reusable experience under explicit governance. I am developing [Nexgent](https://github.com/csxq0605/Nexgent) as a mechanism-level prototype, with fusion-energy simulation as a future domain-transfer and validation setting; I also work on combustion modeling and general-purpose agent runtimes.

I am **actively seeking internship opportunities** in AI agents, agent harness and runtime infrastructure, and embodied intelligence—especially work connecting long-horizon agents with scientific workflows, multimodal perception, world models, or physical action.

> 谁终将声震人间，必长久深自缄默；谁终将亮如闪电，必长久如云漂泊。——尼采

<span class="anchor" id="research-interest"></span>

# 🔬 Research Interest

- **Reliable AI Agents and Harnesses:** long-horizon memory and context, tool and knowledge integration, multi-agent orchestration, permission control, failure recovery, and evaluation.
- **Scientific Workflows:** agents that plan, execute, inspect, and reproduce simulation or experimental pipelines while keeping state and tool traces auditable.
- **Embodied and Multimodal Agents:** grounding ReAct-style reasoning in multimodal perception, sensor streams, world models, and physical action to form perception–planning–action–feedback loops.

<span class="anchor" id="news"></span>

# 🔥 News

- *2026.07*: Joined **Hangzhou Yuanxi Technology** as an independent project lead and one of the startup's first technical team members.
- *2026.05 - now*: Contributing to [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent/pull/4298), from a Core–Adapter architecture and session-scoped fallback protocol to ongoing work on the monorepo refactor.
- *2026.03*: Joined the **AI + Fusion Energy Series Project** at Peking University.
- *2025.09*: Received the **National Scholarship** and was named a Merit Student of Peking University.

<span class="anchor" id="education"></span>

# 📖 Education

- *2023.09 - now*, B.S. in **Theoretical and Applied Mechanics**, Peking University.
- *2024.09 - now*, Double Degree in **Intelligent Science and Technology**, Peking University.
- **GPA:** 3.818/4.0. Full coursework is listed in my [CV](/cv/).

<span class="anchor" id="experience"></span>

# 💻 Experience

- *2026.07 - now*, **Independent Project Lead and Early Technical Team Member**, Hangzhou Yuanxi Technology. Independently designed and implemented [ManySelves](https://github.com/csxq0605/manyselves), a general-purpose capability substrate that defines agent teams as versionable Identity contracts and Skill documents, then realizes them through durable, recoverable execution. Its FastAPI boundary supports controlled study of capability transfer, multi-agent coordination, memory, and recovery across different task workflows and future tasks.
- *2026.03 - now*, **Undergraduate Researcher**, AI + Fusion Energy Series Project, Xinao Technology Innovation Center, Peking University. Studying long-horizon research autonomy: preserving executable research state across interruptions and advancing only through independent evidence. The project develops four layers for orchestration/execution, evidence/verification, memory/evolution, and governance/collaboration; Nexgent provides the long-running substrate, while fusion serves as a future domain-transfer and validation setting. PIs: Prof. Yunfeng Liang and [Prof. Songfang Huang](https://www.coe.pku.edu.cn/teaching/all_time/13007.html).
- *2025.05 - now*, **Undergraduate Researcher**, Combustion Laboratory, Peking University. Studying multiscale combustion processes and the complementary roles of mechanistic and data-driven models under [Prof. Zheng Chen](https://www.coe.pku.edu.cn/teaching/all_time/7195.html).

<span class="anchor" id="projects"></span>

# 🛠 Projects

- **[Nexgent: Long-Running Research Coding Harness](https://github.com/csxq0605/Nexgent)** — Defines each long-horizon research effort as a persistent Research Run rather than an extended chat, using versioned contracts for objectives, budgets, branches, attempts, events, artifacts, verification, and termination. Implements SQLite WAL storage, cross-process lease/resume, and a typed DAG for control, data, resource, artifact, recovery, and verification dependencies, with exact-input caching and effect-safe concurrency across shared GUI, TUI, and CLI frontends. Its execute → validate → detect → attribute → recover → rerun loop promotes strategies only after independent verification and demotes or disables them after failed reuse, while simulator, resource, and irreversible side effects share telemetry and approval. The mechanism prototype passed 1,103 offline tests and reproduced a two-attempt, one-recovery loop with strict JSONL validation at 0 errors/0 warnings.
- **[oh-my-opencode (now oh-my-openagent)](https://github.com/code-yeongyu/oh-my-openagent/pull/4298)** — Investigated which agent behaviors should remain invariant across Harnesses; proposed a Core–Adapter DAG, a zero-dependency configuration core, and a session-scoped fallback protocol that turn implicit integration logic into portable, testable policy. Preserved existing call sites through re-export shims, validated state-machine boundaries, and continue to help lead the monorepo refactor toward reusable Harness-independent plugins.
- **[Where Is My Codex (Flow Rescue)](https://github.com/csxq0605/where-is-my-codex)** — A computer-graphics course project: a 2D fluid-puzzle game built with Python, Taichi, Position-Based Fluids, GPU/CPU backends, five playable levels, and a Tiled import pipeline.
- **[Tiny PyTorch](https://github.com/csxq0605/pku-aiprogramming)** — An AI programming course project implementing tensors, automatic differentiation, neural-network operators, C++/CUDA storage and kernels, cuBLAS acceleration, and end-to-end MLP/CNN training.

<span class="anchor" id="publications"></span>

# 📝 Publications

- No publications yet. Manuscripts and preprints will be listed here as they become available.

<span class="anchor" id="honors-and-awards"></span>

# 🎖 Honors

- *2025*: National Scholarship and Merit Student, Peking University.
- *2025*: Second Prize, Beijing Division, National College Student Mathematical Modeling Competition.
- *2024*: Outstanding Learning Award and Third Scholarship, Peking University.
- *2024*: First Prize, Beijing College Student Mathematics Competition.
