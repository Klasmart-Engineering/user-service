import { schoolMembershipValidations } from '../../../src/entities/validations/schoolMembership'
import { arraySchemaContext } from '../../utils/joi'

context('schoolMembershipValidations', () => {
    context('roles', () => {
        const roles = arraySchemaContext(schoolMembershipValidations.roles)

        roles.optional()
        roles.only.uuid()
    })
})
