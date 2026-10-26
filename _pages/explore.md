---
layout: page
title: Explore
permalink: /explore/
wide: true
eyebrow: Off the main page
heading: Explore
lede: Small things that did not fit on the homepage — where I have been, who drops by, and a toy from my mechanics coursework.
description: A world notebook of places and visitors, and an interactive damped oscillator.
scripts:
  - /assets/js/atlas.js
  - /assets/js/explore.js
---
{% include explore/world.html %}

{% include explore/oscillator.html %}

<div class="card-row">
  <a class="mini-card" href="{{ '/test/' | relative_url }}"><strong>Which MUNer are you? {% include site/icon.html name='arrow' %}</strong><span>A 31-question Model UN personality quiz, in Chinese.</span></a>
  <a class="mini-card" href="{{ '/#projects' | relative_url }}"><strong>Projects {% include site/icon.html name='arrow' %}</strong><span>Nexgent, Tiny PyTorch and a fluid-puzzle game.</span></a>
  <a class="mini-card" href="https://github.com/{{ site.author.github }}"><strong>GitHub {% include site/icon.html name='external' %}</strong><span>Code for everything above.</span></a>
</div>
