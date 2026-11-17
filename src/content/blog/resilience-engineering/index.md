---
title: 'Book Summary: Foresight Review of Resilience Engineering'
subtitle: '“Book’s Resume” series — Book n°15: designing systems for the expected and the unexpected'
date: '2026-11-07'
article_no: 210
category: Book Resume
pillar: growth
tags:
- book-summary
- resilience-engineering
- systems-engineering
- safety
- engineering-leadership
summary: 'A 54-page report from the Lloyd''s Register Foundation (2015) on how to build systems that keep their critical function going when things go wrong. Its core: resilience rests on four abilities (monitor, respond, antici...'
medium_url: https://just-merwan.medium.com/book-summary-foresight-review-of-resilience-engineering-d931097a3b71
canonical: https://just-merwan.medium.com/book-summary-foresight-review-of-resilience-engineering-d931097a3b71
hero: ./assets/visuals/infographic.png
hero_alt: 'The whole report on one page: core idea, the numbers from its case studies, how a resilient system copes, six lessons and the quote to keep (own infographic, after Lloyd''s Register Foundation, 2015)'
---

> **TLDR**: A 54-page report from the Lloyd's Register Foundation (2015) on how to build systems that keep their critical function going when things go wrong. Its core: resilience rests on four abilities (monitor, respond, anticipate, learn), you protect the *function* and not the old system, and you learn from the many things that go right, not only from the rare failure. A quick read, mostly qualitative, but the one idea is worth keeping: build resilience in from the start.

Hey, book readers and lovers… and also curious ones, in this article I share my notes, a summary and the lessons I took from the ***Foresight Review of Resilience Engineering: Designing for the Expected and Unexpected***, published by the Lloyd's Register Foundation in October 2015 [1]. My wife received it during a training she followed in 2018, and I read it in 2021.

It is less a book than a report: the Foundation, a charity that funds engineering safety research, ran a workshop at the Stevens Institute of Technology in April 2015, opened a consultation, and wrote down what resilience engineering is and where it should invest [1]. The image above is the whole report on one page. Below, the details.

## 🚀 The Book in 3 Sentences

1. Resilience can best be defined as "a process linking a set of adaptive capacities to a positive trajectory of functioning and adaptation after a disturbance" [1, p. 8].
2. In this sense, disruptive events are an opportunity to learn and to improve system performance [1, p. 28].
3. Resilience depends on the ability to monitor, prepare, anticipate, adapt, respond and learn [1, p. 42].

## 🎨 Impressions

From my notes [2]: a small book, quick to read. In general it is OK if you are into engineering and want to know some of the criteria for building a resilient system. It can also be an interesting read for non-technical people who want to know what resilience is, and which norms and requirements exist around it.

I gave it 2 stars, and I keep that rating here. The report says it itself: most published work on resilience is qualitative, and the field still needs a common language, theory and quantitative rigour [1, p. 9]. You get definitions, case studies and a research agenda; you don't get a method you can apply on Monday morning. Read it for the ideas, not for a recipe.

**PROS**

* Short, and the definitions from the UN, the British Standards Institution and the US are collected in one place [1, pp. 8–9].
* Real case studies with real numbers.
* The Safety-I vs Safety-II idea alone is worth the read.

**CONS**

* Written for a funding strategy, so many pages are about what the Foundation should finance.
* No metrics, no checklist, no worked engineering example.

## 🤔 Who Should Read It?

Anyone interested in resilience in general who wants to know more about it, for example engineers who design buildings or build systems. I would add engineers who run AI or robotic systems in production: the four abilities map directly onto monitoring, fallbacks, tests and post-incident reviews.

## ☘️ How the Book Changed Me

The main lesson for me: resilience has to be taken into account from the beginning when you build a system, not added after the first failure.

It also changed how I see speed. Sometimes it is good to take the time, start slowly and build a resilient system from the start, instead of jumping in and doing everything fast. What you pay in time at the beginning, you gain back later. I see this most when building the system architecture for a new product or a new solution: the questions you ask in the first weeks (what happens if this sensor drops out, if the network goes down, if the lighting changes) are much cheaper to answer then than after the first deployment.

## ✍️ My Top 3 Quotes

1. "Resilience describes the emergent property or attributes that some systems have which allows them to withstand, respond and/or adapt to a vast range of disruptive events by preserving and even enhancing critical functionality." [1, p. 1]
2. "A system is resilient if it can adjust its functioning prior to, during, or following events (changes, disturbances, and opportunities), and thereby sustain required operations under both expected and unexpected conditions." (Hollnagel, quoted in [1, p. 10])
3. "Resilience depends on the ability to monitor, prepare, anticipate, adapt, respond and learn." [1, p. 42]

## 📒 Key Ideas

### 1. Resilience is about the function, not the system

