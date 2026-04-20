# Implementation

- All code changes should be covered by tests to ensure reliability and maintainability. Positive & negative test cases should be included to ensure comprehensive test coverage. Do not assume that a test is wrong if it fails, investigate the failure and fix any issues in the code until all tests pass.
- Use sub-agents as much as possible to improve task parallelism and context efficiency.
- Once changes are complete, use a sub-agent to perform a code review. Address any issues found during the code review and repeat the review process until the code is approved.
- README.md should be updated to reflect any changes made to the codebase, ensuring that documentation is accurate and up-to-date.
- In order to consider your task complete you must:
  - Ensure all tests pass successfully. Do not immediately assume the test is wrong if it fails, investigate the failure and fix any issues in the code until all tests pass.
  - Run biome lint and address any linting errors.
  - Code must compile cleanly.
  - Code review sub-agent must not report any issues.
  - All these steps must be completed against the same codebase. If any of these steps require changes, you must re-run all the steps after making changes.
- Install the latest compiled watchface on my pebble using, `pebble install --phone <IP_ADDRESS>`

# My Pebble Watch

- Phone IP Address: 192.168.1.93
- My pebble watch is connected to my phone with the "Dev Connection" enabled

