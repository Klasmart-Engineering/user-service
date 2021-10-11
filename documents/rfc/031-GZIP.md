# RFC-031-GZIP

### Synopsis

Requests involving large lists (e.g pagination, permissions) returns large response payloads, anywhere from 10kB to 200 kB.
We can compress these responses to save bandwidth and speed up loading for end users.

### Background

Paginated endpoints with multiple child nodes (particularly with large page size), and any query involving an entity with many results (e.g. permissions for each Role, categories for an Organization) typically return a large response.

#### Example Request

```graphql
query getOrganizationRoles($organization_id: ID!) {
    organization(organization_id: $organization_id) {
        roles {
            role_id
            role_name
            role_description
            system_role
            status
            permissions {
                permission_id
                permission_name
                permission_group
                permission_level
                permission_category
                permission_description
                __typename
            }
            __typename
        }
        __typename
    }
}
```

#### Response

```json
{
    "data": {
        "organization": {
            "roles": [
                {
                    "role_id": "32d320c8-055a-457a-853a-00f8ab04b074",
                    "role_name": "Organization Admin",
                    "role_description": "System Default Role",
                    "system_role": true,
                    "status": "active",
                    "permissions": [
                        {
                            "permission_id": "create_content_page_201",
                            "permission_name": "create_content_page_201",
                            "permission_group": "Create Content",
                            "permission_level": "Teacher",
                            "permission_category": "Library",
                            "permission_description": "Gives users access to create content pages",
                            "__typename": "Permission"
                        },
                        ...
                        ... other Permissions and other Roles
```

| Uncompressed | Compressed |
|:------------:|:----------:|
| 196kB        | 16kB       |

#### Request Sizes

|                   Query                   |    Size    |                     Comment                    |
|:-----------------------------------------:|:----------:|:----------------------------------------------:|
| My user info (e.g. name, avatar)          | 200B - 1kB |                                                |
| ageRangesConnection (6 Age Ranges)        | 2kB        | No child nodes                                 |
| gradesConnection (15 Grades)              | 7kB        | 3 columns only                                 |
| programsConnection (10 Programs)          | 16kB       | Multiple child nodes                           |
| usersConnection (20 Users)                | 18kB       | Multiple child nodes                           |
| getOrganizationCategories (75 Categories) | 47kB       |                                                |
| My memberships                            | 56kB       | Permissions for each Role, for each Membership |
| getOrganizationRoles                      | 196kB      | Permissions for each Role in the Organization  |

### Proposal

Leverage NGINX's more efficient GZIP capabilities, rather than use an application layer solution.

Override default `gzip_min_length`/`gzip-min-length` of 256 bytes with 1000 bytes (not worth compressing such a small response).

Use a `gzip_comp_level`/`gzip-level` of 1.
Level 1 results in a ~80% reduction in size, and even at Level 9 typically only achieved ~83%.
The additional CPU load is minimal from level 1 to 4/5 for small files, but as the benefit is marginal it doesn't even seem worth it.

For both ECS and Kubernetes (K8s) deployments, we will use a test enviroment to benchmark response times pre and post GZIP to validate the change (e.g. alpha for ECS, POC env for K8s), before promoting to production.

NB: Settings are in nginx.conf (ECS)/Ingress Controller (K8s) format

#### K8s Deployments

Set the `use-gzip` flag to ‘true’ in the NGINX Ingress Controller running infront of the Kubernetes cluster for the User Service.

Relevant [config](https://bitbucket.org/calmisland/open-credo-deployment/src/1654a0cbc83b03efdb77418636e7a975dd480389/k8s/helm/helmfile.d/user-service.yaml#lines-46) section.

Relevant deployments:
- Indonesia
- Vietnam

#### ECS deployments

Create new ECS task for an [NGINX Reverse Proxy 'Sidecar' container](https://aws.amazon.com/blogs/compute/nginx-reverse-proxy-sidecar-container-on-amazon-ecs/), configured to GZIP responses with the `gzip on` directive.

These NGINX containers would sit behind the Fargate Application Load Balancer, but infront of the the application containers (which are usually 2x per deployment).

Relevant deployments:
- UK
- India
- Global
- Alpha

### Alternatives

- Use npm `compression` library on the application layer
    - Pros
        - Easy to implement
        - No SRE involvement required
    - Cons
        - Slower than NGINX (will offset more of the gains from compression)
        - Extra CPU load on the application container
- Wait for planned SRE work to shift all deployments to K8 (Working title: KidsKube)
    - Pros
        - One configuration/setup
    - Cons
        - Currently no timeline on when this will be available

### Appendix

[NGINX Ingress Controller - Config](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/configmap/#use-gzip)

[Kubernetes - Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)

[NGINX Ingress Controller - Summary](https://kubernetes.github.io/ingress-nginx/)

[NGINX - Compression and Decompression](https://docs.nginx.com/nginx/admin-guide/web-server/compression/)

[npm: compression](https://www.npmjs.com/package/compression)

[ask-sre Slack Conversation](https://kidsloop.slack.com/archives/C021QCLAESZ/p1631799350006700)

### Decision

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Enrique          | Pending  |   🟡   |
| Matthew          | Pending  |   🟡   |
| Max              | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Sam              | Pending  |   🟡   |
| Raphael          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
