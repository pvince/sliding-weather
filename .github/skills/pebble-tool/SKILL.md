---
name: pebble-tool
description: 'Use the Pebble SDK CLI tool to build, install, debug, and emulate Pebble watchapps. Use when building the project, installing to a watch or emulator, reading logs, taking screenshots, running GDB, or controlling the emulator.'
argument-hint: 'Describe what you want to do: build, install, logs, gdb, emulate, screenshot, timeline, etc.'
---

# Pebble CLI Tool

The `pebble` command is the primary tool for building and deploying Pebble watchapps.
Ref: https://developer.rebble.io/guides/tools-and-resources/pebble-tool/

## Connection Setup

Before running commands that target a physical watch, configure the phone IP:

```sh
export PEBBLE_PHONE=192.168.1.42     # phone IP on the same Wi-Fi
export PEBBLE_EMULATOR=aplite        # default emulator platform
```

Or pass inline with any command:

```sh
pebble install --phone 192.168.1.42
pebble install --emulator basalt
pebble install --qemu localhost:12344
pebble install --serial /dev/cu.PebbleTimeXXXX-SerialPortSe
pebble install --cloudpebble          # connect via CloudPebble
```

Platforms: `aplite`, `basalt`, `chalk`, `diorite`, `emery`, `flint`, `gabbro`

## Project Management

| Command | Description |
|---------|-------------|
| `pebble new-project NAME` | Create a new project. Types: `--c` (default), `--rocky`, `--alloy`. C flags: `--simple`, `--javascript`, `--worker`, `--ai` |
| `pebble new-package NAME` | Create a new pebble package (library, not app/watchface). Flag: `--javascript` |
| `pebble build` | Compile the project into a `.pbw` file in `./build/`. Flags: `--debug` (unoptimised build) |
| `pebble install [FILE]` | Build + install to watch (`--phone IP`) or emulator (`--emulator PLATFORM`). Flags: `--force`, `--logs`, `--qemu_logs` |
| `pebble clean` | Delete all files in `./build/` for a clean rebuild |
| `pebble convert-project` | Upgrade an appinfo project from SDK 2/3 to modern package.json |
| `pebble analyze-size [ELF]` | Analyze app binary size. Flags: `--summary` (one line per section), `--verbose` (per-symbol breakdown) |

## SDK Management

```sh
pebble sdk list                      # list available SDKs
pebble sdk install VERSION           # install a specific SDK
pebble sdk activate VERSION          # make an installed SDK the active one
pebble sdk uninstall VERSION         # remove an installed SDK
pebble sdk set-channel CHANNEL       # set the SDK channel
pebble sdk include-path              # print the SDK include path
```

## Package Management

```sh
pebble package install PACKAGE       # install an npm package
pebble package uninstall PACKAGE     # uninstall an npm package
pebble package login                 # log in to npm
pebble package publish               # publish package to npm
```

## Watching Logs

```sh
pebble logs --phone 192.168.1.42     # physical watch
pebble logs --emulator basalt        # emulator
pebble logs --color                  # force color output
pebble logs --no-color               # force color off
```

## Screenshots

```sh
pebble screenshot                    # auto-names and opens
pebble screenshot my-screen.png      # save to specific file
pebble screenshot --no-open          # save without opening
pebble screenshot --no-correction    # disable colour correction
pebble screenshot --all-platforms    # capture static screenshots for all supported platforms
pebble screenshot --gif-all-platforms          # capture rollover GIF for all platforms
pebble screenshot --gif-fps 15                 # FPS cap for GIF capture (default: 30)
```

## Debugging with GDB (Emulator Only)

```sh
pebble gdb --emulator basalt
```

Key GDB commands once attached:

