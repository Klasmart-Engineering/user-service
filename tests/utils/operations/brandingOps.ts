import { Stream } from 'stream'
import { ReadStream } from 'typeorm/platform/PlatformTools'
import { ApolloServerTestClient } from '../createTestClient'
import { gqlTry } from '../gqlTry'
import { Headers } from 'node-mocks-http'
import { ImageMimeType } from '../../../src/types/imageMimeTypes'

const SET_BRANDING_MUTATION = `
mutation SetBranding($organizationId: ID!, $iconImage: Upload,$primaryColor:HexColor) {
  setBranding(organizationId: $organizationId, iconImage: $iconImage, primaryColor:$primaryColor) {
    iconImageURL
    primaryColor
  }
}
`

const SET_BRANDING_WITHOUT_IMAGE_MUTATION = `
mutation SetBranding($organizationId: ID!, $primaryColor: HexColor) {
  setBranding(organizationId: $organizationId, primaryColor:$primaryColor) {
    iconImageURL
    primaryColor
  }
}
`

const SET_BRANDING_WITHOUT_PRIMARY_COLOR_MUTATION = `
mutation SetBranding($organizationId: ID!, $iconImage: Upload) {
  setBranding(organizationId: $organizationId, iconImage: $iconImage) {
    iconImageURL
    primaryColor
  }
}
`

function fileMockInput(
    file: Stream,
    filename: string,
    mimetype: ImageMimeType,
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
    mimetype: ImageMimeType,
    encoding: string,
    primaryColor: string,
    headers?: Headers
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

export async function setBrandingWithoutImage(
    testClient: ApolloServerTestClient,
    organizationId: string,
    primaryColor: string,
    headers?: Headers
) {
    const variables = {
        organizationId: organizationId,
        primaryColor: primaryColor,
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: SET_BRANDING_WITHOUT_IMAGE_MUTATION,
            variables: variables,
        })

    const res = await gqlTry(operation)
    return res.data?.setBranding
}

export async function setBrandingWithoutPrimaryColor(
    testClient: ApolloServerTestClient,
    organizationId: string,
    iconImage: ReadStream,
    filename: string,
    mimetype: ImageMimeType,
    encoding: string,
    headers?: Headers
) {
    const variables = {
        organizationId: organizationId,
        iconImage: fileMockInput(iconImage, filename, mimetype, encoding),
    }

    const { mutate } = testClient

    const operation = () =>
        mutate({
            mutation: SET_BRANDING_WITHOUT_PRIMARY_COLOR_MUTATION,
            variables: variables,
        })

    const res = await gqlTry(operation)
    return res.data?.setBranding
}
