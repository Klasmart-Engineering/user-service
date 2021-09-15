import faker from 'faker'
import { createOrganization } from './organization.factory'
import { Class } from '../../src/entities/class'
import { School } from '../../src/entities/school'
import { Organization } from '../../src/entities/organization'
import { generateShortCode } from '../../src/utils/shortcode'
import { User } from '../../src/entities/user'

export function createClass(
    schools: School[] = [],
    org?: Organization,
    { students, teachers }: { students?: User[]; teachers?: User[] } = {}
) {
    const cls = new Class()

    cls.class_name = faker.random.word()
    if (org) {
        cls.organization = Promise.resolve(org)
    }
    cls.schools = Promise.resolve(schools)
    cls.shortcode = generateShortCode()
    if (students) {
        cls.students = Promise.resolve(students)
    }
    if (teachers) {
        cls.teachers = Promise.resolve(teachers)
    }

    return cls
}
