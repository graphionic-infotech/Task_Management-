If preview shows "not open" or login freezes:
1. Run: bash start.sh  (or in this sandbox: reinstall + rebuild as above)
2. Hard-refresh preview: Ctrl+Shift+R
3. Click "1-click: Admin" - don't type password manually (avoids Chrome autofill)
4. Use "Test server connection" button on login to verify

Why this happens here: this sandbox wipes node_modules/dist on each restart (they are cache folders).
Your real office PC does NOT have this problem - once installed, it stays.
