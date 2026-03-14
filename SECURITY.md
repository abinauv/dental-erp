# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in DentalERP, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email **[abinavselvam@gmail.com](mailto:abinavselvam@gmail.com)** with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

2. You will receive an acknowledgment within **48 hours**.

3. We will work with you to understand and resolve the issue before any public disclosure.

### What to Expect

- **Acknowledgment**: Within 48 hours of your report.
- **Status Update**: Within 5 business days with an assessment.
- **Resolution**: We aim to release a fix within 14 days for critical vulnerabilities.
- **Credit**: We will credit you in the release notes (unless you prefer to remain anonymous).

## Security Best Practices for Deployment

- **Never commit `.env` files** — use `.env.example` as a template
- **Generate strong secrets** for `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, and `CRON_SECRET`
- **Use HTTPS** in production (reverse proxy with nginx or Caddy)
- **Restrict database access** — don't expose MySQL to the public internet
- **Keep dependencies updated** — run `npm audit` regularly
- **Change default credentials** immediately after seeding the database
