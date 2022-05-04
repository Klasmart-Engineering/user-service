# How to Mark Tests Disabled
## Introduction
Quite often as a result of changes to the API, the Pipeline, Customer Requirments etc. it is necessary to disable tests temporarily.

## The Issue
There is more than one way to disable a test and there is no standard way of documenting why a test is disabled, and what conditions would have to be set to enable the test again.

## Method
Given that we have Mocha tests, we choose the either it.skip() or context.skip() depending on whether it is a 'context' stanza or 'it' stanza that you are disabling and absolutely don't uses xit().

## Documentation
That we document each disabled test with a code comment that records: 
  * When the test was disabled (I know that git will tell us but I don't think we need to always use detective work)
  * Why the test exactly was disabled
  * What would be need to happen to re-enable the test.
  * Who marked the test disabled.





