import { expect } from "chai";
import faker from "faker";
import { CursorObject, fromCursorHash, Paginatable, paginateData, toCursorHash } from "../../../src/utils/paginated.interface";


function shuffle(array:any[]) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

class Emailthing  implements Paginatable<Emailthing, string>{
    public email: string
    public constructor(n: string) {
        this.email = n
    }
    public compareKey(key: string): number {
        return key > this.email ? 1 : key < this.email ? -1 : 0
    }
    public compare(other: Emailthing): number {
        return other.email > this.email
            ? 1
            : other.email < this.email
                ? -1
                : 0
    }
    public generateCursor(total?: number, timestamp?: number): string {
        return toCursorHash(new CursorObject(this.email, total, timestamp))
    }
}

class NumberThing implements Paginatable<NumberThing,number>{
    public num: number
    public constructor(n: number) {
        this.num = n
    }
    public compareKey(key: number): number {
        return key > this.num ? 1 : key < this.num ? -1 : 0
    }
    public compare(other: NumberThing): number {
        return other.num > this.num
            ? 1
            : other.num < this.num
                ? -1
                : 0
    }
    public generateCursor(total?: number, timestamp?: number): string {
        return toCursorHash(new CursorObject(this.num, total, timestamp))
    }
}


describe("paginatedData", () => {

    context("we have an array indexed by strings", () => {
        const emailArray: Emailthing[] = []

        beforeEach(async () => {
           emailArray.length = 0
           const emailsToGenerate = 150
           for(let i = 0; i < emailsToGenerate; i++){
              emailArray.push(new Emailthing(faker.internet.email()+"_"+i));
           }
        });

        it("Start from the front", async () => {
            let direction = true
            let first = true
            let end = false;
            let id ="zzzzzzzzzzzzzzzzzzzzz"
            let recordsRead = 0
            do {
                let result = paginateData<Emailthing, string>(
                    emailArray.length,
                    Date.now(),
                    emailArray,
                    false,
                    10,
                    "zzzzzzzzzzzzzzzzzzzzzz",
                    "A",
                    direction ? undefined : id,
                    direction ? id : undefined
                )
                expect(result).to.exist
                let pageInfo = result.pageInfo
                expect(result.edges.length).to.equal(10)
                recordsRead += result.edges.length
                if (first) {
                    expect(!pageInfo.hasPreviousPage)
                }
                first = false
                let cursorhash = pageInfo.endCursor
                expect(cursorhash).to.exist
                expect(result.total).to.equal(emailArray.length)
                let cursor: CursorObject<string>
                if (cursorhash) {
                    cursor = fromCursorHash(cursorhash)
                }
                else break;
                id = cursor.id
                end = !pageInfo.hasNextPage
            } while(!end)
            expect(recordsRead).to.equal(emailArray.length)
        })
        it("Start from the back", async () => {
            let direction = false

            let first = true
            let end = false;
            let id ="A"
            let recordsRead = 0

            do {
                let result = paginateData<Emailthing, string>(
                    emailArray.length,
                    Date.now(),
                    emailArray,
                    false,
                    10,
                    "zzzzzzzzzzzzzzzzzzzzz",
                    "A",
                    direction ? undefined : id,
                    direction ? id : undefined
                )
                expect(result).to.exist
                let pageInfo = result.pageInfo
                expect(result.edges.length).to.equal(10)
                recordsRead += result.edges.length
                if (first) {
                    expect(!pageInfo.hasNextPage)
                }
                first = false
                let cursorhash = pageInfo.startCursor
                expect(cursorhash).to.exist
                expect(result.total).to.equal(emailArray.length)
                let cursor: CursorObject<string>
                if (cursorhash) {
                    cursor = fromCursorHash(cursorhash)
                }
                else break;
                id = cursor.id
                end = !pageInfo.hasPreviousPage
            } while(!end)
            expect(recordsRead).to.equal(emailArray.length)

        })
    })
    context("we have an array indexed by numbers", () => {
        let numberArray: NumberThing[] = []

        beforeEach(async () => {
           numberArray.length = 0
           const numbersToGenerate = 150
           for(let i = 0; i < numbersToGenerate; i++){
              numberArray.push(new NumberThing(i+1));
           }
           numberArray = shuffle(numberArray)
        });

        it("Start from the front", async () => {
            let direction = true
            let first = true
            let end = false;
            let id = 999999999999
            let recordsRead = 0

            do {
                let result = paginateData<NumberThing, number>(
                    numberArray.length,
                    Date.now(),
                    numberArray,
                    false,
                    10,
                    999999999999999,
                    0,
                    direction ? undefined : id,
                    direction ? id : undefined
                )
                expect(result).to.exist
                let pageInfo = result.pageInfo
                expect(result.edges.length).to.equal(10)
                recordsRead += result.edges.length
                if (first) {
                    expect(!pageInfo.hasPreviousPage)
                }
                first = false
                let cursorhash = pageInfo.endCursor
                expect(cursorhash).to.exist
                expect(result.total).to.equal(numberArray.length)
                let cursor: CursorObject<number>
                if (cursorhash) {
                    cursor = fromCursorHash(cursorhash)
                }
                else break;
                id = cursor.id
                end = !pageInfo.hasNextPage
            } while(!end)
            expect(recordsRead).to.equal(numberArray.length)
        })
        it("Start from the back", async () => {
            let direction = false

            let first = true
            let end = false;
            let id = 0
            let recordsRead = 0

            do {
                let result = paginateData<NumberThing, number>(
                    numberArray.length,
                    Date.now(),
                    numberArray,
                    false,
                    10,
                    999999999999999,
                    0,
                    direction ? undefined : id,
                    direction ? id : undefined
                )
                expect(result).to.exist
                let pageInfo = result.pageInfo
                expect(result.edges.length).to.equal(10)
                recordsRead += result.edges.length
                if (first) {
                    expect(!pageInfo.hasNextPage)
                }
                first = false
                let cursorhash = pageInfo.startCursor
                expect(cursorhash).to.exist
                expect(result.total).to.equal(numberArray.length)
                let cursor: CursorObject<number>
                if (cursorhash) {
                    cursor = fromCursorHash(cursorhash)
                }
                else break;
                id = cursor.id
                end = !pageInfo.hasPreviousPage
            } while(!end)
            expect(recordsRead).to.equal(numberArray.length)

        })
    })
})
