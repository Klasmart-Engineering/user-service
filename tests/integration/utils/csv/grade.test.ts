import chaiAsPromised from "chai-as-promised";
import { Connection } from "typeorm";
import { expect, use } from "chai";
import { Model } from "../../../../src/model";
import { createServer } from "../../../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../../../utils/createTestClient";
import { createTestConnection } from "../../../utils/testConnection";
import { Organization } from "../../../../src/entities/organization";
import { GradeRow } from "../../../../src/types/csv/gradeRow";
import { processGradeFromCSVRow } from "../../../../src/utils/csv/grade";
import { createUser } from "../../../factories/user.factory";
import { createOrganization } from "../../../factories/organization.factory";
import { Grade } from "../../../../src/entities/grade";
import { createGrade } from "../../../factories/grade.factory";

use(chaiAsPromised);

describe("processGradeFromCSVRow", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let row: GradeRow;
    let fileErrors: string[];

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    beforeEach(() => {
        row = {
            organization_name: 'Larson-Wyman',
            grade_name: 'First Grade',
            progress_from_grade_name: 'Kindergarten',
            progress_to_grade_name: 'Second Grade'
        }
    });

    context("when the organization name is not provided", () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it("throws an error", async () => {
            const fn = () => processGradeFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const grade = await Grade.findOne({
                where: {
                    system: false,
                    status: 'active',
                    name: row.grade_name,
                }
            })

            expect(grade).to.be.undefined
        });
    });

    context("when the grade name is not provided", () => {
        beforeEach(async () => {
            row = { ...row, grade_name: '' };
        })

        it("throws an error", async () => {
            const fn = () => processGradeFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const grade = await Grade.findOne({
                where: {
                    system: false,
                    status: 'active',
                    name: row.grade_name,
                }
            })

            expect(grade).to.be.undefined
        });
    });

    context("when the organization provided doesn't exists", () => {
        it("throws an error", async () => {
            const fn = () => processGradeFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const grade = await Grade.findOne({
                where: {
                    system: false,
                    status: 'active',
                    name: row.grade_name,
                }
            })

            expect(grade).to.be.undefined
        });
    });

    context("when the provided grade already exists", () => {
        let organization: Organization;

        beforeEach(async () => {
            const owner = await createUser();
            await owner.save();

            organization = await createOrganization(owner);
            await organization.save();

            const grade = await createGrade(organization);
            await grade.save();

            row = {
                ...row,
                organization_name: String(organization.organization_name),
                grade_name: String(grade.name)
            };
        })

        it("throws an error", async () => {
            const fn = () => processGradeFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const grade = await Grade.findOne({
                where: {
                    organization,
                    system: false,
                    status: 'active',
                    name: row.grade_name,
                }
            })

            expect(grade).to.exist
        });
    });

    context("when all data provided is valid", () => {
        let organization: Organization;

        beforeEach(async () => {
            const owner = await createUser();
            await owner.save();

            organization = await createOrganization(owner);
            await organization.save();

            row = { ...row, organization_name: String(organization.organization_name) };
        });

        it("creates the grade", async () => {
            await processGradeFromCSVRow(connection.manager, row, 1, fileErrors);

            const grade = await Grade.findOneOrFail({
                where: {
                    organization,
                    system: false,
                    status: 'active',
                    name: row.grade_name,
                }
            });

            const organizationInGrade = await grade.organization;

            expect(grade).to.exist;
            expect(grade.name).eq(row.grade_name);
            expect(grade.system).eq(false);
            expect(grade.status).eq('active');
            expect(organizationInGrade?.organization_name).eq(row.organization_name);
        });
    });
});
