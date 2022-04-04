import faker from 'faker'
import { AcademicTerm } from '../../src/entities/academicTerm'
import { Class } from '../../src/entities/class'
import { School } from '../../src/entities/school'

type PartialAcademicTerm = Partial<
    Pick<AcademicTerm, 'name' | 'start_date' | 'end_date' | 'classes'>
>

export function createAcademicTerm(
    school: School,
    { name, start_date, end_date }: PartialAcademicTerm = {},
    classes?: Class[]
) {
    const academicTerm = new AcademicTerm()
    academicTerm.name = name ?? faker.name.title()
    academicTerm.start_date = start_date ?? faker.date.future()
    const minEndDate = new Date(
        academicTerm.start_date.getFullYear(),
        academicTerm.start_date.getMonth(),
        academicTerm.start_date.getDate() + 2
    )
    academicTerm.end_date = end_date ?? faker.date.future(1, minEndDate)
    academicTerm.school = Promise.resolve(school)
    academicTerm.classes = Promise.resolve(classes ?? [])
    return academicTerm
}

export function createSuccessiveAcademicTerms(count: number, school: School) {
    return Array(count)
        .fill(null)
        .map((_, index, array: AcademicTerm[]) => {
            const prevTerm = index ? array[index - 1] : undefined
            return createAcademicTerm(school, {
                name: `${school.school_name} term ${index}`,
                start_date: prevTerm
                    ? new Date(
                          prevTerm.start_date.getFullYear(),
                          prevTerm.start_date.getMonth(),
                          prevTerm.start_date.getDate() + 1
                      )
                    : undefined,
            })
        })
}
