# Pull Requests Guide

The user service follows the [GitHub Flow](https://githubflow.github.io/) branching strategy, with all PRs being to merged to `master`.  

## How to open a PR

### Use a structured title

**The PR title will be used in [the changelog](../../CHANGELOG.md)**, so try to be as informative as possible.

Follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) structure when writing a PR title.


```
<type>(<ticket-number>)[FLAGS]: <description> <breaking-change> 
```

Examples:
```
feat(UD-123)[WIP]: add support for searching UUIDs

refactor(UD-124)[DONT MERGE]: POC for switching to Prisma

feat(UD-456)!: add support for searching UUIDs. BREAKING CHANGE: search parameter is now of type string instead of UUID
```

- `<type>`: the type of change according to the conventional commits spec.
- `<ticket-number>`: include the Jira ticket number to automagically link the ticket to the PR, and vice versa.
- `<flags>`: flag anything that reviewers should know, e.g. `WIP` or `DON'T MERGE`. **Remove before merging**.
- `<description>`: the Jira ticket title where appropriate, or a concise description.
- `<breaking-change>`: highlight any breaking changes, as per the conventional commits spec.


### Add a description

Unless your commit messages are very good, the auto-generated git log description probably isn't very useful to your reviewers. 

Help your reviewers by providing them with the context they need to do a good review. 
Be sure to include any tradeoffs, potential improvements, or concerns you have.


### Request reviews
Add any coworkers, internal or external to the team, who you would like to review the PR. 
If you need info/sign-off from particular people, feel free to flag that in the PR description.

Reviewing pull requests is time consuming, so be patient with your reviewers, but nudge them if your PR isn't being reviewed. 
It may also help to tell your reviewers if the PR is urgent or not.

### Be review-friendly

Reviewing pull requests is a time consuming and challenging task. Help your reviewers by:

- tidying up beforehand; checking for typos, console.logs, dead code, old comments, etc.
- keeping PRs small
- commenting on your code/PR appropriately
- including any references/diagrams/other PRs to provide context
- writing useful commit messages


## How to merge a PR
Your pull request is ready to be merged when:

- it has at least **two approvals**
- **CI has passed** and the docker image is deployed
- a **deployment plan** has been coordinated for any **breaking changes** or infrastructure requirements


### Squash commits
Merge your commits into a single commit when merging to master.  You can use the auto-generated commit message.

### Update the PR title

The PR title will be used in [the changelog](../../CHANGELOG.md), so make sure it follows the convention detailed above. 

### Monitor the deployment

Once a PR is merged to `master`, it is auto-deployed to the alpha environment.
Ensure that the CI/CD pipeline runs successfully and that the application is running normally.
## How to review a PR

Everyone in the team has a responsibility to review each others PRs, so that we can all build better software together. 
Try to dedicate some time each day to review pull requests.

### Make your stance clear

- If you are happy with the changes and don't think any suggestions should block the merge, approve the PR.
- If you have think additional work/discussion is required before the PR can merge, request changes on Bitbucket.
- If you change your mind at any time (perhaps based on new suggestions), update your review status on Bitbucket.
- Don't worry about disagreeing with your coworkers, that's all part of healthy debate.  
- Consider using [conventional comments](https://conventionalcomments.org/) to clarify your comments.

### Consider the surrounding context
A PR is as much about reviewing what isn't there than what is.

- Is there functionality that isn't being tested? 
- Could this be a breaking change?
- Does it follow good patterns used elsewhere in the codebase?
- Does it duplicate code? 

### Keep the bar high

We're trying to build the best software we can, and should hold ourselves and each other to high standards. 

- Are the changes well tested? 
- Is there sufficient documentation and comments? 
- Does it follow best practices and patterns? 
- Does it perform optimally?
- Is it clear, concise, and easy to read? 

### Consider future impact
- Will this change introduce performance issues when deployed? 
- Will this solution be hard to maintain and understand in the future? 
- Is this solution susceptible to breaking changes with basic changes to requirements? 

### Be timely

Try to avoid PRs staying in review for too long by:

- monitoring PR activity and responding to comments in a timely manner.
- leaving all your feedback in a single pass.
    - Leaving additional comments on the original code after changes have been made result in a lot of latency between suggestions and changes.
- getting in to a regular habit of reviewing PRs. 

### Be constructive 
- When suggesting changes, do so with a good attitude and be constructive.
- Explain your reasoning and any assumptions/information you have that the author may not.
- Feel free to comment on positives too! See a neat bit of code or an elegant solution? Say so :) 
