---
name: "FROGS ICON – CAD2GraspMonitor"
years: "2021 – 2023"
description: "Vision-based post-grasp validation for robotic kitting using YOLO detection, ICP pose estimation and sensor fusion."
tags: ["Robotics", "YOLO", "ICP", "Sensor Fusion"]
featured: true
order: 4
facts:
  - { label: "Type", value: "ICON (industry–research cooperative project)" }
  - { label: "Application", value: "Robotic kitting: pick-and-place of industrial parts" }
gallery:
  - { src: "/papers/figures/2024-cad2graspmonitor.webp", caption: "Object-presence check after grasping: the current frame is compared with a background model to get the foreground mask." }
papers: ["2024-cad2graspmonitor"]
---

## Why this project

In robotic kitting, a pick that looks successful can still be wrong: the part may have slipped, a different part may have been picked, a second part may have come along, or the pose may be off. Those errors cascade into the next steps. CAD2GraspMonitor validates each grasp **after** the pick, before the error spreads.

## How it works

The system combines the gripper controller's feedback, tactile sensing and computer vision into four inspection services:

- **Object presence**: is something actually in the gripper?
- **Object type**: is it the right part (YOLO-based detection)?
- **Precise pose**: where exactly is it in the gripper (ICP registration against the CAD model)?
- **Surplus detection**: did more than one part come along?

## Result

Reliable grasp validation in industrial pick-and-place, published at ARCI 2024 (see below).
