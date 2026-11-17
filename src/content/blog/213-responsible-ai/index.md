---
title: 'Responsible AI in Practice: Debugging a Vision Model for Errors, Fairness and Explainability'
subtitle: Where our auto-labeller fails, group by group, why one accuracy number hides it, and what a safety review will ask next
date: '2026-11-17'
article_no: 213
category: AI & Computer Vision
pillar: ai-systems
tags:
- responsible-ai
- computer-vision
- object-detection
- error-analysis
- machine-learning
summary: '"Responsible AI" sounds like a compliance word, but for a vision engineer it comes down to three questions: where does my model fail, does it fail more for some groups than for others, and can I explain a single decis...'
medium_url: ''
canonical: ''
hero: ./assets/hero.jpg
hero_alt: 'The same street scene under six conditions, from the original photo (top left) to an almost black frame (bottom right). The frame colour is the detector''s measured recall for that condition on 100 test images: cyan = most objects found, red = almost none (own experiment [8]; photo CC BY 2.0 via COCO [16])'
---

> **TLDR**: "Responsible AI" sounds like a compliance word, but for a vision engineer it comes down to three questions: where does my model fail, does it fail more for some groups than for others, and can I explain a single decision? We put all three to the detector from our auto-labelling article, on 600 photos from the public COCO dataset. Overall it finds 77 % of the objects; small chairs it finds 30 % of the time. Brightness, which we expected to matter, did not, and the only "dark" test that broke the model turned out to be a nearly black image. A per-group confidence threshold or a brightness filter did not close the gap; improving the model for the weak group (more examples, fine-tuning, higher resolution) would. The deliverable is a small table, one row per group, that you can hand to a customer or a safety engineer.

Hey there, picture a detector that passed every test in the lab. On the shop floor it starts missing parts, and nobody can say why. Then someone notices: it fails when the lamp next to the setup is switched on. Or when the operator picks parts with the left hand. Or wears gloves.

In our projects, that is how "the model is biased" usually shows up: one group of cases where a model that works fine on average works worse. You only find it if you look for it.

In this article three things are covered: first, what responsible AI means when your model draws boxes; second, three ways to debug a detector (error analysis by group, fairness as disparity, and explanations), each with PROS and CONS and each tried on a real model; and third, what changes when a detector gets close to a safety function.

## What "responsible AI" means for an engineer

Microsoft's Responsible AI Standard lists six principles: fairness, reliability and safety, privacy and security, inclusiveness, transparency, and accountability [2]. Read them as an engineer and three of them turn into test questions you can actually run:

* Reliability: where does the model fail? Microsoft's error-analysis tool exists to find "cohorts (subsets) of data with a higher error rate than the overall benchmark" [2].
* Fairness: does it fail more for some groups than for others?
* Transparency: can I explain one decision, on one image?

Microsoft's own docs split model debugging into three stages, identify, diagnose and mitigate, starting with two plain questions: "What kinds of errors does my model have?" and "In what areas are errors most prevalent?" [3]. Ruth Yakubu's walkthrough of the Responsible AI dashboard shows the same idea on a tabular model: an 89 % accurate model can hide a region of the data that fails 42 % of the time [1].

There is a catch for vision people. The Azure dashboard supports regression and classification on tabular data only [3]; images go through the open-source Responsible AI Toolbox and its `responsibleai-vision` package (MIT licence) [4]. We tried it: it installed in a Python 3.10 container, would not import without an extra OpenCV package, and its error tree lives in an interactive dashboard that needs a custom wrapper for an open-vocabulary detector. After ten minutes we wrote the group scoring ourselves, in about 200 lines of Python. You will see below that this is enough.

## Why one accuracy number is not enough

Customers rarely ask for "responsible AI". They ask for numbers: not only accuracy, but also precision, the number of failure cases, and sometimes a reliability figure like one failure in a million (99.9999 %).

