# Establish the contract

1. Inspect the installed package version, its `exports`, README, and declarations before writing code.
2. Define the database schema with `DB.Store<Value, Key, Indexes>` and keep schema upgrades synchronous within the native `upgradeneeded` transaction lifetime.
3. Choose the narrowest operation that preserves the required consistency.
