---
title: What Is Gaussian Splatting? From Drone Photos to a 3D Scene
subtitle: How it works, what it costs to train on a laptop GPU, the licence trap, and where it fits next to photogrammetry for inspection
date: '2026-11-09'
article_no: 211
category: AI & Computer Vision
pillar: perception
tags:
- gaussian-splatting
- 3d-reconstruction
- computer-vision
- photogrammetry
- drones
summary: Gaussian Splatting turns a set of overlapping photos into millions of small, coloured, semi-transparent 3D blobs that a GPU can draw in real time [1]. We trained it on 77 public drone photos on an RTX 4070 laptop GPU ...
medium_url: https://just-merwan.medium.com/what-is-gaussian-splatting-from-drone-photos-to-a-3d-scene-4906075351e6
canonical: https://just-merwan.medium.com/what-is-gaussian-splatting-from-drone-photos-to-a-3d-scene-4906075351e6
hero: ./assets/hero.jpg
hero_alt: 'A park seen from a drone, rendered from a viewpoint the model never saw during training: 1 million 3D Gaussians trained on 77 drone photos on an 8 GB laptop GPU (own render [13]; data OpenDroneMap Aukerman, CC0 [7])'
---

> **TLDR**: Gaussian Splatting turns a set of overlapping photos into millions of small, coloured, semi-transparent 3D blobs that a GPU can draw in real time [1]. We trained it on 77 public drone photos on an RTX 4070 laptop GPU with 8 GB. The default recipe ran out of memory twice; capping the scene at 1 million Gaussians trained in 22 minutes with 1.4 GiB of GPU memory and renders at 135 fps [13]. Detail holds where many photos overlap and breaks at the edges of the flight. Use gsplat (Apache-2.0), not the original research code, if you plan to ship something [2][6]. And treat splats as a visual layer: for measurements, the geometry still comes from photogrammetry or lidar [12].

Hey there, if you've seen a 3D scene on social media that you could fly through like a video game, but it was made from ordinary photos, there's a good chance it was Gaussian Splatting.

In my work I've mostly used photogrammetry: drone photos of indoor or outdoor environments, turned into a 3D model, and then the defects found during the inspection reprojected onto that 3D model. Gaussian Splatting is new to me, so before writing about it, we tested it.

