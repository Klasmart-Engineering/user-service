/* eslint-disable no-console */
import axios, { AxiosResponse } from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { objectToKey } from '../utils/stringUtils'

enum AlertOpMode {
    CREATE = 'Create',
    UPDATE = 'Update',
}

interface AlertPolicy {
    id?: number
    incident_preference: string
    name: string
    created_at?: number
    updated_at?: number
}

async function syncAlphaAlerts() {
    dotenv.config()
    const apiKey = process.env.NR_API_KEY!

    // Fetch all existing policies from remote
    const remotePolicies = (
        await axios.get('https://api.eu.newrelic.com/v2/alerts_policies.json', {
            headers: { 'X-Api-Key': apiKey },
        })
    ).data['policies'] as AlertPolicy[]

    // Step through each local policy:
    // - determine create/update
    // - execute it with the API
    // - update local with auto-updated remote fields
    const policyJsonsInLocal = fs
        .readdirSync('./src/alerts-poc/alpha/policies')
        .filter((file) => path.extname(file) === '.json')

    policyJsonsInLocal.forEach((policyJsonFilename) => {
        const fileData = fs.readFileSync(
            path.join('./src/alerts-poc/alpha/policies', policyJsonFilename)
        )
        const localPolicy = JSON.parse(fileData.toString()) as AlertPolicy

        // Find corresponding remote policy, if any
        const correspondingRemotePolicy = remotePolicies.find(
            (remotePolicy) => {
                if (localPolicy.id) {
                    return localPolicy.id == remotePolicy.id! // Remote policy ID always exists
                } else {
                    return localPolicy.name == remotePolicy.name // Remote policy name always exists
                }
            }
        )

        if (correspondingRemotePolicy) {
            // Update case
            if (
                localPolicy.id &&
                objectToKey({ localPolicy }) !==
                    objectToKey({ correspondingRemotePolicy })
            ) {
                syncPolicy(
                    localPolicy,
                    policyJsonFilename,
                    apiKey,
                    AlertOpMode.UPDATE
                )
            }
        } else {
            // Creation case
            syncPolicy(
                localPolicy,
                policyJsonFilename,
                apiKey,
                AlertOpMode.CREATE
            )
        }
    })
}

function syncPolicy(
    localPolicy: AlertPolicy,
    policyJsonFilename: string,
    apiKey: string,
    mode: AlertOpMode
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nrResponse: Promise<AxiosResponse<any>>

    if (mode == AlertOpMode.UPDATE) {
        nrResponse = axios.put(
            `https://api.eu.newrelic.com/v2/alerts_policies/${localPolicy.id}.json`,
            {
                policy: {
                    id: localPolicy.id,
                    incident_preference: localPolicy.incident_preference,
                    name: localPolicy.name,
                },
            },
            { headers: { 'X-Api-Key': apiKey } }
        )
    } else if (mode == AlertOpMode.CREATE) {
        nrResponse = axios.post(
            'https://api.eu.newrelic.com/v2/alerts_policies.json',
            { policy: localPolicy },
            { headers: { 'X-Api-Key': apiKey } }
        )
    } else {
        throw Error('AlertSync: Invalid sync mode specified')
    }

    // Do this for create and update cases
    // For deletion (conditions, not policies), this will require a small modification
    nrResponse
        .then((resp) => {
            const remotePolicy = JSON.stringify(resp.data.policy as AlertPolicy)
            fs.writeFile(
                path.join(
                    './src/alerts-poc/alpha/policies',
                    policyJsonFilename
                ),
                remotePolicy,
                (error) => {
                    if (error) {
                        throw error
                    }
                }
            )
            console.log(`[POLICY UPDATE]: ${policyJsonFilename} processed`)
        })
        .catch((resp) => {
            console.log('Error occurred during alert policy update:')
            console.log(resp.data.error)
        })
}

void syncAlphaAlerts()
