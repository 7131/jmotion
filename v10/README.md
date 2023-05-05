# File list of jmotion version 1.0

<dl>
  <dt>index.html</dt>
    <dd>The description page for jmotion.</dd>
  <dt>default.css</dt>
    <dd>The default stylesheet.</dd>
  <dt>jmotion.js</dt>
    <dd>A library that defines a namespace containing all jmotion objects.</dd>
  <dt>sample.html</dt>
    <dd>A sample application of jmotion.</dd>
  <dt>sample.css</dt>
    <dd>The style sheet for the sample application.</dd>
  <dt>sample.js</dt>
    <dd>A controller for executing animations in response to user actions.</dd>
  <dt>test.html</dt>
    <dd>A page for testing jmotion.</dd>
  <dt>test.css</dt>
    <dd>The style sheet for the test page.</dd>
  <dt>test.js</dt>
    <dd>A controller that receives the input of the test page and outputs the test result to the table.</dd>
</dl>

# Siteswap specifications by ABNF

The followings are the specifications of the pattern of the siteswap to be accepted.

```ABNF
Pattern     = Async / Sync
Async       = 1*EachHand
EachHand    = AsyncSimple / AsyncMulti
AsyncSimple = Even / Odd
Even        = "0" / "2" / "4" / "6" / "8" / "a" / "c" / "e" / "g" / "i" / "k" / "m" / "o" / "q" / "s" / "u" / "w" / "y"
Odd         = "1" / "3" / "5" / "7" / "9" / "b" / "d" / "f" / "h" / "j" / "l" / "n" / "p" / "r" / "t" / "v" / "x" / "z"
AsyncMulti  = "[" 2*AsyncSimple "]"
Sync        = 1*BothHand ["*"]
BothHand    = "(" OneHand "," OneHand ")"
OneHand     = SyncSimple / SyncMulti
SyncSimple  = Even ["x"]
SyncMulti   = "[" 2*SyncSimple "]"
```

