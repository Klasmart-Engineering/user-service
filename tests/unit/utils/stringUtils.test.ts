import { expect } from 'chai'
import {
    stringInject,
    isHexadecimalColor,
} from '../../../src/utils/stringUtils'

describe('stringInject', () => {
    context('replace brackets with array items', () => {
        it('should replace brackets {0} in string with array[0]', () => {
            var str = stringInject('My username is {0}', ['tjcafferkey'])
            expect(str).to.equal('My username is tjcafferkey')
        })

        it('should replace brackets {0} and {1} in string with array[0] and array[1]', () => {
            var str = stringInject('I am {0} the {1} function', [
                'testing',
                'stringInject',
            ])
            expect(str).to.equal('I am testing the stringInject function')
        })
    })

    context('pass in a string with no {} with an array of items', () => {
        it('should return the same string as passed in', () => {
            var str = stringInject('This should be the same', [
                'testing',
                'stringInject',
            ])
            expect(str).to.equal('This should be the same')
        })
    })

    context('replace object values based on their keys', () => {
        it('replace object values based on one key', () => {
            var str = stringInject('My username is {username}', {
                username: 'tjcafferkey',
            })
            expect(str).to.equal('My username is tjcafferkey')
        })

        it('replace object values based on two keys', () => {
            var str = stringInject('My username is {username} on {platform}', {
                username: 'tjcafferkey',
                platform: 'GitHub',
            })
            expect(str).to.equal('My username is tjcafferkey on GitHub')
        })

        it('replace object values although the keys are omitted', () => {
            var username = 'tjcafferkey'
            var platform = 'GitHub'
            var str = stringInject('My username is {username} on {platform}', {
                username,
                platform,
            })
            expect(str).to.equal('My username is tjcafferkey on GitHub')
        })

        it('replace object values based on two keys in reverse order', () => {
            var str = stringInject('My username is {platform} on {username}', {
                username: 'tjcafferkey',
                platform: 'GitHub',
            })
            expect(str).to.equal('My username is GitHub on tjcafferkey')
        })

        it('if the key does not exist in the object it will not replace it in the string', () => {
            var str = stringInject('My username is {platform} on {username}', {
                username: 'tjcafferkey',
            })
            expect(str).to.equal('My username is {platform} on tjcafferkey')
        })

        it('replace object values based on one nested key and one regular', function () {
            var str = stringInject('My username is {user.name} on {platform}', {
                user: { name: 'Robert' },
                platform: 'IRL',
            })
            expect(str).to.equal('My username is Robert on IRL')
        })

        it('if the object has no keys then it will return the string', () => {
            var str = stringInject(
                'My username is {platform} on {username}',
                {}
            )
            expect(str).to.equal('My username is {platform} on {username}')
        })
    })

    context('pass in incorrect parameters', () => {
        it('should return false when passed a number instead of an array as second parameter', () => {
            var str = stringInject('hello', 1)
            expect(str).to.equal('hello')
        })

        it('if the data param is false bool', () => {
            var str = stringInject(
                'My username is {platform} on {username}',
                false
            )
            expect(str).to.equal('My username is {platform} on {username}')
        })

        it('if the data param is true bool', () => {
            var str = stringInject(
                'My username is {platform} on {username}',
                true
            )
            expect(str).to.equal('My username is {platform} on {username}')
        })

        it('if the data param is a string', () => {
            var str = stringInject(
                'My username is {platform} on {username}',
                'string'
            )
            expect(str).to.equal('My username is {platform} on {username}')
        })
    })
})

describe('isHexadecimalColor', () => {
    it('must start with a hash', () => {
        expect(isHexadecimalColor('000000')).to.be.false
        expect(isHexadecimalColor('#000000')).to.be.true
    })
    it('must be 6 or 8 characters long', () => {
        for (let i = 0; i < 10; i++) {
            let hex = `#${'0'.repeat(i)}`
            if (i === 6 || i === 8) {
                expect(isHexadecimalColor(hex)).to.be.true
            } else {
                expect(isHexadecimalColor(hex)).to.be.false
            }
        }
    })

    it('can consist of numbers', () => {
        for (let i = 0; i < 10; i++) {
            let hex = `#${i.toString().repeat(6)}`
            expect(isHexadecimalColor(hex)).to.be.true
        }
    })

    it('can consist of letters in range a-f, case insensitive', () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz'

        for (const c of chars.split('')) {
            let hexLowercase = `#${c.toLowerCase().repeat(6)}`
            let hexUppercase = `#${c.toUpperCase().repeat(6)}`
            if (c.valueOf() <= 'f'.valueOf()) {
                expect(isHexadecimalColor(hexLowercase)).to.be.true
                expect(isHexadecimalColor(hexUppercase)).to.be.true
            } else {
                expect(isHexadecimalColor(hexLowercase)).to.be.false
                expect(isHexadecimalColor(hexUppercase)).to.be.false
            }
        }
    })
})
