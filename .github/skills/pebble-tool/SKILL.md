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
```

Platforms: `aplite`, `basalt`, `chalk`, `diorite`, `emery`, `flint`, `gabbro`

## Project Management

| Command | Description |
|---------|-------------|
| `pebble new-project NAME` | Create a new project (flags: `--simple`, `--javascript`, `--worker`, `--rocky`) |
| `pebble build` | Compile the project into a `.pbw` file in `./build/` |
| `pebble install [FILE]` | Build + install to watch (`--phone IP`) or emulator (`--emulator PLATFORM`) |
| `pebble clean` | Delete all files in `./build/` for a clean rebuild |
| `pebble convert-project` | Upgrade an existing project to the current SDK |

## Watching Logs

```sh
pebble logs --phone 192.168.1.42     # physical watch
pebble logs --emulator basalt        # emulator
pebble logs --color                  # force color output
```

## Screenshots

```sh
pebble screenshot                    # auto-names and opens
pebble screenshot my-screen.png      # save to specific file
pebble screenshot --no-open          # save without opening
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
| `info locals` | Show local variables |
| `ctrl-D` | Quit GDB |

## Emulator Control

```sh
pebble emu-app-config                        # open config page for running app
pebble emu-tap --direction x+                # send tap event (x+/x-/y+/y-/z+/z-)
pebble emu-bt-connection --connected yes     # simulate BT connected/disconnected
pebble emu-compass --heading 90 --calibrated
pebble emu-battery --percent 50 --charging
pebble emu-accel tilt_left                   # send accelerometer event
pebble emu-time-format --format 24h          # 12h or 24h
pebble emu-set-timeline-quick-view on        # show/hide timeline quick view
pebble emu-control                           # QR code for real-time sensor input
pebble kill                                  # stop emulator and phone simulator
pebble wipe                                  # wipe emulator data
pebble wipe --everything                     # wipe all data including account
```

## Data Logging

```sh
pebble data-logging list
pebble data-logging disable-sends            # stop auto-send to phone before downloading
pebble data-logging download --session-id ID output.bin
pebble data-logging enable-sends            # re-enable after downloading
pebble data-logging get-sends-enabled
```

## Timeline Pins

```sh
pebble login                                 # authenticate Pebble account
pebble insert-pin pin.json --id my-pin-id
pebble delete-pin pin.json --id my-pin-id
pebble logout
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
