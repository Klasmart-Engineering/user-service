# K6 Load Testing
## Install

Install K6 as per K6 documentation found in the following location:
[K6] https://k6.io/docs/getting-started/installation/

## Setup

- Setup a .ENV file, an example is provided within the repo.
- Open up terminal and within /tests/peformance relevant to the root folder of the project run the following 
```sh
npm i
```
- Once the node modules have been installed, a build is required (build required after every change). Run a build with either of the following commands: 
```sh
npm run build
```
or
```sh
webpack
```
## Script Execution
To locally run a script:
```sh 
K6 run ./dist/[script.js]
```

To execute local script on K6 cloud, first sign in to K6 cloud through the terminal. 
Login example: 
```sh
k6 login cloud -t [token found in your k6 account]
```
***Your k6 token can be found in the CLI section of your K6 account.*** 

After login, execute the following in terminal:
```sh
K6 cloud ./dist/[script.js]
```

#### Environment variables
**The following files accept variables through k6 to set the amount of stages:**
./dist/parallelLanding.js
./dist/parallelLandingSchedule.js
./dist/parallelLogin.js

To set ramping-vu stages quantity, execute the script in the terminal by setting the **STAGE_QTY** variable using the *-e* flag.
**Examples**:
```sh
k6 run -e STAGE_QTY=20 ./dist/parallelLanding.js
```

```sh
k6 cloud -e STAGE_QTY=20 ./dist/parallelLanding.js
```

## File Structure
 ** Root / **
    - package.json
    - .ENV
    - tsconfig.json
    - webpack.config.js
    [Main/executable load testing files ].ts
    - /scripts [individual request scripts]
    - /utils
    - /interfaces
    

  
