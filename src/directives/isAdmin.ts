import { SchemaDirectiveVisitor } from 'apollo-server-express'
import { defaultFieldResolver, GraphQLField, GraphQLResolveInfo } from 'graphql'
import { getRepository, SelectQueryBuilder, Brackets } from 'typeorm'
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
import {
    IEntityFilter,
    getWhereClauseFromFilter,
} from '../utils/pagination/filtering'
import { Context } from '../main'
import { PermissionName } from '../permissions/permissionNames'
import { SchoolMembership } from '../entities/schoolMembership'

export class IsAdminDirective extends SchemaDirectiveVisitor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public visitFieldDefinition(field: GraphQLField<any, any>) {
        const { resolve = defaultFieldResolver } = field
        const { entity } = this.args

        field.resolve = async (
            prnt: unknown,
            args: Record<string, unknown>,
            context: Context,
            info: GraphQLResolveInfo
        ) => {
            let scope: SelectQueryBuilder<unknown> | undefined
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
                default:
                    context.permissions.rejectIfNotAdmin()
            }

            if (!context.permissions.isAdmin && scope) {
                switch (entity) {
                    case 'organization':
                        this.nonAdminOrganizationScope(scope, context)
                        break
                    case 'user':
                        await this.nonAdminUserScope(
                            scope as SelectQueryBuilder<User>,
                            context
                        )
                        break
                    case 'ageRange':
                        this.nonAdminAgeRangeScope(scope, context)
                        break
                    case 'grade':
                        this.nonAdminGradeScope(scope, context)
                        break
                    case 'category':
                        this.nonAdminCategoryScope(scope, context)
                        break
                    case 'subcategory':
                        this.nonAdminSubcategoryScope(scope, context)
                        break
                    case 'subject':
                        this.nonAdminSubjectScope(scope, context)
                        break
                    case 'program':
                        this.nonAdminProgamScope(scope, context)
                        break
                    default:
                    // do nothing
                }
            }

            args.scope = scope

