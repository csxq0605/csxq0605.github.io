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

I am **Wangjie Su**, an undergraduate at [Peking University](https://www.pku.edu.cn/) pursuing a B.S. in **Theoretical and Applied Mechanics** and a double degree in **Intelligent Science and Technology**. I build reliable AI agents that can plan, use domain tools, preserve state, recover from failures, and complete long-horizon work in scientific and industrial settings.

I am currently an undergraduate researcher on the **AI + Fusion Energy Series Project** and in the **Combustion Laboratory** at Peking University. I also work as an **AI Agent Developer Intern** at Hangzhou Yuanxi Technology, where I independently designed and implemented [ManySelves](https://github.com/csxq0605/manyselves), a general-purpose runtime for document-defined agent teams.

I am **actively seeking internship opportunities** in AI agents, agent harness and runtime infrastructure, and embodied intelligence—especially roles that connect long-horizon agents with scientific workflows, multimodal perception, world models, or physical action.

[English CV](/assets/cv/CV.pdf){: .btn .btn--primary }
[中文简历](/assets/cv/cv%E4%B8%AD%E6%96%87.pdf){: .btn }
[GitHub](https://github.com/csxq0605){: .btn }

> 谁终将声震人间，必长久深自缄默；谁终将亮如闪电，必长久如云漂泊。——尼采

## Research Interests

My current focus is **reliable AI agents for scientific simulation and industrial workflows**, especially domain-tool and knowledge integration, long-horizon memory and context, multi-agent orchestration, failure recovery, and evaluation.

Looking ahead, I want to ground long-horizon ReAct agents in multimodal perception, sensor streams, world models, and physical action. My goal is to build perception-planning-action-feedback loops for autonomous laboratories, scientific instruments, and general-purpose robots.

## Contact

- Email: [wsu0605@stu.pku.edu.cn](mailto:wsu0605@stu.pku.edu.cn)
- Phone: [+86 188 6803 2449](tel:+8618868032449)
- GitHub: [github.com/csxq0605](https://github.com/csxq0605)

## News

- **2026.07** — Joined Hangzhou Yuanxi Technology as an AI Agent Developer Intern.
- **2026.05** — Contributed a reusable Core-Adapter architecture and session-scoped fallback state machine to [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent/pull/4298); the design was adopted upstream.
- **2026.03** — Joined the AI + Fusion Energy Series Project at Peking University.
- **2025** — Received the National Scholarship and was named a Merit Student of Peking University.

## Education

**Peking University** — B.S. in Theoretical and Applied Mechanics<br>
*September 2023 - Present*

**Peking University** — Double Degree in Intelligent Science and Technology<br>
*September 2024 - Present*

- GPA: **3.818/4.0**
- Selected coursework: Data Structures and Algorithms (**100**), Programming in AI (**100**), Computer Vision, Probability and Statistics, Numerical Analysis, Generative Modeling, Intelligent Robotics, Trustworthy Machine Learning, LLMs and NLG, and Physics Simulation for Computer Graphics.

## Research Experience

### AI + Fusion Energy Series Project

*Undergraduate Researcher · Xinao Technology Innovation Center, Peking University · March 2026 - Present*<br>
PIs: Prof. Yunfeng Liang and [Prof. Songfang Huang](https://www.coe.pku.edu.cn/teaching/all_time/13007.html)

- Developing AI agents that carry out long-horizon fusion-energy simulation workflows, from task planning and knowledge retrieval to tool execution, result interpretation, and iterative refinement.
- Using **Nexgent** as the experimental harness to connect domain knowledge and simulation tools through MCP, coordinate specialist agents and explicit workflows, and preserve sessions, checkpoints, permissions, and tool traces.
- Investigating long-context retrieval and recovery, sustained progress in long-horizon tasks, and permission-gated failure recovery so scientific runs remain state-consistent, auditable, and reproducible.

### Combustion Laboratory, Peking University

*Undergraduate Researcher · May 2025 - Present*<br>
PI: [Prof. Zheng Chen](https://www.coe.pku.edu.cn/teaching/all_time/7195.html)

- Studying fundamental combustion problems in energy conversion and propulsion, including flame dynamics, chemical kinetics, transport, ignition, flame propagation and stabilization, and laminar flame speed.
- Exploring mathematical formulations of multiscale combustion processes from conservation laws and reaction mechanisms, together with machine-learning approaches for predicting key quantities and approximating complex processes.
- Comparing mechanistic and data-driven models with attention to physical consistency, interpretability, data efficiency, and out-of-distribution generalization toward physics-data integrated combustion modeling.

## Internship Experience

### Hangzhou Yuanxi Technology Co., Ltd.

*AI Agent Developer Intern · July 2026 - Present*

**[ManySelves](https://github.com/csxq0605/manyselves)** is a general-purpose AI agent task runtime that I designed and implemented independently from scratch.

- Built a stable runtime for interchangeable document-defined agent teams: identity documents specify roles, boundaries, inputs, outputs, and handoffs, while Skill documents encode reusable methods and quality criteria.
- Built a unified Main Agent surface with specialist routing, document context, streaming execution, multi-provider integration, typed state, checkpoints, rollback, and resumable decisions; tools and workflows connect project files, reviews, and final artifacts.
- Wrapped the complete runtime with FastAPI and exposed only Codex Work-like conversation and task-submission capabilities, keeping model calls, long-horizon workflows, state transitions, and artifact management on the server.

## Selected Projects

### [Nexgent: Scientific Agent Harness](https://github.com/csxq0605/Nexgent)

*Independent Project · May 2026 - Present*

- Developed an agent harness for the AI + Fusion Energy project so agents can connect to domain tools, coordinate specialized work, survive interruptions, expose risky actions, and leave a traceable experimental record.
- Built a model-agnostic, frontend-neutral runtime shared by a PyQt6 desktop workspace, Textual TUI, and headless CLI; integrated 38 tools, automatic MCP bridging, multi-model routing, and subagent/workflow orchestration in pipeline, parallel, and phased modes.
- Implemented progressive context compression, typed project/reference memory, session save-resume-fork, checkpoint rollback, permission gates, lifecycle hooks, goals, and background tasks for controlled and recoverable experiment execution.

### [oh-my-opencode (now oh-my-openagent)](https://github.com/code-yeongyu/oh-my-openagent/pull/4298)

*Open-Source Contributor · May 2026*

- Introduced a Core-Adapter boundary and downward-only dependency DAG to separate reusable policy from OpenCode Hook, provider, and UI side effects, allowing Codex, Pi, and Claude Code adapters to share the same core behavior.
- Consolidated agent-name mapping, ordering, and compatibility into zero-dependency `agent-config-core`; modeled fallback as a per-session `idle/armed/exhausted` state machine with injected reachability and logging.
- Preserved original import paths through re-export shims and handled cleanup, re-arming, chain exhaustion, and notification deduplication. After maintainer discussion, the extraction design was adopted upstream in the new monorepo packages architecture.

### [Where Is My Codex (Flow Rescue)](https://github.com/csxq0605/where-is-my-codex)

*Course Project · Spring 2026*

- Co-developed a 2D fluid-puzzle game and implemented Position-Based Fluids in Python/Taichi with uniform-grid neighbor search, density constraints, terrain collisions, and GPU/CPU backends.
- Built five playable levels and a Tiled import pipeline; added headless tests and profiling for digging, collision, channel stability, goal collection, grid construction, and constraint solving.

### [Tiny PyTorch](https://github.com/csxq0605/pku-aiprogramming)

*Course Project · Fall 2024*

- Built a PyTorch-style tensor and reverse-topological autodiff engine with core operators, fully connected layers, convolution, pooling, softmax loss, and end-to-end MLP/CNN training.
- Implemented C++/CUDA storage, transfers, custom kernels, and cuBLAS-backed computation with Python bindings; trained on MNIST and compared single-GPU and DataParallel workflows.

## Honors and Awards

- National Scholarship and Merit Student, Peking University (2025)
- Second Prize, Beijing Division, National College Student Mathematical Modeling Competition (2025)
- Outstanding Learning Award and Third Scholarship, Peking University (2024)
- First Prize, Beijing College Student Mathematics Competition (2024)

## Skills

- **Programming:** Python, C/C++, CUDA, MATLAB, LaTeX, CMake, Taichi
- **Tools and Frameworks:** PyTorch, PyQt6, Git, Linux, Scikit-learn, Jupyter, OpenFOAM
- **Languages:** Chinese (native); English (CET-6: 613)