There is a simple reason it is hard. If you test a system n times and see zero failures, the most you can claim with 95 % confidence is a failure rate below 3/n, the "rule of three" [5]. To back "fewer than 1 failure in a million" you need about 3 million failure-free, independent trials. A proof of concept with a few thousand labelled images can't get there. What it can do is show *where* the failures live, and that is what the rest of this article is about.

Regulation is moving the same way. Under the EU AI Act, an AI system counts as high-risk when it is the safety component of a product covered by the EU product-safety laws listed in Annex I, and that product needs a third-party conformity assessment (Article 6(1)). For those systems the Act asks for a documented risk management system (Article 9), data governance that includes an "examination in view of possible biases" (Article 10(2)(f)), and an appropriate level of accuracy and robustness that holds over the whole lifecycle (Article 15). These duties were due in August 2027; the Digital Omnibus of 2026 moved them to 2 August 2028 (2 December 2027 for the stand-alone high-risk uses in Annex III) [6].

## The test bench: one detector, 600 images, groups fixed in advance

We reused the setup from our auto-labelling article [7]: Grounding DINO base, an open-vocabulary detector that finds objects from a text prompt, asked for six COCO classes (person, car, bottle, cup, wine glass, chair) on 600 COCO val2017 images, scored against the human labels at IoU 0.5 [8]. Overall: recall 0.77, precision 0.68, the same as in that article.

If these words are new, here is all you need for the rest of the article:

* **Recall**: of all the objects really in the images, the share the model found. 0.77 means 77 out of 100.
* **Precision**: of all the boxes the model drew, the share that are right.
* **IoU 0.5**: a box counts as right when the overlap between it and the human box, divided by the area the two boxes cover together, is at least 0.5 (intersection over union).
* **Confidence threshold**: every box comes with a score between 0 and 1; we keep boxes scoring 0.35 or more. Lower it and you get more boxes, right and wrong.
* **Open-vocabulary detector**: a model you can ask for any object by typing its name, instead of a fixed list it was trained on.

The one rule that matters: **decide the groups before you look at the results.** Otherwise you will find a "weak group" in any dataset, by chance. We fixed five:

* object size: small, medium, large (COCO's bins on the object's outline area: under 32 × 32 = 1,024 pixels, under 96 × 96, above),
* class,
* image brightness: darkest, middle and brightest third of the images,
* crowding: 1–2, 3–6 or 7+ objects in the image,
* stress condition: original, motion blur, darkened, overexposed (100 test images).

The detector was re-run once with its confidence scores kept, so we could also test thresholds later. On an RTX 4070 laptop GPU (8 GB) this took 15 minutes for 2,300 forward passes [8].

## Approach 1: error analysis by group

**How it works.** Score the model separately for every group, then look for the groups whose error rate is two or three times the average. The Responsible AI dashboard does this with an error tree and a heat map over one or two features [1]; for a detector, a table of recall and precision per group does the same job. The core fits in a few lines of Python; this is the logic we used, on a toy example you can run as is:

```python
from collections import defaultdict

def iou(a, b):
    """Boxes as (x1, y1, x2, y2). Overlap area divided by the area covered by both boxes."""
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union else 0.0

def recall_per_group(images, group_of, thr=0.35, iou_min=0.5):
    """images: list of {"gt": [(cls, box), ...], "pred": [(cls, box, score), ...]}
    group_of(image, gt_object) -> group name. Returns {group: (found, total, recall)}."""
    found, total = defaultdict(int), defaultdict(int)
    for img in images:
        preds = sorted([p for p in img["pred"] if p[2] >= thr], key=lambda p: -p[2])
        used = set()
        for cls, box, _ in preds:                      # greedy match, best score first
            best, best_j = 0.0, None
            for j, (gcls, gbox) in enumerate(img["gt"]):
                if gcls == cls and j not in used and iou(box, gbox) > best:
                    best, best_j = iou(box, gbox), j
            if best >= iou_min:
                used.add(best_j)
        for j, g in enumerate(img["gt"]):
            k = group_of(img, g)
            total[k] += 1
            found[k] += j in used
    return {k: (found[k], total[k], round(found[k] / total[k], 2)) for k in total}

# toy example: one image, a large chair found, a small chair missed
images = [{"gt": [("chair", (0, 0, 200, 200)), ("chair", (300, 300, 320, 320))],
           "pred": [("chair", (5, 5, 195, 210), 0.81), ("chair", (290, 290, 330, 330), 0.20)]}]
def size(img, g):
    x1, y1, x2, y2 = g[1]
    a = (x2 - x1) * (y2 - y1)                           # COCO uses the mask area; box area is the usual stand-in
    return "small" if a < 32 ** 2 else "medium" if a < 96 ** 2 else "large"
print(recall_per_group(images, size))
```

