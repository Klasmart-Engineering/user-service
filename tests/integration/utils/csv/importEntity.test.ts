import chaiAsPromised from "chai-as-promised";
import { Connection } from "typeorm";
import { expect, use } from "chai";
import fs from 'fs';

import { createTestConnection } from "../../../utils/testConnection";
import { processOrganizationFromCSVRow } from "../../../../src/utils/csv/organization";
import { createEntityFromCsvWithRollBack } from "../../../../src/utils/csv/importEntity";
import { Organization } from "../../../../src/entities/organization";
import { Upload } from "../../../../src/types/upload";

use(chaiAsPromised);

describe("createEntityFromCsvWithRollBack", () => {
    let connection: Connection;
    let file: Upload;
    let organizationCount: number;

    before(async () => {
        connection = await createTestConnection();
    });

    after(async () => {
        await connection?.close();
    });

    context("when file to process has errors", () => {
        let fileName = 'example.csv';
        let fileStream = fs.createReadStream(`tests/fixtures/${fileName}`, 'utf-8');

        beforeEach(async () => {
            file = {
                filename: fileName,
                mimetype: 'text/csv',
                encoding: '7bit',
                createReadStream: () => fileStream,
            };
        });

        it("does not create any entities", async () => {
            const fn = () => createEntityFromCsvWithRollBack(connection, file, [processOrganizationFromCSVRow]);
            expect(fn()).to.be.rejected;

            organizationCount = await connection.manager.getRepository(Organization).count();
            expect(organizationCount).eq(0);
        });
    });

    context("when file to process is valid", () => {
        let fileName = 'organizationsExample.csv';
        let fileStream = fs.createReadStream(`tests/fixtures/${fileName}`, 'utf-8');

        beforeEach(async () => {
            file = {
                filename: fileName,
                mimetype: 'text/csv',
                encoding: '7bit',
                createReadStream: () => fileStream,
            };
        });

        it("creates all the expected entities", async () => {
            await createEntityFromCsvWithRollBack(connection, file, [processOrganizationFromCSVRow]);
            organizationCount = await connection.manager.getRepository(Organization).count();
            expect(organizationCount).eq(1);
        });
    });
});