            return resolve.apply(this, [prnt, args, context, info])
        }
    }

    // non admins can only view org/school users if they have
    // the appropriate permissions in their org/school memberships
    // otherwise, they can view their user(s)
    private async nonAdminUserScope(
        scope: SelectQueryBuilder<User>,
        context: Context
    ) {
        // filter users by orgs/schools that the user has the required permissions in
        const filter: IEntityFilter = {
            OR: [],
        }

        // 1 - can we view org users?
        const userOrgs: string[] = await context.permissions.orgMembershipsWithPermissions(
            [PermissionName.view_users_40110]
        )
        if (userOrgs.length > 0) {
            // just filter by org, not school
            for (const org of userOrgs) {
                filter.OR?.push({
                    organizationId: {
                        operator: 'eq',
                        value: org,
                    },
                })
            }
        } else {
            // 2 - can we view school users?
            const schoolMemberships = await getRepository(
                SchoolMembership
            ).find({
                where: {
                    user_id: context.permissions.getUserId(),
                },
            })
            const userOrgSchools: string[] = await context.permissions.orgMembershipsWithPermissions(
                [
                    PermissionName.view_my_school_users_40111,
                    PermissionName.view_my_class_users_40112,
                ],
                'OR'
            )
            if (userOrgSchools.length > 0 && schoolMemberships) {
                // you can view all users in the schools you belong to
                for (const school of schoolMemberships) {
                    filter.OR?.push({
                        schoolId: {
                            operator: 'eq',
                            value: school.school_id,
                        },
                    })
                }
            } else {
                // can't view org or school users

                // 3 - can they view their own users?
                const myUsersOrgs = await context.permissions.orgMembershipsWithPermissions(
                    [PermissionName.view_my_users_40113]
                )
                const myUsersSchools = await context.permissions.schoolMembershipsWithPermissions(
                    [PermissionName.view_my_users_40113]
                )
                if (myUsersOrgs.length === 0 && myUsersSchools.length === 0) {
                    // they can only view themselves
                    scope.andWhere('User.user_id = :user_id', {
                        user_id: context.permissions.getUserId(),
                    })
                } else {
                    // they can view users with same email
                    scope.andWhere(
                        new Brackets((qb) => {
                            qb.orWhere('User.user_id = :user_id', {
                                user_id: context.permissions.getUserId(),
                            })
                            qb.orWhere('User.email = :email', {
                                email: context.permissions.getEmail(),
                            })
                        })
                    )
                }
                return
            }
        }

        scope.leftJoinAndSelect('User.school_memberships', 'schoolMembership')
        scope.leftJoinAndSelect('User.memberships', 'orgMembership')

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['orgMembership.organization_id'],
                schoolId: ['schoolMembership.school_id'],
            })
        )
    }

    private nonAdminOrganizationScope(
        scope: SelectQueryBuilder<unknown>,
        context: Context
    ) {
        scope
            .select('Organization')
            .distinct(true)
            .innerJoin('Organization.memberships', 'OrganizationMembership')
            .andWhere('OrganizationMembership.user_id = :d_userId', {
                d_userId: context.permissions.getUserId(),
            })
    }

    private nonAdminAgeRangeScope(
        scope: SelectQueryBuilder<unknown>,
        context: Context
    ) {
        scope
            .leftJoinAndSelect(
                OrganizationMembership,
                'OrganizationMembership',
                'OrganizationMembership.organization = AgeRange.organization'
            )
            .where(
                '(OrganizationMembership.user_id = :d_user_id OR AgeRange.system = :system)',
                {
                    d_user_id: context.permissions.getUserId(),
                    system: true,
                }
            )
    }

    private nonAdminGradeScope(
        scope: SelectQueryBuilder<unknown>,
        context: Context
    ) {
        scope
            .leftJoinAndSelect(
                OrganizationMembership,
                'OrganizationMembership',
                'OrganizationMembership.organization = Grade.organization'
            )
            .where(
                '(OrganizationMembership.user_id = :d_user_id OR Grade.system = :system)',
                {
                    d_user_id: context.permissions.getUserId(),
                    system: true,
                }
            )
    }

    private nonAdminCategoryScope(
        scope: SelectQueryBuilder<unknown>,
        context: Context
    ) {
        scope
            .leftJoinAndSelect(
                OrganizationMembership,
                'OrganizationMembership',
                'OrganizationMembership.organization = Category.organization'
            )
            .where(
                '(OrganizationMembership.user_id = :d_user_id OR Category.system = :system)',
                {
                    d_user_id: context.permissions.getUserId(),
                    system: true,
                }
            )
    }

    private nonAdminSubcategoryScope(
        scope: SelectQueryBuilder<unknown>,
        context: Context
    ) {
        scope
            .leftJoinAndSelect(
                OrganizationMembership,
                'OrganizationMembership',
                'OrganizationMembership.organization = Subcategory.organization'
            )
            .where(
                '(OrganizationMembership.user_id = :d_user_id OR Subcategory.system = :system)',
                {
                    d_user_id: context.permissions.getUserId(),
                    system: true,
                }
            )
    }

    private nonAdminSubjectScope(
        scope: SelectQueryBuilder<unknown>,
        context: Context
    ) {
        scope
            .leftJoinAndSelect(
                OrganizationMembership,
                'OrganizationMembership',
                'OrganizationMembership.organization = Subject.organization'
            )
            .where(
                '(OrganizationMembership.user_id = :d_user_id OR Subject.system = :system)',
                {
                    d_user_id: context.permissions.getUserId(),
                    system: true,
                }
            )
    }

    private nonAdminProgamScope(
        scope: SelectQueryBuilder<unknown>,
        context: Context
    ) {
        scope
            .leftJoinAndSelect(
                OrganizationMembership,
                'OrganizationMembership',
                'OrganizationMembership.organization = Program.organization'
            )
            .where(
                '(OrganizationMembership.user_id = :d_user_id OR Program.system = :system)',
                {
                    d_user_id: context.permissions.getUserId(),
                    system: true,
                }
            )
    }
}