Expected output: `{'large': (1, 1, 1.0), 'small': (0, 1, 0.0)}`. Swap `size` for any function that returns a group name (class, camera, shift, lamp on/off) and you have your group table.

**What we found.** The model is not uniformly "77 % good":

* **Size** is the biggest effect. Large objects are found 94 % of the time, small ones 60 %.
* **Class** comes next. Chairs: 53 %. Wine glasses: 58 %. People: 81 %.
* **Size × class** is where it really breaks: small chairs are found **30 %** of the time (138 objects; with so few, the 95 % confidence interval runs from about 23 % to 38 %), large people 96 %.
* **Crowding** matters a little: 90 % recall with 1–2 objects in the image, 72 % with seven or more.
* **Brightness** does not matter at all on these photos: 78 %, 76 % and 76 % for the dark, middle and bright thirds.

![Recall per class and per image-brightness third, 600 COCO images: the rows differ (chairs and wine glasses are weak everywhere), the columns barely do. Faded cells have fewer than 20 objects (own experiment [8])](./assets/fig-cohort-heatmap.png)

That last point surprised us. We had planned the heat map to show a light problem; it shows a class problem instead. Part of the reason: COCO photos were taken by people who wanted a usable picture, so even our "dark" third is a normally exposed photo, not a night shot. A factory camera at the end of a shift is a different story, which is why you test your own conditions. And that is the value of fixing the groups first: the data told us something we did not expect.

**What kind of errors?** The TIDE toolbox splits detector errors into six types: wrong class, poor box (localisation), both at once, duplicate, background and missed [9]. Its pip package would not import in our container, so we wrote a simpler split ourselves, counting TIDE's "both" as background. Of 1,102 wrong boxes on the 600 images, 765 sit on background, 270 have the right class but a poor box, 39 are duplicates and only 28 have the wrong class. And 437 objects had no box anywhere near them.

![Errors by type on the same 100 test images under four conditions: the original photos produce mostly background boxes; blur and darkness turn the problem into missed objects (own experiment [8])](./assets/fig-error-split.png)

The split changes the fix. Background boxes call for a higher threshold, or, for a model you train yourself, more images of empty scenes; missed objects call for more examples of that group.

**PROS**

* Cheap: a script and the labels you already have.
* Tells you where to collect data next.
* The table is easy to explain to a non-specialist.

**CONS**

* You only find the groups you thought of. Lamps and gloves are not in COCO's metadata.
* Small groups give noisy numbers: we ignored groups with fewer than 20 objects.
* Many groups means many comparisons: some "weak" groups will be chance.
* Objects in the same image are not independent, and all numbers here are at one threshold (0.35). A threshold-free metric such as average precision per group is a good second check.

## Approach 2: fairness as disparity

In the fairness literature, group fairness criteria compare how a classifier behaves across groups defined by a sensitive attribute [10]. Most Responsible AI tooling does exactly that: the fairness component "defines groups in terms of sensitive attributes like sex, race, and age" [3].

For an industrial detector the idea transfers without the demographics: **does the model serve every group of cases equally well?** Two numbers capture it:

* Worst-group recall: small chairs, 0.30.
* Gap to the overall: 0.30 − 0.77 = −0.47.

A useful habit: set a *floor* on the worst group, not only a target on the average. "Overall recall ≥ 0.75" passes this model. "Every group ≥ 0.60" fails it, and tells you which group to fix.

