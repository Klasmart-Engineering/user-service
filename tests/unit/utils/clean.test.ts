import { expect } from 'chai'
import clean from '../../../src/utils/clean'
import { isPhone } from '../../../src/utils/validations'

describe('email', () => {
    it('normalises "" to null', () => {
        expect(clean.email('')).to.be.null
    })

    it('if invalid is unchanged', () => {
        const input = 'not-an-email'
        expect(clean.email(input)).to.equal(input)
    })

    it('preserves null', () => {
        expect(clean.email(null)).to.be.null
    })

    it('removes spaces', () => {
        expect(clean.email(' abc@def.com ')).to.equal('abc@def.com')
    })

    it('forces lowercase', () => {
        expect(clean.email('AbC@dEf.com')).to.equal('abc@def.com')
    })
})

describe('phone', () => {
    it('normalises "" to null', () => {
        expect(clean.phone('')).to.be.null
    })

    it('if invalid is unchanged', () => {
        const input = 'not-a-phone-number'
        const cleanPhoneFunc = function () {
            clean.phone(input)
        }
        expect(cleanPhoneFunc).to.throw(
            Error,
            "The phone number doesn't appear to have a international format"
        )
    })

    it('preserves null', () => {
        expect(clean.phone(null)).to.be.null
    })

    it('removes spaces', () => {
        expect(clean.phone(' +4412345678910 ')).to.equal('+4412345678910')
    })

    // tests copied from https://bitbucket.org/calmisland/go-server-utils/src/master/phoneutils/phone_numbers_test.go

    context('has same behaviour as auth service', () => {
        const validUncleanPhoneNumbers = new Map([
            ['+(1)415 555 2671', '+14155552671'],
            ['+(44)207-183-8750', '+442071838750'],
            ['+(44)207 1838-7503', '+4420718387503'],
            ['+(44)207-183875038', '+44207183875038'],
            ['+(44)207 183875-0380', '+442071838750380'],
            ['+(55)155256325', '+55155256325'],
            ['+(55)11552563257', '+5511552563257'],
            ['+(55)115 5256 32572', '+55115525632572'],
            ['+(55)115-5256-3257-26', '+551155256325726'],
            ['+(1)1235550100', '+11235550100'],
            ['+104155552671', '+14155552671'],
            ['+4402071838750', '+442071838750'],
            ['+44020718387503', '+4420718387503'],
            ['+440207183875038', '+44207183875038'],
            ['+4402071838750380', '+442071838750380'],
            ['+5501155256325', '+551155256325'],
            ['+55011552563257', '+5511552563257'],
            ['+550115525632572', '+55115525632572'],
            ['+5501155256325726', '+551155256325726'],
            ['+101235550100', '+11235550100'],
        ])

        const phoneValidation = /^\+[1-9]\d{1,14}$/

        const isValidPhoneNumber = (phoneNumber: string) => {
            return phoneValidation.test(phoneNumber)
        }

        for (const [num, cleaned] of validUncleanPhoneNumbers.entries()) {
            it(`cleans ${num} into a valid E164 number`, () => {
                const cleanNum = clean.phone(num)
                expect(cleanNum).to.eq(cleaned)
                expect(isValidPhoneNumber(cleanNum as string)).to.be.true
            })
        }

        const invalidPhoneNumbers: string[] = [
            '14155552671',
            '+1415a5552671',
            '+14155552671a',
            '+4420718387503890',
            '+5511552563257264',
            '+1XXX5550100',
            '(1)4155552671',
            '+(1)415a5552671',
            '+(1)4155552671a',
            '+(44)20718387503890',
            '+(44)207 18387 503890',
            '+(44)207-18387-503890',
            '+(55)11552563257264',
            '+(55)1155 25632-57264',
            '+(1)XXX5550100',
        ]

        for (const num of invalidPhoneNumbers) {
            it(`cannot clean ${num} into a valid E164 number`, () => {
                // clean.phone() before it may pass some invalid phone numbers back, so isPhone catches them
                expect(isPhone(num)).to.be.false
            })
        }

        const parsedNumbers = new Map([
            [
                '+14155552671',
                {
                    CountryCallCode: 1,
                    LocalPhoneNumber: 4155552671,
                },
            ],
            [
                '+442071838750',
                {
                    CountryCallCode: 44,
                    LocalPhoneNumber: 2071838750,
                },
            ],
            [
                '+4420718387503',
                {
                    CountryCallCode: 44,
                    LocalPhoneNumber: 20718387503,
                },
            ],
            [
                '+44207183875038',
                {
                    CountryCallCode: 44,
                    LocalPhoneNumber: 207183875038,
                },
            ],
            [
                '+442071838750380',
                {
                    CountryCallCode: 44,
                    LocalPhoneNumber: 2071838750380,
                },
            ],
            [
                '+551155256325',
                {
                    CountryCallCode: 55,
                    LocalPhoneNumber: 1155256325,
                },
            ],
            [
                '+5511552563257',
                {
                    CountryCallCode: 55,
                    LocalPhoneNumber: 11552563257,
                },
            ],
            [
                '+55115525632572',
                {
                    CountryCallCode: 55,
                    LocalPhoneNumber: 115525632572,
                },
            ],
            [
                '+551155256325726',
                {
                    CountryCallCode: 55,
                    LocalPhoneNumber: 1155256325726,
                },
            ],
            [
                '+11235550100',
                {
                    CountryCallCode: 1,
                    LocalPhoneNumber: 1235550100,
                },
            ],
        ])

        for (const [num, parsed] of parsedNumbers) {
            it(`parsed ${num} correctly`, () => {
                const cleanNum = clean.phone(num)
                if (cleanNum == null) {
                    expect(false, 'should not be null')
                } else {
                    expect(cleanNum).to.equal(
                        `+${parsed.CountryCallCode}${parsed.LocalPhoneNumber}`
                    )
                }
            })
        }

        const testParsedNumbers = new Map([
            [
                '+14155552671',
                {
                    CountryCallCode: 1,
                    LocalPhoneNumber: 4155552671,
                },
            ],
            [
                '+442071838750',
                {
                    CountryCallCode: 44,
                    LocalPhoneNumber: 2071838750,
                },
            ],
            [
                '+4420718387503',
                {
                    CountryCallCode: 44,
                    LocalPhoneNumber: 20718387503,
                },
            ],
            [
                '+44207183875038',
                {
                    CountryCallCode: 44,
                    LocalPhoneNumber: 207183875038,
                },
            ],
            [
                '+442071838750380',
                {
                    CountryCallCode: 44,
                    LocalPhoneNumber: 2071838750380,
                },
            ],
            [
                '+551155256325',
                {
                    CountryCallCode: 55,
                    LocalPhoneNumber: 1155256325,
                },
            ],
            [
                '+5511552563257',
                {
                    CountryCallCode: 55,
                    LocalPhoneNumber: 11552563257,
                },
            ],
            [
                '+55115525632572',
                {
                    CountryCallCode: 55,
                    LocalPhoneNumber: 115525632572,
                },
            ],
            [
                '+551155256325726',
                {
                    CountryCallCode: 55,
                    LocalPhoneNumber: 1155256325726,
                },
            ],
            [
                '+11235550100',
                {
                    CountryCallCode: 1,
                    LocalPhoneNumber: 1235550100,
                },
            ],
        ])

        for (const [num, parsed] of testParsedNumbers) {
            it(`testParsedNumbers:  ${num} correctly`, () => {
                const cleanNum = clean.phone(
                    `+${parsed.CountryCallCode}${parsed.LocalPhoneNumber}`
                )
                expect(cleanNum).to.equal(num)
            })
        }
    })
})
