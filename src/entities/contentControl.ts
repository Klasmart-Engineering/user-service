import {
    Check,
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Organization } from "./organization";

import { Permission } from "./permission";

import { User } from "./user";

@Entity()
@Index(["organization", "documentId"], {
    unique: true,

    where: `"organization_id" IS NOT NULL`,
})
@Index(["user", "documentId"], {
    unique: true,

    where: `"user_id" IS NOT NULL`,
})
@Check("organization_id IS NOT NULL OR user_id IS NOT NULL")
export class ContentControl {
    @PrimaryGeneratedColumn("uuid", { name: "content_control_id" })
    contentControlId!: string;

    @Column({ name: "document_id", update: false })
    documentId!: string;

    @ManyToOne(() => Organization, (org) => org.contentControls)
    @JoinColumn({
        name: "organization_id",
    })
    organization?: Organization;

    @ManyToOne(() => User, (user) => user.contentControls)
    @JoinColumn({
        name: "user_id",
    })
    user?: User;

    @Column({ name: "access_level" })
    accessLevel!: AccessLevel;
}

export enum AccessLevel {
    Read = "READ",
    Write = "WRITE",
    Delete = "DELETE",
    Admin = "ADMIN",
}
