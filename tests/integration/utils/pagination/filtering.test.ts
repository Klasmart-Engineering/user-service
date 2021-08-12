import chaiAsPromised from 'chai-as-promised'
import { Connection, getRepository, SelectQueryBuilder } from 'typeorm'
import { expect, use } from 'chai'
import { createTestConnection } from '../../../utils/testConnection'
import { User } from '../../../../src/entities/user'
import {
    IEntityFilter,
    getWhereClauseFromFilter,
} from '../../../../src/utils/pagination/filtering'
import { AgeRange } from '../../../../src/entities/ageRange'
import { AgeRangeUnit } from '../../../../src/entities/ageRangeUnit'
import { Program } from '../../../../src/entities/program'

use(chaiAsPromised)

// don't use faker, as we need this to be deterministic for these tests
function getUsers() {
    const userData = [
        {
            user_id: '07d15ab3-67e2-4933-b933-3d3a3d40887f',
            given_name: 'John',
            family_name: 'Smith',
            email: 'john@gmail.com',
            username: 'john',
            date_of_birth: '01-1993',
            gender: 'male',
            primary: true,
            deleted_at: new Date(2020, 0, 1),
        },
        {
            user_id: '122e3d10-43ed-4bac-8d7a-f0d6fde115b9',
            given_name: 'Sally',
            family_name: 'Smith',
            email: 'sally@gmail.com',
            username: 'sally',
            date_of_birth: '01-2000',
            gender: 'female',
            primary: false,
            deleted_at: new Date(2000, 0, 1),
        },
    ]

    const users: User[] = []
    for (const u of userData) {
        const user = new User()
        user.user_id = u.user_id
        user.given_name = u.given_name
        user.family_name = u.family_name
        user.email = u.email
        user.username = u.username
        user.date_of_birth = u.date_of_birth
        user.gender = u.gender
        user.primary = u.primary
        user.deleted_at = u.deleted_at
        users.push(user)
    }

    return users
}

const ageRangeData = [
    {
        id: '3f9a4f12-aabd-464a-b2a3-59bdc3fa70e4',
        name: '9-12 month(s)',
        low_value: 9,
        low_value_unit: AgeRangeUnit.MONTH,
        high_value: 12,
        high_value_unit: AgeRangeUnit.MONTH,
    },
    {
        id: '6429f000-3704-43f5-8b2b-c472f09b7512',
        name: '12-24 month(s)',
        low_value: 12,
        low_value_unit: AgeRangeUnit.MONTH,
        high_value: 24,
        high_value_unit: AgeRangeUnit.MONTH,
    },
    {
        id: '6bc34d1f-ac28-4344-88a9-6e679ed400ba',
        name: '24-36 month(s)',
        low_value: 24,
        low_value_unit: AgeRangeUnit.MONTH,
        high_value: 36,
        high_value_unit: AgeRangeUnit.MONTH,
    },
    {
        id: 'd4a7c445-8eb9-44e6-a153-c1b1bc13e8f5',
        name: '3-4 year(s)',
        low_value: 3,
        low_value_unit: AgeRangeUnit.YEAR,
        high_value: 4,
        high_value_unit: AgeRangeUnit.YEAR,
    },
    {
        id: '6c2b2756-ad24-4d30-b9ae-a316d4e136ae',
        name: '4-5 year(s)',
        low_value: 4,
        low_value_unit: AgeRangeUnit.YEAR,
        high_value: 5,
        high_value_unit: AgeRangeUnit.YEAR,
    },
    {
        id: '87403ab4-2d9a-4e3d-b1d0-66e0e6d21de1',
        name: '5-6 year(s)',
        low_value: 5,
        low_value_unit: AgeRangeUnit.YEAR,
        high_value: 6,
        high_value_unit: AgeRangeUnit.YEAR,
    },
]

function getAgeRanges() {
    const ageRanges: AgeRange[] = []
    for (const ar of ageRangeData) {
        const ageRange = new AgeRange()
        ageRange.id = ar.id
        ageRange.name = ar.name
        ageRange.low_value = ar.low_value
        ageRange.low_value_unit = ar.low_value_unit
        ageRange.high_value = ar.high_value
        ageRange.high_value_unit = ar.high_value_unit

        ageRanges.push(ageRange)
    }

    return ageRanges
}

async function getPrograms() {
    const programData = [
        {
            id: '5e9837fd-1469-4752-a4bb-fc18935a6370',
            name: 'Nursery',
            age_ranges: [ageRangeData[0], ageRangeData[1], ageRangeData[2]],
        },
        {
            id: '40c1f13d-f750-4b7b-bc71-bc6636399f3d',
            name: 'Three to Four',
            age_ranges: [ageRangeData[3]],
        },
        {
            id: '2194d455-629d-4495-8a85-e1e60825fe72',
            name: 'Kindergarten Full',
            age_ranges: [ageRangeData[3], ageRangeData[4], ageRangeData[5]],
        },
        {
            id: 'df099b0f-baf0-4793-9409-78076fb1ae65',
            name: 'Kindergarten Partial',
            age_ranges: [ageRangeData[4], ageRangeData[5]],
        },
    ]

    const programs: Program[] = []
    for (const p of programData) {
        const ageRanges = await getRepository(AgeRange).findByIds(
            p.age_ranges.map((ar) => ar.id)
        )

        const program = new Program()
        program.id = p.id
        program.name = p.name
        program.age_ranges = Promise.resolve(ageRanges)

        programs.push(program)
    }

    return programs
}

