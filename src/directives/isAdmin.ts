import { defaultFieldResolver, GraphQLSchema } from 'graphql'
import {
    BaseEntity,
    getRepository,
    SelectQueryBuilder,
    Brackets,
    createQueryBuilder,
} from 'typeorm'
import { Class } from '../entities/class'
import { AgeRange } from '../entities/ageRange'
import { Category } from '../entities/category'
import { Grade } from '../entities/grade'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
import { Subcategory } from '../entities/subcategory'
import { Subject } from '../entities/subject'
import { User } from '../entities/user'
import { Program } from '../entities/program'
import { Context } from '../main'
import { UserPermissions } from '../permissions/userPermissions'
import { PermissionName } from '../permissions/permissionNames'
import { SchoolMembership } from '../entities/schoolMembership'
import { School } from '../entities/school'
import { isSubsetOf } from '../utils/array'
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils'
import { Permission } from '../entities/permission'
import { scopeHasJoin } from '../utils/typeorm'
import { AcademicTerm } from '../entities/academicTerm'

//
// changing permission rules? update the docs: permissions.md
//

export type IEntityString =
    | 'organization'
    | 'user'
    | 'role'
    | 'class'
    | 'ageRange'
    | 'grade'
    | 'category'
    | 'subcategory'
    | 'subject'
    | 'program'
    | 'school'
    | 'permission'
    | 'schoolMembership'
    | 'organizationMembership'
    | 'academicTerm'

interface IsAdminDirectiveArgs {
    entity?: IEntityString
}

type NonAdminScope<Entity extends BaseEntity> = (
    scope: SelectQueryBuilder<Entity>,
    permissions: UserPermissions
) => Promise<void> | void

export function isAdminTransformer(schema: GraphQLSchema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const isAdminDirective = getDirective(
                schema,
                fieldConfig,
                'isAdmin'
            )?.[0]
            if (!isAdminDirective) return

            const { resolve = defaultFieldResolver } = fieldConfig
            const { entity } = isAdminDirective as IsAdminDirectiveArgs
            fieldConfig.resolve = async (
                source,
                args,
                context: Context,
                info
            ) => {
                const scope = await createEntityScope({
                    permissions: context.permissions,
                    entity,
                })
                args.scope = scope
                return resolve(source, args, context, info)
            }
            return fieldConfig
        },
    })
}

export interface ICreateScopeArgs {
    permissions: UserPermissions
    entity?: IEntityString
}

export const createEntityScope = async ({
    permissions,
    entity,
}: ICreateScopeArgs) => {
    let scope: SelectQueryBuilder<BaseEntity> | undefined
    switch (entity) {
        case 'organization':
            scope = getRepository(Organization).createQueryBuilder()
            break
        case 'user':
            scope = getRepository(User).createQueryBuilder()
            break
        case 'role':
            scope = getRepository(Role).createQueryBuilder()
            break
        case 'class':
            scope = getRepository(Class).createQueryBuilder()
            break
        case 'ageRange':
            scope = getRepository(AgeRange).createQueryBuilder()
            break
        case 'grade':
            scope = getRepository(Grade).createQueryBuilder()
            break
        case 'category':
            scope = getRepository(Category).createQueryBuilder()
            break
        case 'subcategory':
            scope = getRepository(Subcategory).createQueryBuilder()
            break
        case 'subject':
            scope = getRepository(Subject).createQueryBuilder()
            break
        case 'program':
            scope = getRepository(Program).createQueryBuilder()
            break
        case 'school':
            scope = getRepository(School).createQueryBuilder()
            break
        case 'permission':
            scope = getRepository(Permission).createQueryBuilder()
            break
        case 'schoolMembership':
            scope = getRepository(SchoolMembership).createQueryBuilder()
            break
        case 'organizationMembership':
            scope = getRepository(OrganizationMembership).createQueryBuilder()
            break
        case 'academicTerm':
            scope = getRepository(AcademicTerm).createQueryBuilder()
            break
        default:
            permissions.rejectIfNotAdmin()
    }
    if (!permissions.isAdmin && scope) {
        switch (entity) {
            case 'organization':
                await nonAdminOrganizationScope(
                    scope as SelectQueryBuilder<Organization>,
                    permissions
                )
                break
            case 'user':
                await nonAdminUserScope(
                    scope as SelectQueryBuilder<User>,
                    permissions
                )
                break
            case 'ageRange':
                await nonAdminAgeRangeScope(
                    scope as SelectQueryBuilder<AgeRange>,
                    permissions
                )
                break
            case 'grade':
                await nonAdminGradeScope(
                    scope as SelectQueryBuilder<Grade>,
                    permissions
                )
                break
            case 'category':
                await nonAdminCategoryScope(
                    scope as SelectQueryBuilder<Category>,
                    permissions
                )
                break
            case 'subcategory':
                await nonAdminSubcategoryScope(
                    scope as SelectQueryBuilder<Subcategory>,
                    permissions
                )
                break
            case 'subject':
                await nonAdminSubjectScope(
                    scope as SelectQueryBuilder<Subject>,
                    permissions
                )
                break
            case 'program':
                await nonAdminProgramScope(
                    scope as SelectQueryBuilder<Program>,
                    permissions
                )
                break
            case 'class':
                await nonAdminClassScope(
                    scope as SelectQueryBuilder<Class>,
                    permissions
                )
                break
            case 'school':
                await nonAdminSchoolScope(
                    scope as SelectQueryBuilder<School>,
                    permissions
                )
                break
            case 'permission':
                await nonAdminPermissionScope(
                    scope as SelectQueryBuilder<Permission>,
                    permissions
                )
                break
            case 'role':
                await nonAdminRoleScope(
                    scope as SelectQueryBuilder<Role>,
                    permissions
                )
                break

            case 'schoolMembership':
                await nonAdminSchoolMembershipScope(
                    scope as SelectQueryBuilder<SchoolMembership>,
                    permissions
                )
                break
            case 'organizationMembership':
                await nonAdminOrganizationMembershipScope(
                    scope as SelectQueryBuilder<OrganizationMembership>,
                    permissions
                )
                break
            default:
            // do nothing
        }
    }
    return scope
}

