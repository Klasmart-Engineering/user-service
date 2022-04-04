# **RFC-064**

## **Synopsis**

We are introducing the concept of 'academic term' (AT) to our application, this rfc deals with how it should be stored in our database.

## **Background**

[Grade progression](https://calmisland.atlassian.net/wiki/spaces/ET/pages/2602795009/Grade+Progression)

## **Requirements for academic term**

* AT must have a name, start date, and end date.
* AT periods may not overlap.
* ATs are owned by a school, schools and ATs have a one-to-many relationship.
* Classes can be linked to one AT, classes and ATs have a many-to-one relationship.
* The AT a class is linked to must be an AT which belongs to its school.
* We must be able to obtain the student roster for an AT.
* (Opinion) Each AT must have a unique name within a school

## **Proposal**

### **Create the `academic_term` table**

In SQL:

```sql
CREATE TYPE academic_term_status_enum AS ENUM('active', 'inactive');

CREATE TABLE "academic_term" (
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
      "deleted_at" TIMESTAMP(3),
      "status" "academic_term_status_enum" NOT NULL DEFAULT 'active',
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "name" character varying NOT NULL,
      "start_date" TIMESTAMP(3) NOT NULL,
      "end_date" TIMESTAMP(3) NOT NULL,
      "school_id" uuid NOT NULL,
      CONSTRAINT "PK_7b17dac59645103012db5b168e5" PRIMARY KEY ("id")
);
```

Create the file `src/entities/academicTerm.ts` with the appropriate columns, make sure to include:

```typescript
@ManyToOne(() => School, { nullable: false })
@JoinColumn({ name: 'school_id' })
public school!: Promise<School>
```

In `src/entities/school.ts`, add:

```typescript
@OneToMany(() => AcademicTerm, (ay) => ay.school)
public academicTerms?: Promise<AcademicTerm[]>
```

### **Add an `academic_term_id` column to the `class` table**

In SQL:

```sql
ALTER TABLE class ADD COLUMN academic_term_id uuid NULL REFERENCES academic_term
```

In `src/entities/class.ts`, add:

```typescript
@ManyToOne(() => AcademicTerm)
@JoinColumn({ name: 'academic_term_id' })
public academicTerm?: Promise<AcademicTerm | null>

@RelationId((class_: Class) => class_.academicTerm)
public readonly academic_term_id?: string
```

In `src/entities/academicTerm.ts`, add:

```typescript
@OneToMany(() => Class, (c) => c.academicTerm)
public classes?: Promise<Class[]>
```

## **Discussion**

Some of the requirements I outlined are not enforced by this structure:

* Academic term periods may not overlap
* The academic term a class is linked to must belong to its school

The reason I chose not to enforce these in the database schema is because they cannot be enforced without using more complex SQL features like triggers. As we do not want to have such logic in the database, it is better to perform these checks at an application level.

## Decision

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Toghrul          | Pending  |   🟡   |
| Oliver           | Approved |   🟢   |
| Matthew          | Approved |   🟢   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Approved |   🟢   |
