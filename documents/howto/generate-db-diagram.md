# How to generate a database diagram with plantuml

## Defining the diagram

The file which contains the code to generate the diagram is located at `documents/dbschema.plantuml`.

In this file, tables are defined using the `class` keyword and using a similar syntax to defining a typescript object.
We also define enums which are used in these tables.

Then we need to define relationships between classes, the following syntax is used:

```
ClASS_A "source_description" --* "destination_description" CLASS_B
```

`--` draws a line between two classes, and `*` puts an arrow at the end of it.

## Producing an image

The most straightforward way to produce an image from a `.plantuml` file is to past its code in a plantuml generator
and then exporting the generated image. You can use this website <https://www.planttext.com/>