# RFC-XXX

## Synopsis

A high level summary of how we'd like to evolve the behavior of roles in the user system.
This is not intended as something we will implement now, but rather a shared vision of the direction we want to head in.

## Background

This was written based on @emfg's explanation of why we should not implement membership child connections in our graphQL API.

At the moment a connection node is natural for memberships because they are a 3 way JOIN between organisations, roles and users, or schools, roles and users.

This makes this look like a natural model:

```
userNode {
    membershipsConnection{
        edges{
            node{
                organizationNode{
                    id
                },
                userNode{
                    id
                },
                rolesConnection{
                    edges{
                        node{
                            id
                        }
                    }
                }
            }
        }
    }
}
```

However if role's was removed from this relationship, we are left with a much more simple model:

```
userNode {
    organizationsConnection{
        edge{
            node{
                id
            }
        }
    }
}
```

But how do you remove roles from the relations?

## Proposal

Allow users to be given roles in an organization independently of whether or not they are a member of the organization.

This makes sense if you image roles as a set of permissions - you might want to grant a guest permission to join your classes, without actually adding them to your organization.

Today we have

```
       user
        │
        │
    has ├───────────role
        │             ▲
        │             │
        │             │
       org────────────┘
               owns
```

We would move to:

```
                    has
           user ───────────┐
            │              │
            │              │
     belongs│            role
      to    │              ▲
            │              │
            ▼              │
           org─────────────┘
                   owns
```


## Classes, students and teachers

At the moment we have explicit JOIN tables for denoting the users who are in a class as students and teachers.

An alternative would instead be to model only which users are in a class, and then check their permissions to decide if they are a teacher or a student.

Today:

```
   ┌───────────────┐
   │    is student │
   │               │
   │               ▼
  user           class
   │               ▲
   │    is teacher │
   └───────────────┘
```

We would move to:

```
          is in
    user────────►class
      │
      │
      │has
      │
      └──────►role
```

## Associating roles with orgs/schools/classes

Allowing roles to be directly associated with users is great for flexibility.
But what if you want to give the same role to many users?

We could allow roles to be associated with class, schools and orgs.
This would act as "default roles" for any user added to those entities ("is a member of").

Orgs would have 2 relationships with roles

1) those they own (for defining custom roles)
2) those they give to their members

Today we have:

```
                 school
                   │
      is student   │has
     ┌──────────┐  ├─────────────────┐
     │          │  │                 │
     ▼          │  ▼                 │
  class         │user              role◄─┐
     ▲          │  ▲                 │   │
     │          │  │                 │   │
     └──────────┘  │has              │   │
      is teacher   ├─────────────────┘   │
                   │                     │owns
                   │                     │ 
                  org────────────────────┘
```

We would move to:

```
                         owns
      role◄───────────────────────────┐
       │                              │
       │         default role(s)      │
       ├────────┬───────┬─────────┐   │
       │        │       │         │   │
   has │        │       │         │   │
       ▼        ▼       ▼         ▼   │  
     user      class  school    org───┘
       │        ▲       ▲         ▲
       │        │       │         │
       │        │       │         │
       └────────┴───────┴─────────┘
         belongs to
```

## User table

Along with this, it's also expected that most data in the user table will move to another service. That helps isolate use from any PII data.

So the User table will go from something like:

```
user_id
given_name
family_name
username
email
phone
date_of_birth
gender
avatar
status
deleted_at
primary
alternate_email
alternate_phone
myOrganizationOrganizationId
created_at
updated_at
```

To more like:

```
user_id
status
deleted_at
created_at
updated_at
```

## Out of scope

Actually building any of this

## Decision

Default reviewer list - deleted/add to as appropriate:

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Enrique          | Pending  |   🟡   |
| Oliver           | Pending  |   🟡   |
| Max              | Pending  |   🟡
| Matthew          | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Sam              | Pending  |   🟡   |
| Raphael          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