Across all the definitions in the report, the same pattern comes back: something disrupts normal operation, the system copes with it, and coping means anticipating and preparing, absorbing the hit, adapting during the event and recovering afterwards [1, p. 9].

The important twist: what you preserve is the critical *function*, not the system you had before. After a disaster, a water utility may not rebuild the same old pipes but deliver water differently, with a smaller footprint or lower cost [1, pp. 10–11]. The report calls this "resilience by design".

And resilience is a spectrum, not a yes/no property. The goal changes from "engineering a resilient system" to "engineering a more resilient system", which is what makes metrics and design rules possible [1, p. 11].

![Performance of the critical function through a disruption: anticipate and prepare, absorb, adapt, recover, ending above the old level (own diagram, phases after [1, p. 9])](./assets/fig-resilience-curve.png)

### 2. The four abilities

Borrowing from Hollnagel and colleagues, the report lists four abilities a resilient system needs [1, pp. 9–10]:

* **Monitor**: know what to look for, in the system's own performance and in its environment.
* **Respond**: know what to do, by activating prepared actions or adjusting how the system runs.
* **Anticipate**: know what to expect further ahead: disruptions, new demands, changing conditions.
* **Learn**: know what has happened, and learn the right lessons from it.

For an AI system in production, the mapping is direct: monitor = drift and health metrics, respond = fallback modes, anticipate = scenario and stress tests, learn = post-incident reviews that change the design.

### 3. From Safety-I to Safety-II

Safety-I studies what goes wrong: count failures, find causes, add barriers. Safety-II studies what goes right: how the system succeeds under varying conditions, so it can do better and be safer. In the report's figure, Safety-I learns from the 1 failure in 10,000 events, Safety-II from the 9,999 that went fine [1, p. 28].

The report's conclusion: the work should be "less about minimising the risk of failure and more about creating systems that are higher performing under both 'normal' and unanticipated conditions" [1, p. 28].

### 4. What threatens resilience

The threats are external (environmental, social, economic and technological change) and internal (organisational deficiencies) [1, p. 1]. The list that hit closest to engineering practice [1, pp. 19–20]: no parameters to measure resilience, a lack of incentives, managers focused on the current status and a single indicator such as the bottom line, and the tension between efficiency and resilience.

### 5. Lessons from real disasters

The case studies are where the report is strongest [1, pp. 14–18]:

* **Hurricane Sandy, 2012:** New Jersey Transit lost equipment and service for long periods because it had not protected it from the storm surge. The New York City subway had prepared, restored partial service less than three days after landfall and was nearly fully running within a week.
* **The 2003 blackouts:** cascading grid failures hit more than 45 million people in North America and, a month later, 56 million in Italy and Switzerland, stopping trains, airports, traffic lights and water pressure.
* **Cyclone Phailin, 2013:** early warning, one of India's largest evacuations and trained responders kept the toll to 44 deaths. A super-cyclone in the same state in 1999 killed more than 10,000 people.
* **Cosmic rays:** single particles can flip bits in electronics on the ground and in aircraft, which is why such effects are now considered in safety-critical design.

The common thread: preparation decides the damage, and failures cascade across sectors that depend on each other. And when large systems fail, people are often what keeps them running: in the Fukushima accident, the plant's employees showed that "people are the resource for flexibility and resilience" [1, pp. 29–30].

### 6. What to build

The report's recommendations are aimed at the Foundation, but they read well as a to-do list for any engineering organisation [1, pp. 2, 27, 31–32]: shared data and metrics for resilience, modelling and simulation platforms to test "what if" scenarios, and teams that mix engineering with social science, economics and policy.

## Key Take-Aways

After reading this article you should be able to answer for yourself, and why not explain to others, the following:

* What resilience means: keeping the critical function going, and even improving it, through expected and unexpected disruptions.
* The four abilities: monitor, respond, anticipate, learn.
* Why Safety-II learns from what goes right, and not only from failures.
* Why preparation, not the size of the shock, decided the outcome in the report's case studies.
* Why time spent on resilience at the start of a project is paid back later.

As always to end this article, here is the "***Quote of the Article***":

> **"Resilience depends on the ability to monitor, prepare, anticipate, adapt, respond and learn."** — Lloyd's Register Foundation [1, p. 42]

Six verbs, and most of them happen before anything goes wrong.

Cheers

Merwansky

---

*This article was drafted with AI assistance from the author's reading notes and the report itself, with the one-page infographic generated from page-referenced notes, and reviewed and completed by the author.*

## Sources

1. Lloyd's Register Foundation, *Foresight Review of Resilience Engineering: Designing for the Expected and Unexpected*, Report Series No. 2015.2, London, October 2015. DOI 10.60743/nhyy-n773. https://www.lrfoundation.org.uk/publications/foresight-review-of-resilience-engineering (page numbers = printed pages of the PDF)
2. M. Birem, reading notes on the report (finished 2021-01-21).

_Accessed 2026-11-02._
