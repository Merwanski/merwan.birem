---
name: "ALARMM SBO – Visual SLAM for Large Environments"
years: "2025 – Present"
description: "Leading a 4M€ multi-partner project on low-cost, accurate and robust visual SLAM for complex industrial environments, aiming at ~1 cm markerless localisation over 600 m²+ shop floors."
tags: ["Visual SLAM", "Digital Twin", "Sensor Fusion", "Industrial AI"]
featured: true
order: 1
role: "Project leader"
facts:
  - { label: "Full name", value: "Accurate large-area Localisation and spatial Alignment with Robust Markerless Methods" }
  - { label: "Type", value: "SBO (Strategic Basic Research)" }
  - { label: "Budget", value: "4M€" }
  - { label: "Consortium", value: "4 research groups, 7 industrial partners + user group" }
  - { label: "Target", value: "~1 cm accuracy over 600 m²+, little or no reliance on markers" }
links:
  - { label: "Flanders Make article", href: "https://www.flandersmake.be/en/insights/high-precision-markerless-localisation-for-the-factories-of-tomorrow" }
  - { label: "Project update on LinkedIn (April 2026)", href: "https://www.linkedin.com/posts/nick-michiels_ar-xr-spatialcomputing-ugcPost-7446453289799372800-C5x6/" }
gallery:
  - { src: "/projects/alarmm/approach.svg", caption: "The ALARMM approach: four research pillars feed a modular SLAM core to deliver centimetre-level, markerless localisation." }
---

## Why

Standard visual SLAM drifts in feature-poor areas, such as corridors with white walls or dark warehouses, and loses precision by centimetres or even metres. ALARMM aims for **about 1 cm accuracy over areas larger than 600 m², with little or no reliance on markers**.

## How

The work is built on the modular **stella_vSLAM** framework and organised around four pillars:

- **Digital-twin alignment**: anchoring the visual map to 3D scans and CAD models of the factory, so positions stay consistent with the real layout.
- **Semantic reasoning**: using scene understanding, including vision-language and large language models (such as Qwen), to exploit geometric relationships between objects and correct the pose.
- **Dynamic scene awareness**: filtering out moving objects and environmental noise.
- **AI-enhanced IMU positioning**: deep-learning inertial models that keep localisation going gracefully when vision fails.

Alongside these, I'm digging into the SLAM engine itself: how **bundle adjustment** works, and how new kinds of information and constraints can be added to the optimisation. I'm also looking at **object pose estimation with FoundationPose**, which gives the full 6D pose of an object from nothing more than its CAD file.

## Use cases

- **AR guidance** for operators during maintenance and assembly, anchored precisely on the real machines.
- **AMR, AGV and forklift localisation**, including precise docking and pallet tracking.

## Status

The first year is complete and a warehouse benchmark is in place, with steady progress from the partner research groups. The next two years lead to two toolboxes: **ALARMM-SLAM**, and **SLAMTEST**, which lets companies predict the localisation accuracy they can expect on their own shop floor.

_Videos and images of the first results will be added here soon._
