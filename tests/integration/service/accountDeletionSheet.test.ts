import { v4 as uuid_v4 } from 'uuid'
import faker from 'faker'
import { expect } from 'chai'
import accountDeletionSheet from '../../../src/services/accountDeletionSheet'

process.env.GOOGLE_APPLICATION_CREDENTIALS = './google-api-secrets.json'
process.env.ACCOUNT_DELETION_SHEET_ID =
    '1OKuKxgnfikeu1BY4B2l5Zy-PaSiPPrwWNwcTY7GUBSY'

describe.skip('accountDeletionSheet', () => {
    context('.getRowCount()', () => {
        it('fetches the row count', async () => {
            await accountDeletionSheet.getRowCount()
        })
    })

    context('.findRowByColumn()', () => {
        it('fetches the row for an azure B2C GUID', async () => {
            await accountDeletionSheet.findRowByColumn(
                '8asd76g6asd',
                'guidAzureB2c'
            )
        })

        it('fetches all rows matching a value', async () => {
            await accountDeletionSheet.findRowByColumn('a', 'guidAzureB2c')
        })

        it('returns undefined if no match is found', async () => {
            expect(
                await accountDeletionSheet.findRowByColumn(
                    'GUID AzureB2C',
                    'guidAzureB2c'
                )
            ).to.be.undefined
        })
    })

    context('.push()', () => {
        it('can add multiple rows to the end of the spreadsheet', async () => {
            const res = await accountDeletionSheet.push(
                {
                    guidAzureB2c: uuid_v4(),
                    guidUserService: uuid_v4(),
                    hashedUserInfo: uuid_v4(),
                    deletionRequestDate: faker.date
                        .past(1)
                        .toLocaleDateString('en', { dateStyle: 'short' }),
                    overallStatus: faker.random.word(),
                    userService: faker.random.word(),
                    yService: faker.random.word(),
                },
                {
                    guidAzureB2c: uuid_v4(),
                    guidUserService: uuid_v4(),
                    hashedUserInfo: uuid_v4(),
                    deletionRequestDate: faker.date
                        .past(1)
                        .toLocaleDateString('en', { dateStyle: 'short' }),
                    overallStatus: faker.random.word(),
                    userService: faker.random.word(),
                    yService: faker.random.word(),
                }
            )
            expect(res?.updatedRows).to.equal(2)
        })
    })

    context('.readLastRow()', () => {
        it('fetches the last row', async () => {
            await accountDeletionSheet.readLastRow()
        })
    })

    context('.readRow()', () => {
        it('fails to fetch row 0', async () => {
            await expect(accountDeletionSheet.readRow(0)).to.be.rejected
        })

        it('fetches a row', async () => {
            await accountDeletionSheet.readRow(3)
        })

        it('returns undefined if row empty', async () => {
            expect(await accountDeletionSheet.readRow(54)).to.be.undefined
        })
    })

    context('.readRows()', () => {
        it('fetches multiple rows, ignores empty rows', async () => {
            await accountDeletionSheet.readRows(4, 6, 54)
        })
    })
})
