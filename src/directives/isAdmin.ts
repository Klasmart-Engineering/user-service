import { SchemaDirectiveVisitor } from 'apollo-server-express'
import { defaultFieldResolver } from 'graphql'
import { getRepository } from 'typeorm'
import { Class } from '../entities/class'

import { Organization } from '../entities/organization'
import { User } from '../entities/user'
import { Role } from '../entities/role'

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
                default:
                    context.permissions.rejectIfNotAdmin()
            }

            if (!context.permissions.isAdmin && scope) {
                switch (entity) {
                    case 'organization':
                        this.nonAdminOrganizationScope(scope, context.token)
                        break
                    case 'user':
                        this.nonAdminUserScope(scope, context.token)
                        break
                    default:
                    // do nothing
                }
            }

            args.scope = scope

            return resolve.apply(this, [prnt, args, context, info])
        }
    }

    private nonAdminUserScope(scope: any, token?: any) {
        scope.select('User').where('User.user_id = :userId', {
            userId: token?.id,
        })
    }

    private nonAdminOrganizationScope(scope: any, token?: any) {
        scope
            .select('Organization')
            .distinct(true)
            .innerJoin('Organization.memberships', 'OrganizationMembership')
            .andWhere('OrganizationMembership.user_id = :userId', {
                userId: token?.id,
            })
    }
}
