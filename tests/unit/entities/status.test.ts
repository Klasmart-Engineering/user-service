import { expect } from 'chai'
import { Status } from '../../../src/entities/status'

describe('Status', () => {
    it('contains an active status', async () => {
        expect(Status.ACTIVE).to.eq('active')
    })

    it('contains an inactive status', async () => {
        expect(Status.INACTIVE).to.eq('inactive')
    })
})
