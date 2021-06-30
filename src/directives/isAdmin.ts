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
        const user_id = context.permissions.getUserId()
        const user = getRepository(User).create({ user_id })

        // 1 - can we view org users?
        const userOrgs: string[] = await context.permissions.orgMembershipsWithPermissions(
            [PermissionName.view_users_40110]
        )
        if (userOrgs.length > 0) {
            // just filter by org, not school
            scope.leftJoinAndSelect('User.memberships', 'orgMembership')
            scope.andWhere('orgMembership.organization_id IN (:...userOrgs)', {
                userOrgs,
            })
            return
        }
        // 2 - can we view school users?
        const schoolMemberships = await getRepository(SchoolMembership).find({
            where: { user_id },
        })
        const userOrgSchools: string[] = await context.permissions.orgMembershipsWithPermissions(
            [PermissionName.view_my_school_users_40111]
        )
        if (userOrgSchools.length > 0 && schoolMemberships) {
            // you can view all users in the schools you belong to
            scope.leftJoinAndSelect(
                'User.school_memberships',
                'schoolMembership'
            )
            scope.andWhere('schoolMembership.school_id IN (:...schoolIds)', {
                schoolIds: schoolMemberships.map(({ school_id }) => school_id),
            })
            return
        }

        // 3 - can we view class users?
        const [classesTaught, orgsWithClasses] = await Promise.all([
            user.classesTeaching,
            context.permissions.orgMembershipsWithPermissions([
                PermissionName.view_my_class_users_40112,
            ]),
        ])

        if (orgsWithClasses.length && classesTaught) {
            scope.leftJoin(
                (qb) =>
                    qb
                        .select('User.user_id', 'user_id')
                        .distinct(true)
                        .from(User, 'User')
                        .innerJoin(
                            'User.classesStudying',
                            'class_membership',
                            'class_membership.class_id IN (:...ids)',
                            {
                                ids: classesTaught.map(
                                    ({ class_id }) => class_id
                                ),
                            }
                        ),
                'class_membership',
                'class_membership.user_id = User.user_id'
            )
            scope.andWhere(
                new Brackets((qb) => {
                    // As a teacher
                    qb.orWhere('User.user_id = :user_id', { user_id })
                    // Their students
                    qb.orWhere('class_membership.user_id IS NOT NULL')
                })
            )

            return
        }
        // can't view org or school users

        // 4 - can they view their own users?
        const myUsersOrgs = await context.permissions.orgMembershipsWithPermissions(
            [PermissionName.view_my_users_40113]
        )
        const myUsersSchools = await context.permissions.schoolMembershipsWithPermissions(
            [PermissionName.view_my_users_40113]
        )
        if (myUsersOrgs.length === 0 && myUsersSchools.length === 0) {
            // they can only view themselves
            scope.andWhere('User.user_id = :user_id', { user_id })
            return
        }

        // they can view users with same email
        scope.andWhere(
            new Brackets((qb) => {
                qb.orWhere('User.user_id = :user_id', {
                    user_id,
                })
                qb.orWhere('User.email = :email', {
                    email: context.permissions.getEmail(),
                })
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
