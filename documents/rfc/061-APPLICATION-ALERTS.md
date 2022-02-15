# RFC-061

## Synopsis

Defining and maintaining New Relic application alerts.

## Background

Observability has been a key focus in our engineering teams for the past six months, with logging and monitoring now largely set up in New Relic.
The next logical step is to build out our alerting suite which will complement our on-call initiative, in order to catch deficiencies in our product offering before its availability, and reputation, would take a significant hit.

The advice from SRE (from Tim) is for all application teams to own their own monitoring and alerting repositories dedicated to *application alerts*. At the same time, the infrastructure team will own their own infrastructure alerts (for `user-service`) and corresponding repository. Therefore, this RFC outlines how `user-service` can:

1. create/read/update/delete application alerts
2. deploy these changes
3. maintain/store application alerts

## Terminology

A distinction should be made between "infrastructure" and "application" alerts, since we only care about the latter. "Infrastructure" alerts monitor "bare-metal"/software metrics from our cloud infrastructure such as database CPU/memory/disk space, Heimdall similar metrics, load balancer health, and AWS ECS CPU/memory. Tim has stated that `user-service` does not own these alerts because we do not own or control the operations of these components. Instead, we are to own "application" alerts which monitor New Relic's APM (application performance monitoring) metrics, and these are emitted directly from our application through the APM service to surface as three of the standard ["Golden Signal"](https://newrelic.com/blog/best-practices/monitoring-golden-signals) metrics:

1. Latency (response time)
2. Traffic/Throughput (number of requests per time unit)
3. Errors (number of failing requests, usually per time unit)

Other application alerts can/will be defined from transformed error-level logs and any other sources that emit metrics from our application.

## Proposal

### CRUD: how to CRUD alert definitions?

There are two immediate options to define alerts:

1. Through the New Relic UI
2. Infrastructure-as-code

Option #1 is the "non-programmatic" way of creating infrastructure and alerts in any PaaS or IaaS platform. The UI makes designing alerts easy. However, there are a few downsides to this:

* We rely on visiting New Relic to view and change alert definitions
* There is no backup of alert definitions in the event that these alerts are lost for any reason
* Version control of subsequent updates/deployments is non-existent

