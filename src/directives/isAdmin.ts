import { defaultFieldResolver, GraphQLSchema } from 'graphql'
import {
    BaseEntity,
    getRepository,
    SelectQueryBuilder,
    Brackets,
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
import { distinctMembers } from './isAdminUtils'

//
// changing permission rules? update the docs: permissions.md
//

type IEntityString =
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
export const nonAdminUserScope: NonAdminScope<User> = async (
    scope,
    permissions
) => {
    const user_id = permissions.getUserId()
    const user = getRepository(User).create({ user_id })
    const email = permissions.getEmail()
    const phone = permissions.getPhone()

    // generate queries to find users for each of the conditions below,
    // then do a WHERE user_id IN on each query to find all visible users
    const visibleUserQueries: SelectQueryBuilder<unknown>[] = []

    // 1 - can we view org users?
    const userOrgs: string[] = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_users_40110,
    ])

    if (userOrgs.length > 0) {
        visibleUserQueries.push(
            distinctMembers(
                'organization_membership',
                `organizationOrganizationId`,
                userOrgs
            )!
        )
    }
    // 2 - can we view school users?
    const userSchoolOrgs = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_my_school_users_40111,
    ])

    if (userSchoolOrgs.length) {
        // find a schools the user is a member of in these orgs
        const schoolIdsQuery = getRepository(SchoolMembership)
            .createQueryBuilder()
            .select('SchoolMembership.school_id')
            .innerJoin('SchoolMembership.school', 'School')
            .innerJoin('School.organization', 'Organization')
            .where('Organization.organization_id in (:...ids)', {
                ids: userSchoolOrgs,
            })
            .andWhere('SchoolMembership.userUserId = :user_id', { user_id })

        const schoolIds = (await schoolIdsQuery.getRawMany()).map(
            ({ SchoolMembership_school_id }) => SchoolMembership_school_id
        )

        // you can view all users in the schools you belong to\
        const qbDistinctMembers = distinctMembers(
            'school_membership',
            `schoolSchoolId`,
            schoolIds
        )
        if (qbDistinctMembers) {
            visibleUserQueries.push(qbDistinctMembers)
        }
    }

    // 3 - can we view class users?
    const [classesTaught, orgsWithClasses] = await Promise.all([
        user.classesTeaching,
        permissions.orgMembershipsWithPermissions([
            PermissionName.view_my_class_users_40112,
        ]),
    ])

    if (orgsWithClasses.length && classesTaught && classesTaught.length > 0) {
        visibleUserQueries.push(
            distinctMembers(
                'user_classes_studying_class',
                'classClassId',
                classesTaught.map(({ class_id }) => class_id)
            )!
        )
        visibleUserQueries.push(
            distinctMembers(
                'user_classes_teaching_class',
                'classClassId',
                classesTaught.map(({ class_id }) => class_id)
            )!
        )
    }

    scope.where(
        new Brackets((qb) => {
            qb.orWhere('User.user_id = :user_id', {
                user_id,
            })
            if (email) {
                qb.orWhere('User.email = :email', {
                    email: email,
                })
            }
            if (phone) {
                qb.orWhere('User.phone = :phone', {
                    phone: phone,
                })
            }
            visibleUserQueries.forEach((userQuery) => {
                qb.orWhere((_) => {
                    scope.setParameters({
                        ...scope.getParameters(),
                        ...userQuery.getParameters(),
                    })
                    return `"User"."user_id" IN (${userQuery.getQuery()})`
                })
            })
        })
    )
}

export const nonAdminOrganizationScope: NonAdminScope<Organization> = async (
    scope,
    permissions
) => {
    const orgIds = await permissions.orgMembershipsWithPermissions([])
    scope.select('Organization').distinct(true)
    if (orgIds.length > 0) {
        scope.andWhere('Organization.organization_id IN (:...orgIds)', {
            orgIds,
        })
    } else {
        // postgres errors if we try to do `IN ()`
        scope.andWhere('false')
    }
}

