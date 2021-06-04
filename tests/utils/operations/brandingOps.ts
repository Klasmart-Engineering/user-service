import { Stream } from 'stream'
import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'

const SET_BRANDING_MUTATION = `
 mutation SetBranding($organizationId: ID!, $iconImage: Upload,$primaryColor:HexColor) {
  setBranding(organizationId: $organizationId, iconImage: $iconImage, primaryColor:$primaryColor) {
    organizationId
    iconImageURL
    faviconImageURL
    primaryColor
  }
}
`

function fileMockInput(
    file: Stream,
    filename: string,
    mimetype: string,
    encoding: string
) {
    return {
        resolve: () => {},
        reject: () => {},
        promise: new Promise((resolve) =>
            resolve({
                filename,
                mimetype,
                encoding,
                createReadStream: () => file,
            })
        ),
        file: {
            filename,
            mimetype,
            encoding,
            createReadStream: () => file,
        },
    }
}

export async function setBranding(
    testClient: ApolloServerTestClient,
    organizationId: string,
    iconImage: ReadStream,
    filename: string,
    mimetype: string,
    encoding: string,
    primaryColor: string
) {
    const variables = {
        organizationId: organizationId,
        iconImage: fileMockInput(iconImage, filename, mimetype, encoding),
        primaryColor: primaryColor,
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: SET_BRANDING_MUTATION,
            variables: variables,
        })

    const res = await gqlTry(operation)
    return res.data?.setBranding
}
