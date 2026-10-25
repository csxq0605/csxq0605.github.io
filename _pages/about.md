---
permalink: /
title: ""
excerpt: ""
layout: home
redirect_from:
  - /about/
  - /about.html
---

## About Me {#about-me}

I am **Wangjie Su**, an undergraduate at [Peking University](https://www.pku.edu.cn/) pursuing a B.S. in **Theoretical and Applied Mechanics** and a double degree in **Intelligent Science and Technology**. My current work centers on reliable AI agents that can use domain tools, preserve state, recover from failures, and complete long-horizon scientific and industrial workflows.

I am currently studying long-horizon research autonomy: how agents can preserve executable state across interruptions, advance only through independent evidence, recover from failures, and accumulate reusable experience under explicit governance. I built [Nexgent](https://github.com/csxq0605/Nexgent), a desktop agent whose coordinator splits work across background threads and improves how it divides work from measured outcomes, and which serves as the execution substrate for this research, including monitoring long fusion simulations; I also work on combustion modeling and general-purpose agent runtimes.

I am **actively seeking internship opportunities** in AI agents, agent harness and runtime infrastructure, and embodied intelligence—especially work connecting long-horizon agents with scientific workflows, multimodal perception, world models, or physical action.

> 谁终将声震人间，必长久深自缄默；谁终将亮如闪电，必长久如云漂泊。——尼采

## Research Interest {#research-interest}

- **Reliable AI Agents and Harnesses:** long-horizon memory and context, tool and knowledge integration, multi-agent orchestration, permission control, failure recovery, and evaluation.
- **Scientific Workflows:** agents that plan, execute, inspect, and reproduce simulation or experimental pipelines while keeping state and tool traces auditable.
- **Embodied and Multimodal Agents:** grounding ReAct-style reasoning in multimodal perception, sensor streams, world models, and physical action to form perception–planning–action–feedback loops.

## News {#news}

- *2026.06*: Joined **Hangzhou Yuanxi Technology** as an independent project lead and one of the startup's first technical team members.
- *2026.03*: Joined the **AI + Fusion Energy Series Project** at Peking University.
- *2025.09*: Received the **National Scholarship** and was named a Merit Student of Peking University.

## Education {#education}

- *2023.09 - now*, B.S. in **Theoretical and Applied Mechanics**, Peking University.
- *2024.09 - now*, Double Degree in **Intelligent Science and Technology**, Peking University.
- **GPA:** 3.818/4.0. Full coursework is listed in my [CV](/cv/).

## Experience {#experience}

- *2026.06 - 2026.09*, **Independent Project Lead and Early Technical Team Member**, Hangzhou Yuanxi Technology. Contributed end to end across the frontend, backend, and runtime of [ManySelves](https://github.com/csxq0605/manyselves), independently designing and implementing its runtime kernel and capability packages. ManySelves is a recoverable local runtime for file-defined agent teams: identities, skills, tasks, contracts, and workflows are declared in Markdown, YAML, and JSON Schema, compiled into a frozen plan, and executed by a stateless kernel. Its bundled power-distribution safety reporting capability splits work so that code handles structure (grouping, citations, gap classification, reconciliation, assembly) while the model makes the professional judgments in a judgment ledger, and revisions produce a new version under the same run, reopening only the modules whose facts changed.
- *2026.03 - now*, **Undergraduate Researcher**, AI + Fusion Energy Series Project, Xinao Technology Innovation Center, Peking University. Studying long-horizon research autonomy: preserving executable research state across interruptions and advancing only through independent evidence. The project develops four layers for orchestration/execution, evidence/verification, memory/evolution, and governance/collaboration; Nexgent provides the long-running substrate and can monitor long fusion simulations. PIs: Prof. Yunfeng Liang and [Prof. Songfang Huang](https://www.coe.pku.edu.cn/teaching/all_time/13007.html).
- *2025.05 - now*, **Undergraduate Researcher**, Combustion Laboratory, Peking University. Studying multiscale combustion processes and the complementary roles of mechanistic and data-driven models under [Prof. Zheng Chen](https://www.coe.pku.edu.cn/teaching/all_time/7195.html).

## Projects {#projects}

<div class="project" markdown="1">

### [Nexgent: A Desktop Agent Team That Learns](https://github.com/csxq0605/Nexgent)

A general-purpose desktop agent (TypeScript monorepo; Electron desktop app and CLI over one in-process SDK) that works in the user's project folder. Each project has a coordinator that only splits, dispatches, relays corrections, and summarizes; threads work in their own copies of the project and, when a piece is large, use an `organize` tool to assign one to six members with generic roles. After each team run it records the cost, time, failures, and wasted work of every part, changes only the hottest spot, and keeps or reverts that change on the next similar task while keeping a solo control group; experience notes are enabled or disabled by randomized with/without comparisons, and outcomes count only deterministic checks, user corrections, and external review. Mid-run user messages take effect on the next model request, the user's own words survive context compaction verbatim, and an append-only JSONL session log with a usage ledger allows recovery after a hard kill, with OS-level sandboxing, approvals, and three-level cost limits.

[csxq0605/Nexgent](https://github.com/csxq0605/Nexgent){: .repo-link}

</div>

<div class="project" markdown="1">

### [Tiny PyTorch: CUDA Deep-Learning Framework](https://github.com/csxq0605/pku-aiprogramming)

Grew an AI programming course project (tensors, reverse-mode autodiff, C++/CUDA layers, pybind11) into a PyTorch-style framework (Python package `tinytensor`) with bf16 tensor-core convolution, grouped convolution, BatchNorm, LayerNorm, single-kernel attention, and fused layers. The whole training step runs without CPU read-back and is replayed as a CUDA Graph. On one A100 it trains ViT-Tiny, ResNet18, ResNeXt26, and VGG16 on ImageNet-1k at 64x64 (top-1 56.5% / 56.0% / 62.6% / 57.6%), matching PyTorch epoch by epoch over the first 10 epochs from the same initial weights; per epoch it is 2.56x / 1.39x faster than torch.compile on ViT-Tiny / ResNet18, on par on ResNeXt26, and 30% slower on VGG16, where cuDNN's convolution kernels are still faster.

[csxq0605/pku-aiprogramming](https://github.com/csxq0605/pku-aiprogramming){: .repo-link}

</div>

<div class="project" markdown="1">

### [Where Is My Codex (Flow Rescue)](https://github.com/csxq0605/where-is-my-codex)

A computer-graphics course project: a 2D fluid-puzzle game built with Python, Taichi, Position-Based Fluids, GPU/CPU backends, five playable levels, and a Tiled import pipeline.

[csxq0605/where-is-my-codex](https://github.com/csxq0605/where-is-my-codex){: .repo-link}

</div>

## Honors {#honors-and-awards}

- *2025*: National Scholarship and Merit Student, Peking University.
- *2025*: Second Prize, Beijing Division, National College Student Mathematical Modeling Competition.
- *2024*: Outstanding Learning Award and Third Scholarship, Peking University.
- *2024*: First Prize, Beijing College Student Mathematics Competition.
