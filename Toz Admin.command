#!/bin/zsh
# Double-click to open the toz+ admin in the browser. Closing this window stops it.
cd "${0:A:h}" || exit 1
exec /usr/bin/python3 tools/admin_server.py --open
