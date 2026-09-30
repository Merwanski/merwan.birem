---
title: "New Object Tracker Based On Adaptive Intensity Models of Object and Its Surroundings"
authors:
  - "D. Gors"
  - "R. Hofman"
  - "Merwan Birem"
  - "S. Kauffmann"
year: 2021
venue: "7th World Congress on Electrical Engineering and Computer Systems and Sciences (EECSS 2021), Prague"
abstract: "New developments on the object tracker topic are needed, so that reliable tracking systems can have value for industrial applications, like surveillance and assembly monitoring. This paper presents a new object tracker algorithm based on adaptive models of the intensity probabilities of the object and its surroundings. Using the tracked object contour in the previous frame and the object path allow to estimate a narrow search area, in which contours with high object probability are combined, after masking pixels with high surrounding probabilities away. Rules about the object contour area ensures that the tracked contour doesn’t drift away between frames or spreads into the surroundings. If the tracking is lost, the contour prediction in combination with the surrounding estimation takes over, filling the gaps until the object intensity-based tracker leads the tracking again. The proposed tracker was contrasted against three of the available trackers in OpenCV (i.e. KCF, CRST and MOSSE). Their performances were evaluated on two different applications (i.e. drone tracking and part tracking in an assembly cell) based on the Intersection over Union (IoU)-metric and their processing time. The obtained results show that the proposed tracker is faster and more accurate."
pdf_url: "/papers/2021-object-tracker-adaptive-intensity.pdf"
doi: null
tags:
  - object tracking
  - computer vision
  - adaptive models
  - visual tracking
featured: false
citations: 0
thumbnail: "/papers/thumbs/2021-object-tracker-adaptive-intensity.webp"
figure: "/papers/figures/2021-object-tracker-adaptive-intensity.webp"
---
