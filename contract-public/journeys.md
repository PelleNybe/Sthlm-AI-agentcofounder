# Public journey guidance

The input idea is authoritative. Use these common record-keeping patterns to check its coverage; they are not fixed feature requirements.

## Behaviors to implement and test when implied

1. Add the idea's complete primary record and show it in the collection.
2. Edit and delete an existing record.
3. Narrow the collection using a meaningful category or state.
4. Show a derived value the idea requests.
5. Preserve required data across a browser refresh.

Implement every behavior the idea details or implies; never drop an implied behavior merely to simplify the application. If the idea does not imply a listed pattern, omit it instead of inventing an equivalent feature, and record why in `assumptions`.

## Run and reporting requirements

- Start at `http://localhost:3000` without errors.
- Record the decision made for the idea's ambiguity in `assumptions`.

The runner verifies startup, and the result report carries assumptions. These are not user behaviors that need Vitest/jsdom coverage.
