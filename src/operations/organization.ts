import Joi from 'joi'
import { organizationMembershipValidations } from '../entities/validations/organizationMembership'
import { schoolValidations } from '../entities/validations/school'
import { schoolMembershipValidations } from '../entities/validations/schoolMembership'
import { userValidations } from '../entities/validations/user'
import { APISchema, APISchemaMetadata } from '../types/api'

export interface InviteUserArguments {
    email?: string
    phone?: string
    given_name: string
    family_name: string
    date_of_birth?: string
    username?: string
    gender: string
    shortcode?: string
    organization_role_ids: string[]
    school_ids?: string[]
    school_role_ids?: string[]
    alternate_email?: string | null
    alternate_phone?: string | null
}

export const inviteUserSchema: APISchema<InviteUserArguments> = {
    email: userValidations.email,
    phone: userValidations.phone,
    given_name: userValidations.given_name,
    family_name: userValidations.family_name,
    date_of_birth: userValidations.date_of_birth,
    username: userValidations.username,
    gender: userValidations.gender,
    shortcode: organizationMembershipValidations.shortcode,
    organization_role_ids: organizationMembershipValidations.roles,
    school_ids: Joi.array()
        .items(schoolValidations.school_id.optional())
        .optional(),
    school_role_ids: schoolMembershipValidations.roles,
    alternate_email: userValidations.alternate_email,
    alternate_phone: userValidations.alternate_phone,
}

export const inviteUserSchemaMetadata: APISchemaMetadata<InviteUserArguments> = {
    email: {
        entity: 'User',
    },
    phone: {
        entity: 'User',
    },
    given_name: {
        entity: 'User',
    },
    family_name: {
        entity: 'User',
    },
    date_of_birth: {
        entity: 'User',
    },
    username: {
        entity: 'User',
    },
    gender: {
        entity: 'User',
    },
    shortcode: {
        entity: 'OrganizationMembership',
    },
    organization_role_ids: {
        entity: 'OrganizationMembership',
        attribute: 'roles',
    },
    school_ids: {
        entity: 'SchoolMembership',
        attribute: 'school',
    },
    school_role_ids: {
        entity: 'SchoolMembership',
        attribute: 'roles',
    },
    alternate_email: {
        entity: 'User',
    },
    alternate_phone: {
        entity: 'User',
    },
}