In this article three things are covered: first, what Gaussian Splatting is and why it took off; second, the full pipeline step by step, tested on a public drone dataset with a laptop GPU, with every number measured; and third, the licence trap and where splats fit (and don't) next to photogrammetry for inspection.

## What is Gaussian Splatting?

Gaussian Splatting, or 3DGS, is a way to represent a scene captured with photos so that new views can be rendered in real time. Kerbl et al. introduced it in 2023: starting from the sparse points produced during camera calibration, they "represent the scene with 3D Gaussians" and render them with a fast, visibility-aware "splatting" rasteriser [1].

### Intuition

Think of the scene as made of millions of fuzzy, coloured ellipsoids. Each one has:

* a **position** in 3D,
* a **shape and orientation** (it can be a flat disc on a road or a long needle on a branch),
* an **opacity** (how much it blocks what's behind it),
* a **colour** that can change with the viewing direction, stored as spherical harmonics, so a roof can look brighter from one side [1].

To render an image, every ellipsoid is projected onto the image plane ("splatted"), sorted by depth, and blended front to back. Training means adjusting all those parameters until the rendered images match the photos.

### The equations

Each Gaussian is defined by its centre μ and a 3×3 covariance Σ [1]:

```
G(x) = exp( -1/2 · (x - μ)ᵀ Σ⁻¹ (x - μ) )
Σ = R S Sᵀ Rᵀ
```

R is a rotation (stored as a quaternion) and S a scale per axis. Writing Σ this way keeps it a valid covariance while the optimiser changes R and S freely [1].

The colour of a pixel is the classic front-to-back alpha blend of the N Gaussians that cover it, sorted by depth [1]:

```
C = Σ_i  c_i · α_i · Π_{j<i} (1 - α_j)
```

c_i is the colour of Gaussian i seen from this direction and α_i its opacity times its 2D footprint at that pixel. Nearer Gaussians hide farther ones, exactly like layers of tracing paper.

### Why it took off

Before 3DGS, the quality leader was NeRF, which stores the scene inside a neural network that is queried at many points along every camera ray [4]. That works well but is slow to train and to render. Kerbl et al. put it plainly: high quality "still requires neural networks that are costly to train and render", and for full scenes at 1080p "no current method can achieve real-time display rates" [1]. 3DGS reached real-time (≥ 30 fps) rendering at 1080p with state-of-the-art quality [1]. No network at render time, just a list of blobs and a rasteriser.

## The pipeline STEP by STEP

![Gaussian Splatting in four steps: overlapping photos, camera poses and sparse points from COLMAP, 3D Gaussians optimised on the GPU, real-time render (own figure, method from [1])](./assets/fig-pipeline.png)

### STEP1: Overlapping photos

Splatting needs what photogrammetry needs: every part of the scene seen in several photos from slightly different positions. Pix4D's guideline for aerial surveys is at least 70–80 % overlap along the flight lines and 60–70 % between lines [8].

For this test we used the **Aukerman** dataset from OpenDroneMap: 77 drone photos of a park with a building, a parking lot and a pond, published under CC0 (public domain), so the renders can be shown here [7]. The photos look straight down (nadir), which is typical for mapping flights. Keep that in mind; it matters later.

### STEP2: Camera poses with COLMAP

Training needs to know where each photo was taken and with which lens. COLMAP, an open-source Structure-from-Motion tool (new BSD licence), estimates both, plus a sparse point cloud that becomes the starting set of Gaussians [5][1]. If intrinsics and distortion are new to you, my article on [camera calibration](https://just-merwan.medium.com/what-is-camera-calibration-intrinsics-extrinsics-and-the-photos-that-make-or-break-it-39d96dfe36f9) covers them.

Everything runs in Docker, so nothing gets installed on the host (GPU access from containers is covered in [this article](https://just-merwan.medium.com/how-to-access-an-nvidia-gpu-from-docker-in-2026-507cc7de0737?sk=ef0ed03c0c3f452e6eb5d7b2793e3ea3)):

```bash
# SCENE is a folder with images/ inside (the 77 drone photos)
docker run --rm --gpus all -u "$(id -u):$(id -g)" -v "$SCENE:/scene" colmap/colmap:20260929.8466 bash -c '
  set -e; cd /scene; mkdir -p sparse
  colmap feature_extractor --database_path database.db --image_path images \
    --ImageReader.single_camera 1 --ImageReader.camera_model SIMPLE_RADIAL
  colmap exhaustive_matcher --database_path database.db
  colmap mapper --database_path database.db --image_path images --output_path sparse
  colmap model_analyzer --path sparse/0'
```

* `--gpus all` lets COLMAP use the GPU for feature extraction and matching.
* `-u "$(id -u):$(id -g)"` writes the results as your user, not root.
* `--ImageReader.single_camera 1` tells COLMAP that all photos come from the same camera, so it estimates one set of intrinsics instead of 77.
* `exhaustive_matcher` compares every pair of images: fine for 77 photos, too slow for thousands (COLMAP also has a `sequential_matcher` for video frames) [5].

Expected output (end of `model_analyzer`), from our run [13]:

```
Cameras: 1
Registered images: 77
Points: 42774
Mean reprojection error: 1.312604px
```

All 77 photos found their place, in 238 seconds [13].

### STEP3: Train the Gaussians with gsplat

The original 3DGS code from Inria asks for "24 GB VRAM (to train to paper evaluation quality)" [6]. Our GPU has 8. That's one reason to use **gsplat**, an open-source library from the Nerfstudio team with optimised CUDA kernels; its paper reports "up to 10% less training time and 4x less memory than the original implementation" [2].

A small Dockerfile builds it for the RTX 40 series (compute capability 8.9):

```dockerfile
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-devel
ENV DEBIAN_FRONTEND=noninteractive TORCH_CUDA_ARCH_LIST="8.9" MAX_JOBS=8
RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --recurse-submodules --shallow-submodules --branch v1.5.3 https://github.com/nerfstudio-project/gsplat.git /opt/gsplat
WORKDIR /opt/gsplat
RUN pip install --no-cache-dir --no-build-isolation .
RUN pip install --no-cache-dir --no-build-isolation -r examples/requirements.txt \
 && pip uninstall -y opencv-python && pip install --no-cache-dir "opencv-python-headless<4.11"
WORKDIR /opt/gsplat/examples
```

* `TORCH_CUDA_ARCH_LIST="8.9"` compiles the kernels only for this GPU's compute capability; set it to your GPU's value.
* `--recurse-submodules` is not optional: without it the build stops on a missing `glm` header, which is exactly what happened on our first try.
* The headless OpenCV avoids pulling in GUI libraries the container doesn't have.

Then train:

```bash
docker build -t cs-gsplat:1.5.3 -f Dockerfile.gsplat .
# the example loader wants a 4x downscaled copy in images_4/
docker run --rm -u "$(id -u):$(id -g)" -v "$SCENE:/scene" cs-gsplat:1.5.3 python -c "
import os; from PIL import Image
os.makedirs('/scene/images_4', exist_ok=True)
for f in sorted(os.listdir('/scene/images')):
    im = Image.open('/scene/images/' + f); im.resize((im.width // 4, im.height // 4), Image.LANCZOS).save('/scene/images_4/' + f, quality=95)"
docker run --rm --gpus all --shm-size 8g -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$SCENE:/scene" -v "$PWD/out:/out" cs-gsplat:1.5.3 \
  python simple_trainer.py mcmc --data_dir /scene --data_factor 4 --result_dir /out \
    --disable_viewer --save_ply
```

* `mcmc` picks the MCMC strategy, which keeps the number of Gaussians under a cap (1 million by default). More on why in the next section.
* `--data_factor 4` trains on 1500×1000 images instead of 6000×4000.
* `--disable_viewer` because the machine is headless; `--save_ply` writes the model as a `.ply` file that common 3DGS viewers open.
* By default the trainer holds back every 8th photo and never trains on it; those 10 photos are the test set.

Expected output: `out/stats/val_step29999.json` with the scores on the held-out photos, `out/ply/point_cloud_29999.ply` with the model, and a trajectory video in `out/videos/`.

### STEP4: Look at it

The `.ply` file opens in any 3DGS viewer. For the numbers below, render speed was measured headless over the 10 held-out cameras [13].

## Our test: 8 GB, four runs

![Peak GPU memory per run against the 7.6 GiB the card offers: both default runs crash, both MCMC runs fit, with time, quality, speed and file size per run (own experiment [13])](./assets/fig-memory-runs.png)

Same photos, same 30,000 training steps, four strategies [13]:

| Run | Result | Train time | Peak GPU memory | PSNR ↑ | SSIM ↑ | LPIPS ↓ | Render | Model |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default (densify until step 15,000) | out of memory at step 5,200 | | | | | | | |
| Default + packed mode | out of memory at step 5,800 | | | | | | | |
| MCMC, cap 1 M Gaussians | done | 22 min | 1.4 GiB | 22.27 | 0.684 | 0.260 | 135 fps | 236 MB |
| MCMC, cap 3 M Gaussians | done | 53 min | 3.9 GiB | 22.36 | 0.678 | 0.215 | 76 fps | 708 MB |

PSNR and SSIM compare the render with the real held-out photo pixel by pixel and structure by structure (higher is better); LPIPS compares them the way a neural network "sees" (lower is better). Render speed is at the 1223×917 training resolution [13].

### What the numbers say

**The default recipe doesn't fit 8 GB.** The original method grows the scene by cloning and splitting Gaussians where the image error is high [1]. On these photos it had 3.8 million Gaussians by step 5,200, and kept growing, until it asked for more memory than the card has [13]. Packed mode and a different memory allocator setting bought 600 steps, nothing more.

**A budget does.** Kheradmand et al. recast the Gaussians as samples of a probability distribution and replace the hand-made clone and split rules with a "relocalization scheme"; one result is "easy control over the number of Gaussians" [3]. With a cap of 1 million, training used 1.4 GiB and took 22 minutes [13].

**Three times the Gaussians bought little.** Going from 1 to 3 million cost 2.4× the training time, 3× the file size, and dropped render speed from 135 to 76 fps. LPIPS improved from 0.260 to 0.215; PSNR and SSIM stayed flat [13]. For a drone survey of this size, 1 million is enough.

**Coverage matters more than the GPU.** In the centre of the flight, where many photos overlap, the held-out view comes back sharp: cars, parking lines, the roof.

![Held-out view in the centre of the flight: real photo (left) and render (right); cars, lines and roof come back sharp, the top-left corner already shows edge artefacts (own experiment [13]; data CC0 [7])](./assets/still-building.jpg)

At the edge of the flight, where only a few photos overlap, the same model produces needle-shaped blobs and black holes:

![Held-out view at the edge of the flight: few overlapping photos, so the render shows needle-shaped Gaussians and missing areas on the right (own experiment [13]; data CC0 [7])](./assets/still-edge-artefacts.jpg)

Pix4D warns about exactly this for nadir projects: quality is best "from the top, close to the input views, but can degrade significantly moving away from this viewing direction", and they recommend adding oblique images [8]. Our fly-through confirms it: tilt the virtual camera by 12° over the well-covered centre and it looks fine; fly toward the border and it falls apart.

To see how far that goes, we took the held-out camera over the building, moved it to half its distance from the ground, and orbited it around the point it looks at, away from straight down. No photo was ever taken from any of these positions [13]:

![The same 1 M-Gaussian model rendered from viewpoints no drone photo was taken from: straight down (0°), 30°, 60° and 80° away from vertical. At 30° the building's side starts to appear and the scene still holds; at 60° it turns into haze and needles; at 80° it is mostly fog (own experiment [13]; data CC0 [7])](./assets/fig-novel-views.jpg)

At 30° the model still holds: the roof keeps its shape and you start to see a side of the building that no photo faced directly, most likely pieced together from the edges of the nadir photos, where perspective shows a little of the walls. At 60° the ground turns into a brownish haze with needle-shaped blobs, and at 80°, close to a pedestrian's view, there is almost nothing left but fog [13]. The model is not a 3D survey of the park; it is a very good answer to "what did the drone see from above?".

![Fly-through over the well-covered centre of the flight, camera tilted 12°: rendered in real time from the 1 M model, not filmed (own render [13]; data CC0 [7])](./assets/flythrough.gif)

**Don't judge by one metric.** Between step 7,000 and 30,000, the 1 M model's PSNR on held-out photos dropped slightly (22.75 → 22.27) while SSIM (0.661 → 0.684) and LPIPS (0.398 → 0.260) improved [13]. The renders got sharper, while the pixel-by-pixel match on unseen photos got a bit worse. With only 77 photos, all looking down, report all three.

## The licence trap

This is the part people skip, and it decides whether you can use any of this in a product (same story as in my [6D pose estimation](https://just-merwan.medium.com/6d-object-pose-estimation-in-2026-what-changed-since-2022-and-which-method-to-pick-311ae6c0728e?sk=a7e734f0d20bd9841868b9d5a3f73318) article).

* The original 3DGS code (Inria and the Max Planck Institute for Informatics) has its own "Gaussian-Splatting License": the software "may be used 'non-commercially', i.e., for research and/or evaluation purposes only" [6]. Fine for learning, not for a product.
* gsplat is Apache-2.0 [2]. Commercial use is allowed; keep the licence and notices.
* COLMAP is new BSD [5].
* Data: a dataset you can download is not automatically one whose renders you can publish. Check its licence before training, not after; for this article we picked a CC0 dataset [7].

The method itself is published; the reference code is the restricted part. If someone in your team prototypes with the Inria repo, plan the switch before the demo becomes a product.

## Where it fits for inspection

This section is built from published work and vendor documentation, plus what our test showed, since splatting is new to me.

### The photogrammetry baseline

Mapping inspection findings onto a 3D model is established practice. Von Benzon and Chen classify paint damage and delamination in drone photos with AI and colour thresholding, then map each damage onto either a photogrammetry reconstruction or the CAD model of an offshore wind turbine part, using the image metadata and the model's geo-placement; "the location, shape, and size of the damage are visible on the Digital Twin" [9].

Movyon, part of the Autostrade per l'Italia group, tested its ARGO 3D platform on about 30 assets: drones carried out a "laser-scanner and photogrammetric survey", and inspectors can take measurements and annotate defects "directly on the 3D model", including a "polygon to be drawn on the 3D geometry, identifying the exact size of the defect itself" [10]. Their page has images of it; link, don't copy.

### What splats add

Wang et al. apply the same idea to Gaussian Splatting: 2D damage segmentation is shown on a GS-based digital twin, with a multi-scale strategy to balance efficiency and damage detail, and updates as the damage evolves [11]. They note that radiance-field methods "excel in scene representation, rendering quality, and handling featureless regions" compared with conventional photogrammetry [11]. Their demonstration uses a synthetic post-earthquake dataset, so it's a research result, not yet a field one [11].

### What splats don't replace

Vendors are clear on this. Esri ingests splats as contextual layers and treats them "as a complement to its established photogrammetric pipeline, not a replacement"; Bentley frames them the same way [12]. On accuracy, AEC Magazine sums it up: when vendors talk about "survey-grade" splats, "LiDAR or SLAM has done the geometric heavy lifting. Splats inherit that accuracy, they do not generate it" [12].

### A simple rule

Based on those sources and our test:

1. If you need measurements (crack length, deformation, volumes), photogrammetry or lidar gives you the geometry; splats can sit on top as the visual layer [12].
2. If people need to see the site (review an inspection remotely, brief a team, show where a defect is), splats work well, as long as viewers stay near where the drone flew [8][13].
3. When you plan the flight, add oblique photos and keep the overlap high, or the model will break where you look from a new angle [8].
4. If you plan to ship, build on gsplat or another permissively licensed implementation, not the original research code [2][6].
5. On an 8 GB card, cap the number of Gaussians; 1 million was plenty for 77 drone photos [13].

## Key Take-Aways

After reading this article you should be able to answer for yourself, and why not explain to others, the following:

* What a 3D Gaussian is (position, shape, opacity, view-dependent colour) and how splatting renders millions of them in real time.
* The four steps: overlapping photos, camera poses from COLMAP, training, rendering.
* Why the default recipe ran out of memory on 8 GB, and how a capped budget (MCMC) trained the same scene in 22 minutes with 1.4 GiB.
* Why the original code is research-only, and which open alternative you can ship.
* Where splats help inspection (seeing the site) and where photogrammetry or lidar stays in charge (measuring it).

As always to end this article, here is the "***Quote of the Article***":

> **"All models are wrong but some are useful."** — George E. P. Box [14]

A splat model is wrong about geometry it never saw, and very useful where the drone looked. Fly for the views you need, and measure with the tool that measures.

Cheers

Merwansky

---

*This article was drafted with AI assistance from the cited papers, vendor documentation and our own test runs, and reviewed and completed by the author.*

## Sources

1. B. Kerbl, G. Kopanas, T. Leimkühler, G. Drettakis, *3D Gaussian Splatting for Real-Time Radiance Field Rendering*, ACM Transactions on Graphics 42(4), 2023. https://arxiv.org/abs/2308.04079
2. V. Ye, R. Li, J. Kerr, M. Turkulainen, B. Yi, Z. Pan, O. Seiskari, J. Ye, J. Hu, M. Tancik, A. Kanazawa, *gsplat: An Open-Source Library for Gaussian Splatting*, JMLR MLOSS, arXiv:2409.06765, 2024. Code (Apache-2.0, v1.5.3): https://github.com/nerfstudio-project/gsplat
3. S. Kheradmand, D. Rebain, G. Sharma, W. Sun, J. Tseng, H. Isack, A. Kar, A. Tagliasacchi, K. M. Yi, *3D Gaussian Splatting as Markov Chain Monte Carlo*, arXiv:2404.09591, 2024. https://arxiv.org/abs/2404.09591
4. B. Mildenhall, P. P. Srinivasan, M. Tancik, J. T. Barron, R. Ramamoorthi, R. Ng, *NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis*, ECCV, 2020. https://arxiv.org/abs/2003.08934
5. J. L. Schönberger, J.-M. Frahm, *Structure-from-Motion Revisited*, CVPR, 2016. COLMAP (new BSD licence): https://github.com/colmap/colmap
6. graphdeco-inria, *gaussian-splatting* repository: README (hardware requirements) and LICENSE.md ("Gaussian-Splatting License"). https://github.com/graphdeco-inria/gaussian-splatting
7. OpenDroneMap, *odm_data_aukerman* dataset, CC0-1.0. https://github.com/OpenDroneMap/odm_data_aukerman
8. Pix4D, *Gaussian splats & point cloud – PIX4Dmatic*, support documentation. https://support.pix4d.com/hc/gaussian-splatting-pix4dmatic
9. H.-H. von Benzon, X. Chen, *Mapping damages from inspection images to 3D digital twins of large-scale structures*, Engineering Reports 7(1), e12837, 2024 (CC BY 4.0). https://doi.org/10.1002/eng2.12837
10. Movyon, *Remote inspection of bridges using drones*. https://www.movyon.com/en/trends/remote-inspection-of-bridges-using-drones/
11. S. Wang, X. Nie, Y. Narazaki, T. Matiki, B. F. Spencer Jr., *Three-dimensional Damage Visualization of Civil Structures via Gaussian Splatting-enabled Digital Twins*, arXiv:2602.16713, 2026. https://arxiv.org/abs/2602.16713
12. M. Day, *Introducing Gaussian splats for AEC*, AEC Magazine, 2 December 2025. https://aecmag.com/technology/introducing-gaussian-splats-for-aec/
13. Own experiment (#211): COLMAP 20260929.8466 + gsplat 1.5.3 in Docker on an RTX 4070 Laptop GPU (8 GB), OpenDroneMap Aukerman, four training runs; scripts, logs and results.json in the article's `assets/runs/`.
14. G. E. P. Box, *Robustness in the strategy of scientific model building*, in R. L. Launer, G. N. Wilkinson (eds.), *Robustness in Statistics*, Academic Press, 1979, p. 202.

_Accessed 2026-11-08._
