{
  "testDir": ".",
  "use": {
    "baseURL": "http://localhost:5173",
    "trace": "retain-on-failure",
    "screenshot": "only-on-failure"
  },
  "projects": [
    { "name": "chromium", "use": { "browserName": "chromium" } }
  ],
  "reporter": [["html", { "open": "never" }], ["list"]]
}
