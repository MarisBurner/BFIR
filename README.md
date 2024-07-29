# BFIR (Brainfuck Intermediate Representation)
BFIR is a web based transpiler that is similar to an ASM and designed to be used for creating Brainfuck Applications easier.

### why did i do this?
- i like brainfuck
- for fun
- why not?

Its really simple to write in. Every line is a new action. Spaces seperate each operation, to write spaces within strings though you use _, to use _ normally you should write \ before it, and \\\\ if you want to put a single \ without effecting anything.
Most things take from the program stack so you can push references and values for certain functions.

### Base operations
- exec [function]
- malloc [name] (size: default 1)
- push# [number]
- push$ [string]
- pushRef [variable name]
- CLEAR
- move [variable a] [index] [variable b] [index]
- moveAdd \<same as move>
- moveSub \<same as move>
- copy \<same as move>
- copyAdd \<same as move>
- copySub \<same as move>
- inc [variable name] (index)
- dec [variable name] (index)
- while [variable name] (index)
- next [variable name] (index)
