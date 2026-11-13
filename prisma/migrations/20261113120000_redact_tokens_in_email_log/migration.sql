-- Remove access tokens from the email log.
--
-- Staff invitations and signup email verifications were logged in full,
-- links included, and any signed-in staff member can read the clinic's email
-- log. Someone could open a pending invitation meant for a colleague (for
-- example a new admin) and create that account with a password of their own.
-- New emails are logged with the token removed; this does the same for the
-- ones already logged. Tokens are 32 letters and digits.

UPDATE `EmailLog`
SET `body` = REGEXP_REPLACE(
    `body`,
    '(/invite/accept\\?token=|/verify-email\\?token=)[A-Za-z0-9]+',
    '$1[removed]'
  )
WHERE `body` LIKE '%/invite/accept?token=%'
   OR `body` LIKE '%/verify-email?token=%';