export const nonAdminOrganizationMembershipScope: NonAdminScope<OrganizationMembership> = async (
    scope,
    permissions
) => {
    // non admins can view organization memberships in their orgs only
    // note that permissions for accessing actual user / org info is handled via the corresponding scopes
    const orgIds = await permissions.orgMembershipsWithPermissions([])
    if (orgIds.length > 0) {
        scope.where('OrganizationMembership.organization IN (:...orgIds)', {
            orgIds,
        })
    } else {
        scope.andWhere('false')
    }
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

export const nonAdminSchoolScope: NonAdminScope<School> = async (
    scope,
    permissions
) => {
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
        scope.leftJoin(
            'School.memberships',
            'SchoolMembership',
            'SchoolMembership.schoolSchoolId = School.school_id'
        )

        if (schoolIds.length > 0) {
            scope.where(
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
            scope.where(
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
        scope.where('School.organization IN (:...schoolOrgs)', {
            schoolOrgs,
        })
    } else if (mySchoolOrgs.length && schoolIds.length > 0) {
        scope
            .innerJoin(
                'School.memberships',
                'SchoolMembership',
                'SchoolMembership.schoolSchoolId = School.school_id'
            )
            .where('School.organization IN (:...mySchoolOrgs)', {
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
    // non admins can view memberships of the schools they're a member of
    // AND all schools in their orgs
    // note that permissions for accessing actual user / school info is handled via the corresponding scopes
    const orgIds = await permissions.orgMembershipsWithPermissions([])
    const schoolIds = await permissions.schoolMembershipsWithPermissions([])

    if (orgIds.length > 0 && schoolIds.length > 0) {
        scope.innerJoin('SchoolMembership.school', 'School')
        scope.where(
            new Brackets((qb) => {
                qb.where('School.organization IN (:...orgIds)', {
                    orgIds,
                })
                qb.orWhere('SchoolMembership.school IN (:...schoolIds)', {
                    schoolIds,
                })
            })
        )
    } else if (orgIds.length > 0) {
        scope.innerJoin('SchoolMembership.school', 'School')
        scope.where('School.organization IN (:...orgIds)', {
            orgIds,
        })
    } else if (schoolIds.length > 0) {
        scope.where('SchoolMembership.school IN (:...schoolIds)', {
            schoolIds,
        })
    } else {
        scope.andWhere('false')
    }
}

export const nonAdminClassScope: NonAdminScope<Class> = async (
    scope,
    permissions
) => {
    const userId = permissions.getUserId()
    const classOrgs = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_classes_20114,
    ])

    //
    const schoolOrgs = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_school_classes_20117,
    ])

    if (classOrgs.length && schoolOrgs.length) {
        scope
            .leftJoin('Class.schools', 'School')
            .leftJoin('School.memberships', 'SchoolMembership')
            .where(
                // NB: Must be included in brackets to avoid incorrect AND/OR boolean logic with downstream WHERE
                new Brackets((qb) => {
                    qb.where('Class.organization IN (:...classOrgs)', {
                        classOrgs,
                    }).orWhere(
                        'Class.organization IN (:...schoolOrgs) AND SchoolMembership.user_id = :user_id',
                        {
                            user_id: userId,
                            schoolOrgs,
                        }
                    )
                })
            )
        return
    }

    if (classOrgs.length) {
        scope.where('Class.organization IN (:...classOrgs)', { classOrgs })
        return
    }
    if (schoolOrgs.length) {
        scope
            // Must be LEFT JOIN to support `isNull` operator
            .leftJoin('Class.schools', 'School')
            .innerJoin(
                'School.memberships',
                'SchoolMembership',
                'SchoolMembership.user_id = :user_id',
                { user_id: userId }
            )
            .where('Class.organization IN (:...schoolOrgs)', { schoolOrgs })
        return
    }

    scope.where('false')
}

export const nonAdminPermissionScope: NonAdminScope<Permission> = async (
    scope,
    permissions
) => {
    const userId = permissions.getUserId() || ''
    const orgMembership = await OrganizationMembership.findOne({
        where: { user_id: userId },
    })

    if (orgMembership) {
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