One honest limit. COCO has no labels for skin tone, age or gender, and we did not try to guess them from the pixels. We chose not to infer them: a guessed attribute adds its own errors to the very measurement you are trying to make. If your detector looks at people, you need those labels from the data owner, with consent, or you cannot make that claim at all.

From my experience, uneven failure showed up mostly where the process was not fully automated: a human in the loop, in an environment we did not fully control. That is where the examples from the opening come from, and they were simple things we had not considered: a light next to the setup switched on or off, an operator walking past and casting a shadow on the area the camera watches, a different table height, an operator using the left hand instead of the right, or wearing gloves.

None of those groups would have appeared in a generic benchmark. You can only test them if someone writes them down as groups before the trial.

**PROS**

* Turns a vague "is it fair?" into one number per group and a pass/fail floor.
* Works for parts, cameras, shifts and operators, not only people.

**CONS**

* You need the group label for every test image (who, which line, which lamp state).
* Raising the worst group can cost some overall accuracy, for example when a lower threshold adds wrong boxes everywhere; that trade-off is a decision, not a metric.

## Approach 3: explaining one detection

**Counterfactuals: change the input, watch the output.** Our stress set is a counterfactual test: same images, one change. Motion blur cut recall from 0.78 to 0.36, overexposure to 0.72, and our "dark" variant to 0.11 [8].

That last number needs a warning, and it is a lesson in itself. When we built the hero image of this article, we looked at the darkened photo: 98 % of its pixels are pure black. The test does not simulate a dark scene; it simulates a dead camera. Our earlier article reported the same test [7]. A stress test is only as good as its realism, so look at your perturbed images before you trust their numbers.

