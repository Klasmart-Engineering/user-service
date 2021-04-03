import { EntityManager } from 'typeorm'

import { Class } from '../../entities/class'
import { Organization, validateDOB, normalizedLowercaseTrimmed } from '../../entities/organization'
import { OrganizationMembership, MEMBERSHIP_SHORTCODE_MAXLEN } from '../../entities/organizationMembership'
import { Role } from '../../entities/role'
import { School } from '../../entities/school'
import { SchoolMembership } from '../../entities/schoolMembership'
import { User, accountUUID } from '../../entities/user'
import { UserRow } from '../../types/csv/userRow'
import {
    generateShortCode,
    validateShortCode,
} from '../shortcode'

export const processUserFromCSVRow = async (manager: EntityManager, row: UserRow, rowCount: number) => {
    if(!row.organization_name) {
        throw `[row ${rowCount}] missing organization_name`
    }

    const org = await manager.findOne(Organization, {organization_name: row.organization_name})
    if (!org) {
        throw `[row ${rowCount}] Organisation doesn't exist`
    }

    if(!row.user_email && !row.user_phone) {
        throw `[row ${rowCount}] missing user_email or user_phone`
    }

    if(row.user_date_of_birth && !validateDOB(row.user_date_of_birth)) {
        throw `[row ${rowCount}] date of birth is not valid. Please specify MM-YYYY`
    }

    if (row.user_shortcode?.length > 0) {
        if (!validateShortCode(row.user_shortcode, MEMBERSHIP_SHORTCODE_MAXLEN)) {
            throw `[row ${rowCount}] invalid shortcode provided. Make sure is uppercased`
        }
    }

    let organizationRole = undefined
    if(row.organization_role_name) {
        organizationRole = await manager.findOne(Role, {
            where: [
                { role_name: row.organization_role_name, system_role: true, organization: null },
                { role_name: row.organization_role_name, organization: { organization_id: org.organization_id } }
            ]
        })

        if(!organizationRole){
            throw `[row ${rowCount}] invalid organization role name provided`
        }
    }

    let school = undefined
    if(row.school_name) {
        school = await manager.findOne(School, {
            where: { school_name: row.school_name, organization: { organization_id: org.organization_id } },
        })

        if(!school){
            throw `[row ${rowCount}] invalid school name provided`
        }
    }

    let schoolRole = undefined
    if(row.school_role_name) {
        schoolRole = await manager.findOne(Role, {
            where: [
                { role_name: row.organization_role_name, system_role: true, organization: null },
                { role_name: row.organization_role_name, organization: { organization_id: org.organization_id } }
            ]
        })

        if(!schoolRole){
            throw `[row ${rowCount}] invalid school role name provided`
        }
    }

    let cls = undefined
    if(row.class_name) {
        cls = await manager.findOne(Class, {
            where: { class_name: row.class_name, organization: { organization_id: org.organization_id } },
        })

        if(!cls){
            throw `[row ${rowCount}] invalid class name provided`
        }
    }


    let email = row.user_email
    let phone = row.user_phone

    if (email) {
        email = normalizedLowercaseTrimmed(email)
    }

    if (phone) {
        phone = normalizedLowercaseTrimmed(phone)
    }

    const hashSource = email ?? phone
    const user = await manager.findOne(User, {
        where: [
            { email: email, phone: null },
            { email: null, phone: phone },
            { email: email, phone: phone },
        ]
    }) || new User()

    user.user_id = accountUUID(hashSource)

    if(email) {
        user.email = row.user_email
    }

    if(phone) {
        user.phone = row.user_phone
    }

    if(row.user_given_name) {
        user.given_name = row.user_given_name
    }

    if(row.user_family_name) {
        user.family_name = row.user_family_name
    }

    if(row.user_date_of_birth) {
        user.date_of_birth = row.user_date_of_birth
    }

    if(row.user_gender) {
        user.gender = row.user_gender
    }

    await manager.save(user)

    let organizationMembership = await manager.findOne(OrganizationMembership, {
        where: {
            organization_id: org.organization_id,
            user_id: user.user_id
        }
    })

    if(!organizationMembership){
        organizationMembership = new OrganizationMembership()
        organizationMembership.organization_id = org.organization_id
        organizationMembership.organization = Promise.resolve(org)
        organizationMembership.user_id = user.user_id
        organizationMembership.user = Promise.resolve(user)
        organizationMembership.shortcode = row.user_shortcode || generateShortCode(user.user_id, MEMBERSHIP_SHORTCODE_MAXLEN)
    }

    if(organizationRole) {
        const organizationRoles = (await organizationMembership.roles) || []

        if(!organizationRoles.includes(organizationRole)){
            organizationRoles.push(organizationRole)
            organizationMembership.roles = Promise.resolve(organizationRoles)
        }
    }

    await manager.save(organizationMembership)

    if(school) {
        let schoolMembership = await manager.findOne(SchoolMembership, {
            where: {
                school_id: school.school_id,
                user_id: user.user_id
            }
        })

        if(!schoolMembership){
            schoolMembership = new SchoolMembership()
            schoolMembership.school_id = school.school_id
            schoolMembership.school = Promise.resolve(school)
            schoolMembership.user_id = user.user_id
            schoolMembership.user = Promise.resolve(user)
        }

        if(schoolRole) {
            const schoolRoles = (await schoolMembership.roles) || []

            if(!schoolRoles.includes(schoolRole)){
                schoolRoles.push(schoolRole)
                schoolMembership.roles = Promise.resolve(schoolRoles)
            }
        }

        await manager.save(schoolMembership)

        if((organizationRole || schoolRole) && cls) {
            const roleName  = organizationRole?.role_name || schoolRole?.role_name

            if(roleName === 'Student') {
                const students = (await cls.students) || []

                if(!students.includes(user)){
                    students.push(user)
                    cls.students = Promise.resolve(students)
                }

            }else if(roleName === 'Teacher'){
                const teachers = (await cls.teachers) || []

                if(!teachers.includes(user)){
                    teachers.push(user)
                    cls.teachers = Promise.resolve(teachers)
                }
            }

            await manager.save(cls)
        }
    }
}
