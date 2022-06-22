import { v4 as uuid_v4 } from 'uuid'
import faker from 'faker'
import { expect } from 'chai'
import accountDeletionSheet, {
    accountDeletionRequestColumns,
    AccountDeletionRequestRow,
    parseRange,
} from '../../src/services/accountDeletionSheet'
import _ from 'lodash'

process.env.GOOGLE_APPLICATION_CREDENTIALS = './google-api-secrets.json'
process.env.ACCOUNT_DELETION_SHEET_ID =
    '1OKuKxgnfikeu1BY4B2l5Zy-PaSiPPrwWNwcTY7GUBSY'

describe('accountDeletionSheet', () => {
    context('.getHeaders()', () => {
        it('retrieves headers which match what is expected', async () => {
            const tableRange = await accountDeletionSheet.getRange()
            const headers = await accountDeletionSheet.getHeaders(tableRange)
            expect(headers?.map(_.camelCase)).to.deep.equal(
                Object.keys(accountDeletionRequestColumns)
            )
        })
    })

    context('.push()', () => {
        function generateRow(): AccountDeletionRequestRow {
            return {
                guidAzureB2C: uuid_v4(),
                guidUserService: uuid_v4(),
                hashedUserInfo: uuid_v4(),
                deletionRequestDate: faker.date
                    .past(1)
                    .toLocaleDateString('en', { dateStyle: 'short' }),
                overallStatus: faker.random.word(),
                userService: faker.random.word(),
                yService: faker.random.word(),
            }
        }

        it('adds new rows', async () => {
            const newRows = [generateRow(), generateRow()]
            const updateRange = await accountDeletionSheet.push(...newRows)

            const foundRows = await accountDeletionSheet.getAll(updateRange)
            expect(foundRows).to.deep.equal(newRows)

            await accountDeletionSheet.deleteRows(updateRange) // clean up
        })
    })
})

describe('parseRange()', () => {
    it('successfully parses a valid long table range', () => {
        const rangeString = 'Sheet21412!AC412:POA0123'
        const parsedRange = parseRange(rangeString)
        expect(parsedRange.startRow).to.equal(412)
        expect(parsedRange.endRow).to.equal(123)
        expect(parsedRange.startColumn).to.equal('AC')
        expect(parsedRange.endColumn).to.equal('POA')
    })

    it('throws an error when parsing ranges in an invalid format', () => {
        expect(() => parseRange('AC412:POA0123')).to.throw(
            'Failed to parse table range'
        )
        expect(() => parseRange('Sheet21412!412AC:123POA')).to.throw(
            'Failed to parse table range'
        )
    })
})
