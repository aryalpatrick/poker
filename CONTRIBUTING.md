# Contributing to Poker App

First off, thank you for considering contributing to the Poker App! It's people like you that make open-source a great community.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](../../issues) first. If it doesn't exist, feel free to open a new one.

## Setting up your local environment

1. Clone the repository and `cd` into it:
   ```bash
   git clone https://github.com/aryalpatrick/poker.git
   cd poker
   ```

2. Copy `.env.example` to `.env` and fill in the required environment variables:
   ```bash
   cp .env.example .env
   ```

3. Install the dependencies:
   ```bash
   npm install
   ```

4. Run the local development server:
   ```bash
   npm run dev:local
   ```

5. Run the tests to ensure everything is working:
   ```bash
   npm test
   ```

## Making Changes

- Create a new branch from `main` for your feature or bugfix.
- Write code that follows the existing style.
- Add tests for any new functionality or bug fixes.
- Ensure all tests pass before submitting a pull request.

## Submitting a Pull Request

1. Push your branch to your fork.
2. Open a Pull Request against the `main` branch of this repository.
3. Describe your changes in detail in the PR description.
4. Wait for a maintainer to review your code.

Thank you for contributing!
