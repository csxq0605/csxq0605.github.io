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

{% include home/timeline.html items=site.data.education quiet=true %}

<p class="tl-note"><strong>GPA:</strong> 3.818/4.0. Full coursework is listed in my <a href="/cv/">CV</a>.</p>

## Experience {#experience}

{% include home/timeline.html items=site.data.experience %}

{% if site.data.publications.size > 0 %}
## Publications {#publications}

{% include home/publications.html %}
{% endif %}

## Projects {#projects}

{% include home/projects.html %}

## Honors {#honors-and-awards}

- *2025*: National Scholarship and Merit Student, Peking University.
- *2025*: Second Prize, Beijing Division, National College Student Mathematical Modeling Competition.
- *2024*: Outstanding Learning Award and Third Scholarship, Peking University.
- *2024*: First Prize, Beijing College Student Mathematics Competition.