/**
 * non admins can only view org/school users if they have
 * the appropriate permissions in their org/school memberships
 * otherwise, they can view their user(s)
 * */
export const nonAdminUserScope: NonAdminScope<
    User | OrganizationMembership | SchoolMembership
> = async (scope, permissions) => {
    const user_id = permissions.getUserId()
    const email = permissions.getEmail()
    const phone = permissions.getPhone()

    // for each condition generate a WHERE clause, then OR
    // them all together
    const userFilters: {
        where: string
        params?: Record<string, unknown>
    }[] = []

    userFilters.push({
        where: 'User.user_id = :user_id',
        params: { user_id },
    })

    const userFiltersAnd: {
        where: string
        params?: Record<string, unknown>
    }[] = []

    // assuming no extra permissions, you should only be able to see
    // users whose profiles you can sign in as
    // meaning those that are returned by the profiles resolver
    // profiles does not return users with matching emails or phone numbers if username is set
    // do the same here
    // we don't match on username, because username is supposed to be globally unique
    // which makes it the same as matching on user_id

    if (permissions.getUsername() === undefined) {
        if (email) {
            userFilters.push({
                where: 'User.email = :email',
                params: { email },
            })
        }
        // todo: make this an else if, to match myUsers resolver
        if (phone) {
            userFilters.push({
                where: 'User.phone = :phone',
                params: { phone },
            })
        }
    }

    // avoid querying org users that have already been queried using
    // less restrictive permissions
    const orgsWithFullAccess: string[] = []

    // 1 - can we view org users?
    const userOrgs: string[] = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_users_40110,
    ])

    if (userOrgs.length) {
        if (!scopeHasJoin(scope, OrganizationMembership)) {
            scope.leftJoin('User.memberships', 'OrganizationMembership')
        }
        userFilters.push({
            where:
                'OrganizationMembership.organization_id IN (:...organizations)',
            params: { organizations: userOrgs },
        })
        orgsWithFullAccess.push(...userOrgs)
    }

    // 2 - can we view school users?
    const orgsWithSchools = (
        await permissions.orgMembershipsWithPermissions([
            PermissionName.view_my_school_users_40111,
        ])
    ).filter((org) => !orgsWithFullAccess.includes(org))

    if (orgsWithSchools.length) {
        // find a schools the user is a member of in these orgs
        const schoolIds = await permissions.schoolsInOrgs(orgsWithSchools)

        if (schoolIds.length) {
            if (!scopeHasJoin(scope, SchoolMembership)) {
                scope.leftJoin('User.school_memberships', 'SchoolMembership')
            }
            userFilters.push({
                where: 'SchoolMembership.school IN (:...schools)',
                params: { schools: schoolIds },
            })
        }
    }

    // 3 - can we view class users?
    const orgsWithClasses = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_my_class_users_40112,
    ])
    if (orgsWithClasses.length) {
        const classesTaught = await permissions.classesTeaching(orgsWithClasses)
        if (classesTaught?.length) {
            const distinctMembers = (
                membershipTable: string,
                qb: SelectQueryBuilder<User>
            ) => {
                return qb
                    .select('membership_table.userUserId', 'user_id')
                    .distinct(true)
                    .from(membershipTable, 'membership_table')
                    .andWhere(
                        'membership_table.classClassId IN (:...classIds)',
                        {
                            classIds: classesTaught.map(
                                ({ class_id }) => class_id
                            ),
                        }
                    )
            }
            scope.leftJoin(
                (qb) => distinctMembers('user_classes_studying_class', qb),
                'class_studying_membership',
                'class_studying_membership.user_id = User.user_id'
            )
            scope.leftJoin(
                (qb) => distinctMembers('user_classes_teaching_class', qb),
                'class_teaching_membership',
                'class_teaching_membership.user_id = User.user_id'
            )
            userFilters.push({
                where: 'class_studying_membership.user_id IS NOT NULL',
            })
            userFilters.push({
                where: 'class_teaching_membership.user_id IS NOT NULL',
            })
        }
    }

    // 4 - can we view admin users?
    const orgsWithAdmins = (
        await permissions.orgMembershipsWithPermissions([
            PermissionName.view_my_admin_users_40114,
        ])
    ).filter((org) => !orgsWithFullAccess.includes(org))

    if (orgsWithAdmins.length) {
        // find a schools the user is a member of in these orgs
        const schoolIds = await permissions.schoolsInOrgs(orgsWithAdmins)
        if (schoolIds.length) {
            // add joins and where conds to find school admins of these schools
            if (!scopeHasJoin(scope, SchoolMembership)) {
                scope.leftJoin('User.school_memberships', 'SchoolMembership')
            }
            if (!scopeHasJoin(scope, OrganizationMembership)) {
                scope.leftJoin('User.memberships', 'OrganizationMembership')
            }
            scope.leftJoin('OrganizationMembership.roles', 'Role')
            scope.leftJoin('Role.permissions', 'Permission')
            userFiltersAnd.push(
                {
                    where: 'Permission.permission_name = :permissionName',
                    params: {
                        permissionName:
                            PermissionName.view_my_school_users_40111,
                    },
                },
                {
                    where: 'SchoolMembership.school_id IN (:...schoolIds)',
                    params: { schoolIds },
                }
            )
        }
    }

    // encase all user filters in brackets to avoid conflicting
    // with subsequent conditions
    scope.andWhere(
        new Brackets((qb) => {
            for (const where of userFilters) {
                // match users that meet ANY of the conditions
                qb.orWhere(where.where, where.params)
            }
            if (userFiltersAnd.length > 0) {
                qb.orWhere(
                    new Brackets((qb2) => {
                        for (const where of userFiltersAnd) {
                            qb2.andWhere(where.where, where.params)
                        }
                    })
                )
            }
        })
    )
}

