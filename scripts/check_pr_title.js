const axios = require('axios')
const lint = require('@commitlint/lint').default;
const load = require('@commitlint/load').default;
const lintConfig = require("../commitlint.config")

const bitbucketPRId = process.env.BITBUCKET_PR_ID
const bitbucketUser = process.env.BITBUCKET_USER
const bitbucketPassword = process.env.BITBUCKET_PASSWORD

const bitBucketRequestConfig = {
    method: 'get',
    url: `https://${bitbucketUser}:${bitbucketPassword}@api.bitbucket.org/2.0/repositories/calmisland/kidsloop-user-service/pullrequests/${bitbucketPRId}`,
    headers: {},
}

axios(bitBucketRequestConfig).then(async (response) => {
    const title = response.data.title
    console.log(`Linting PR title: ${title}`)
    load(lintConfig).then((config) => {
        lint(title, config.rules, {
            parserOpts: config.parserPreset.parserOpts
          }).then(result => {
            if (result.valid) {
                console.log(`\nPASS: PR title matches the expected conventional commit format. `)
                process.exit(0)
            } else {
                console.error(`\nFAIL: PR title does not match the expected conventional commit format. Please refer to the PR guide: https://bitbucket.org/calmisland/kidsloop-user-service/src/master/documents/howto/pullrequests.md`)
                console.error("\nLint result:", result)
                process.exit(1)
            }
        })
    })
})
