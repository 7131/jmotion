# jmotion version 1.0

https://7131.github.io/jmotion/v10/

This is the first version of jmotion.

# How to use

First, write the following line in &lt;head&gt; block of the HTML file.

```HTML
<script src="https://7131.github.io/jmotion/v10/jmotion.js"></script>
```

The URL of the original file is specified in the src attribute.
You can download this file and save it on your own computer or server, in which case, specify the location in the src attribute.

Then put the &lt;svg&gt; tag in the &lt;body&gt; block.

```HTML
<svg id="board" width="300" height="300"></svg>
```

The id attribute can be any string, but here I set it to "board".
The size can also be set freely.
I think it is usually set in the stylesheet.
Depending on the environment, the namespace attribute xmlns="http://www.w3.org/2000/svg" is required, so specify it if it is not displayed.

Preparations are over.
After the &lt;svg&gt; is displayed, you can run the simulator by passing it to the Facade object inside the &lt;script&gt; tag.
For example, the JavaScript for throwing siteswap 3 would be:

```HTML
<script>
const facade = new jmotion.Facade("#board");
facade.startJuggling("3");
</script>
```

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