| Command | Action |
|---------|--------|
| `ctrl-C` | Pause execution |
| `c` | Continue |
| `b function_name` | Breakpoint at function |
| `b file.c:45` | Breakpoint at line 45 |
| `s` / `n` | Step into / step over |
| `finish` | Run until end of current frame |
| `bt` / `bt full` | Backtrace / full with locals |
| `p expr` | Print expression value |
| `set var x = foo` | Set variable value |
| `info args` | Show function arguments |
| `info locals` | Show local variables |
| `info break` | List breakpoints (#1 is `<app_crashed>`, inserted by pebble tool) |
| `delete N` | Delete breakpoint #N |
| `ctrl-D` | Quit GDB |

## Emulator Control

```sh
pebble emu-app-config                        # open config page for running app
pebble emu-app-config --file local.html      # use local file instead of JS-specified URL
pebble emu-tap --direction x+                # send tap event (x+/x-/y+/y-/z+/z-)
pebble emu-bt-connection --connected yes     # simulate BT connected/disconnected (yes/no)
pebble emu-compass --heading 90 --calibrated # also: --uncalibrated, --calibrating
pebble emu-battery --percent 50 --charging
pebble emu-accel tilt-left                   # motions: tilt-left, tilt-right, tilt-forward, tilt-back
                                             #   gravity+x, gravity-x, gravity+y, gravity-y, gravity+z, gravity-z, none
pebble emu-accel custom --file data.csv      # custom CSV: each line is "x, y, z" (max 255 samples)
pebble emu-time-format --format 24h          # 12h or 24h
pebble emu-set-time 14:30:00                 # set emulated time (HH:MM:SS or Unix seconds)
pebble emu-set-time 14:30:00 --utc           # interpret as UTC (default: local time)
pebble emu-set-timeline-quick-view on        # show/hide timeline quick view (on/off)
pebble emu-set-content-size medium           # set content size: small, medium, large, x-large
pebble emu-button click select               # click a button (press+release)
pebble emu-button push up down               # hold multiple buttons simultaneously
pebble emu-button release                    # release all held buttons
pebble emu-button click back -d 500 -n 3 -i 200  # duration ms, repeat count, interval ms
pebble emu-control                           # interactive sensor control (QR code)
pebble emu-control --port 5000               # use specific port for sensor page
pebble kill                                  # stop emulator and phone simulator
pebble kill --force                          # send SIGKILL
pebble wipe                                  # wipe emulator data for current SDK version
pebble wipe --everything                     # wipe all data including account
pebble ping                                  # ping the watch/emulator
```

### Emulator Button Names

`back`, `up`, `select`, `down`

## Voice Transcription

```sh
pebble transcribe "hello world"              # send transcription result to app
pebble transcribe --error connectivity       # simulate error: connectivity, disabled, no-speech-detected
```

## Data Logging

```sh
pebble data-logging list
pebble data-logging disable-sends            # stop auto-send to phone before downloading
pebble data-logging download --session-id ID output.bin
pebble data-logging enable-sends             # re-enable after downloading
pebble data-logging get-sends-enabled
```

## Timeline Pins

```sh
pebble login                                 # authenticate via Firebase (opens browser)
pebble login --no-open-browser               # print auth URL without opening browser
pebble login --status                        # check login status
pebble insert-pin pin.json --id my-pin-id
pebble insert-pin pin.json --id my-pin-id --app-uuid UUID
pebble delete-pin --id my-pin-id
pebble logout
```

## Publishing

```sh
pebble publish                               # build, capture GIFs, and upload to appstore
pebble publish --release-notes "Bug fixes"   # include release notes
pebble publish --is-published                # publish immediately (default: draft)
pebble publish --no-gif-all-platforms        # skip GIF capture
pebble publish --all-platforms               # capture static screenshots instead of GIFs
pebble publish --non-interactive             # CI-friendly, no prompts
pebble publish --non-interactive --name "My App" --description "..." --category tools
```

## Firmware Management

```sh
pebble fw install firmware.pbz               # install firmware bundle onto watch
pebble fw install-lang langpack.pbl          # install language pack
pebble fw coredump                           # extract coredump from watch
pebble fw flash-logs                         # dump PBL_LOG flash logs
pebble fw enter-prf                          # reboot watch into PRF (recovery firmware)
```

## Python REPL

```sh
pebble repl                                  # launch Python prompt with connected 'pebble' object
```

## Verbosity

```sh
pebble install -v       # minimum
pebble install -vv
pebble install -vvv
pebble install -vvvv    # maximum
```

## Disable Analytics

```sh
touch ~/.pebble-sdk/NO_TRACKING
```

## Common Workflows

### Build and install to physical watch
```sh
pebble build && pebble install --phone $PEBBLE_PHONE
```

### Build and run on emulator with logs
```sh
pebble install --emulator basalt && pebble logs --emulator basalt
```

### Install with inline logs
```sh
pebble install --emulator basalt --logs
```

### Debug a crash with GDB
```sh
pebble install --emulator basalt
pebble gdb --emulator basalt
# then: bt full, info locals
```

### Open config page in emulator
```sh
pebble install --emulator chalk
pebble emu-app-config
```

### Analyze binary size
```sh
pebble analyze-size --verbose
```

### Publish to appstore
```sh
pebble login
pebble publish --release-notes "v1.2: new features"
```
