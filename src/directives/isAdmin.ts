import { SchemaDirectiveVisitor } from 'apollo-server-express'
import { defaultFieldResolver } from 'graphql'
import { getRepository } from 'typeorm'
import { Class } from '../entities/class'

import { AgeRange } from '../entities/ageRange'
import { Grade } from '../entities/grade'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
import { User } from '../entities/user'

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
                    default:
                    // do nothing
                }
            }

            args.scope = scope

            return resolve.apply(this, [prnt, args, context, info])
        }
    }

    private nonAdminUserScope(scope: any, context?: any) {
        scope.select('User').where('User.user_id = :userId', {
            userId: context.permissions.getUserId(),
        })
    }

    private nonAdminOrganizationScope(scope: any, context?: any) {
        scope
            .select('Organization')
            .distinct(true)
            .innerJoin('Organization.memberships', 'OrganizationMembership')
            .andWhere('OrganizationMembership.user_id = :userId', {
                userId: context.permissions.getUserId(),
            })
    }

    private nonAdminAgeRangeScope(scope: any, context: any) {
        scope
            .innerJoin(
                OrganizationMembership,
                'OrganizationMembership',
                'OrganizationMembership.organization = AgeRange.organization'
            )
            .where('OrganizationMembership.user_id = :user_id', {
                user_id: context.permissions.getUserId(),
            })
            .orWhere('AgeRange.system = :system', {
                system: true,
            })
    }

    private nonAdminGradeScope(scope: any, context: any) {
        scope
            .innerJoin(
                OrganizationMembership,
                'OrganizationMembership',
                'OrganizationMembership.organization = Grade.organization'
            )
            .where('OrganizationMembership.user_id = :user_id', {
                user_id: context.permissions.getUserId(),
            })
            .orWhere('Grade.system = :system', {
                system: true,
            })
    }
}