describe('filtering', () => {
    let connection: Connection
    let scope: SelectQueryBuilder<any>
    let programScope: SelectQueryBuilder<any>

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await connection.manager.save(getUsers())
        scope = getRepository(User).createQueryBuilder()

        await connection.manager.save(getAgeRanges())
        await connection.manager.save(await getPrograms())
        programScope = getRepository(Program).createQueryBuilder()
    })

    context('strings', () => {
        it('supports string.eq', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'eq',
                    value: 'john@gmail.com',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports string.neq', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'neq',
                    value: 'john@gmail.com',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports string.contains', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'contains',
                    value: 'john',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports case-insensitive string.contains', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'contains',
                    value: 'JOHN',
                    caseInsensitive: true,
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('ignores contains filters with empty values', async () => {
            const filter: IEntityFilter = {
                email: {
                    operator: 'contains',
                    value: '',
                },
            }
            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(2)
        })
    })

    context('booleans', () => {
        it('supports boolean.eq', async () => {
            const filter: IEntityFilter = {
                primary: {
                    operator: 'eq',
                    value: true,
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
    })

    context('dates', () => {
        it('supports date.eq', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'eq',
                    value: '2000-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
        it('supports date.neq', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'neq',
                    value: '2000-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
        it('supports date.gt', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'gt',
                    value: '2000-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
        it('supports date.gte', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'gte',
                    value: '2000-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(2)
        })
        it('supports date.lt', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'lt',
                    value: '2020-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
        it('supports date.lte', async () => {
            const filter: IEntityFilter = {
                deleted_at: {
                    operator: 'lte',
                    value: '2020-01-01',
                },
            }

            scope.andWhere(getWhereClauseFromFilter(filter))
            const data = await scope.getMany()

            expect(data.length).to.equal(2)
        })
    })

    context('uuids', () => {
        it('supports uuid.eq', async () => {
            const filter: IEntityFilter = {
                userId: {
                    operator: 'eq',
                    value: '07d15ab3-67e2-4933-b933-3d3a3d40887f',
                },
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    userId: "concat(User.user_id, '')",
                })
            )
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports uuid.neq', async () => {
            const filter: IEntityFilter = {
                userId: {
                    operator: 'neq',
                    value: '07d15ab3-67e2-4933-b933-3d3a3d40887f',
                },
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    userId: "concat(User.user_id, '')",
                })
            )
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports uuid.contains', async () => {
            const filter: IEntityFilter = {
                userId: {
                    operator: 'contains',
                    value: '07d15ab3',
                },
            }

            scope.andWhere(
                getWhereClauseFromFilter(filter, {
                    userId: "concat(User.user_id, '')",
                })
            )
            const data = await scope.getMany()

            expect(data.length).to.equal(1)
        })
    })

    context('ageRanges', () => {
        it('supports ageRange.eq', async () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'eq',
                    value: {
                        value: 4,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const data: Program[] = await programScope.getMany()

            expect(data.length).to.equal(2)
        })

        it('supports ageRange.neq', async () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'neq',
                    value: {
                        value: 3,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const data = await programScope.getMany()

            expect(data.length).to.equal(3)
        })

        it('supports ageRange.gt', async () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'gt',
                    value: {
                        value: 12,
                        unit: AgeRangeUnit.MONTH,
                    },
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const data = await programScope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports ageRange.gte', async () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'gte',
                    value: {
                        value: 12,
                        unit: AgeRangeUnit.MONTH,
                    },
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const data = await programScope.getMany()

            expect(data.length).to.equal(1)
        })

        it('supports ageRange.lt', async () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'lt',
                    value: {
                        value: 4,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const data = await programScope.getMany()

            expect(data.length).to.equal(2)
        })

        it('supports ageRange.lte', async () => {
            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'lte',
                    value: {
                        value: 4,
                        unit: AgeRangeUnit.YEAR,
                    },
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeFrom: {
                        operator: 'AND',
                        aliases: [
                            'AgeRange.low_value',
                            'AgeRange.low_value_unit',
                        ],
                    },
                })
            )

            const data = await programScope.getMany()

            expect(data.length).to.equal(3)
        })
    })

    context('ageRangeUnits', () => {
        it('supports ageRangeUnit.eq', async () => {
            const filter: IEntityFilter = {
                ageRangeUnitFrom: {
                    operator: 'eq',
                    value: AgeRangeUnit.MONTH,
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeUnitFrom: 'AgeRange.low_value_unit',
                })
            )

            const data = await programScope.getMany()
            expect(data.length).to.equal(1)
        })

        it('supports ageRangeUnit.neq', async () => {
            const filter: IEntityFilter = {
                ageRangeUnitTo: {
                    operator: 'neq',
                    value: AgeRangeUnit.YEAR,
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeUnitTo: 'AgeRange.high_value_unit',
                })
            )

            const data = await programScope.getMany()
            expect(data.length).to.equal(1)
        })

        it('fails with a value different to a valid Age Range Unit', async () => {
            const filter: IEntityFilter = {
                ageRangeUnitTo: {
                    operator: 'neq',
                    value: 'week',
                },
            }

            programScope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
            programScope.andWhere(
                getWhereClauseFromFilter(filter, {
                    ageRangeUnitTo: 'AgeRange.high_value_unit',
                })
            )

            const fn = async () => await programScope.getMany()
            await expect(fn()).to.be.rejected
        })
    })
})
