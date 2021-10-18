import { expect } from 'chai'
import { Lazy } from '../../../src/utils/lazyLoading'

class ClassToLazify {
    property: string

    constructor(property: string) {
        this.property = property
    }
}

describe('get instance lazily', () => {
    it('instantiates a class instance if uninitialised with the desired instantiation', () => {
        const classInstanceLazy = new Lazy<ClassToLazify>(
            () => new ClassToLazify('KidsLoop')
        )
        expect(classInstanceLazy['_instance']).to.eq(null)

        const classInstanceInitialised = classInstanceLazy.instance
        expect(classInstanceInitialised).to.deep.equal(
            new ClassToLazify('KidsLoop')
        )
    })

    it('returns the same class instance to the getter if already initialised', () => {
        const classInstanceLazy = new Lazy<ClassToLazify>(
            () => new ClassToLazify('KidsLoop')
        )
        classInstanceLazy['_instance'] = new ClassToLazify('KidsLoop')

        expect(classInstanceLazy.instance).to.equal(
            classInstanceLazy['_instance']
        )
    })
})
