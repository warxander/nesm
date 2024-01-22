# nesm: FiveM NES Emulator

(Based on awesome [jsnes](https://github.com/bfirsh/jsnes) by bfirsh)

## Quick Start

-   Download and put into `resources/` directory
-   Add `ensure nesm` to `server.cfg`

## Usage

```lua
local nesm = exports.nes

nesm:init()
while not nesm:isReady() do
	Wait(0)
end

local nesTxd = nesm:getTextureDict()
local nesTxn = nesm:getTextureName()

local romBytes = --[[ .nes content ]]--
nesm:run(romBytes)

while nesm:isRunning() do
	DrawSprite(nesTxd, nesTxn, 0.5, 0.5, 0.3125, 0.5212, 0, 255, 255, 255, 255)
	Wait(0)
end
```

## Exports

```lua
init()

--! @return : boolean
isReady()

--! @return : string
getTextureDict()

--! @return : string
getTextureName()

--! @param romBytes: number[]
run(romBytes)

--! @return : boolean
isRunning()

stop()
```
