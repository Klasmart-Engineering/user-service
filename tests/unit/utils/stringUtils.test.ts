import { expect } from 'chai'
import {
    stringInject,
    isHexadecimalColor,
    objectToKey,
    ObjMap,
} from '../../../src/utils/stringUtils'

describe('stringInject', () => {
    context('replace brackets with array items', () => {
        it('should replace brackets {0} in string with array[0]', () => {
            const str = stringInject('My username is {0}', ['tjcafferkey'])
            expect(str).to.equal('My username is tjcafferkey')
        })

        it('should replace brackets {0} and {1} in string with array[0] and array[1]', () => {
            const str = stringInject('I am {0} the {1} function', [
                'testing',
                'stringInject',
            ])
            expect(str).to.equal('I am testing the stringInject function')
        })
    })

    context('pass in a string with no {} with an array of items', () => {
        it('should return the same string as passed in', () => {
            const str = stringInject('This should be the same', [
                'testing',
                'stringInject',
            ])
            expect(str).to.equal('This should be the same')
        })
    })

    context('replace object values based on their keys', () => {
        it('replace object values based on one key', () => {
            const str = stringInject('My username is {username}', {
                username: 'tjcafferkey',
            })
            expect(str).to.equal('My username is tjcafferkey')
        })

        it('replace object values based on two keys', () => {
            const str = stringInject(
                'My username is {username} on {platform}',
                {
                    username: 'tjcafferkey',
                    platform: 'GitHub',
                }
            )
            expect(str).to.equal('My username is tjcafferkey on GitHub')
        })

        it('replace object values although the keys are omitted', () => {
            const username = 'tjcafferkey'
            const platform = 'GitHub'
            const str = stringInject(
                'My username is {username} on {platform}',
                {
                    username,
                    platform,
                }
            )
            expect(str).to.equal('My username is tjcafferkey on GitHub')
        })

        it('replace object values based on two keys in reverse order', () => {
            const str = stringInject(
                'My username is {platform} on {username}',
                {
                    username: 'tjcafferkey',
                    platform: 'GitHub',
                }
            )
            expect(str).to.equal('My username is GitHub on tjcafferkey')
        })

        it('if the key does not exist in the object it will not replace it in the string', () => {
            const str = stringInject(
                'My username is {platform} on {username}',
                {
                    username: 'tjcafferkey',
                }
            )
            expect(str).to.equal('My username is {platform} on tjcafferkey')
        })

        it('replace object values based on one nested key and one regular', function () {
            const str = stringInject(
                'My username is {user.name} on {platform}',
                {
                    user: { name: 'Robert' },
                    platform: 'IRL',
                }
            )
            expect(str).to.equal('My username is Robert on IRL')
        })

        it('if the object has no keys then it will return the string', () => {
            const str = stringInject(
                'My username is {platform} on {username}',
                {}
            )
            expect(str).to.equal('My username is {platform} on {username}')
        })
    })

    context('pass in incorrect parameters', () => {
        it('should return false when passed a number instead of an array as second parameter', () => {
            const str = stringInject('hello', 1)
            expect(str).to.equal('hello')
        })

        it('if the data param is false bool', () => {
            const str = stringInject(
                'My username is {platform} on {username}',
                false
            )
            expect(str).to.equal('My username is {platform} on {username}')
        })

        it('if the data param is true bool', () => {
            const str = stringInject(
                'My username is {platform} on {username}',
                true
            )
            expect(str).to.equal('My username is {platform} on {username}')
        })

        it('if the data param is a string', () => {
            const str = stringInject(
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
            const hex = `#${'0'.repeat(i)}`
            if (i === 6 || i === 8) {
                expect(isHexadecimalColor(hex)).to.be.true
            } else {
                expect(isHexadecimalColor(hex)).to.be.false
            }
        }
    })

    it('can consist of numbers', () => {
        for (let i = 0; i < 10; i++) {
            const hex = `#${i.toString().repeat(6)}`
            expect(isHexadecimalColor(hex)).to.be.true
        }
    })

    it('can consist of letters in range a-f, case insensitive', () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz'

        for (const c of chars.split('')) {
            const hexLowercase = `#${c.toLowerCase().repeat(6)}`
            const hexUppercase = `#${c.toUpperCase().repeat(6)}`
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

describe('objectToKey', () => {
    it('converts an object to a string', () => {
        const obj = {
            a: 1,
            b: 2,
        }
        const key = objectToKey(obj)
        expect(key).to.equal('{"a":1,"b":2}')
    })
    it('ignores the order of properties', () => {
        expect(objectToKey({ a: 1, b: 2 })).eq(objectToKey({ b: 2, a: 1 }))
    })
})

describe('objMap', () => {
    type TestObjMap = ObjMap<{ a: string; b: string }, string>

    const testObjMap = (
        objMap: TestObjMap,
        expectedKeys: { a: string; b: string }[],
        expectedValues: string[],
        expectedSize: number
    ) => {
        for (const [index, key] of expectedKeys.entries()) {
            it(`has ${JSON.stringify(key)}`, () => {
                expect(objMap.has(key)).to.be.true
            })

            it(`get ${JSON.stringify(key)}`, () => {
                expect(objMap.get(key)).to.eq(expectedValues[index])
            })
        }

        it('has correct entries', () => {
            const keys = Array.from(objMap.entries()).map(([k, v]) => k)
            const values = Array.from(objMap.entries()).map(([k, v]) => v)
            expect(keys).to.deep.eq(Array.from(objMap.keys()))
            expect(values).to.deep.eq(Array.from(objMap.values()))
            expect(keys).to.deep.eq(expectedKeys)
            expect(values).to.deep.eq(expectedValues)
        })
        it('has correct size', () => {
            expect(objMap.size).to.eq(expectedSize)
        })
    }

    context('constructing with entries', () => {
        const entries = [
            {
                key: { a: '1', b: '2' },
                value: 'myvalue',
            },
            {
                key: { a: '2', b: '2' },
                value: 'myvalue',
            },
        ]

        const objMap: TestObjMap = new ObjMap(entries)
        testObjMap(
            objMap,
            entries.map((e) => e.key),
            entries.map((e) => e.value),
            2
        )
    })

    context('setting entries', () => {
        const objMap: TestObjMap = new ObjMap([])

        const entries = [
            {
                key: { a: '1', b: '2' },
                value: 'myvalue',
            },
            {
                key: { a: '2', b: '2' },
                value: 'myvalue',
            },
        ]

        objMap.set(entries[0].key, entries[0].value)
        objMap.set(entries[1].key, entries[1].value)
        testObjMap(
            objMap,
            entries.map((e) => e.key),
            entries.map((e) => e.value),
            2
        )
    })

    context('constructing with duplicate keys', () => {
        const entries = [
            {
                key: { a: '1', b: '2' },
                value: 'myvalue',
            },
            {
                key: { a: '1', b: '2' },
                value: 'othervalue',
            },
        ]

        const objMap: TestObjMap = new ObjMap(entries)
        testObjMap(objMap, [entries[1].key], [entries[1].value], 1)
    })

    context('setting duplicate keys', () => {
        const objMap: TestObjMap = new ObjMap([])

        const entries = [
            {
                key: { a: '1', b: '2' },
                value: 'myvalue',
            },
            {
                key: { a: '1', b: '2' },
                value: 'othervalue',
            },
        ]

        objMap.set(entries[0].key, entries[0].value)
        objMap.set(entries[1].key, entries[1].value)
        testObjMap(objMap, [entries[1].key], [entries[1].value], 1)
    })
})
