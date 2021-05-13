import { SchemaDirectiveVisitor } from 'apollo-server-express'
import { defaultFieldResolver } from 'graphql'
import { Brackets, getRepository } from 'typeorm'
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

export class IsAdminDirective extends SchemaDirectiveVisitor {
    public visitFieldDefinition(field: any) {
        const { resolve = defaultFieldResolver } = field
        const { entity } = this.args
        let scope: any

        field.resolve = (prnt: any, args: any, context: any, info: any) => {
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
                        this.nonAdminUserScope(scope, context)
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

    private nonAdminUserScope(scope: any, context?: any) {
        const subQuery = getRepository(Organization)
            .createQueryBuilder()
            .select('Organization.organization_id')
            .distinct(true)
            .innerJoin('Organization.memberships', 'OrganizationMembership')
            .andWhere('OrganizationMembership.user_id = :d_userId', {
                d_userId: context.permissions.getUserId(),
            })
            .getQuery()

        scope
            .leftJoinAndSelect('User.memberships', 'OrganizationMembership')
            .where(
                new Brackets((qb) => {
                    qb.where(
                        'OrganizationMembership.organization IN (' +
                            subQuery +
                            ') '
                    ).orWhere('User.user_id = :d_userId', {
                        d_userId: context.permissions.getUserId(),
                    })
                })
            )
    }

    private nonAdminOrganizationScope(scope: any, context?: any) {
        scope
            .select('Organization')
            .distinct(true)
            .innerJoin('Organization.memberships', 'OrganizationMembership')
            .andWhere('OrganizationMembership.user_id = :d_userId', {
                d_userId: context.permissions.getUserId(),
            })
    }

    private nonAdminAgeRangeScope(scope: any, context: any) {
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

    private nonAdminGradeScope(scope: any, context: any) {
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

    private nonAdminCategoryScope(scope: any, context: any) {
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

    private nonAdminSubcategoryScope(scope: any, context: any) {
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

    private nonAdminSubjectScope(scope: any, context: any) {
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

    private nonAdminProgamScope(scope: any, context: any) {
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
