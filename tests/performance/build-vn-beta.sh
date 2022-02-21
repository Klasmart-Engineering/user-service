rm -rf ./dist
npm run build:vn-prod
mv ./dist/parallelLanding.js ./dist/vnParallelLanding.js
mv ./dist/parallelLandingHomeStudents.js ./dist/vnParallelLandingHomeStudents.js
