# Contributing to The Hive Shift Scheduler

Thanks for your interest in contributing to **The Hive Shift Scheduler**, the shift scheduling system for The Hive Makerspace at Georgia Tech!
We’re excited to have you help improve the project - whether you’re fixing bugs, improving documentation, or adding new features.

---

## 🧭 Getting Started

If you haven’t already, follow the setup steps in the [README.md](./README.md#setup).

We highly recommend using VS Code development containers (configuration included) to ensure a consistent and easy experience.

Make sure you can run both the client and server before contributing.

---

## 🌿 Branch Naming

We’re not strict about branch names, but try to keep them readable and descriptive.
Use one of the following patterns:

* `feature/<name>` — for new features (e.g. `feature/users-page`)
* `fix/<name>` — for bug fixes (e.g. `fix/schedule-timezone`)
* `chore/<name>` — for maintenance or cleanup (e.g. `chore/update-deps`)

---

## 🧹 Code Quality

Before committing, always run the checks:

```sh
pnpm check
```

This ensures formatting, type checks, and tests all pass.
If your code doesn’t pass these checks, please fix any issues before submitting your PR.

---

## 🧩 Submitting a Pull Request (PR)

1. **Create your branch** from `dev`.
2. **Make your changes** — try to keep commits focused and clear.
3. **Run checks** with `pnpm check`.
4. **Push your branch** and open a pull request into `dev`.

Your PR title should briefly describe the change.
Examples:

* `Add user details editor`
* `Fix shift overlap validation`
* `Refactor API schema utilities`

Please avoid duplicating existing work — check open PRs and issues before starting.

---

## 🧑‍⚖️ Code Review Process

We want everyone to feel comfortable contributing, so reviews are designed to be helpful — not intimidating.

### For All Contributors
* **Copilot reviews** will be in place for all submitted PRs. You don’t need to accept every suggestion, but please take the time to consider feedback and respond as needed.

### For Hive Contributors

* **Relaxed human reviews** will be in place for those who are regular attendees of the operations committee.
* **New features or major changes** that haven’t been discussed in operations committee may spark some conversation on the PR to ensure alignment.

### For External Contributors

* We love outside help!
  However, PRs from non-Hive members will go through a **full review** to ensure consistency and compatibility.

---

## 🗣️ Discussions & Communication

* Use GitHub Issues to suggest features or report bugs.
* Major architectural or UX changes should be discussed before coding, either:

  * in a Hive operations committee meeting, or
  * by opening a GitHub Discussion or Issue for visibility.

---

## 💡 Tips for a Smooth PR

* Keep changes focused — one feature or fix per PR.
* Write clear commit messages.
* Add or update documentation if needed.
* Ensure new code follows existing project style and conventions.
* Be kind and constructive in reviews. We’re all here to make The Hive better.

---

## 🐝 Thank You!

Your contributions help The Hive run smoother and make scheduling easier for everyone.
We appreciate your time, ideas, and collaboration!