**Occlusion sensitivity: what does the box depend on?** Gradient methods like Grad-CAM use the gradients flowing into a convolutional layer to show which regions matter [11]. Grounding DINO is built on transformers (the architecture behind most current vision and language models) and mixes the image with the text prompt before it draws a box, so there is no single convolutional layer whose gradients explain one box. We used a method that needs no model internals: slide a grey 48-pixel patch (about a fifth of the person's height) over the region, re-run the detector, and record how much the box's score drops.

![Occlusion sensitivity for one detected person (start score 0.72): covering the head or the lower legs lowers the score most, but no single patch removes the detection (own experiment [8]; photo CC BY 2.0 via COCO [16])](./assets/fig-occlusion.png)

The largest single drop was 0.22, when the patch covered the lower legs. The box survives every patch: the model relies on the whole silhouette, not one part. That is reassuring for partial occlusion, and it is the kind of evidence a reviewer can read without knowing what a transformer is. For the classic explanation methods on tabular and image classifiers, see our article on LIME and SHAP [12].

**PROS**

* Works on any detector, black box included.
* Produces pictures that people outside the team understand.

**CONS**

* Slow: one forward pass per patch position (46 seconds for this one box).
* Explains one image, not the model; a reassuring map on one image proves little about the others.

## Can a quick fix close the gap?

We tried the two fixes people reach for first.

**A lower confidence threshold for the weak group.** We split the 600 images into 500 for choosing thresholds and 100 for checking them (the detector itself is pretrained; nothing was trained here). On the 500, going from 0.35 to 0.25 for chairs lifts recall from 0.49 to 0.70, but precision falls from 0.50 to 0.27: of the 400 extra chair boxes, only 53 are real chairs. Picking the threshold that maximises F1 (a single score that balances precision and recall) on those 500 images gave 0.35 again for chairs and for small objects. A threshold moves you along the precision-recall curve; it does not move the curve.

**Brightness normalisation** before detection: CLAHE (a local contrast boost) or an automatic gamma curve that brightens dark images. On the nearly black images, gamma lifted recall from 0.11 to 0.18 and CLAHE to 0.13: you cannot restore pixels that are gone. On the normal photos neither changed anything (0.765 before, 0.764 and 0.766 after).

![Left: on the nearly black test images, no threshold and no brightness filter gets close to the original images (white diamond). Right: for the weakest natural groups, a lower threshold buys recall with precision (own experiment [8])](./assets/fig-fix.png)

So the cheap fixes did not work here. When a group fails its floor, you have three honest options: improve the model for that group (for a model you train, more labelled examples of it; for a pretrained detector like ours, fine-tuning on such examples, a higher input resolution, or cutting the image into tiles so small objects become bigger); narrow the intended use and write it down, for example "not validated for objects under 32 × 32 pixels", which is exactly the kind of statement model cards ask for [15]; or put a second system and a human behind the model for that group. For small chairs, the first option is where our effort would go.

## When the detector sits near a safety function

Everything above is about quality. Safety raises the bar.

In our projects the detector is never trusted alone in a safety loop, and the more critical the function, the stricter that rule. Where it matters, its output is double-checked by a second, different system; the two must agree, and if they don't, a human is notified to make the final decision.

Three questions get sharper in that setting:

* **Same input, same output?** Determinism is not only about the model. A talk on safety-critical real-time systems showed that the message ordering in stacks built on ROS 2 (the most common robotics middleware), such as the Autoware.Auto driving software, can make the whole pipeline non-deterministic, and proposed a framework with predictable coordination instead [13].
* **Is this input like the training data?** A check that flags images unlike anything seen in training (out-of-distribution detection), or at least the stress set above, run on new camera footage.
* **Who notices drift?** Monitoring in operation, with the group table re-computed on fresh data.

The standards are catching up. exida, a functional-safety assessment company, notes that most existing safety standards were not written with machine learning in mind, and has been developing its own assessment scheme for ML in safety-critical tasks [14].

## A 5-step recipe you can run on your own model

1. Write the groups down before testing: size, class, camera, shift, lamp on/off, operator, gloves. Whatever could change the image.
2. Score per group, not only overall: recall, precision and object count per row.
3. Set a floor on the worst group, not only a target on the average.
4. Keep a stress set, and look at it: blur, light, occlusion, at realistic strengths.
5. Hand over the table. Model cards propose exactly this: a short document with "benchmarked evaluation in a variety of conditions" for every released model [15]. Your group table is the core of it.

Here is what ours looks like, with a floor of 0.60 recall per group (own experiment [8]):

| Group | Objects | Recall | Precision | Floor 0.60 |
| --- | --- | --- | --- | --- |
| All objects | 3,034 | 0.77 | 0.68 | pass |
| Large objects | 598 | 0.94 | 0.78 | pass |
| Small objects | 1,317 | 0.60 (0.605) | 0.59 | borderline pass |
| 7+ objects per image | 1,985 | 0.72 | 0.67 | pass |
| Chairs | 323 | 0.53 | 0.51 | fail |
| Small chairs | 138 | 0.30 | 0.50 | fail |
| Motion blur (100 images) | 557 | 0.36 | 0.74 | fail |

The whole analysis took a 15-minute GPU run and about 200 lines of scoring code. Cheap, compared to the meeting where someone asks why the line stopped.

## Key Take-Aways

After reading this article you should be able to answer for yourself, and why not explain to others, the following:

* Why an overall accuracy or recall can hide a group where the model fails most of the time.
* How to turn "responsible AI" into three tests: error analysis by group, worst-group recall, and an explanation of one detection.
* Why a stress test must be checked by eye before its numbers are trusted.
* Why a per-group threshold rarely fixes a weak group, and what does (data, model, or a second system plus a human).
* What a customer or safety engineer can be handed: a model card built around the group table.

As always to end this article, here is the "***Quote of the Article***":

> **"Model cards are short documents accompanying trained machine learning models that provide benchmarked evaluation in a variety of conditions."** — Margaret Mitchell et al., *Model Cards for Model Reporting* [15]

Notice the plural: *conditions*. One number is a claim; a table of conditions is evidence.

Cheers

Merwansky

## Sources

1. R. Yakubu, *How to perform Error Analysis on a model with the Responsible AI dashboard (Part 4)*, Microsoft Tech Community, 2023-03-22; also presented in her webinar *Responsible AI: Debugging AI models for errors, fairness and explainability*. https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/how-to-perform-error-analysis-on-a-model-with-the-responsible-ai-dashboard-part-/3775442
2. Microsoft, *What is Responsible AI*, Azure Machine Learning documentation, Microsoft Learn, updated 2026. https://learn.microsoft.com/en-us/azure/machine-learning/concept-responsible-ai
3. Microsoft, *Assess AI systems and make data-driven decisions with Azure Machine Learning Responsible AI dashboard*, Microsoft Learn, updated 2026. https://learn.microsoft.com/en-us/azure/machine-learning/concept-responsible-ai-dashboard
4. Microsoft, *Responsible AI Toolbox* (incl. `responsibleai-vision`), GitHub, MIT licence. https://github.com/microsoft/responsible-ai-toolbox
5. J. A. Hanley, A. Lippman-Hand, *If nothing goes wrong, is everything all right? Interpreting zero numerators*, JAMA 249(13):1743–1745, 1983. https://pubmed.ncbi.nlm.nih.gov/6827763/
6. Regulation (EU) 2024/1689 (Artificial Intelligence Act), Official Journal of the EU, 2024, Articles 6(1), 9, 10(2)(f), 15 and 113, https://eur-lex.europa.eu/eli/reg/2024/1689/oj; amended by Regulation (EU) 2026/1744 of 8 July 2026 (Digital Omnibus on AI), recital 40 (new dates: 2 December 2027 for Annex III, 2 August 2028 for Article 6(1)/Annex I), https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744. Both read on EUR-Lex 2026-11-17 (Cowork).
7. M. Birem, *Is Manual Labelling Dead? Auto-Labelling for Computer Vision in 2026*, Medium, 2026-11-07. https://just-merwan.medium.com/is-manual-labelling-dead-auto-labelling-for-computer-vision-in-2026-f0e0c9652e4f
8. M. Birem, cohort experiment for this article: Grounding DINO base (`IDEA-Research/grounding-dino-base`, Apache-2.0) on 600 COCO val2017 images, scripts and numbers in `assets/runs/` (`run213.py`, `score213.py`, `cohorts.json`). COCO annotations CC BY 4.0, images under their Flickr licences. https://cocodataset.org
9. D. Bolya, S. Foley, J. Hays, J. Hoffman, *TIDE: A General Toolbox for Identifying Object Detection Errors*, ECCV 2020. https://github.com/dbolya/tide
10. S. Barocas, M. Hardt, A. Narayanan, *Fairness and Machine Learning: Limitations and Opportunities*, MIT Press, 2023, ch. 3 "Classification". https://fairmlbook.org
11. R. R. Selvaraju, M. Cogswell, A. Das, R. Vedantam, D. Parikh, D. Batra, *Grad-CAM: Visual Explanations from Deep Networks via Gradient-based Localization*, ICCV 2017 / IJCV 2019. https://arxiv.org/abs/1610.02391
12. M. Birem, *Why Should I Trust You? How LIME and SHAP Make Black-Box Models Transparent*, Medium. https://medium.com/p/5ab6520bf24a
13. Software Center, *Predictable Coordination for Safety-Critical Real-Time Systems* (talk on non-determinism in ROS 2 / Autoware.Auto and the Xronos framework), YouTube, 2022-08-26. https://www.youtube.com/watch?v=3NHjQLIYVK4
14. exida, *exida's Pathway to Safe Machine Learning (ML)*, webinar, YouTube, 2023-04-13. https://www.youtube.com/watch?v=sHLACu5i9ss
15. M. Mitchell, S. Wu, A. Zaldivar, P. Barnes, L. Vasserman, B. Hutchinson, E. Spitzer, I. D. Raji, T. Gebru, *Model Cards for Model Reporting*, FAT* 2019. https://arxiv.org/abs/1810.03993
16. Photo credit: COCO val2017 image 000000140203 (Flickr, CC BY 2.0): http://farm1.staticflickr.com/47/151349771_c85a058c7d_z.jpg

_Accessed 2026-11-13._
