import { expect } from "chai";
import { generateShortCode, SHORTCODE_MAXLEN } from "../../../src/utils/shortcode";

describe("shortcode", () => {
    const shortcode_re = /^[A-Z|0-9]+$/
    context("we have a string", () => {
        const stringValue = "This is a string value"

        it("We generate a shortcode ", async () => {
                const shortcode = generateShortCode(stringValue)
                expect(shortcode).to.match(shortcode_re)
                expect(shortcode.length).to.equal(SHORTCODE_MAXLEN)
        });
    });
    context("we do not have a string", () => {
        it("We generate a shortcode ", async () => {
                const shortcode = generateShortCode()
                expect(shortcode).to.match(shortcode_re)
                expect(shortcode.length).to.equal(SHORTCODE_MAXLEN)
        });
    });
    context("we have a long string", () => {
        const stringValue = "This is a long string value"
        it("We generate two shortcodes and they are the same", async () => {
                const shortcode = generateShortCode(stringValue)
                expect(shortcode).to.match(shortcode_re)
                expect(shortcode.length).to.equal(SHORTCODE_MAXLEN)
                const shortcode2 = generateShortCode(stringValue)
                expect(shortcode2).to.match(shortcode_re)
                expect(shortcode2.length).to.equal(SHORTCODE_MAXLEN)
                expect(shortcode2).to.equal(shortcode)

        });
    });
    context("we have a small string", () => {
        const stringValue = "T"
        it("We generate two shortcodes and they are the same", async () => {
                const shortcode = generateShortCode(stringValue)
                expect(shortcode).to.match(shortcode_re)
                expect(shortcode.length).to.equal(SHORTCODE_MAXLEN)
                const shortcode2 = generateShortCode(stringValue)
                expect(shortcode2).to.match(shortcode_re)
                expect(shortcode2.length).to.equal(SHORTCODE_MAXLEN)
                expect(shortcode2).to.equal(shortcode)

        });
    });
      context("we have a no string", () => {

        it("We generate two shortcodes and they are the different", async () => {
                const shortcode = generateShortCode()
                expect(shortcode).to.match(shortcode_re)
                expect(shortcode.length).to.equal(SHORTCODE_MAXLEN)
                const shortcode2 = generateShortCode()
                expect(shortcode2).to.match(shortcode_re)
                expect(shortcode2.length).to.equal(SHORTCODE_MAXLEN)
                expect(shortcode2).to.not.equal(shortcode)

        });
    });
});
        
