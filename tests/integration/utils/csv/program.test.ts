import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Connection } from "typeorm";
import { AgeRange } from "../../../../src/entities/ageRange";
import { AgeRangeUnit } from "../../../../src/entities/ageRangeUnit";
import { Grade } from "../../../../src/entities/grade";
import { Organization } from "../../../../src/entities/organization";
import { Program } from "../../../../src/entities/program";
import { Subject } from "../../../../src/entities/subject";
import { Model } from "../../../../src/model";
import { ProgramRow } from "../../../../src/types/csv/programRow";
import { createServer } from "../../../../src/utils/createServer";
import { processProgramFromCSVRow } from "../../../../src/utils/csv/program";
import { createAgeRange } from "../../../factories/ageRange.factory";
import { createGrade } from "../../../factories/grade.factory";
import { createOrganization } from "../../../factories/organization.factory";
import { createSubject } from "../../../factories/subject.factory";
import { ApolloServerTestClient, createTestClient } from "../../../utils/createTestClient";
import { createTestConnection } from "../../../utils/testConnection";

use(chaiAsPromised);

describe("processProgramFromCSVRow", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let row: ProgramRow;
    let organization: Organization;
    let ageRange: AgeRange;
    let grade: Grade;
    let subject: Subject;
    let noneSpecifiedAgeRange: AgeRange;
    let noneSpecifiedGrade: Grade;
    let noneSpecifiedSubject: Subject;
    let fileErrors: string[];
    const rowModel: ProgramRow = {
        organization_name: 'Company 1',
        program_name: 'Program 1',
        age_range_low_value: '6',
        age_range_high_value: '7',
        age_range_unit: AgeRangeUnit.YEAR,
        grade_name: 'First Grade',
        subject_name: 'Subject 1'
    }

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    beforeEach(async () => {
        row = rowModel;

        organization = await createOrganization();
        organization.organization_name = rowModel.organization_name;
        await connection.manager.save(organization);

        ageRange = await createAgeRange(organization);
        ageRange.name = `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`;
        ageRange.low_value = Number(rowModel.age_range_low_value);
        ageRange.high_value = Number(rowModel.age_range_high_value);
        ageRange.high_value_unit = rowModel.age_range_unit as AgeRangeUnit;
        ageRange.low_value_unit = rowModel.age_range_unit as AgeRangeUnit;
        await connection.manager.save(ageRange);

        grade = await createGrade(organization);
        grade.name = rowModel.grade_name;
        await connection.manager.save(grade);

        subject = await createSubject(organization);
        subject.name = rowModel.subject_name;
        await connection.manager.save(subject);

        noneSpecifiedAgeRange = new AgeRange();
        noneSpecifiedAgeRange.name = 'None Specified';
        noneSpecifiedAgeRange.low_value = 0;
        noneSpecifiedAgeRange.high_value = 99;
        noneSpecifiedAgeRange.low_value_unit = AgeRangeUnit.YEAR;
        noneSpecifiedAgeRange.high_value_unit = AgeRangeUnit.YEAR;
        noneSpecifiedAgeRange.system = true;
        await connection.manager.save(noneSpecifiedAgeRange);

        noneSpecifiedGrade = new Grade();
        noneSpecifiedGrade.name = 'None Specified';
        noneSpecifiedGrade.system = true;
        await connection.manager.save(noneSpecifiedGrade);

        noneSpecifiedSubject = new Subject();
        noneSpecifiedSubject.name = 'None Specified';
        noneSpecifiedSubject.system = true;
        await connection.manager.save(noneSpecifiedSubject);
    });

    context("when the organization name is not provided", () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when the program name is not provided", () => {
        beforeEach(() => {
            row = { ...row, program_name: '' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when not all the age range values are provided", () => {
        beforeEach(() => {
            row = { ...row, age_range_unit: '' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when age range high value is not a valid number", () => {
        beforeEach(() => {
            row = { ...row, age_range_high_value: '100.5d' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when age range low value is not a valid number", () => {
        beforeEach(() => {
            row = { ...row, age_range_low_value: '100.5d' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when age range low value is greather than age range high value", () => {
        beforeEach(() => {
            row = { ...row, age_range_low_value: String(Number(row.age_range_high_value) + 1) }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when age range unit value is not AgeRangeUnit", () => {
        beforeEach(() => {
            row = { ...row, age_range_unit: 'week' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when provided organization doesn't exists", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Organization 2' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when provided age range doesn't exists", () => {
        beforeEach(() => {
            row = { ...row, age_range_unit: 'month' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when provided grade doesn't exists", () => {
        beforeEach(() => {
            row = { ...row, grade_name: 'Second Grade' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when provided subject doesn't exists", () => {
        beforeEach(() => {
            row = { ...row, subject_name: 'Subject 2' }
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.be.undefined
        });
    });

    context("when provided age range already exists in the provided program", () => {
        beforeEach(async () => {
            let ageRanges: AgeRange[] = [];
            ageRanges.push(ageRange);

            const program = new Program();
            program.name = row.program_name;
            program.organization = Promise.resolve(organization);
            program.age_ranges = Promise.resolve(ageRanges);
            await connection.manager.save(program);
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.exist
        });
    });

    context("when provided grade already exists in the provided program", () => {
        beforeEach(async () => {
            let grades: Grade[] = [];
            grades.push(grade);

            const program = new Program();
            program.name = row.program_name;
            program.organization = Promise.resolve(organization);
            program.grades = Promise.resolve(grades);
            await connection.manager.save(program);
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.exist
        });
    });

    context("when provided subject already exists in the provided program", () => {
        beforeEach(async () => {
            let subjects: Subject[] = [];
            subjects.push(subject);

            const program = new Program();
            program.name = row.program_name;
            program.organization = Promise.resolve(organization);
            program.subjects = Promise.resolve(subjects);
            await connection.manager.save(program);
        })

        it("throws an error", async () => {
            const fn = () => processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

            expect(fn()).to.be.rejected
            const program = await Program.findOne({
                where: {
                    name: row.program_name,
                    status: 'active',
                    system: false,
                    organization,
                }
            })

            expect(program).to.exist
        });
    });

    context("when all data provided is valid", () => {
        context("and all fields are provided", () => {
            it("creates a program with its relations", async () => {
                await processProgramFromCSVRow(connection.manager, row, 1, fileErrors);
    
                const program = await Program.findOneOrFail({
                    where: {
                        name: row.program_name,
                        status: 'active',
                        system: false,
                        organization
                    }
                });

                const ageRangeDB = await connection.manager.findOneOrFail(AgeRange, ageRange.id);
                const gradeDB = await connection.manager.findOneOrFail(Grade, grade.id);
                const subjectDB = await connection.manager.findOneOrFail(Subject, subject.id);

                const organizationInProgram = await program.organization;
                const ageRangesInProgram = await program.age_ranges || [];
                const gradesInProgram = await program.grades || [];
                const subjectsInProgram = await program.subjects || [];

                const EntityInfo = (entityValue: any) => {
                    return entityValue;
                }

                expect(program).to.exist;
                expect(program.name).eq(row.program_name);
                expect(program.system).eq(false);
                expect(program.status).eq('active');
                expect(organizationInProgram?.organization_id).eq(organization.organization_id);
                expect(ageRangesInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(ageRangeDB)]);
                expect(gradesInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(gradeDB)]);
                expect(subjectsInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(subjectDB)]);
            });
        });

        context("and age range is not provided", () => {
            beforeEach(async () => {
                row = { ...row, program_name: 'Program 2', age_range_low_value: '', age_range_high_value: '', age_range_unit: '' }
            });
    
            it("creates a program with 'None Specified' age range", async () => {
                await processProgramFromCSVRow(connection.manager, row, 1, fileErrors);
    
                const program = await Program.findOneOrFail({
                    where: {
                        name: row.program_name,
                        status: 'active',
                        system: false,
                        organization
                    }
                });

                const ageRangeDB = await connection.manager.findOneOrFail(AgeRange, noneSpecifiedAgeRange.id);
                const gradeDB = await connection.manager.findOneOrFail(Grade, grade.id);
                const subjectDB = await connection.manager.findOneOrFail(Subject, subject.id);

                const organizationInProgram = await program.organization;
                const ageRangesInProgram = await program.age_ranges || [];
                const gradesInProgram = await program.grades || [];
                const subjectsInProgram = await program.subjects || [];

                const EntityInfo = (entityValue: any) => {
                    return entityValue;
                }

                expect(program).to.exist;
                expect(program.name).eq(row.program_name);
                expect(program.system).eq(false);
                expect(program.status).eq('active');
                expect(organizationInProgram?.organization_id).eq(organization.organization_id);
                expect(ageRangesInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(ageRangeDB)]);
                expect(gradesInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(gradeDB)]);
                expect(subjectsInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(subjectDB)]);
            });
        });

        context("and grade is not provided", () => {
            beforeEach(async () => {
                row = { ...row, program_name: 'Program 3', grade_name: '' }
            });
    
            it("creates a program with 'None Specified' grade", async () => {
                await processProgramFromCSVRow(connection.manager, row, 1, fileErrors);
    
                const program = await Program.findOneOrFail({
                    where: {
                        name: row.program_name,
                        status: 'active',
                        system: false,
                        organization
                    }
                });

                const ageRangeDB = await connection.manager.findOneOrFail(AgeRange, ageRange.id);
                const gradeDB = await connection.manager.findOneOrFail(Grade, noneSpecifiedGrade.id);
                const subjectDB = await connection.manager.findOneOrFail(Subject, subject.id);

                const organizationInProgram = await program.organization;
                const ageRangesInProgram = await program.age_ranges || [];
                const gradesInProgram = await program.grades || [];
                const subjectsInProgram = await program.subjects || [];

                const EntityInfo = (entityValue: any) => {
                    return entityValue;
                }

                expect(program).to.exist;
                expect(program.name).eq(row.program_name);
                expect(program.system).eq(false);
                expect(program.status).eq('active');
                expect(organizationInProgram?.organization_id).eq(organization.organization_id);
                expect(ageRangesInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(ageRangeDB)]);
                expect(gradesInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(gradeDB)]);
                expect(subjectsInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(subjectDB)]);
            });
        });

        context("and subject is not provided", () => {
            beforeEach(async () => {
                row = { ...row, program_name: 'Program 4', subject_name: '' }
            });

            it("creates a program with 'None Specified' subject", async () => {
                await processProgramFromCSVRow(connection.manager, row, 1, fileErrors);

                const program = await Program.findOneOrFail({
                    where: {
                        name: row.program_name,
                        status: 'active',
                        system: false,
                        organization
                    }
                });

                const ageRangeDB = await connection.manager.findOneOrFail(AgeRange, ageRange.id);
                const gradeDB = await connection.manager.findOneOrFail(Grade, grade.id);
                const subjectDB = await connection.manager.findOneOrFail(Subject, noneSpecifiedSubject.id);

                const organizationInProgram = await program.organization;
                const ageRangesInProgram = await program.age_ranges || [];
                const gradesInProgram = await program.grades || [];
                const subjectsInProgram = await program.subjects || [];

                const EntityInfo = (entityValue: any) => {
                    return entityValue;
                }

                expect(program).to.exist;
                expect(program.name).eq(row.program_name);
                expect(program.system).eq(false);
                expect(program.status).eq('active');
                expect(organizationInProgram?.organization_id).eq(organization.organization_id);
                expect(ageRangesInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(ageRangeDB)]);
                expect(gradesInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(gradeDB)]);
                expect(subjectsInProgram.map(EntityInfo)).to.deep.eq([EntityInfo(subjectDB)]);
            });
        });
    });
});