export const nonAdminOrganizationScope: NonAdminScope<
    Organization | OrganizationMembership
> = async (scope, permissions) => {
    const orgIds = await permissions.orgMembershipsWithPermissions([])
    if (orgIds.length > 0) {
        scope.andWhere('Organization.organization_id IN (:...orgIds)', {
            orgIds,
        })
    } else {
        // postgres errors if we try to do `IN ()`
        scope.andWhere('false')
    }
}

// nonAdminOrganizationScope + nonAdminUserScope
export const nonAdminOrganizationMembershipScope: NonAdminScope<OrganizationMembership> = async (
    scope,
    permissions
) => {
    scope.leftJoin('OrganizationMembership.organization', 'Organization')
    scope.leftJoin('OrganizationMembership.user', 'User')

    await nonAdminOrganizationScope(scope, permissions)
    await nonAdminUserScope(scope, permissions)
}

export const nonAdminAgeRangeScope: NonAdminScope<AgeRange> = (
    scope,
    permissions
) => {
    scope
        .leftJoinAndSelect(
            OrganizationMembership,
            'OrganizationMembership',
            'OrganizationMembership.organization = AgeRange.organization'
        )
        .where(
            '(OrganizationMembership.user_id = :d_user_id OR AgeRange.system = :system)',
            {
                d_user_id: permissions.getUserId(),
                system: true,
            }
        )
}

export const nonAdminGradeScope: NonAdminScope<Grade> = (
    scope,
    permissions
) => {
    scope
        .leftJoinAndSelect(
            OrganizationMembership,
            'OrganizationMembership',
            'OrganizationMembership.organization = Grade.organization'
        )
        .where(
            '(OrganizationMembership.user_id = :d_user_id OR Grade.system = :system)',
            {
                d_user_id: permissions.getUserId(),
                system: true,
            }
        )
}

