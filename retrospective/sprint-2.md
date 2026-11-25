# Sprint 1 Retrospective - Team 02

## 1. Process Measures

### 1.1 Macro Statistics

- Number of stories committed vs done: **6** committed, **6** done.
- Total points committed vs done: **22** committed, **22** done.
- Number of hours planned vs spent (as a team): **95h 00m** planned, **93h 12m** spent.

Our Definition of Done:

1. Code present on GitHub
2. Code review completed
3. Unit Tests passing
4. Integration Tests passing
5. End-to-End tests performed

### 1.2 Detailed Statistics

| Story  | # Tasks | Points | Hours est. | Hours actual |
| :----- | :------ | :----- | :--------- | :----------- |
| **#0** | 22      | -      | 45h 00m  | 47h 10m    |
| **#7** | 9       | 5      | 11h 30m     | 10h 25m    |
| **#8** | 5       | 2      | 7h 00m   | 4h 46m     |
| **#9** | 6       | 5      | 8h 30m   | 8h 40m     |
| **#10** | 7       | 3      | 8h 15m   | 8h 11m      |
| **#11** | 5       | 2      | 6h 15m   | 5h 45m     |
| **#20** | 5       | 5      | 8h 30m     | 8h 15m     |

#### 1.2.1 Hours per Task (Average, Standard Deviation)

<!-- **Per Person**: -->

| Member          | Time (min) | # Tasks | Average | StDev  |
| --------------- | ---------- | ------- | ------- | ------ |
| Alice Nicotra   | 920        | 13      | 1h 10m  | 0h 46m |
| Davide Giordano | 990        | 12      | 1h 22m  | 0h 50m |
| Elif Guney      | 940        | 13      | 1h 12m  | 0h 57m |
| Eren Altuntas   | 655        | 13      | 0h 50m  | 0h 42m |
| Giacomo Viviano | 1050       | 18      | 0h 58m  | 0h 51m |
| Leonardo Miani  | 1037       | 13      | 1h 19m  | 1h 00m |


<!-- **General**: -->
<!---->
<!-- |            | Mean     | StDev    | -->
<!-- | ---------- | -------- | -------- | -->
<!-- | Estimation | 1h 36min | 1h 43min | -->
<!-- | Actual     | 1h 35min | 2h 55min | -->

#### 1.2.2 Total task estimation error ratio

$$
    \frac{\sum_i \text{spent}_{\text{task}_i}}{\sum_i \text{estimation}_{\text{task}_i}} - 1 = \frac{\text{93h 12m}}{\text{95h 00m}} - 1 = -0,019
$$

#### 1.2.3 Absolute relative task estimation error

$$
    \frac{1}{n} \sum_{i=1}^{n} \left| \frac{\text{spent}_{\text{task}_i}}{\text{estimation}_{\text{task}_i}} - 1 \right| = \frac{1}{58} \sum_{i=1}^{58} \left| \frac{\text{spent}_{\text{task}_i}}{\text{estimation}_{\text{task}_i}} - 1 \right| = 0,199
$$

## 2. Quality Measures

### 2.1 Unit Testing

- Total hours estimated: 5h 05m
- Total hours spent: 3h 30m
- Number of automated unit test cases: 282
- Coverage (if available): 89.48% 

### 2.2 Integration Testing

- Total hours estimated: 6h 30m
- Total hours spent: 6h 18m

### 2.3 E2E Testing

- Total hours estimated: 6h
- Total hours spent: 5h 25m

### 2.4 Code Review

- Total hours estimated: 12h
- Total hours spent: 9h 28m

## 3. Assessment

### 3.1 Estimation Errors

> What caused your errors in estimation (if any)?

For the most part of the stories we didn't do such big of errors in estimation, but in the 7th story there is quite a difference between the actual time spent and the estimation time due to the fixing from clarifications that we had to implement.

### 3.2 Lessons Learned

> What lessons did you learn (both positive and negative) in this sprint?

We realized that we have a messy workflow on GitHub and that's not good from the point of view of understanding where to implement things so we have to fix this problem.

The positive lesson we learned was that splitting in two groups is better in order to have a more solid workflow.

### 3.3 Improvement Goals

#### 3.3.1 Achieved

> Which improvement goals set in the previous retrospective were you able to achieve?

We managed to be better coordinated as a team, also considering the fact that we follow different weekly time schedule with the univeristy. 

The workload was divided in two 3-people groups so we can have better coordination and work in an efficient way on all the stories without blocking mutually the task's development.

We have achieved not leaving tasks sitting in the "to verify" stage for too long. As soon as a feature was implemented, we tested it and moved onto the next story.

#### 3.3.2 Not Achieved

> Which ones you were not able to achieve? Why?

We achieved every goal we said in the previous sprint.

#### 3.3.3 For the next sprint

> Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)

Our main goal is to have a better organization of the branches in the GitHub repository so it's easier, from a confilct and review point of view, to merge and verify pull requests.

Another goal we want to achieve is to finish the stories few days earlier in order to organize the retrospective part and the demo part more calmly.

### 3.4 Thing we're proud of as a team

> One thing you are proud of as a Team!!

Considering the overall complexity of this second sprint, we're proud that we managed to complete all the stories with a better organization from the point of view of task's splitting.
