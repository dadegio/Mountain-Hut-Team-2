# Sprint 1 Retrospective - Team 02

- [process measures](#process-measures)
- [quality measures](#quality-measures)
- [general assessment](#assessment)

## 1. Process Measures

### 1.1 Macro Statistics

- Number of stories committed vs done: **7** committed, **6** done.
- Total points committed vs done: **33** committed, **28** done.
- Number of hours planned vs spent (as a team): TODO

We started working on `MH-07 — Reserve for an hiker`, though we can't consider it as finished since it doesn't respect our Definition of Done, which includes:

1. Code present on GitHub
2. Code review completed
3. Unit Tests passing
4. Integration Tests passing
5. End-to-End tests performed

### 1.2 Detailed Statistics

| Story | # Tasks | Points | Hours est. | Hours actual |
| ----- | ------- | ------ | ---------- | ------------ |
| _#0_  |         | -      |            |              |
| _#1_  | 8       | 8      | 11h        | 12h 49m      |
| _#2_  |         | 5      |            |              |
| _#3_  |         |        |            |              |
| _#4_  |         |        |            |              |
| _#5_  |         |        |            |              |
| _#6_  |         |        |            |              |
| _#7_  |         |        |            |              |

- Hours per task <span style="color:red">per person</span> (average, standard deviation)
- Total task estimation error ratio: sum of total hours estimation / sum of total hours spent -1

## 2. Quality Measures

### 2.1 Unit Testing

- Total hours estimated
- Total hours spent
- Number of automated unit test cases
- Coverage (if available)

### 2.2 Integration Testing

- Total hours estimated
- Total hours spent

### 2.3 E2E Testing

- Total hours estimated
- Total hours spent

### 2.4 Code Review

- Total hours estimated
- Total hours spent

## 3. Assessment

### 3.1 Estimation Errors

> What caused your errors in estimation (if any)?

There are several factors that contributed to this sprint's estimation errors:

1. We used the estimation we made for the pilot project as a baseline without realizing that this wouldn't work given the much higher complexity of this project compared to the pilot. So, to sum up, the sprint planning took way more time than anticipated.
2. We didn't account for the time needed to analyze the story clarifications on GitHub.
3. We estimated tasks based on their complexity "in isolation", failing to realize that some tasks belonging to later stories may take more time than expected, since they need to be integrated in a much more complex context.
4. Finally, we didn't reserve any leeway to address potential mistakes after the initial implementation of a task.

### 3.2 Lessons Learned

> What lessons did you learn (both positive and negative) in this sprint?

We found that having developers write their own unit tests works best, as it acts as clear documentation for the rest of the team and gives the author an immediate way to verify their code.

At the same time, we realized that reviewers need dedicated time up front to fully understand the logic behind a task before diving into testing and code review to avoid misunderstandings.

### 3.3 Improvement Goals

#### 3.3.a Achieved

> Which improvement goals set in the previous retrospective were you able to achieve?

Just like we promised in the pilot project's demo, this time we actually set aside some time to prepare for the demo.

#### 3.3.b Not Achieved

> Which ones you were not able to achieve? Why?

In this sprint we still failed to achieve a more balanced task distribution between team members.

#### 3.3.c For the next sprint

> Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)

Our main goal is still better team coordination: not just to balance out workload, but to keep tasks from blocking one another.

Also we will try not to leave tasks sitting in the "to verify" stage for too long: as soon as a feature is implemented, our first priority should be to test it, so that we can move onto the next story in a more precise manner.

### 3.4 Thing we're proud of as a team

> One thing you are proud of as a Team!!

Considering the overall complexity of this first sprint and the initial slowdown caused by the sprint planning, we're proud that we managed to complete six of the seven stories we planned to do.
