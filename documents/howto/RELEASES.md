# Onboarding

This document shows you all the steps you need to follow in order to generate a release.

### What a release is
A release is anything that to the best of your knowledge you feel comfortable with going into production:
- regular releases
- hotfixes

### What releases are not
Any code that is going to have an effect on production and have not been tested properly. For example a feature
branch.

### How often should we create releases
Ideally this should be done as often as possible, but the pace will be marked by the delivery team, so make sure
you take this into consideration.

### Our limitations
Currently we have only one environment before reaching production which is called Alpha, and for every merge on
our main branch the code gets automatically deployed into the environment. Because of this reason every time we
make a release on master we have to be really conscious about what we are releasing.

### What's the key points a need to understand
- We work with different providers for infrastructure, Alpha is using AWS, but that doesn't mean that production
will mimic that environment on every region.
- In relation with the previous point, we use docker, so this gives us an advantage to understand what we are
about to release, so use this power.
- Alpha deployments are automatic, so this release process is just about enabling other people to make the manual
deployment into production for when the release happens. The CI/CD pipelines need to be developed all the way down
to production, until then the process is manual.

### How do I create a release

Depending on what you are trying to generate a regular release or a hotfix change the first step:

#### Regular release
1. Checkout a branch, from the specific commit on master, using the version number you are about to release:
```bash
git checkout -b v<VERSION> <COMMIT>
```
Example
```bash
git checkout -b v2.1.0 d47b925
```

#### Hotfix
1. Checkout a branch, from the last stable release:
```bash
git checkout -b v<VERSION> <COMMIT | TAG>
```
Example
```bash
git checkout -b v2.1.1 v2.1.0
```

### Common Steps

2. Make sure there is nothing else to add to that release, if there is anything else that needs to be added
(e.g. a critical bug) add it on the branch.

3. Create the changelog. This is done automatically with a script:
```bash
npm run release
```

4. Tag and push your release:
```bash
./scripts/push_tag.sh
```

5. Finally update the release document according to that sprint. An [example](https://calmisland.atlassian.net/l/c/S8dgrLWg)

6. Merge the release branch back into master