The latter two considerations have contributed to the rise of "Infrastructure-as-code" (Option #2) practices in recent years in cloud engineering. By defining `user-service` alerts in code, we can treat them the same as any code that we push to our main `user-service` application repository, going through the same review procedures (although the deployment procedure may differ to application code).

For Option #2, we must consider what "code" we define our alerts with, along with how to deploy this code to New Relic. Numerous infrastructure code languages exist in the cloud engineering space, yet we should not forget that we are only concerned with New Relic and the fact that it is a PaaS solution, not an IaaS solution - it has its own REST API to facilitate CRUD operations on any components we own in New Relic. Let's consider three options:

1. Terraform, a popular infrastructure code language used by the infrastructure team
2. New Relic REST API
3. New Relic NerdGraph API

#### Terraform

Terraform is undoubtedly powerful and is the natural language of choice for the infrastructure team to design New Relic alerts with (they use Terraform to manage/deploy cloud resources as well). [New Relic provides support for Terraform](https://newrelic.com/blog/how-to-relic/observability-as-code-new-relic-terraform-provider) in that it integrates seamlessly with the Terraform service by simplying specifying in `main.tf`:

```
provider "newrelic" {
  api_key = var.newrelic_api_key
} 
```

And, along with other resource definitions such as a New Relic API key and alert policies, we can then define alerts as such:

```
resource "newrelic_alert_condition" "response_time_web" {
    policy_id       = user-service_alerts_policy.id
    name            = "High Response Time (web)"
    type            = "apm_app_metric"
    entities        = [user-service_global-prod_application.id]
    metric          = "response_time_web"
    condition_scope = "application"
    terms = [
        term {
            duration      = 5
            operator      = "above"
            priority      = "critical"
            threshold     = "5"
            time_function = "all"
        },
        term {
            duration      = 5
            operator      = "above"
            priority      = "warning"
            threshold     = "2"
            time_function = "all"
        }
    ]
}
```

To update these definitions, we run `terraform plan` for Terraform to present the changeset, then `terraform apply` to apply the changeset.
Alternatively, we could include these commands in our CI/CD pipeline such that any changeset changes are detected upon every CI/CD deployment (discussed in [Deployment](#deployment)).

It is unclear at the moment what the best practice is for deleting an alert condition. Removing its definition from the Terraform code may not necessarily delete the resource on the other side (this needs to be confirmed) via `terraform apply`. `terraform destroy` (with the `-target` flag) also exists.

The downsides to `user-service` using Terraform are the following:

* Tim from SRE strongly advises *against* using Terraform, quote: "... Terraform I strongly advise not using, unless you fully understand the call graphs, remote state files, HCL, and lots of other things, like sharing the state files etc."
* `user-service` would have to learn and maintain a new language, as Tim stated
* Given we will be managing our own alerting repo, there may be some difficulty in coordinating any infrastructure component metadata we may need with the `kidsloop-infra` repo. This should not be too much of a problem though as the component definitions for New Relic alerts are very minimal (API key, the New Relic application we act on, and the alert policy we affect)
* `user-service` is billed as an application team first and foremost, not an infrastructure team; relying on infrastructure code languages is somewhat antithetical to that mission

#### New Relic REST API

Fortunately, we have the option available to us where we don't have to learn a new language. Instead, we could use New Relic's REST API to perform CRUD operations on our alerts. A preliminary test using Postman to GET query `https://api.eu.newrelic.com/v2/alerts_conditions.json?policy_id=152349` (which lists all APM-sourced alert conditions currently defined for a particular KidsLoop-created alert policy with ID 152349) with an appropriate API key header shows the following:

```
{
    "conditions": [
        {
            "id": 735565,
            "type": "apm_app_metric",
            "name": "Error percentage (High)",
            "enabled": true,
            "entities": [
                "220010060"
            ],
            "metric": "error_percentage",
            "condition_scope": "application",
            "terms": [
                {
                    "duration": "5",
                    "operator": "above",
                    "priority": "critical",
                    "threshold": "8",
                    "time_function": "all"
                }
            ]
        },
        {
            "id": 735555,
            "type": "apm_app_metric",
            "name": "Error percentage (High)",
            "enabled": true,
            "entities": [
                "16884",
                "18229"
            ],
            "metric": "error_percentage",
            "condition_scope": "application",
            "terms": [
                {
                    "duration": "5",
                    "operator": "above",
                    "priority": "critical",
                    "threshold": "40",
                    "time_function": "all"
                },
                {
                    "duration": "5",
                    "operator": "above",
                    "priority": "warning",
                    "threshold": "8",
                    "time_function": "all"
                }
            ]
        }
    ]
}
```

This shows 1) how easy it is to query the New Relic REST API for alert conditions, and 2) the form that these alert conditions take (notice the similar format with the earlier Terraform alert definition).

Using the New Relic REST API offers additional flexibility in querying/designing alerts, as it also offers CRUD functionality for NRQL (New Relic Query Language)-based alerts. At time of writing, querying for an NRQL-based alert via a GET request to `https://api.eu.newrelic.com/v2/alerts_nrql_conditions.json?policy_id=170963` would return the following:

```
{
    "nrql_conditions": [
        {
            "id": 830993,
            "type": "static",
            "name": "User Service prod error lines",
            "enabled": false,
            "value_function": "single_value",
            "violation_time_limit_seconds": 259200,
            "terms": [
                {
                    "duration": "5",
                    "operator": "above",
                    "threshold": "500.0",
                    "time_function": "all",
                    "priority": "critical"
                }
            ],
            "nrql": {
                "query": "SELECT count(*) FROM Log WHERE service = 'user-service' and environment = 'prod' and level = 'error' FACET `environment`, `level` EXTRAPOLATE "
            },
            "signal": {
                "aggregation_window": "300",
                "aggregation_method": "EVENT_FLOW",
                "aggregation_delay": 120,
                "fill_option": "none"
            },
            "description": "High number of error lines detected in the user service logs"
        }
    ]
}
```

The above demonstrates how to *query* for existing alert conditions, but what if we wanted to create, update, or delete them?

* To create, send a POST request with the required fields in the alert condition definition, specifying the policy ID to be affected in the request URL
* To update, send a PUT request with just the required fields to update, specifying the condition ID to be affected in the request URL
* To delete, send a DELETE request with just the condition ID to be affected in the request URL

The above shows what kind of requests we send through the API. In whatever repository we use, we will be storing the actual alert definitions as well.
The aim should be to represent this information as simply as possible, and to have any updates to their definitions shown clearly in PRs.
In essence, the repository would act as a database to be synced with our New Relic account. The update procedure will be discussed in [Deployment](#deployment).
With this in mind, each alert condition can be stored as a JSON file. For example, in its initial state before updating New Relic, we could have a JSON file `highErrorRate.json`:

```
{
    "type": "apm_app_metric",
    "name": "Error percentage (High)",
    "enabled": true,
    "entities": [
        "220010060"
    ],
    "metric": "error_percentage",
    "condition_scope": "application",
    "terms": [
        {
            "duration": "5",
            "operator": "above",
            "priority": "critical",
            "threshold": "8",
            "time_function": "all"
        }
    ]
}
```

Notice the `id` field is missing - this JSON file would get updated by a client (that we write ourselves) upon upload to New Relic, as New Relic would automatically generate an ID, and our client can read it and populate the `id` field in the JSON file (to be discussed further in [Deployment](#deployment)).

#### New Relic NerdGraph API

According to the New Relic documentation, New Relic users are encouraged to use the newer, unified GraphQL-based NerdGraph API over the REST API. However, there is a caveat when it comes to performing CRUD operations on alert conditions: NerdGraph only sees and deals with NRQL-based alert conditions, i.e. alert conditions based on NRQL queries. Therefore, if we wanted to use this API, we would have to compose all of our alert conditions in NRQL. For example, currently there are two ways to represent the golden metric for latency (i.e. high response time) in New Relic:

1. Through the New Relic APM service, as "Response Time (web)"
2. Through the New Relic NRQL service, as `SELECT average(newrelic.goldenmetrics.apm.application.responseTimeMs) FROM Metric WHERE appName like '%prod%' FACET appName, entity.guid`, for example, where we would need to correctly configure the `SELECT` and `WHERE` clauses

Here is an example of querying for all alert conditions' ID, name, type, and their terms' operator and threshold in our account, at time of writing:

```
{
  actor {
    account(id: 3286825) {
      alerts {
        nrqlConditionsSearch {
          nextCursor
          nrqlConditions {
            id
            name
            type
            terms {
                operator
                threshold
            }
          }
          totalCount
        }
      }
    }
  }
}
```

With the response:

```
{
    "data": {
        "actor": {
            "account": {
                "alerts": {
                    "nrqlConditionsSearch": {
                        "nextCursor": null,
                        "nrqlConditions": [
                            {
                                "id": "830993",
                                "name": "User Service prod error lines",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 500.0
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "829461",
                                "name": "High Application Errors (threshold, prod only)",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 0.4
                                    },
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 0.1
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "828670",
                                "name": "High Application Response Time (threshold, prod only)",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 6.0e4
                                    },
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 1.0e4
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "779148",
                                "name": "data-dms-prod-india-cpu-utilisation-critical",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 1.95
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "779147",
                                "name": "data-dms-prod-india-memory-usage-critical",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 3.0e9
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "769330",
                                "name": "kl-int-data-glue-job-killed",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 0.9
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "725141",
                                "name": "High CPU Utilization",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 90.0
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "725140",
                                "name": "Apdex Score",
                                "terms": [
                                    {
                                        "operator": "BELOW",
                                        "threshold": 0.5
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "725139",
                                "name": "Transaction Errors",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 10.0
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "717914",
                                "name": "Low Application Throughput (prod only)",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 10.0
                                    },
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 3.0
                                    }
                                ],
                                "type": "BASELINE"
                            },
                            {
                                "id": "717913",
                                "name": "High Application Response Time",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 3.0
                                    },
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 5.0
                                    }
                                ],
                                "type": "BASELINE"
                            },
                            {
                                "id": "717912",
                                "name": "High Application Error percentage (prod only)",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 3.0
                                    }
                                ],
                                "type": "BASELINE"
                            },
                            {
                                "id": "717911",
                                "name": "High CPU (prod only)",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 85.0
                                    }
                                ],
                                "type": "STATIC"
                            },
                            {
                                "id": "715203",
                                "name": "mysql-database-active-connections",
                                "terms": [
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 60.0
                                    },
                                    {
                                        "operator": "ABOVE",
                                        "threshold": 50.0
                                    }
                                ],
                                "type": "STATIC"
                            }
                        ],
                        "totalCount": 14
                    }
                }
            }
        }
    }
}
```

Aside from the NRQL distinction, for all intents and purposes, using the NerdGraph API would be very similar to how we would use the REST API, with the benefit that NerdGraph API appears to be receiving more attention and is actively developed by New Relic, and we avoid the classic REST problem of dealing with multiple endpoints. In our simple case of querying just the REST Alerts API, this isn't a huge problem. But in future if the repository expands to include other New Relic monitoring management, then using the NerdGraph API would mean we would not have to add more REST API endpoints to our calls.

### Deployment: how to detect and deploy updated alert definitions

We've discussed how to define alerts in code in Terraform and the New Relic REST API. Another topic of equal importance is how we deploy our changes.
The aim is to have the alert deployment procedure controlled such that no deployment can happen locally - it must be done from the CI/CD pipeline (ensures it's had PR reviews).

#### Terraform

CI/CD deployments can be managed through the Terraform Enterprise platform (as we already have to communicate with Terraform Cloud to effect alert definition changes). The infrastructure team is currently trialling this product. However, the most important pre-requisite is that we have our own Terraform account and workspace to manage, in addition to access to CircleCI.

We define a CI/CD pipeline to execute the following Terraform jobs (with simplified explanations) in a CircleCI `config.yml`. The relevant steps below will be defined in YAML, as per the [CircleCI Terraform tutorial on Terraform's website](https://learn.hashicorp.com/tutorials/terraform/circle-ci):

1. `terraform plan` - checkouts the working directory (in this case, where our alert policies and conditions are), creates a changeset, and saves the initialised config
2. `terraform apply` - applies the changeset/plan

```
jobs:  
  plan-apply:    
    working_directory: /alerts/policies    
    docker:      
      - image: docker.mirror.hashicorp.services/hashicorp/terraform:light    
    steps:      
      - checkout      
      - run:          
        name: terraform init & plan          
        command: |            
          terraform init -input=false            
          terraform plan -out tfapply -var-file variables.tfvars      
      - persist_to_workspace:          
        root: .          
        paths:            
          - .
  apply:    
    docker:      
      - image: docker.mirror.hashicorp.services/hashicorp/terraform:light    
    steps:      
      - attach_workspace:        
        at: .    
      - run:        
        name: terraform        
        command: |          
          terraform apply -auto-approve tfapply    
      - persist_to_workspace:        
        root: .        
        paths:          
          - .
```

Note that we *persist to* and *attach* our workspace to save and retrieve the config relevant to this CI/CD pipeline.

For approval purposes, we can define which jobs require approval in the overall pipeline definition:

```
workflows:  
  version: 2  
  plan_approve_apply:    
    jobs:      
      - plan-apply      
      - hold-apply:          
        type: approval          
        requires:            
          - plan-apply      
      - apply:          
        requires:            
          - hold-apply
```


#### New Relic REST and NerdGraph APIs

New Relic API keys don't offer the granularity required for a read-only API key for local development and a read/write API key for CI/CD deployments. Therefore, we must use *process* rather than *technology* to control deployment. As mentioned in [How to define alerts with the New Relic REST API](#new-relic-rest-api), we would treat the repository as a database, and we can design a TypeScript client to facilitate interactions with the New Relic REST API. Furthermore, we can write a Bash script to run a client method which detects differences with remote New Relic and calls the appropriate client methods to update the alert policies/conditions. 

As far as discouraging local deployments goes, this Bash script could be designed to be used only within the CI/CD pipeline (this point needs to be expanded upon to provide concrete ideas).

Therefore, let's illustrate the deployment process for creating an alert policy and an alert condition within it:

1. Have new policy and condition JSONs defined in the repository
2. PR is raised, reviewed and appoved, and JSONs are merged into main branch
3. CI/CD pipeline (perhaps GitHub Actions) detects change, runs `sync_newrelic_alerts.sh` Bash script
4. `sync_newrelic_alerts.sh` Bash script, with CI/CD permissions, runs `alertsClient.sync()`, which in turn 1) detects differences between local and New Relic remote alert definitions, 2) makes the appropriate API requests to sync, and 3) updates local JSONs with any missing ID fields

This CI/CD flow can work with any change in the repository's JSONs.

The `alertsClient` we create can either handle/process alert definitions using JSON or translate them into the TypeScript medium, although the latter may provide questionable benefits for the added complexity if we are going to convert any updates back to JSON anyway:

```
interface AlertConditionTerm {
    duration: string
    operartor: string
    priority: string
    threshold: string
    timeFunction: string
}

interface AlertCondition {
    id?: number
    type: string
    name: string
    enabled: boolean
    entities: string[]
    metric: string
    conditionScope: string
    terms: AlertConditionTerm[]
}

interface AlertPolicy {
    id?: number
    incidentPreference: string
    name: string
    conditions?: AlertCondition[]
}
```

#### Environment-specific alerts

We may want to deploy alpha-environment-specific alerts to test them before deploying the same alert as production-level. For the New Relic API options, this would *not* work in the traditional CI/CD way where the same code is injected with environment variables and its build is deployed through different target environments in sequence (e.g. alpha, then staging, then prod). The reason is because New Relic, the target "environment" for this scenario, surfaces metrics from all environments in the same platform/interface.

If we instead deployed our alerts via Terraform and CircleCI, we could take advantage of more traditional CI/CD processes in the way that we can design a pipeline to first deploy an alert definition through the Terraform Cloud as the alpha environment version, with a hold placed on next deployment steps (that is, deploying the prod environment version) until testing of the alarm has been done and approval has been granted.

We can separate alert conditions targeting the same metric based on the metric data's tagging, i.e. `tags.Environment`, provided it's available. This is easily shown through NRQL-based alerts. For example, if we were designing an error rate alert based on alpha-environment-specific data, we could specify the following NRQL (more WHERE clauses would be needed to specify `user-service` only):

```
FROM Metric SELECT count(apm.service.error.count) / count(apm.service.transaction.duration) as 'Error Rate' WHERE tags.Environment = 'alpha' FACET appName
```

We want to group our alert conditions by environment (both in our repository and in New Relic), so we can simply group them under environment-specific alert policies (e.g. `User Service Alpha Alerts` and `User Service Prod Alerts`). Since our repository would aim to keep New Relic in sync with it, our repository could either:

* Reflect these different environment groups in its folder structure, having `alpha` and `prod` (and possibly other environments) folders with alert condition versions for each of them
* Have a single set of alert conditions, and insert the environment value at API-request time to update the corresponding conditions in New Relic

The first option has the obvious downside of repeated, non-DRY code, and could be unwieldy if we had 10+ alert conditions (therefore we would have N x 10+ conditions to store where N is number of environments we want to alert in). This disadvantage would be minimal if these quantities were low, and we would have the advantage of seeing the exact representation of alert conditions that are currently deployed to New Relic as well. Therefore, this option would suit a New Relic API-based solution.

The second option seeks to implement DRY. If we go with the New Relic API-based solution, the main disadvantage would be not reflecting what is deployed to different environments (since it is often the case we would want to test different thresholds or other values in alpha environment before doing the same for prod). Another disadvantage would be the added complexity of our custom API client in designing the sync process based on what environment we want the corresponding alert conditions to be updated in. If we went with the Terraform/CircleCI solution, however, versioning would be more trackable based on where the pipeline deployment is at (viewable in CircleCI UI), and so this solution is more in line with traditional code deployment where there is only one version of code for different environments (with environment variables). So the second option is more suited for a Terraform/CircleCI solution.

### Maintaining and storing alert definitions

There are two immediate options for where to store all the code discussed:

1. The same repository we keep our application code in (`kidsloop-user-service`)
2. A new repository (`kidsloop-user-service-alerts`)

Keeping all of our code in the same place makes it easier for developers to know where to find the alert code. Additionally, `kidsloop-user-service` is where our CI/CD pipeline is defined, so integration of the alerts client's Bash script would be made easier *if* we wished to tie our alert updates to our main CI/CD pipeline.

On the other hand, Tim from SRE has expressed the vision that an application team should have separate repositories for application code and monitoring/alerting code. This would properly separate *application* code from *infrastructure*(-related) code, and it would help the infrastructure team and other client/"on-call" teams read the alerting code easily without having to wade through `user-service` application code. The immediate downside is that this would be yet another repository to be cognizant of for `user-service`, let alone the responsibility of maintaining it. However, this might have been bound to happen if SRE's vision is to have these separate repositories eventually anyway.

### Error handling

In the event of any errors during synchronisation of the repository's alert definitions and New Relic remote, it is the alerts client's responsibility to handle them. If the API returns error responses, our client can attempt another request(s), then exponentially back off and eventually raise an error that synchronisation failed to complete during the CI/CD deployment.

## Out of scope

What application alerts to define.

## Decision

* Separate repository (`kidsloop-user-service-alerts`) for storing all alerts definitions, which take the form of JSONs (alert policies, alert conditions)

### Why?

A separate repository makes it reusable as a tool or at least a demonstration for other teams.
JSONs are the simplest representations for our purpose.

* New Relic NerdGraph API in conjunction with custom TypeScript client for making HTTP requests to the API and synchronising the repository alert definitions and New Relic remote

### Why?

The biggest decision made in this RFC came down to considering Terraform vs. New Relic APIs. Terraform is powerful, but introduces too much knowledge and code overhead to make it worth it for the team's purposes of setting up simple alerts in the short term. Between the REST API and the NerdGraph API, the NerdGraph API is actively maintained and presents the benefits of GraphQL that we are used to. The synchronisation mechanism will be trialled out in a POC, so this RFC will be updated once it is known how effective the mechanism is.


* If we go with the API solution, then we should have separate folders for each environment we want to alert its metrics on, representing the environment-specific alert policies with their alert condition JSONs within

### Why?

We currently do not envision having many alert conditions, and we do not have many environments to alert on (alpha, prod, maybe staging). Therefore, duplicating alert conditions should be harmless. Furthermore, changes to any environment-specific alert condition can be viewed easily in a PR. 

* Stick to using REST API for POC

### Why?

REST and NerdGraph APIs are practically equivalent in terms of information received, but REST is easier to work with in the context of a POC. Furthermore, the synchronisation mechanism is the focus of the POC - if it can be demonstrated to work with REST, then it will work with NerdGraph.

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Toghrul          | Pending  |   🟡   |
| Oliver           | Pending  |   🟡   |
| Max              | Pending  |   🟡   |
| Matthew          | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Raphael          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
