import chaiAsPromised from "chai-as-promised";
import { Connection } from "typeorm";
import { expect, use } from "chai";
import { Model } from "../../../../src/model";
import { createServer } from "../../../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../../../utils/createTestClient";
import { createTestConnection } from "../../../utils/testConnection";
import { Organization } from "../../../../src/entities/organization";
import { GradeRow } from "../../../../src/types/csv/gradeRow";
import { createUser } from "../../../factories/user.factory";
import { createOrganization } from "../../../factories/organization.factory";
import { Grade } from "../../../../src/entities/grade";
import { createGrade } from "../../../factories/grade.factory";
import { setGradeFromToFields } from "../../../../src/utils/csv/grade";

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

    context("when 'from grade' is equal to grade", () => {
        beforeEach(() => {
            row = { ...row, progress_from_grade_name: row.grade_name }
        })

        it("throws an error", async () => {
            const fn = () => setGradeFromToFields(connection.manager, row, 1, fileErrors);

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

    context("when 'to grade' is equal to grade", () => {
        beforeEach(() => {
            row = { ...row, progress_to_grade_name: row.grade_name }
        })

        it("throws an error", async () => {
            const fn = () => setGradeFromToFields(connection.manager, row, 1, fileErrors);

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

    context("when 'from grade' and 'to grade' are equal", () => {
        beforeEach(() => {
            row = { ...row, progress_from_grade_name: row.progress_to_grade_name }
        })

        it("throws an error", async () => {
            const fn = () => setGradeFromToFields(connection.manager, row, 1, fileErrors);

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

    context("when 'from grade' doesn't exists", () => {
        beforeEach(async () => {
            const owner = await createUser();
            await owner.save();

            const organization = await createOrganization(owner);
            await organization.save();

            const noneSpecifiedGrade = await createGrade();
            noneSpecifiedGrade.name = 'None Specified';
            noneSpecifiedGrade.system = true;
            noneSpecifiedGrade.organization = undefined;
            await noneSpecifiedGrade.save();

            row = { ...row, organization_name: String(organization.organization_name) };
        })

        it("throws an error", async () => {
            const fn = () => setGradeFromToFields(connection.manager, row, 1, fileErrors);

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

    context("when 'to grade' doesn't exists", () => {
        beforeEach(async () => {
            const owner = await createUser();
            await owner.save();

            const organization = await createOrganization(owner);
            await organization.save();

            const noneSpecifiedGrade = await createGrade();
            noneSpecifiedGrade.name = 'None Specified';
            noneSpecifiedGrade.system = true;
            noneSpecifiedGrade.organization = undefined;
            await noneSpecifiedGrade.save();

            const fromGrade = await createGrade(organization);
            await fromGrade.save();

            row = {
                ...row,
                organization_name: String(organization.organization_name),
                progress_from_grade_name: String(fromGrade.name)
            };
        })

        it("throws an error", async () => {
            const fn = () => setGradeFromToFields(connection.manager, row, 1, fileErrors);

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

    context("when all data provided is valid", () => {
        let organization: Organization;
        let fromGrade: Grade;
        let toGrade: Grade;
        let grade: Grade;

        beforeEach(async () => {
            const owner = await createUser();
            await owner.save();

            organization = await createOrganization(owner);
            await organization.save();

            const noneSpecifiedGrade = await createGrade();
            noneSpecifiedGrade.name = 'None Specified';
            noneSpecifiedGrade.system = true;
            noneSpecifiedGrade.organization = undefined;
            await noneSpecifiedGrade.save();

            grade = fromGrade = await createGrade(organization);
            await fromGrade.save();

            fromGrade = await createGrade(organization);
            await fromGrade.save();

            toGrade = await createGrade(organization);
            await toGrade.save();

            row = {
                ...row,
                grade_name: String(grade.name),
                organization_name: String(organization.organization_name),
                progress_from_grade_name: String(fromGrade.name),
                progress_to_grade_name: String(toGrade.name),
            };
        });

        it("creates the grade", async () => {
            await setGradeFromToFields(connection.manager, row, 1, fileErrors);

            const grade = await Grade.findOneOrFail({
                where: {
                    organization,
                    system: false,
                    status: 'active',
                    name: row.grade_name,
                }
            });

            const organizationInGrade = await grade.organization;
            const fromGradeInGrade = await grade.progress_from_grade;
            const toGradeInGrade = await grade.progress_to_grade;

            expect(grade).to.exist;
            expect(grade.name).eq(row.grade_name);
            expect(grade.system).eq(false);
            expect(grade.status).eq('active');
            expect(organizationInGrade?.organization_name).eq(row.organization_name);
            expect(fromGradeInGrade?.name).eq(row.progress_from_grade_name);
            expect(toGradeInGrade?.name).eq(row.progress_to_grade_name);
        });
    });
});
