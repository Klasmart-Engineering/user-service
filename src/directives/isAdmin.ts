import { defaultFieldResolver, GraphQLSchema } from 'graphql'
import {
    BaseEntity,
    getRepository,
    SelectQueryBuilder,
    Brackets,
    WhereExpression,
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

    const orUsersSharedEmailOrPhone = (qb: WhereExpression) => {
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
    }

    // 1 - can we view org users?
    const userOrgs: string[] = await permissions.orgMembershipsWithPermissions([
        PermissionName.view_users_40110,
    ])
    if (userOrgs.length > 0) {
        // just filter by org, not school
        scope.leftJoin(
            'User.memberships',
            'OrganizationMembership',
            'OrganizationMembership.organization IN (:...organizations)',
            { organizations: userOrgs }
        )
        scope.andWhere(
            new Brackets((qb) => {
                qb.orWhere('OrganizationMembership.user_id IS NOT NULL')
                orUsersSharedEmailOrPhone(qb)
            })
        )
        return
    }
    // 2 - can we view school users?
    const [schoolMemberships, userOrgSchools] = await Promise.all([
        getRepository(SchoolMembership).find({
            where: { user_id },
            select: ['school_id'],
        }),
        permissions.orgMembershipsWithPermissions([
            PermissionName.view_my_school_users_40111,
        ]),
    ])
    if (userOrgSchools.length > 0 && schoolMemberships?.length) {
        // you can view all users in the schools you belong to
        // Must be LEFT JOIN to support `isNull` operator
        scope.leftJoin(
            'User.school_memberships',
            'SchoolMembership',
            'SchoolMembership.school_id IN (:...schoolIds)',
            {
                schoolIds: schoolMemberships.map(({ school_id }) => school_id),
            }
        )
        scope.andWhere(
            new Brackets((qb) => {
                qb.orWhere('SchoolMembership.user_id IS NOT NULL')
                orUsersSharedEmailOrPhone(qb)
            })
        )
        return
    }

    // 3 - can we view class users?
    const [classesTaught, orgsWithClasses] = await Promise.all([
        user.classesTeaching,
        permissions.orgMembershipsWithPermissions([
            PermissionName.view_my_class_users_40112,
        ]),
    ])

    if (orgsWithClasses.length && classesTaught && classesTaught.length > 0) {
        const distinctMembers = (
            membershipTable: string,
            qb: SelectQueryBuilder<User>
        ) => {
            return qb
                .select('membership_table.userUserId', 'user_id')
                .distinct(true)
                .from(membershipTable, 'membership_table')
                .andWhere('membership_table.classClassId IN (:...ids)', {
                    ids: classesTaught.map(({ class_id }) => class_id),
                })
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

        scope.andWhere(
            new Brackets((qb) => {
                qb.orWhere('class_studying_membership.user_id IS NOT NULL')
                qb.orWhere('class_teaching_membership.user_id IS NOT NULL')
                orUsersSharedEmailOrPhone(qb)
            })
        )

        return
    }

    scope.andWhere(
        new Brackets((qb) => {
            orUsersSharedEmailOrPhone(qb)
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
    const userId = permissions.getUserId()
    const [schoolOrgs, mySchoolOrgs] = await Promise.all([
        permissions.orgMembershipsWithPermissions([
            PermissionName.view_school_20110,
        ]),
        permissions.orgMembershipsWithPermissions([
            PermissionName.view_my_school_20119,
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
        scope
            .leftJoin(
                OrganizationMembership,
                'OrganizationMembership',
                'School.organization IN (:...schoolOrgs) AND OrganizationMembership.user = :d_user_id',
                {
                    schoolOrgs,
                    d_user_id: userId,
                }
            )
            .leftJoin(
                'School.memberships',
                'SchoolMembership',
                'School.organization IN (:...mySchoolOrgs) AND SchoolMembership.user = :user_id',
                {
                    mySchoolOrgs,
                    user_id: userId,
                }
            )
            .where(
                // NB: Must be included in brackets to avoid incorrect AND/OR boolean logic with downstream WHERE
                new Brackets((qb) => {
                    qb.where('OrganizationMembership.user IS NOT NULL').orWhere(
                        'SchoolMembership.user IS NOT NULL'
                    )
                })
            )
    } else if (schoolOrgs.length) {
        scope.innerJoin(
            OrganizationMembership,
            'OrganizationMembership',
            'School.organization IN (:...schoolOrgs) AND OrganizationMembership.user = :d_user_id',
            {
                schoolOrgs,
                d_user_id: userId,
            }
        )
    } else if (mySchoolOrgs.length) {
        scope.innerJoin(
            'School.memberships',
            'SchoolMembership',
            'School.organization IN (:...mySchoolOrgs) AND SchoolMembership.user = :user_id',
            {
                mySchoolOrgs,
                user_id: userId,
            }
        )
    } else {
        // No permissions
        scope.where('false')
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
export const nonAdminRoleScope: NonAdminScope<Role> = (scope, permissions) => {
    scope
        .leftJoin(
            OrganizationMembership,
            'OrganizationMembership',
            'OrganizationMembership.organization = Role.organization'
        )
        .andWhere(
            '(OrganizationMembership.user_id = :d_user_id OR Role.system_role = :system)',
            {
                d_user_id: permissions.getUserId(),
                system: true,
            }
        )
}