export const nonAdminCategoryScope: NonAdminScope<Category> = (
    scope,
    permissions
) => {
    scope
        .leftJoinAndSelect(
            OrganizationMembership,
            'OrganizationMembership',
            'OrganizationMembership.organization = Category.organization'
        )
        .where(
            '(OrganizationMembership.user_id = :d_user_id OR Category.system = :system)',
            {
                d_user_id: permissions.getUserId(),
                system: true,
            }
        )
}

export const nonAdminSubcategoryScope: NonAdminScope<Subcategory> = (
    scope,
    permissions
) => {
    scope
        .leftJoinAndSelect(
            OrganizationMembership,
            'OrganizationMembership',
            'OrganizationMembership.organization = Subcategory.organization'
        )
        .where(
            '(OrganizationMembership.user_id = :d_user_id OR Subcategory.system = :system)',
            {
                d_user_id: permissions.getUserId(),
                system: true,
            }
        )
}

export const nonAdminSubjectScope: NonAdminScope<Subject> = (
    scope,
    permissions
) => {
    scope
        .leftJoinAndSelect(
            OrganizationMembership,
            'OrganizationMembership',
            'OrganizationMembership.organization = Subject.organization'
        )
        .where(
            '(OrganizationMembership.user_id = :d_user_id OR Subject.system = :system)',
            {
                d_user_id: permissions.getUserId(),
                system: true,
            }
        )
}

export const nonAdminProgramScope: NonAdminScope<Program> = (
    scope,
    permissions
) => {
    scope
        .leftJoinAndSelect(
            OrganizationMembership,
            'OrganizationMembership',
            'OrganizationMembership.organization = Program.organization'
        )
        .where(
            '(OrganizationMembership.user_id = :d_user_id OR Program.system = :system)',
            {
                d_user_id: permissions.getUserId(),
                system: true,
            }
        )
}

export const nonAdminSchoolScope: NonAdminScope<
    School | SchoolMembership
> = async (scope, permissions) => {
    const schoolIds = await permissions.schoolMembershipsWithPermissions([]) // all schools the User is a member of
    const [schoolOrgs, mySchoolOrgs] = await Promise.all([
        permissions.orgMembershipsWithPermissions([
            PermissionName.view_school_20110, // all schools (through orgs) the User is allowed to see
        ]),
        permissions.orgMembershipsWithPermissions([
            PermissionName.view_my_school_20119, // all schools (through orgs) the User is a member of and allowed to see
        ]),
    ])

    if (
        schoolOrgs.length &&
        mySchoolOrgs.length &&
        // perf: if User has both `view_school_20110` and `view_my_school_20119`
        // for the same Organizations (or a subset), `view_school_20110`
        // (ability to see all Schools in the Organization) can take precedence, saving JOINs
        !isSubsetOf(mySchoolOrgs, schoolOrgs)
    ) {
        if (!scopeHasJoin(scope, SchoolMembership)) {
            scope.leftJoin(
                'School.memberships',
                'SchoolMembership',
                'SchoolMembership.schoolSchoolId = School.school_id'
            )
        }

        if (schoolIds.length > 0) {
            scope.andWhere(
                // NB: Must be included in brackets to avoid incorrect AND/OR boolean logic with downstream WHERE
                new Brackets((qb) => {
                    qb.where(
                        // Schools which the user is not a member of but is allowed to see through orgs
                        '(School.organization IN (:...schoolOrgs) AND SchoolMembership.user IS NULL)',
                        {
                            schoolOrgs,
                        }
                    ).orWhere(
                        // Schools which the user is a member of and is allowed to see
                        '(School.school_id IN (:...schoolIds) AND SchoolMembership.user IS NOT NULL)',
                        {
                            schoolIds,
                        }
                    )
                })
            )
        } else {
            scope.andWhere(
                new Brackets((qb) => {
                    qb.where(
                        // Schools which the user is not a member of but is allowed to see through orgs
                        '(School.organization IN (:...schoolOrgs) AND SchoolMembership.user IS NULL)',
                        {
                            schoolOrgs,
                        }
                    ).orWhere(
                        // FALSE is a workaround for `School.organization IN ()` which is invalid PostgresQL
                        'SchoolMembership.user IS NOT NULL AND FALSE'
                    )
                })
            )
        }
    } else if (schoolOrgs.length) {
        scope.andWhere('School.organization IN (:...schoolOrgs)', {
            schoolOrgs,
        })
    } else if (mySchoolOrgs.length && schoolIds.length > 0) {
        if (!scopeHasJoin(scope, SchoolMembership)) {
            scope.innerJoin(
                'School.memberships',
                'SchoolMembership',
                'SchoolMembership.schoolSchoolId = School.school_id'
            )
        }
        scope
            .andWhere('School.organization IN (:...mySchoolOrgs)', {
                mySchoolOrgs,
            })
            .andWhere('SchoolMembership.schoolSchoolId IN (:...schoolIds)', {
                schoolIds,
            })
    } else {
        // No permissions
        scope.where('false')
    }
}

