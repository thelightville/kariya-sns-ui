-- Source-only K-SNS Cloud-auth transaction custody.
-- Application is separately gated; this migration is not applied by this PR.
CREATE TABLE ksns_auth_transactions (
  schema_version text NOT NULL CHECK (schema_version = 'ksns.auth-transaction.v1'),
  id uuid PRIMARY KEY,
  region text NOT NULL CHECK (region IN ('ng', 'ca')),
  state_digest varchar(43) NOT NULL UNIQUE
    CHECK (state_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  cloud_request_id_digest varchar(43)
    CHECK (cloud_request_id_digest IS NULL OR cloud_request_id_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  normalized_return_path varchar(512) NOT NULL,
  envelope jsonb,
  state text NOT NULL CHECK (
    state IN ('created', 'registered', 'callback_reserved', 'redeem_sent',
              'completed', 'terminal_failed', 'expired')
  ),
  state_version bigint NOT NULL CHECK (state_version > 0),
  cloud_issued_at bigint,
  cloud_expires_at bigint,
  reservation_id_digest varchar(43)
    CHECK (reservation_id_digest IS NULL OR reservation_id_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  reservation_expires_at bigint,
  terminal_at bigint,
  terminal_reason varchar(64),
  purge_after bigint,
  created_at bigint NOT NULL CHECK (created_at > 0),
  updated_at bigint NOT NULL CHECK (updated_at > 0),

  CONSTRAINT ksns_auth_cloud_time_complete CHECK (
    (cloud_request_id_digest IS NULL AND cloud_issued_at IS NULL AND cloud_expires_at IS NULL)
    OR
    (cloud_request_id_digest IS NOT NULL AND cloud_issued_at IS NOT NULL
      AND cloud_expires_at IS NOT NULL
      AND cloud_expires_at - cloud_issued_at = 300)
  ),
  CONSTRAINT ksns_auth_envelope_state CHECK (
    (state IN ('created', 'registered', 'callback_reserved') AND envelope IS NOT NULL)
    OR
    (state IN ('redeem_sent', 'completed', 'terminal_failed', 'expired') AND envelope IS NULL)
  ),
  CONSTRAINT ksns_auth_reservation_state CHECK (
    (state = 'callback_reserved' AND reservation_id_digest IS NOT NULL
      AND reservation_expires_at IS NOT NULL
      AND cloud_expires_at IS NOT NULL
      AND reservation_expires_at <= cloud_expires_at)
    OR
    (state <> 'callback_reserved' AND reservation_id_digest IS NULL
      AND reservation_expires_at IS NULL)
  ),
  CONSTRAINT ksns_auth_terminal_state CHECK (
    (state IN ('completed', 'terminal_failed', 'expired')
      AND terminal_at IS NOT NULL AND terminal_reason IS NOT NULL
      AND purge_after = terminal_at + 86400)
    OR
    (state NOT IN ('completed', 'terminal_failed', 'expired')
      AND terminal_at IS NULL AND terminal_reason IS NULL AND purge_after IS NULL)
  )
);

CREATE INDEX ksns_auth_transactions_terminal_cleanup_idx
  ON ksns_auth_transactions (purge_after)
  WHERE state IN ('completed', 'terminal_failed', 'expired');

CREATE INDEX ksns_auth_transactions_cloud_request_idx
  ON ksns_auth_transactions (cloud_request_id_digest)
  WHERE cloud_request_id_digest IS NOT NULL;

COMMENT ON TABLE ksns_auth_transactions IS
  'Regional K-SNS Cloud authorization transactions. Encrypted envelopes are cleared before redemption; terminal replay tombstones remain for 24 hours.';
