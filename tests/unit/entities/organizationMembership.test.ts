import { organizationMembershipValidations } from '../../../src/entities/validations/organizationMembership'
import { arraySchemaContext } from '../../utils/joi'

context('organizationMembershipValidations', () => {
    context('roles', () => {
        const roles = arraySchemaContext(
            organizationMembershipValidations.roles
        )

        roles.required()
        roles.only.uuid()
    })
})