export const nonAdminSchoolMembershipScope: NonAdminScope<SchoolMembership> = async (
    scope,
    permissions
) => {
    scope.leftJoin('SchoolMembership.school', 'School')
    scope.leftJoin('SchoolMembership.user', 'User')
    await nonAdminUserScope(scope, permissions)
    await nonAdminSchoolScope(scope, permissions)
}

export const nonAdminClassScope: NonAdminScope<Class> = async (
    scope,
    permissions
) => {
    const classOrgs = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_classes_20114,
    ])
    const schoolOrgs = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_school_classes_20117,
    ])
    const myClassOrgs = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_my_classes_20118,
    ])
    let schoolIds: string[] = []
    if (schoolOrgs.length > 0) {
        schoolIds = await permissions.schoolMembershipsWithPermissions([])
    }

    if (!classOrgs.length && !schoolIds.length && !myClassOrgs.length) {
        scope.where('false')
        return
    }
    scope.where(
        new Brackets((qb) => {
            if (classOrgs.length) {
                // can view all classes in these orgs
                qb.where('Class.organization IN (:...classOrgs)', { classOrgs })
            }
            if (myClassOrgs.length) {
                const teachingClassIdsQuery = createQueryBuilder()
                    .select('teachingClasses.classClassId')
                    .from('user_classes_teaching_class', 'teachingClasses')
                    .where('teachingClasses.userUserId = :userId')
                const studyingClassIdsQuery = createQueryBuilder()
                    .select('studyingClasses.classClassId')
                    .from('user_classes_studying_class', 'studyingClasses')
                    .where('studyingClasses.userUserId = :userId')

                scope.setParameters({
                    ...scope.getParameters(),
                    userId: permissions.getUserId(),
                })
                qb.orWhere(
                    new Brackets((subQb) => {
                        subQb
                            .where('Class.organization IN (:...myClassOrgs)', {
                                myClassOrgs,
                            })
                            .andWhere(
                                new Brackets((subQb2) => {
                                    subQb2
                                        .where(
                                            `"Class"."class_id" IN (${teachingClassIdsQuery.getQuery()})`
                                        )
                                        .orWhere(
                                            `"Class"."class_id" IN (${studyingClassIdsQuery.getQuery()})`
                                        )
                                })
                            )
                    })
                )
            }
            if (schoolOrgs.length && schoolIds.length) {
                const classIdsQuery = createQueryBuilder()
                    .select('schoolClasses.classClassId')
                    .from('school_classes_class', 'schoolClasses')
                    .where('schoolClasses.schoolSchoolId IN (:...schoolIds)', {
                        schoolIds,
                    })

                scope.setParameters({
                    ...scope.getParameters(),
                    ...classIdsQuery.getParameters(),
                })
                qb.orWhere(
                    new Brackets((subQb) => {
                        subQb
                            .where('Class.organization IN (:...schoolOrgs)', {
                                schoolOrgs,
                            })
                            .andWhere(
                                `"Class"."class_id" IN (${classIdsQuery.getQuery()})`
                            )
                    })
                )
            }
        })
    )
}

export const nonAdminPermissionScope: NonAdminScope<Permission> = async (
    scope,
    permissions
) => {
    const orgIds = await permissions.orgMembershipsWithPermissions([])
    if (orgIds.length) {
        scope.innerJoin('Permission.roles', 'Role')
        return
    }

    scope.where('false')
}
export const nonAdminRoleScope: NonAdminScope<Role> = async (
    scope,
    permissions
) => {
    const orgIds = await permissions.orgMembershipsWithPermissions([])

    scope.andWhere(
        new Brackets((qb) => {
            qb.where('Role.system_role = :system', {
                system: true,
            })
            if (orgIds.length > 0) {
                qb.orWhere('Role.organization IN (:...orgIds)', {
                    orgIds,
                })
            }
        })
    )
}
