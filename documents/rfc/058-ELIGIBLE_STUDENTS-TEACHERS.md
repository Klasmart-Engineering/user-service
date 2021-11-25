# RFC-085: paginated eligible students and teachers for a class

## Synopsis

Current queries for eligible students and teachers are not paginated and can return huge lists.

How can we paginate these queries?

## Background

Eligible students and teachers for a class are currently queried as follows:

```gql
class(class_id: "532fe00c-e38b-4622-b4e5-5f92f7413591") {
  eligibleTeachers {
    user_id
  }
  eligibleStudents {
    user_id
  }
}
```

This returns a potentially huge, unpaginated list via the following query:
```ts
// entities/class.ts
public async _membersWithPermission(permission_name: PermissionName) {
    const results = new Map<string, User>()
    const userRepo = getRepository(User)
    const organizationPromise = userRepo
        .createQueryBuilder()
        .innerJoin('User.memberships', 'OrganizationMembership')
        .innerJoin('OrganizationMembership.organization', 'Organization')
        .innerJoin('OrganizationMembership.roles', 'Role')
        .innerJoin('Role.permissions', 'Permission')
        .innerJoin('Organization.classes', 'Class')
        .where('Class.class_id = :class_id', { class_id: this.class_id })
        .andWhere('Permission.permission_name = :permission_name', {
            permission_name,
        })
        .groupBy(
            'User.user_id, OrganizationMembership.organization_id, Permission.permission_name'
        )
        .having('bool_and(Permission.allow) = :allowed', { allowed: true })
        .getMany()

    const schoolPromise = userRepo
        .createQueryBuilder()
        .innerJoin('User.school_memberships', 'SchoolMembership')
        .innerJoin('SchoolMembership.school', 'School')
        .innerJoin('SchoolMembership.roles', 'Role')
        .innerJoin('Role.permissions', 'Permission')
        .innerJoin('School.classes', 'Class')
        .where('Class.class_id = :class_id', { class_id: this.class_id })
        .andWhere('Permission.permission_name = :permission_name', {
            permission_name,
        })
        .groupBy(
            'User.user_id, SchoolMembership.school_id, Permission.permission_name'
        )
        .having('bool_and(Permission.allow) = :allowed', { allowed: true })
        .getMany()

    const [organizationUsers, schoolUsers] = await Promise.all([
        organizationPromise,
        schoolPromise,
    ])

    for (const organizationUser of organizationUsers) {
        results.set(organizationUser.user_id, organizationUser)
    }
    for (const schoolUser of schoolUsers) {
        results.set(schoolUser.user_id, schoolUser)
    }

    return results.values()
}
```

A previous attempt was made in this PR: https://bitbucket.org/calmisland/kidsloop-user-service/pull-requests/508

It tried to adapt the `usersConnection` query to support this very complex query, which resulted in a very complex implementation. 


This RFC explores a simpler alternative, with some drawbacks.

## Proposal

Two key proposals:

- Add a `permissionId` filter to `organizationMembershipsConnection`
- Don't check school membership roles (since they are not currently used)

By doing the above, we can create this query to find eligible students and teachers for a given class:
```gql
{
  organizationNode(id: "2f0b9a4a-24ac-4cf4-8b69-64477ed57298") { # class.organization_id
    eligibleStudents: organizationMembershipsConnection(
      filter: {permissionId: {operator: eq, value: "attend_live_class_as_a_student_187"}}
    ) {
      totalCount
    }
    eligibleTeachers: organizationMembershipsConnection(
      filter: {permissionId: {operator: eq, value: "attend_live_class_as_a_teacher_186"}}
    ) {
      totalCount
    }
  }
}
```

This is different behaviour from the current eligibleStudents/Teachers implementation in that it doesn’t check school memberships. We may be able to get away with this, because:

- School memberships are a subset of org memberships
- School memberships are not actually assigned roles by the frontend

## Advantages
- Simpler, more performant implementation

## Disadvantages

- School memberships are not checked
- OrganizationMembershipConnectionNodes are returned, additional DB required to get user data
- Moves business logic from backend to client (although we could expose dedicated endpoints that do this under the hood)
- Less user friendly

## Appendix

- Ticket: https://calmisland.atlassian.net/browse/AD-1434
- Related bug: https://calmisland.atlassian.net/browse/AD-1690

## Decision


|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Enrique          | Pending  |   🟡   |
| Henrik           | Pending  |   🟡   |
| Ismael           | Pending  |   🟡   |
| Admin service    | Pending  |   🟡   |
