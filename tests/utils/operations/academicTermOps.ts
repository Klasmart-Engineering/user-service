const ACADEMIC_TERMS_MUTATION_RESULT = `academicTerms {
    id
    name
    startDate
    endDate
    status
}
`

export const CREATE_ACADEMIC_TERMS = `mutation($input: [CreateAcademicTermInput!]!) {
    createAcademicTerms(input: $input) {
        ${ACADEMIC_TERMS_MUTATION_RESULT}
    }
}`

export const DELETE_ACADEMIC_TERMS = `mutation($input: [DeleteAcademicTermInput!]!) {
    deleteAcademicTerms(input: $input) {
        ${ACADEMIC_TERMS_MUTATION_RESULT}
    }
}`
